// Database Tracking Service - PRISMA VERSION
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

class TrackingService {
    constructor() {
        this.prisma = null;
        this.isConnected = false;
        this.initializePrisma();
    }

    initializePrisma() {
        try {
            if (!process.env.DATABASE_URL) {
                logger.warn('DATABASE_URL not configured - running without database tracking');
                return;
            }

            this.prisma = new PrismaClient({
                log: ['error', 'warn'],
            });

            // Test connection asynchronously
            this.testConnectionAsync();

        } catch (error) {
            logger.error('Failed to initialize Prisma client:', error);
            this.isConnected = false;
        }
    }

    async testConnectionAsync() {
        try {
            await this.prisma.$connect();
            this.isConnected = true;
            logger.info('Database connection successful (Prisma)');
        } catch (error) {
            logger.warn('Database connection failed - running in offline mode:', error.message);
            this.isConnected = false;
        }
    }

    async testConnection() {
        if (!this.prisma) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            await this.prisma.$queryRaw`SELECT NOW() as current_time`;
            this.isConnected = true;
            return { success: true, timestamp: new Date() };
        } catch (error) {
            this.isConnected = false;
            logger.error('Database connection test failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Wrapper for all database operations
    async safeQuery(queryFn, fallbackValue = null) {
        if (!this.prisma || !this.isConnected) {
            logger.debug('Database not available, skipping query');
            return fallbackValue;
        }

        try {
            return await queryFn();
        } catch (error) {
            logger.warn('Database query failed:', error.message);
            // Don't set isConnected to false - Prisma will handle reconnection
            return fallbackValue;
        }
    }

    // ✨ NEW: Get recent forms - formatted for frontend
    async getRecentForms(limit = 50) {
        return this.safeQuery(async () => {
            const forms = await this.prisma.processedForm.findMany({
                take: limit,
                orderBy: { createdAt: 'desc' },
                where: {
                    status: {
                        in: ['APPROVED', 'PENDING_REVIEW']
                    }
                },
                include: {
                    issues: true,
                    complianceChecks: true
                }
            });

            // Transform to frontend format
            return forms.map(form => {
                const analysis = typeof form.aiAnalysis === 'string' 
                    ? JSON.parse(form.aiAnalysis) 
                    : form.aiAnalysis;

                return {
                    file: form.originalFileName || 'Unknown',
                    formType: form.formType,  // Already in correct enum format from database
                    riskLevel: this.extractRiskLevel(form.riskScore, analysis),
                    riskScore: form.riskScore,
                    timestamp: form.createdAt.toISOString(),
                    fullAnalysis: analysis,
                    source: 'database',
                    id: form.id,
                    // Additional data
                    site: form.site,
                    workerName: form.workerName,
                    status: form.status,
                    requiresSupervisorReview: form.requiresSupervisorReview,
                    issuesCount: form.issues.length,
                    complianceIssuesCount: form.complianceChecks.filter(c => !c.compliant).length
                };
            });
        }, []);
    }

    // Helper to extract risk level from risk score
    extractRiskLevel(riskScore, analysis = null) {
        // First try to get from analysis
        if (analysis?.riskLevel) return analysis.riskLevel;
        if (analysis?.riskAssessment?.level) return analysis.riskAssessment.level;
        
        // Otherwise derive from risk score
        if (riskScore >= 9) return 'CRITICAL';
        if (riskScore >= 7) return 'HIGH';
        if (riskScore >= 5) return 'MEDIUM';
        return 'LOW';
    }

    // Helper to map AI form types to Prisma enum values
    mapFormType(aiFormType) {
        if (!aiFormType) return 'OTHER';
        
        const formTypeMap = {
            // Pre-work planning
            'TAKE_5': 'TAKE5',
            'TAKE5': 'TAKE5',
            'TAKE_FIVE': 'TAKE5',
            'PRE_TASK_BRIEF': 'PRE_TASK_BRIEF',
            'PRE_TASK_BRIEFING': 'PRE_TASK_BRIEF',
            'PRE_START': 'PRE_TASK_BRIEF',
            'JSEA': 'JSEA',
            'JOB_SAFETY_ENVIRONMENTAL_ANALYSIS': 'JSEA',
            'JSA': 'JSA',
            'JOB_SAFETY_ANALYSIS': 'JSA',
            'JHA': 'JHA',
            'JOB_HAZARD_ANALYSIS': 'JHA',
            'SWMS': 'SWMS',
            'SAFE_WORK_METHOD_STATEMENT': 'SWMS',
            'SAFE_WORK_METHOD': 'SWMS',
            
            // Assessments
            'HAZARD_ASSESSMENT': 'HAZARD_ASSESSMENT',
            'HAZARD_IDENTIFICATION': 'HAZARD_ASSESSMENT',
            'HAZARD_ANALYSIS': 'HAZARD_ASSESSMENT',
            'RISK_ASSESSMENT': 'RISK_ASSESSMENT',
            'RISK_ANALYSIS': 'RISK_ASSESSMENT',
            'SITE_ASSESSMENT': 'SITE_ASSESSMENT',
            'SITE_SAFETY_ASSESSMENT': 'SITE_ASSESSMENT',
            
            // Inspections
            'INSPECTION_REPORT': 'INSPECTION_REPORT',
            'INSPECTION': 'INSPECTION_REPORT',
            'SAFETY_INSPECTION': 'INSPECTION_REPORT',
            'EQUIPMENT_INSPECTION': 'EQUIPMENT_INSPECTION',
            'TOOL_INSPECTION': 'EQUIPMENT_INSPECTION',
            'PLANT_INSPECTION': 'EQUIPMENT_INSPECTION',
            'VEHICLE_CHECKLIST': 'VEHICLE_CHECKLIST',
            'VEHICLE_CHECK': 'VEHICLE_CHECKLIST',
            'PRE_START_CHECK': 'VEHICLE_CHECKLIST',
            'WORKPLACE_INSPECTION': 'WORKPLACE_INSPECTION',
            'SITE_INSPECTION': 'WORKPLACE_INSPECTION',
            
            // Permits
            'PERMIT_TO_WORK': 'PERMIT_TO_WORK',
            'WORK_PERMIT': 'PERMIT_TO_WORK',
            'PTW': 'PERMIT_TO_WORK',
            'HOT_WORK_PERMIT': 'HOT_WORK_PERMIT',
            'HOT_WORK': 'HOT_WORK_PERMIT',
            'WELDING_PERMIT': 'HOT_WORK_PERMIT',
            'CONFINED_SPACE_ENTRY': 'CONFINED_SPACE_ENTRY',
            'CONFINED_SPACE': 'CONFINED_SPACE_ENTRY',
            'CONFINED_SPACE_PERMIT': 'CONFINED_SPACE_ENTRY',
            'HEIGHT_WORK_PERMIT': 'HEIGHT_WORK_PERMIT',
            'WORKING_AT_HEIGHT': 'HEIGHT_WORK_PERMIT',
            'HEIGHT_PERMIT': 'HEIGHT_WORK_PERMIT',
            'EXCAVATION_PERMIT': 'EXCAVATION_PERMIT',
            'EXCAVATION': 'EXCAVATION_PERMIT',
            'DIGGING_PERMIT': 'EXCAVATION_PERMIT',
            
            // Training & Induction
            'TOOLBOX_TALK': 'TOOLBOX_TALK',
            'TOOLBOX': 'TOOLBOX_TALK',
            'TOOLBOX_MEETING': 'TOOLBOX_TALK',
            'SAFETY_MEETING': 'TOOLBOX_TALK',
            'SAFETY_BRIEFING': 'TOOLBOX_TALK',
            'SITE_INDUCTION': 'SITE_INDUCTION',
            'INDUCTION': 'SITE_INDUCTION',
            'SAFETY_INDUCTION': 'SITE_INDUCTION',
            'TRAINING_RECORD': 'TRAINING_RECORD',
            'TRAINING': 'TRAINING_RECORD',
            'TRAINING_LOG': 'TRAINING_RECORD',
            'COMPETENCY_ASSESSMENT': 'COMPETENCY_ASSESSMENT',
            'COMPETENCY': 'COMPETENCY_ASSESSMENT',
            'SKILLS_ASSESSMENT': 'COMPETENCY_ASSESSMENT',
            
            // Incidents & Reporting
            'INCIDENT_REPORT': 'INCIDENT_REPORT',
            'INCIDENT': 'INCIDENT_REPORT',
            'ACCIDENT_REPORT': 'INCIDENT_REPORT',
            'ACCIDENT': 'INCIDENT_REPORT',
            'NEAR_MISS': 'NEAR_MISS',
            'NEAR_HIT': 'NEAR_MISS',
            'CLOSE_CALL': 'NEAR_MISS',
            'HAZARD_REPORT': 'HAZARD_REPORT',
            'INJURY_REPORT': 'INJURY_REPORT',
            'INJURY': 'INJURY_REPORT',
            'FIRST_AID': 'INJURY_REPORT',
            
            // Other
            'EMERGENCY_DRILL': 'EMERGENCY_DRILL',
            'EVACUATION_DRILL': 'EMERGENCY_DRILL',
            'FIRE_DRILL': 'EMERGENCY_DRILL',
            'SAFE_OPERATING_PROCEDURE': 'SAFE_OPERATING_PROCEDURE',
            'SOP': 'SAFE_OPERATING_PROCEDURE',
            'OPERATING_PROCEDURE': 'SAFE_OPERATING_PROCEDURE',
            'ENVIRONMENTAL_CHECK': 'ENVIRONMENTAL_CHECK',
            'ENVIRONMENTAL': 'ENVIRONMENTAL_CHECK',
            'ENVIRONMENTAL_INSPECTION': 'ENVIRONMENTAL_CHECK'
        };
        
        // Normalize and lookup
        const normalized = aiFormType.toUpperCase().trim().replace(/\s+/g, '_');
        const mapped = formTypeMap[normalized];
        
        if (mapped) {
            logger.debug(`Mapped form type: ${aiFormType} → ${mapped}`);
            return mapped;
        }
        
        logger.warn(`Unknown form type: ${aiFormType}, defaulting to OTHER`);
        return 'OTHER';
    }

    // Helper to map AI issue categories to Prisma enum values
    mapIssueCategory(aiCategory) {
        if (!aiCategory) return 'OTHER';
        
        const categoryMap = {
            // PPE related
            'PPE': 'PPE',
            'PERSONAL_PROTECTIVE_EQUIPMENT': 'PPE',
            'PROTECTIVE_EQUIPMENT': 'PPE',
            'SAFETY_EQUIPMENT': 'PPE',
            
            // General hazards
            'HAZARD': 'HAZARD',
            'GENERAL_HAZARD': 'HAZARD',
            'SAFETY_HAZARD': 'HAZARD',
            'FALL_PROTECTION': 'HAZARD',
            'FALL': 'HAZARD',
            'FALLS': 'HAZARD',
            'SLIP': 'HAZARD',
            'TRIP': 'HAZARD',
            'MANUAL_HANDLING': 'HAZARD',
            'LIFTING': 'HAZARD',
            'ERGONOMIC': 'HAZARD',
            
            // Electrical
            'ELECTRICAL': 'HAZARD',
            'ELECTRIC': 'HAZARD',
            'ELECTROCUTION': 'HAZARD',
            'POWER': 'HAZARD',
            'POWERLINES': 'HAZARD',
            
            // Mechanical
            'MECHANICAL': 'EQUIPMENT',
            'MACHINERY': 'EQUIPMENT',
            'MACHINE': 'EQUIPMENT',
            
            // Vehicle/Traffic
            'VEHICLE': 'EQUIPMENT',
            'VEHICLE_MOVEMENT': 'HAZARD',
            'TRAFFIC': 'HAZARD',
            'MOBILE_PLANT': 'EQUIPMENT',
            
            // Procedure related
            'PROCEDURE': 'PROCEDURE',
            'PROCESS': 'PROCEDURE',
            'METHOD': 'PROCEDURE',
            'WORK_METHOD': 'PROCEDURE',
            'ISOLATION': 'PROCEDURE',
            'LOTO': 'PROCEDURE',
            'LOCKOUT': 'PROCEDURE',
            
            // Documentation
            'DOCUMENTATION': 'DOCUMENTATION',
            'PAPERWORK': 'DOCUMENTATION',
            'RECORD': 'DOCUMENTATION',
            'INCOMPLETE_FORM': 'DOCUMENTATION',
            
            // Environmental
            'ENVIRONMENTAL': 'ENVIRONMENTAL',
            'ENVIRONMENT': 'ENVIRONMENTAL',
            'WEATHER': 'ENVIRONMENTAL',
            'NOISE': 'ENVIRONMENTAL',
            'DUST': 'ENVIRONMENTAL',
            'CHEMICAL': 'ENVIRONMENTAL',
            'SPILL': 'ENVIRONMENTAL',
            
            // Equipment
            'EQUIPMENT': 'EQUIPMENT',
            'TOOL': 'EQUIPMENT',
            'TOOLS': 'EQUIPMENT',
            'PLANT': 'EQUIPMENT',
            'DEFECTIVE_EQUIPMENT': 'EQUIPMENT',
            
            // Training
            'TRAINING': 'TRAINING',
            'COMPETENCY': 'TRAINING',
            'QUALIFICATION': 'TRAINING',
            'LICENSE': 'TRAINING',
            'INDUCTION': 'TRAINING'
        };
        
        // Normalize and lookup
        const normalized = aiCategory.toUpperCase().trim().replace(/\s+/g, '_');
        const mapped = categoryMap[normalized];
        
        if (mapped) {
            logger.debug(`Mapped issue category: ${aiCategory} → ${mapped}`);
            return mapped;
        }
        
        logger.warn(`Unknown issue category: ${aiCategory}, defaulting to OTHER`);
        return 'OTHER';
    }

    // Create form record
    async createFormRecord({ processingId, originalFileName, formType, extractedText, aiAnalysis, riskScore }) {
        return this.safeQuery(async () => {
            const form = await this.prisma.processedForm.create({
                data: {
                    processingId,
                    originalFileName,
                    formType: this.mapFormType(formType) || 'OTHER',
                    extractedText,
                    aiAnalysis: aiAnalysis || {},
                    riskScore: riskScore || 5,
                    requiresSupervisorReview: riskScore >= 7,
                    status: 'PENDING_REVIEW'
                }
            });
            
            return form;
        }, { id: `temp-${Date.now()}`, processingId });
    }

    // Update form with AI analysis
    async updateFormAnalysis(formId, analysisData) {
        return this.safeQuery(async () => {
            const form = await this.prisma.processedForm.update({
                where: { id: formId },
                data: {
                    aiAnalysis: analysisData.aiAnalysis || {},
                    riskScore: analysisData.riskScore,
                    requiresSupervisorReview: analysisData.riskScore >= 7,
                    site: analysisData.site,
                    workerName: analysisData.workerName,
                    status: 'PENDING_REVIEW',
                    metadata: analysisData.metadata
                }
            });
            
            return form;
        }, { id: formId });
    }

    // Add safety issues
    async addSafetyIssues(formId, issues) {
        return this.safeQuery(async () => {
            if (!issues || issues.length === 0) return [];
            
            const created = await this.prisma.safetyIssue.createMany({
                data: issues.map(issue => ({
                    formId,
                    category: this.mapIssueCategory(issue.category) || 'OTHER',
                    description: issue.description,
                    severity: issue.severity || 'MEDIUM',
                    recommendation: issue.recommendation
                }))
            });
            
            return created;
        }, []);
    }

    // Add compliance checks
    async addComplianceChecks(formId, checks) {
        return this.safeQuery(async () => {
            if (!checks || checks.length === 0) return [];
            
            const created = await this.prisma.complianceCheck.createMany({
                data: checks.map(check => ({
                    formId,
                    standard: check.standard,
                    issue: check.issue,
                    action: check.action,
                    compliant: !check.issue // If there's an issue, it's not compliant
                }))
            });
            
            return created;
        }, []);
    }

    // Log processing event
    async logProcessingEvent(processingId, status, errorMessage = null, metadata = null) {
        return this.safeQuery(async () => {
            const log = await this.prisma.processingLog.create({
                data: {
                    processingId,
                    status,
                    errorMessage,
                    metadata: metadata || {}
                }
            });
            
            return log;
        }, null);
    }

    // Get form by ID
    async getFormById(formId) {
        return this.safeQuery(async () => {
            const form = await this.prisma.processedForm.findUnique({
                where: { id: formId },
                include: {
                    issues: true,
                    complianceChecks: true
                }
            });
            
            return form;
        }, null);
    }

    // Get analytics summary
    async getAnalyticsSummary() {
        return this.safeQuery(async () => {
            const [totalForms, highRiskForms, avgRiskScore] = await Promise.all([
                this.prisma.processedForm.count(),
                this.prisma.processedForm.count({
                    where: { riskScore: { gte: 7 } }
                }),
                this.prisma.processedForm.aggregate({
                    _avg: { riskScore: true }
                })
            ]);
            
            return {
                totalForms,
                highRiskForms,
                avgRiskScore: avgRiskScore._avg.riskScore || 0
            };
        }, {
            totalForms: 0,
            highRiskForms: 0,
            avgRiskScore: 0
        });
    }

    // Health check
    async healthCheck() {
        try {
            if (!this.prisma) {
                return {
                    status: 'not_configured',
                    database: 'not_configured',
                    timestamp: new Date().toISOString()
                };
            }

            await this.prisma.$queryRaw`SELECT 1`;
            
            return {
                status: 'healthy',
                database: 'connected',
                orm: 'prisma',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'degraded',
                database: 'disconnected',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Close connection
    async close() {
        if (this.prisma) {
            try {
                await this.prisma.$disconnect();
                logger.info('Database connection closed (Prisma)');
            } catch (error) {
                logger.error('Error closing Prisma connection:', error);
            }
        }
    }

    // ============ Legacy compatibility methods ============
    // These maintain compatibility with the old trackingService API

    async createProcessingSession({ sessionToken, userIdentifier, deviceInfo, locationData }) {
        // For now, just return a mock session since your schema doesn't have sessions table
        return { id: sessionToken, session_token: sessionToken };
    }

    async createFormProcessingRecord({ sessionId, originalFilename, fileSizeBytes, fileType }) {
        const processingId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return this.safeQuery(async () => {
            // Log the processing start
            await this.logProcessingEvent(processingId, 'PROCESSING');
            
            return { 
                id: processingId, 
                processingId,
                originalFilename 
            };
        }, { id: processingId, processingId });
    }

    async updateFormProcessingOCR(formId, ocrData) {
        // Log OCR completion
        return this.safeQuery(async () => {
            await this.logProcessingEvent(formId, 'COMPLETED', null, {
                stage: 'ocr',
                provider: ocrData.providerUsed,
                confidence: ocrData.confidenceScore
            });
            return { id: formId };
        }, { id: formId });
    }

    async updateFormProcessingAI(formId, aiData) {
        // Create the actual form record now that we have AI analysis
        return this.safeQuery(async () => {
            const form = await this.prisma.processedForm.create({
                data: {
                    processingId: formId,
                    originalFileName: aiData.originalFileName || 'Unknown',
                    formType: this.mapFormType(aiData.formTypeDetected) || 'OTHER',
                    extractedText: aiData.extractedText || '',
                    aiAnalysis: aiData.analysisResult || {},
                    riskScore: aiData.riskScore || 5,
                    requiresSupervisorReview: aiData.supervisorFlagged || false,
                    status: 'PENDING_REVIEW',
                    metadata: {
                        aiProvider: aiData.aiProvider,
                        processingTime: aiData.processingTimeMs,
                        standards: aiData.australianStandardsReferenced
                    }
                }
            });

            // Add safety issues if present
            if (aiData.hazardsIdentified && aiData.hazardsIdentified.length > 0) {
                await this.addSafetyIssues(form.id, aiData.hazardsIdentified);
            }

            // Log completion
            await this.logProcessingEvent(formId, 'COMPLETED');
            
            return form;
        }, { id: formId });
    }

    async markFormProcessingError(formId, error) {
        return this.safeQuery(async () => {
            await this.logProcessingEvent(formId, 'FAILED', error.error || error.message, error);
            return { id: formId, status: 'failed' };
        }, { id: formId, status: 'failed' });
    }

    async logAuditEvent(formId, sessionId, eventType, eventData) {
        // Log as a processing event
        return this.logProcessingEvent(formId || sessionId, 'COMPLETED', null, {
            eventType,
            ...eventData
        });
    }

    async updateProcessingSession(sessionId, stats) {
        // Mock - your schema doesn't have sessions
        return { id: sessionId };
    }
}

// Export singleton instance
module.exports = new TrackingService();