// Updated Forms Route with Database Tracking Integration
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const ocrService = require('../services/ocr/ocrService');
const aiAnalysisService = require('../services/ai/aiAnalysisService');
const trackingService = require('../services/database/trackingService');
const logger = require('../services/utils/logger');

const router = express.Router();

// Configure multer for memory storage (no disk writes)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Helper function to generate session token
function getOrCreateSessionToken(req) {
    return req.headers['x-session-token'] || 
           req.session?.token || 
           uuidv4();
}

// Helper function to extract device info from request
function extractDeviceInfo(req) {
    return {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        acceptLanguage: req.headers['accept-language'],
        origin: req.headers.origin,
        referer: req.headers.referer,
        timestamp: new Date().toISOString()
    };
}

// Helper function to extract location data if available
function extractLocationData(req) {
    const lat = req.headers['x-location-lat'] || req.body.latitude;
    const lng = req.headers['x-location-lng'] || req.body.longitude;
    
    if (lat && lng) {
        return {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            accuracy: req.headers['x-location-accuracy'] || req.body.accuracy,
            timestamp: new Date().toISOString()
        };
    }
    return null;
}

// RESTORED: Original /upload endpoint that your frontend expects
router.post('/upload', upload.single('file'), async (req, res) => {
    const startTime = Date.now();
    let sessionRecord = null;
    let formRecord = null;
    let structuredResult = null;
    
    try {
        logger.info('Starting form analysis (upload endpoint)');

        // 1. Get or create processing session
        const sessionToken = getOrCreateSessionToken(req);
        const deviceInfo = extractDeviceInfo(req);
        const locationData = extractLocationData(req);

        try {
            sessionRecord = await trackingService.createProcessingSession({
                sessionToken,
                userIdentifier: req.ip,
                deviceInfo,
                locationData
            });
            logger.info(`Created processing session: ${sessionRecord.id}`);
        } catch (error) {
            logger.warn('Could not create session record, continuing without tracking:', error.message);
        }

        // 2. Validate file upload
        if (!req.file) {
            const error = new Error('No file uploaded');
            if (sessionRecord) {
                await trackingService.logAuditEvent(null, sessionRecord.id, 'upload_failed', {
                    error: 'No file provided',
                    userAgent: req.headers['user-agent']
                });
            }
            return res.status(400).json({ 
                success: false,
                error: 'No file uploaded',
                sessionToken: sessionToken
            });
        }

        // 3. Create form processing record
        try {
            formRecord = await trackingService.createFormProcessingRecord({
                sessionId: sessionRecord?.id,
                originalFilename: req.file.originalname,
                fileSizeBytes: req.file.size,
                fileType: req.file.mimetype,
                imageDimensions: null
            });
            logger.info(`Created form processing record: ${formRecord.id}`);
        } catch (error) {
            logger.warn('Could not create form record, continuing without tracking:', error.message);
        }

        // 4. Extract text using OCR
        const ocrStartTime = Date.now();
        let ocrResult;
        
        try {
            logger.info("Starting OCR processing");
            ocrResult = await ocrService.extractText(req.file.buffer);

            // Normalize the result to match expected format
            ocrResult = {
                text: ocrResult.text,
                confidence: ocrResult.confidence,
                provider: ocrResult.provider || "tesseract",
                fallbackUsed: ocrResult.fallbackUsed || false,
                ...ocrResult,
            };

            // Update form record with OCR results
            if (formRecord) {
                await trackingService.updateFormProcessingOCR(formRecord.id, {
                    providerUsed: ocrResult.provider,
                    confidenceScore: ocrResult.confidence,
                    processingTimeMs: Date.now() - ocrStartTime,
                    extractedTextLength: ocrResult.text?.length || 0,
                    fallbackUsed: ocrResult.fallbackUsed || false,
                    extractedText: ocrResult.text,
                });
            }

            logger.info(`OCR completed with ${ocrResult.provider}, confidence: ${ocrResult.confidence}%`);
        } catch (error) {
            logger.error("OCR processing failed:", error);

            if (formRecord) {
                await trackingService.markFormProcessingError(formRecord.id, {
                    stage: "ocr",
                    error: error.message,
                    stack: error.stack,
                });
            }

            return res.status(500).json({
                success: false,
                error: "Failed to extract text from image",
                details: error.message,
                sessionToken: sessionToken,
                formId: formRecord?.id,
            });
        }

        // 5. Validate OCR results
        if (!ocrResult.text || ocrResult.text.trim().length < 10) {
            const error = 'Insufficient text extracted from image';
            logger.warn(error);
            
            if (formRecord) {
                await trackingService.markFormProcessingError(formRecord.id, {
                    stage: 'ocr_validation',
                    error: error,
                    extractedLength: ocrResult.text?.length || 0
                });
            }

            return res.status(400).json({
                success: false,
                error: error,
                extractedText: ocrResult.text,
                confidence: ocrResult.confidence,
                provider: ocrResult.provider,
                sessionToken: sessionToken,
                formId: formRecord?.id
            });
        }

        // 6. Perform AI analysis
        const aiStartTime = Date.now();
        let analysisResult;

        try {
            logger.info('Starting AI safety analysis');
            analysisResult = await aiAnalysisService.analyzeSafetyForm(ocrResult.text);

            // Process and structure the AI results
            structuredResult = processAIAnalysisResult(analysisResult, ocrResult);

            // Update form record with AI analysis results
            if (formRecord) {
                await trackingService.updateFormProcessingAI(formRecord.id, {
                    aiProvider: 'deepseek',
                    processingTimeMs: Date.now() - aiStartTime,
                    formTypeDetected: structuredResult.formType,
                    riskScore: structuredResult.riskAssessment.score,
                    riskLevel: structuredResult.riskAssessment.level,
                    riskEscalated: structuredResult.riskAssessment.escalated,
                    supervisorFlagged: structuredResult.riskAssessment.level === 'HIGH' || structuredResult.riskAssessment.level === 'CRITICAL',
                    australianStandardsReferenced: structuredResult.complianceCheck.standardsReferenced,
                    complianceGapsIdentified: structuredResult.safetyIssues?.length || 0,
                    analysisResult: analysisResult,
                    hazardsIdentified: structuredResult.safetyIssues || [],
                    recommendations: structuredResult.recommendations || []
                });
            }

            logger.info(`AI analysis completed: ${structuredResult.riskAssessment.level} risk (${structuredResult.riskAssessment.score}/10)`);
        } catch (error) {
            logger.error('AI analysis failed:', error);
            
            if (formRecord) {
                await trackingService.markFormProcessingError(formRecord.id, {
                    stage: 'ai_analysis',
                    error: error.message,
                    stack: error.stack
                });
            }

            return res.status(500).json({
                success: false,
                error: 'Failed to analyze safety form',
                details: error.message,
                ocrResult: {
                    text: ocrResult.text,
                    confidence: ocrResult.confidence,
                    provider: ocrResult.provider
                },
                sessionToken: sessionToken,
                formId: formRecord?.id
            });
        }

        // 7. Update session statistics
        if (sessionRecord) {
            try {
                await trackingService.updateProcessingSession(sessionRecord.id, {
                    totalFormsProcessed: 1,
                    totalProcessingTimeMs: Date.now() - startTime
                });
            } catch (error) {
                logger.warn('Could not update session statistics:', error.message);
            }
        }

        // 8. Return response in format your frontend expects
        const totalProcessingTime = Date.now() - startTime;
        const response = {
            success: true,
            message: 'Form processed successfully',
            fileId: formRecord?.id,
            sessionToken: sessionToken,
            result: {
                formType: structuredResult.formType,
                riskAssessment: structuredResult.riskAssessment,
                safetyIssues: structuredResult.safetyIssues,
                recommendations: structuredResult.recommendations,
                complianceCheck: structuredResult.complianceCheck,
                analysis: analysisResult
            },
            processingTime: totalProcessingTime,
            metadata: {
                filename: req.file.originalname,
                fileSize: req.file.size,
                processingTimestamp: new Date().toISOString()
            }
        };

        logger.info(`Form analysis completed successfully in ${totalProcessingTime}ms`);
        res.json(response);

    } catch (error) {
        logger.error('Unexpected error in form analysis:', error);
        
        if (formRecord) {
            try {
                await trackingService.markFormProcessingError(formRecord.id, {
                    stage: 'unexpected_error',
                    error: error.message,
                    stack: error.stack
                });
            } catch (dbError) {
                logger.error('Could not log error to database:', dbError);
            }
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error during form analysis',
            details: error.message,
            sessionToken: getOrCreateSessionToken(req),
            formId: formRecord?.id
        });
    }
});

// Add this to your forms.js routes (after your existing /upload endpoint)

// NEW: Analysis endpoint for interactive mode (returns data for confirmation)
router.post('/analyze', upload.single('file'), async (req, res) => {
    const startTime = Date.now();
    let sessionRecord = null;
    
    try {
        logger.info('Starting form analysis for interactive confirmation');

        // 1. Get or create processing session
        const sessionToken = getOrCreateSessionToken(req);
        const deviceInfo = extractDeviceInfo(req);
        const locationData = extractLocationData(req);

        try {
            sessionRecord = await trackingService.createProcessingSession({
                sessionToken,
                userIdentifier: req.ip,
                deviceInfo,
                locationData
            });
            logger.info(`Created processing session: ${sessionRecord.id}`);
        } catch (error) {
            logger.warn('Could not create session record, continuing without tracking:', error.message);
        }

        // 2. Validate file upload
        if (!req.file) {
            return res.status(400).json({ 
                error: 'No file uploaded',
                sessionToken: sessionToken
            });
        }

        // 3. Extract text using OCR
        const ocrStartTime = Date.now();
        let ocrResult;
        
        try {
            logger.info("Starting OCR processing for analysis");
            ocrResult = await ocrService.extractText(req.file.buffer);

            ocrResult = {
                text: ocrResult.text,
                confidence: ocrResult.confidence,
                provider: ocrResult.provider || "tesseract",
                fallbackUsed: ocrResult.fallbackUsed || false,
                ...ocrResult,
            };

            logger.info(`OCR completed with ${ocrResult.provider}, confidence: ${ocrResult.confidence}%`);
        } catch (error) {
            logger.error("OCR processing failed:", error);
            return res.status(500).json({
                error: "Failed to extract text from image",
                details: error.message,
                sessionToken: sessionToken,
            });
        }

        // 4. Validate OCR results
        if (!ocrResult.text || ocrResult.text.trim().length < 10) {
            return res.status(400).json({
                error: 'Insufficient text extracted from image',
                extractedText: ocrResult.text,
                confidence: ocrResult.confidence,
                provider: ocrResult.provider,
                sessionToken: sessionToken,
                suggestion: "Please ensure the image is clear and contains readable text"
            });
        }

        // 5. Perform AI analysis
        const aiStartTime = Date.now();
        let analysisResult;

        try {
            logger.info('Starting AI safety analysis for interactive mode');
            analysisResult = await aiAnalysisService.analyzeSafetyForm(ocrResult.text);

            logger.info(`AI analysis completed: ${analysisResult.formType} - ${analysisResult.riskLevel} risk (${analysisResult.riskScore}/10)`);
        } catch (error) {
            logger.error('AI analysis failed:', error);
            
            return res.status(500).json({
                error: 'Failed to analyze safety form',
                details: error.message,
                ocrResult: {
                    text: ocrResult.text,
                    confidence: ocrResult.confidence,
                    provider: ocrResult.provider
                },
                sessionToken: sessionToken
            });
        }

        // 6. Prepare response for user confirmation (DON'T save to database yet)
        const totalProcessingTime = Date.now() - startTime;
        const response = {
            success: true,
            status: 'awaiting_confirmation',
            sessionToken: sessionToken,
            sessionId: sessionRecord?.id,
            processing: {
                totalTimeMs: totalProcessingTime,
                ocrTimeMs: Date.now() - ocrStartTime - (Date.now() - aiStartTime),
                aiTimeMs: Date.now() - aiStartTime
            },
            ocr: {
                provider: ocrResult.provider,
                confidence: ocrResult.confidence,
                textLength: ocrResult.text.length,
                fallbackUsed: ocrResult.fallbackUsed,
                extractedText: ocrResult.text.substring(0, 500) + (ocrResult.text.length > 500 ? '...' : '') // Preview only
            },
            analysis: {
                formType: analysisResult.formType || 'UNKNOWN',
                formTypeConfidence: 'HIGH', // You could enhance this based on AI confidence
                riskScore: analysisResult.riskScore || 5,
                riskLevel: analysisResult.riskLevel || 'MEDIUM',
                flaggedIssues: analysisResult.flaggedIssues || [],
                ppeRequired: [], // Add if your AI provides this
                complianceIssues: analysisResult.complianceIssues || [],
                summary: analysisResult.summary || 'Safety analysis completed',
                requiresSupervisorReview: analysisResult.requiresSupervisorReview || false,
                formCompleteness: analysisResult.formCompleteness || 'UNKNOWN',
                missingFields: analysisResult.missingFields || [],
                positiveFindings: analysisResult.positiveFindings || [],
                workLocation: 'Not specified', // User can edit this
                workActivity: 'Not specified', // User can edit this
                workerDetails: {
                    signaturesPresent: false, // You could detect this
                    supervisorApproval: false,
                    dateCompleted: null
                },
                emergencyProcedures: {
                    mentioned: false,
                    details: []
                }
            },
            fileInfo: {
                originalFilename: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                uploadTimestamp: new Date().toISOString()
            },
            confirmationRequired: true,
            tempData: {
                extractedText: ocrResult.text,
                ocrResult: ocrResult,
                originalAnalysis: analysisResult
            },
            message: "Please review and confirm the analysis before saving"
        };

        logger.info(`Form analysis completed for confirmation in ${totalProcessingTime}ms`);
        res.json(response);

    } catch (error) {
        logger.error('Unexpected error in interactive form analysis:', error);
        
        res.status(500).json({
            error: 'Internal server error during form analysis',
            details: error.message,
            sessionToken: getOrCreateSessionToken(req)
        });
    }
});

// NEW: Confirmation endpoint (saves to database after user confirms)
router.post('/confirm', async (req, res) => {
    const startTime = Date.now();
    let formRecord = null;
    
    try {
        const { 
            sessionToken, 
            sessionId, 
            confirmedAnalysis, 
            tempData, 
            fileInfo,
            userCorrections = {}
        } = req.body;

        logger.info('Processing form confirmation and saving to database', {
            sessionToken,
            sessionId,
            hasCorrections: Object.keys(userCorrections).length > 0
        });

        // Validate required data
        if (!sessionToken || !confirmedAnalysis || !tempData) {
            return res.status(400).json({
                error: 'Missing required confirmation data',
                required: ['sessionToken', 'confirmedAnalysis', 'tempData']
            });
        }

        // Create form processing record
        try {
            formRecord = await trackingService.createFormProcessingRecord({
                sessionId: sessionId,
                originalFilename: fileInfo.originalFilename,
                fileSizeBytes: fileInfo.fileSize,
                fileType: fileInfo.mimeType,
                imageDimensions: null
            });
            logger.info(`Created form processing record: ${formRecord.id}`);
        } catch (error) {
            logger.error('Could not create form record:', error);
            return res.status(500).json({
                error: 'Failed to create form record',
                details: error.message
            });
        }

        // Update form record with OCR results
        const ocrResult = tempData.ocrResult;
        await trackingService.updateFormProcessingOCR(formRecord.id, {
            providerUsed: ocrResult.provider,
            confidenceScore: ocrResult.confidence,
            processingTimeMs: 0, // We don't have this from temp data
            extractedTextLength: ocrResult.text?.length || 0,
            fallbackUsed: ocrResult.fallbackUsed || false,
            extractedText: tempData.extractedText,
        });

        // Update form record with AI analysis results (including user corrections)
        await trackingService.updateFormProcessingAI(formRecord.id, {
            aiProvider: 'deepseek',
            processingTimeMs: 0,
            formTypeDetected: confirmedAnalysis.formType,
            riskScore: confirmedAnalysis.riskScore,
            riskLevel: confirmedAnalysis.riskLevel,
            riskEscalated: confirmedAnalysis.requiresSupervisorReview,
            supervisorFlagged: confirmedAnalysis.riskLevel === 'HIGH' || confirmedAnalysis.riskLevel === 'CRITICAL',
            australianStandardsReferenced: confirmedAnalysis.complianceIssues?.map(issue => issue.standard) || [],
            complianceGapsIdentified: confirmedAnalysis.complianceIssues?.length || 0,
            analysisResult: {
                ...confirmedAnalysis,
                userCorrections,
                confirmationTimestamp: new Date().toISOString()
            },
            hazardsIdentified: confirmedAnalysis.flaggedIssues || [],
            recommendations: confirmedAnalysis.flaggedIssues?.map(issue => issue.recommendation).filter(Boolean) || []
        });

        // Log audit event for user confirmation
        await trackingService.logAuditEvent(formRecord.id, sessionId, 'form_confirmed', {
            userCorrections,
            finalFormType: confirmedAnalysis.formType,
            finalRiskScore: confirmedAnalysis.riskScore,
            supervisorReviewRequired: confirmedAnalysis.requiresSupervisorReview,
            confirmationTimestamp: new Date().toISOString()
        });

        // Prepare final response
        const response = {
            success: true,
            status: 'confirmed_and_saved',
            formId: formRecord.id,
            sessionToken: sessionToken,
            processing: {
                confirmationTimeMs: Date.now() - startTime
            },
            analysis: {
                formType: confirmedAnalysis.formType,
                riskScore: confirmedAnalysis.riskScore,
                riskLevel: confirmedAnalysis.riskLevel,
                requiresSupervisorReview: confirmedAnalysis.requiresSupervisorReview,
                issueCount: confirmedAnalysis.flaggedIssues?.length || 0,
                complianceIssueCount: confirmedAnalysis.complianceIssues?.length || 0
            },
            metadata: {
                savedAt: new Date().toISOString(),
                userCorrections: Object.keys(userCorrections).length > 0,
                correctionFields: Object.keys(userCorrections)
            }
        };

        logger.info(`Form confirmation completed and saved in ${Date.now() - startTime}ms`, {
            formId: formRecord.id,
            formType: confirmedAnalysis.formType,
            riskLevel: confirmedAnalysis.riskLevel
        });

        res.json(response);

    } catch (error) {
        logger.error('Unexpected error in form confirmation:', error);
        
        if (formRecord) {
            try {
                await trackingService.markFormProcessingError(formRecord.id, {
                    stage: 'confirmation_error',
                    error: error.message,
                    stack: error.stack
                });
            } catch (dbError) {
                logger.error('Could not log error to database:', dbError);
            }
        }

        res.status(500).json({
            error: 'Internal server error during form confirmation',
            details: error.message,
            formId: formRecord?.id
        });
    }
});

// Helper function to process and structure AI analysis results
function processAIAnalysisResult(rawAnalysis, ocrResult) {
    try {
        // Use the raw analysis directly since it's already structured
        const analysis = rawAnalysis;
        
        // Map to your frontend's expected format
        const structured = {
            formType: analysis.formType || 'UNKNOWN',
            riskAssessment: {
                score: analysis.riskScore || 5,
                level: analysis.riskLevel || 'MEDIUM',
                escalated: false,
                reasoning: analysis.summary || 'Risk assessment completed'
            },
            safetyIssues: analysis.flaggedIssues || [],
            recommendations: analysis.flaggedIssues?.map(issue => issue.recommendation).filter(Boolean) || [],
            complianceCheck: {
                status: analysis.complianceIssues?.length > 0 ? 'ISSUES_FOUND' : 'COMPLIANT',
                standardsReferenced: analysis.complianceIssues?.map(issue => issue.standard) || [],
                gaps: analysis.complianceIssues || []
            }
        };

        // Apply risk escalation logic for incomplete forms
        if (ocrResult.text.length < 200 && structured.riskAssessment.score < 8) {
            structured.riskAssessment.score = Math.min(10, structured.riskAssessment.score + 2);
            structured.riskAssessment.level = structured.riskAssessment.score >= 8 ? 'HIGH' : 'MEDIUM';
            structured.riskAssessment.escalated = true;
            structured.riskAssessment.reasoning += ' (Escalated due to incomplete form data)';
        }

        return structured;
    } catch (error) {
        logger.error('Error processing AI analysis result:', error);
        return {
            formType: 'UNKNOWN',
            riskAssessment: {
                score: 8,
                level: 'HIGH',
                escalated: true,
                reasoning: 'Error processing analysis - escalated for manual review'
            },
            safetyIssues: [],
            recommendations: ['Manual review required due to processing error'],
            complianceCheck: {
                status: 'REQUIRES_REVIEW',
                standardsReferenced: [],
                gaps: ['Analysis processing error']
            }
        };
    }
}

// Keep all your existing endpoints
router.get('/session/:sessionToken', async (req, res) => {
    try {
        const { sessionToken } = req.params;
        const forms = await trackingService.getSessionForms(sessionToken);
        
        res.json({
            success: true,
            sessionToken,
            forms: forms.map(form => ({
                id: form.id,
                filename: form.original_filename,
                status: form.processing_status,
                riskLevel: form.risk_level,
                riskScore: form.risk_score,
                formType: form.form_type_detected,
                processedAt: form.created_at,
                processingTimeMs: form.total_processing_time_ms
            }))
        });
    } catch (error) {
        logger.error('Error fetching session forms:', error);
        res.status(500).json({
            error: 'Failed to fetch session history',
            details: error.message
        });
    }
});

router.get('/form/:formId', async (req, res) => {
    try {
        const { formId } = req.params;
        const form = await trackingService.getFormById(formId);
        
        if (!form) {
            return res.status(404).json({
                error: 'Form not found',
                formId
            });
        }

        res.json({
            success: true,
            form: {
                id: form.id,
                filename: form.original_filename,
                status: form.processing_status,
                processing: {
                    totalTimeMs: form.total_processing_time_ms,
                    ocrProvider: form.ocr_provider_used,
                    ocrConfidence: form.ocr_confidence_score,
                    aiProvider: form.ai_provider
                },
                analysis: {
                    formType: form.form_type_detected,
                    riskScore: form.risk_score,
                    riskLevel: form.risk_level,
                    riskEscalated: form.risk_escalated,
                    supervisorFlagged: form.supervisor_flagged,
                    complianceGaps: form.compliance_gaps_identified,
                    standardsReferenced: form.australian_standards_referenced
                },
                results: {
                    extractedText: form.extracted_text,
                    aiAnalysis: form.ai_analysis_result,
                    hazards: form.hazards,
                    recommendations: form.recommendations
                },
                metadata: {
                    createdAt: form.created_at,
                    updatedAt: form.updated_at,
                    sessionToken: form.session_token
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching form details:', error);
        res.status(500).json({
            error: 'Failed to fetch form details',
            details: error.message
        });
    }
});

router.get('/analytics/summary', async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24 hours';
        const summary = await trackingService.getProcessingSummary(timeRange);
        
        res.json({
            success: true,
            timeRange,
            summary: {
                totalForms: parseInt(summary.total_forms) || 0,
                completedForms: parseInt(summary.completed_forms) || 0,
                failedForms: parseInt(summary.failed_forms) || 0,
                highRiskForms: parseInt(summary.high_risk_forms) || 0,
                averageRiskScore: parseFloat(summary.average_risk_score) || 0,
                averageProcessingTime: parseInt(summary.average_processing_time) || 0,
                uniqueSessions: parseInt(summary.unique_sessions) || 0,
                formTypesProcessed: summary.form_types_processed?.split(', ').filter(Boolean) || []
            }
        });
    } catch (error) {
        logger.error('Error fetching analytics summary:', error);
        res.status(500).json({
            error: 'Failed to fetch analytics summary',
            details: error.message
        });
    }
});

router.get('/analytics/hazards', async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '7 days';
        const trends = await trackingService.getHazardTrends(timeRange);
        
        res.json({
            success: true,
            timeRange,
            hazardTrends: trends.map(trend => ({
                type: trend.hazard_type,
                category: trend.hazard_category,
                count: parseInt(trend.occurrence_count),
                averageSeverity: parseFloat(trend.average_severity),
                standardsViolated: trend.standards_violated?.split(', ').filter(Boolean) || []
            }))
        });
    } catch (error) {
        logger.error('Error fetching hazard trends:', error);
        res.status(500).json({
            error: 'Failed to fetch hazard trends',
            details: error.message
        });
    }
});

router.get('/health', async (req, res) => {
    try {
        const health = await trackingService.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/analytics/recent', async (req, res) => {
    try {
        const forms = await trackingService.getRecentForms(50); // Get last 50
        res.json({
            success: true,
            forms: forms.map(form => ({
                id: form.id,
                filename: form.original_filename,
                formType: form.form_type_detected,
                riskLevel: form.risk_level,
                riskScore: form.risk_score,
                hazardCount: form.hazards?.length || 0,
                processedAt: form.created_at,
                status: form.processing_status
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint to your forms.js route file
router.get('/analytics/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const recentForms = await db.query(`
            SELECT 
                fp.id,
                fp.form_type,
                fp.risk_score,
                fp.risk_level,
                fp.processing_status,
                fp.created_at,
                ps.session_id,
                COUNT(fh.id) as hazard_count
            FROM forms_processing fp
            LEFT JOIN processing_sessions ps ON fp.session_id = ps.id
            LEFT JOIN form_hazards fh ON fp.id = fh.form_id
            WHERE fp.processing_status IN ('CONFIRMED', 'PROCESSED')
            GROUP BY fp.id, ps.session_id
            ORDER BY fp.created_at DESC
            LIMIT $1
        `, [limit]);
        
        res.json({
            success: true,
            data: recentForms.rows,
            count: recentForms.rows.length
        });
        
    } catch (error) {
        logger.error('Recent analytics query failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent analytics'
        });
    }
});

module.exports = router;

// // backend/src/routes/forms.js - Enhanced with Confirmation Step
// const express = require('express');
// const multer = require('multer');
// const { v4: uuidv4 } = require('uuid');
// const ocrService = require('../services/ocr/ocrService');
// const aiAnalysisService = require('../services/ai/aiAnalysisService');
// const trackingService = require('../services/database/trackingService');
// const logger = require('../services/utils/logger');

// const router = express.Router();

// // Configure multer for memory storage (no disk writes)
// const upload = multer({
//     storage: multer.memoryStorage(),
//     limits: {
//         fileSize: 10 * 1024 * 1024, // 10MB limit
//     },
//     fileFilter: (req, file, cb) => {
//         if (file.mimetype.startsWith('image/')) {
//             cb(null, true);
//         } else {
//             cb(new Error('Only image files are allowed'), false);
//         }
//     }
// });

// // Helper function to generate session token
// function getOrCreateSessionToken(req) {
//     return req.headers['x-session-token'] || 
//            req.session?.token || 
//            uuidv4();
// }

// // Helper function to extract device info from request
// function extractDeviceInfo(req) {
//     return {
//         userAgent: req.headers['user-agent'],
//         ip: req.ip,
//         acceptLanguage: req.headers['accept-language'],
//         origin: req.headers.origin,
//         referer: req.headers.referer,
//         timestamp: new Date().toISOString()
//     };
// }

// // Helper function to extract location data if available
// function extractLocationData(req) {
//     const lat = req.headers['x-location-lat'] || req.body.latitude;
//     const lng = req.headers['x-location-lng'] || req.body.longitude;
    
//     if (lat && lng) {
//         return {
//             latitude: parseFloat(lat),
//             longitude: parseFloat(lng),
//             accuracy: req.headers['x-location-accuracy'] || req.body.accuracy,
//             timestamp: new Date().toISOString()
//         };
//     }
//     return null;
// }

// // Step 1: Analyze form (returns analysis for user confirmation)
// router.post('/analyze', upload.single('file'), async (req, res) => {
//     const startTime = Date.now();
//     let sessionRecord = null;
    
//     try {
//         logger.info('Starting form analysis for user confirmation');

//         // 1. Get or create processing session
//         const sessionToken = getOrCreateSessionToken(req);
//         const deviceInfo = extractDeviceInfo(req);
//         const locationData = extractLocationData(req);

//         try {
//             sessionRecord = await trackingService.createProcessingSession({
//                 sessionToken,
//                 userIdentifier: req.ip,
//                 deviceInfo,
//                 locationData
//             });
//             logger.info(`Created processing session: ${sessionRecord.id}`);
//         } catch (error) {
//             logger.warn('Could not create session record, continuing without tracking:', error.message);
//         }

//         // 2. Validate file upload
//         if (!req.file) {
//             const error = new Error('No file uploaded');
//             if (sessionRecord) {
//                 await trackingService.logAuditEvent(null, sessionRecord.id, 'upload_failed', {
//                     error: 'No file provided',
//                     userAgent: req.headers['user-agent']
//                 });
//             }
//             return res.status(400).json({ 
//                 error: 'No file uploaded',
//                 sessionToken: sessionToken
//             });
//         }

//         // 3. Extract text using OCR
//         const ocrStartTime = Date.now();
//         let ocrResult;
        
//         try {
//             logger.info("Starting OCR processing for analysis");
//             ocrResult = await ocrService.extractText(req.file.buffer);

//             // Normalize the result
//             ocrResult = {
//                 text: ocrResult.text,
//                 confidence: ocrResult.confidence,
//                 provider: ocrResult.provider || "tesseract",
//                 fallbackUsed: ocrResult.fallbackUsed || false,
//                 ...ocrResult,
//             };

//             logger.info(`OCR completed with ${ocrResult.provider}, confidence: ${ocrResult.confidence}%`);
//         } catch (error) {
//             logger.error("OCR processing failed:", error);
//             return res.status(500).json({
//                 error: "Failed to extract text from image",
//                 details: error.message,
//                 sessionToken: sessionToken,
//             });
//         }

//         // 4. Validate OCR results
//         if (!ocrResult.text || ocrResult.text.trim().length < 10) {
//             const error = 'Insufficient text extracted from image';
//             logger.warn(error);
            
//             return res.status(400).json({
//                 error: error,
//                 extractedText: ocrResult.text,
//                 confidence: ocrResult.confidence,
//                 provider: ocrResult.provider,
//                 sessionToken: sessionToken,
//                 suggestion: "Please ensure the image is clear and contains readable text"
//             });
//         }

//         // 5. Perform AI analysis
//         const aiStartTime = Date.now();
//         let analysisResult;

//         try {
//             logger.info('Starting enhanced AI safety analysis');
//             analysisResult = await aiAnalysisService.analyzeSafetyForm(ocrResult.text);

//             logger.info(`AI analysis completed: ${analysisResult.formType} (${analysisResult.formTypeConfidence}) - ${analysisResult.riskLevel} risk (${analysisResult.riskScore}/10)`);
//         } catch (error) {
//             logger.error('AI analysis failed:', error);
            
//             return res.status(500).json({
//                 error: 'Failed to analyze safety form',
//                 details: error.message,
//                 ocrResult: {
//                     text: ocrResult.text,
//                     confidence: ocrResult.confidence,
//                     provider: ocrResult.provider
//                 },
//                 sessionToken: sessionToken
//             });
//         }

//         // 6. Prepare response for user confirmation
//         const totalProcessingTime = Date.now() - startTime;
//         const response = {
//             success: true,
//             status: 'awaiting_confirmation',
//             sessionToken: sessionToken,
//             sessionId: sessionRecord?.id,
//             processing: {
//                 totalTimeMs: totalProcessingTime,
//                 ocrTimeMs: Date.now() - ocrStartTime - (Date.now() - aiStartTime),
//                 aiTimeMs: Date.now() - aiStartTime
//             },
//             ocr: {
//                 provider: ocrResult.provider,
//                 confidence: ocrResult.confidence,
//                 textLength: ocrResult.text.length,
//                 fallbackUsed: ocrResult.fallbackUsed,
//                 extractedText: ocrResult.text.substring(0, 500) + (ocrResult.text.length > 500 ? '...' : '') // Preview only
//             },
//             analysis: analysisResult,
//             fileInfo: {
//                 originalFilename: req.file.originalname,
//                 fileSize: req.file.size,
//                 mimeType: req.file.mimetype,
//                 uploadTimestamp: new Date().toISOString()
//             },
//             confirmationRequired: true,
//             message: "Please review and confirm the analysis before saving"
//         };

//         // Store temporary analysis data in session or cache for confirmation
//         // For now, we'll include it in the response and expect it back on confirmation
//         response.tempData = {
//             extractedText: ocrResult.text,
//             ocrResult: ocrResult,
//             fileBuffer: req.file.buffer.toString('base64'), // For reprocessing if needed
//             originalAnalysis: analysisResult
//         };

//         logger.info(`Form analysis completed for confirmation in ${totalProcessingTime}ms`);
//         res.json(response);

//     } catch (error) {
//         logger.error('Unexpected error in form analysis:', error);
        
//         res.status(500).json({
//             error: 'Internal server error during form analysis',
//             details: error.message,
//             sessionToken: getOrCreateSessionToken(req)
//         });
//     }
// });

// // Step 2: Confirm and save analysis to database
// router.post('/confirm', async (req, res) => {
//     const startTime = Date.now();
//     let formRecord = null;
    
//     try {
//         const { 
//             sessionToken, 
//             sessionId, 
//             confirmedAnalysis, 
//             tempData, 
//             fileInfo,
//             userCorrections = {}
//         } = req.body;

//         logger.info('Processing form confirmation and saving to database', {
//             sessionToken,
//             sessionId,
//             hasCorrections: Object.keys(userCorrections).length > 0
//         });

//         // Validate required data
//         if (!sessionToken || !confirmedAnalysis || !tempData) {
//             return res.status(400).json({
//                 error: 'Missing required confirmation data',
//                 required: ['sessionToken', 'confirmedAnalysis', 'tempData']
//             });
//         }

//         // Create form processing record
//         try {
//             formRecord = await trackingService.createFormProcessingRecord({
//                 sessionId: sessionId,
//                 originalFilename: fileInfo.originalFilename,
//                 fileSizeBytes: fileInfo.fileSize,
//                 fileType: fileInfo.mimeType,
//                 imageDimensions: null
//             });
//             logger.info(`Created form processing record: ${formRecord.id}`);
//         } catch (error) {
//             logger.error('Could not create form record:', error);
//             return res.status(500).json({
//                 error: 'Failed to create form record',
//                 details: error.message
//             });
//         }

//         // Update form record with OCR results
//         const ocrResult = tempData.ocrResult;
//         await trackingService.updateFormProcessingOCR(formRecord.id, {
//             providerUsed: ocrResult.provider,
//             confidenceScore: ocrResult.confidence,
//             processingTimeMs: 0, // We don't have this from temp data
//             extractedTextLength: ocrResult.text?.length || 0,
//             fallbackUsed: ocrResult.fallbackUsed || false,
//             extractedText: tempData.extractedText,
//         });

//         // Update form record with AI analysis results (including user corrections)
//         await trackingService.updateFormProcessingAI(formRecord.id, {
//             aiProvider: 'deepseek',
//             processingTimeMs: 0, // We don't have this from temp data
//             formTypeDetected: confirmedAnalysis.formType,
//             riskScore: confirmedAnalysis.riskScore,
//             riskLevel: confirmedAnalysis.riskLevel,
//             riskEscalated: confirmedAnalysis.requiresSupervisorReview,
//             supervisorFlagged: confirmedAnalysis.riskLevel === 'HIGH' || confirmedAnalysis.riskLevel === 'CRITICAL',
//             australianStandardsReferenced: confirmedAnalysis.complianceIssues?.map(issue => issue.standard) || [],
//             complianceGapsIdentified: confirmedAnalysis.complianceIssues?.length || 0,
//             analysisResult: {
//                 ...confirmedAnalysis,
//                 userCorrections,
//                 confirmationTimestamp: new Date().toISOString()
//             },
//             hazardsIdentified: confirmedAnalysis.flaggedIssues || [],
//             recommendations: extractRecommendations(confirmedAnalysis)
//         });

//         // Log audit event for user confirmation
//         await trackingService.logAuditEvent(formRecord.id, sessionId, 'form_confirmed', {
//             userCorrections,
//             finalFormType: confirmedAnalysis.formType,
//             finalRiskScore: confirmedAnalysis.riskScore,
//             supervisorReviewRequired: confirmedAnalysis.requiresSupervisorReview,
//             confirmationTimestamp: new Date().toISOString()
//         });

//         // Update session statistics
//         if (sessionId) {
//             try {
//                 await trackingService.updateProcessingSession(sessionId, {
//                     totalFormsProcessed: 1,
//                     totalProcessingTimeMs: Date.now() - startTime
//                 });
//             } catch (error) {
//                 logger.warn('Could not update session statistics:', error.message);
//             }
//         }

//         // Prepare final response
//         const response = {
//             success: true,
//             status: 'confirmed_and_saved',
//             formId: formRecord.id,
//             sessionToken: sessionToken,
//             processing: {
//                 confirmationTimeMs: Date.now() - startTime
//             },
//             analysis: {
//                 formType: confirmedAnalysis.formType,
//                 riskScore: confirmedAnalysis.riskScore,
//                 riskLevel: confirmedAnalysis.riskLevel,
//                 requiresSupervisorReview: confirmedAnalysis.requiresSupervisorReview,
//                 issueCount: confirmedAnalysis.flaggedIssues?.length || 0,
//                 complianceIssueCount: confirmedAnalysis.complianceIssues?.length || 0
//             },
//             metadata: {
//                 savedAt: new Date().toISOString(),
//                 userCorrections: Object.keys(userCorrections).length > 0,
//                 correctionFields: Object.keys(userCorrections)
//             },
//             nextSteps: generateNextSteps(confirmedAnalysis)
//         };

//         logger.info(`Form confirmation completed and saved in ${Date.now() - startTime}ms`, {
//             formId: formRecord.id,
//             formType: confirmedAnalysis.formType,
//             riskLevel: confirmedAnalysis.riskLevel,
//             supervisorReview: confirmedAnalysis.requiresSupervisorReview
//         });

//         res.json(response);

//     } catch (error) {
//         logger.error('Unexpected error in form confirmation:', error);
        
//         // Log error to database if possible
//         if (formRecord) {
//             try {
//                 await trackingService.markFormProcessingError(formRecord.id, {
//                     stage: 'confirmation_error',
//                     error: error.message,
//                     stack: error.stack
//                 });
//             } catch (dbError) {
//                 logger.error('Could not log error to database:', dbError);
//             }
//         }

//         res.status(500).json({
//             error: 'Internal server error during form confirmation',
//             details: error.message,
//             formId: formRecord?.id
//         });
//     }
// });

// // Helper function to extract recommendations from analysis
// function extractRecommendations(analysis) {
//     const recommendations = [];
    
//     // Add recommendations from flagged issues
//     if (analysis.flaggedIssues) {
//         recommendations.push(...analysis.flaggedIssues.map(issue => issue.recommendation));
//     }
    
//     // Add recommendations from compliance issues
//     if (analysis.complianceIssues) {
//         recommendations.push(...analysis.complianceIssues.map(issue => issue.action));
//     }
    
//     // Add general recommendations based on risk level
//     if (analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL') {
//         recommendations.push('Immediate supervisor review required before work commences');
//     }
    
//     if (analysis.formCompleteness === 'INCOMPLETE') {
//         recommendations.push('Complete all missing form fields before proceeding');
//     }
    
//     return recommendations.filter(Boolean); // Remove empty recommendations
// }

// // Helper function to generate next steps based on analysis
// function generateNextSteps(analysis) {
//     const steps = [];
    
//     if (analysis.requiresSupervisorReview) {
//         steps.push({
//             action: 'supervisor_review',
//             priority: 'HIGH',
//             description: 'Send form to supervisor for review and approval',
//             required: true
//         });
//     }
    
//     if (analysis.formCompleteness === 'INCOMPLETE') {
//         steps.push({
//             action: 'complete_form',
//             priority: 'HIGH',
//             description: 'Complete missing form fields: ' + (analysis.missingFields?.join(', ') || 'various fields'),
//             required: true
//         });
//     }
    
//     if (analysis.flaggedIssues?.some(issue => issue.severity === 'CRITICAL')) {
//         steps.push({
//             action: 'address_critical_issues',
//             priority: 'CRITICAL',
//             description: 'Address all critical safety issues before work begins',
//             required: true
//         });
//     }
    
//     if (analysis.ppeRequired?.length > 0) {
//         steps.push({
//             action: 'verify_ppe',
//             priority: 'MEDIUM',
//             description: `Ensure all required PPE is available: ${analysis.ppeRequired.map(ppe => ppe.type).join(', ')}`,
//             required: true
//         });
//     }
    
//     steps.push({
//         action: 'proceed_with_work',
//         priority: 'LOW',
//         description: 'Work may proceed once all above steps are completed',
//         required: false
//     });
    
//     return steps;
// }

// // Existing endpoints (analytics, health, etc.) remain the same...
// // [Include all your existing endpoint code here]

// // Get form processing history for a session
// router.get('/session/:sessionToken', async (req, res) => {
//     try {
//         const { sessionToken } = req.params;
//         const forms = await trackingService.getSessionForms(sessionToken);
        
//         res.json({
//             success: true,
//             sessionToken,
//             forms: forms.map(form => ({
//                 id: form.id,
//                 filename: form.original_filename,
//                 status: form.processing_status,
//                 riskLevel: form.risk_level,
//                 riskScore: form.risk_score,
//                 formType: form.form_type_detected,
//                 processedAt: form.created_at,
//                 processingTimeMs: form.total_processing_time_ms,
//                 requiresSupervisorReview: form.supervisor_flagged
//             }))
//         });
//     } catch (error) {
//         logger.error('Error fetching session forms:', error);
//         res.status(500).json({
//             error: 'Failed to fetch session history',
//             details: error.message
//         });
//     }
// });

// // Get detailed form analysis results
// router.get('/form/:formId', async (req, res) => {
//     try {
//         const { formId } = req.params;
//         const form = await trackingService.getFormById(formId);
        
//         if (!form) {
//             return res.status(404).json({
//                 error: 'Form not found',
//                 formId
//             });
//         }

//         res.json({
//             success: true,
//             form: {
//                 id: form.id,
//                 filename: form.original_filename,
//                 status: form.processing_status,
//                 processing: {
//                     totalTimeMs: form.total_processing_time_ms,
//                     ocrProvider: form.ocr_provider_used,
//                     ocrConfidence: form.ocr_confidence_score,
//                     aiProvider: form.ai_provider
//                 },
//                 analysis: {
//                     formType: form.form_type_detected,
//                     riskScore: form.risk_score,
//                     riskLevel: form.risk_level,
//                     riskEscalated: form.risk_escalated,
//                     supervisorFlagged: form.supervisor_flagged,
//                     complianceGaps: form.compliance_gaps_identified,
//                     standardsReferenced: form.australian_standards_referenced
//                 },
//                 results: {
//                     extractedText: form.extracted_text,
//                     aiAnalysis: form.ai_analysis_result,
//                     hazards: form.hazards,
//                     recommendations: form.recommendations
//                 },
//                 metadata: {
//                     createdAt: form.created_at,
//                     updatedAt: form.updated_at,
//                     sessionToken: form.session_token
//                 }
//             }
//         });
//     } catch (error) {
//         logger.error('Error fetching form details:', error);
//         res.status(500).json({
//             error: 'Failed to fetch form details',
//             details: error.message
//         });
//     }
// });

// // Analytics endpoint for processing summary
// router.get('/analytics/summary', async (req, res) => {
//     try {
//         const timeRange = req.query.timeRange || '24 hours';
//         const summary = await trackingService.getProcessingSummary(timeRange);
        
//         res.json({
//             success: true,
//             timeRange,
//             summary: {
//                 totalForms: parseInt(summary.total_forms) || 0,
//                 completedForms: parseInt(summary.completed_forms) || 0,
//                 failedForms: parseInt(summary.failed_forms) || 0,
//                 highRiskForms: parseInt(summary.high_risk_forms) || 0,
//                 averageRiskScore: parseFloat(summary.average_risk_score) || 0,
//                 averageProcessingTime: parseInt(summary.average_processing_time) || 0,
//                 uniqueSessions: parseInt(summary.unique_sessions) || 0,
//                 formTypesProcessed: summary.form_types_processed?.split(', ').filter(Boolean) || []
//             }
//         });
//     } catch (error) {
//         logger.error('Error fetching analytics summary:', error);
//         res.status(500).json({
//             error: 'Failed to fetch analytics summary',
//             details: error.message
//         });
//     }
// });

// // Hazard trends endpoint
// router.get('/analytics/hazards', async (req, res) => {
//     try {
//         const timeRange = req.query.timeRange || '7 days';
//         const trends = await trackingService.getHazardTrends(timeRange);
        
//         res.json({
//             success: true,
//             timeRange,
//             hazardTrends: trends.map(trend => ({
//                 type: trend.hazard_type,
//                 category: trend.hazard_category,
//                 count: parseInt(trend.occurrence_count),
//                 averageSeverity: parseFloat(trend.average_severity),
//                 standardsViolated: trend.standards_violated?.split(', ').filter(Boolean) || []
//             }))
//         });
//     } catch (error) {
//         logger.error('Error fetching hazard trends:', error);
//         res.status(500).json({
//             error: 'Failed to fetch hazard trends',
//             details: error.message
//         });
//     }
// });

// // Health check endpoint
// router.get('/health', async (req, res) => {
//     try {
//         const health = await trackingService.healthCheck();
//         const aiHealth = await aiAnalysisService.healthCheck();
        
//         res.json({
//             ...health,
//             aiService: aiHealth,
//             workflow: {
//                 steps: ['analyze', 'confirm', 'save'],
//                 confirmationEnabled: true
//             }
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: 'unhealthy',
//             error: error.message,
//             timestamp: new Date().toISOString()
//         });
//     }
// });

// module.exports = router;