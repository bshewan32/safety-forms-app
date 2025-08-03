// backend/src/services/forms/formProcessor.js - Enhanced with buffer support
const fs = require('fs');
const OCRService = require('../ocr/ocrService');
const AIAnalysisService = require('../ai/aiAnalysisService');
const logger = require('../utils/logger');
const { calculateRiskScore } = require('../utils/riskScoring');

class FormProcessor {
  constructor() {
    this.ocrService = new OCRService();
    this.aiService = new AIAnalysisService();
  }

  // Enhanced buffer-based processing method
  async processFormBuffer(buffer, metadata = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting form processing (buffer-based)', { 
        bufferSize: buffer.length,
        metadata: {
          captureMethod: metadata.captureMethod,
          deviceType: metadata.deviceType,
          formType: metadata.formType
        }
      });

      // Step 1: Enhanced OCR Processing with metadata
      logger.info('Starting OCR processing');
      const ocrResult = await this.ocrService.extractText(buffer, 'auto', {
        captureMethod: metadata.captureMethod || 'file_upload',
        deviceType: metadata.deviceType || 'desktop',
        imageQuality: this.calculateImageQuality(buffer, metadata)
      });
      
      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        throw new Error('No text extracted from image');
      }

      logger.info('OCR completed', { 
        textLength: ocrResult.text.length,
        confidence: ocrResult.confidence,
        provider: ocrResult.provider
      });

      // Step 2: Determine form type (enhanced with OCR provider info)
      const formType = metadata.formType && metadata.formType !== 'UNKNOWN' 
        ? metadata.formType 
        : this.detectFormType(ocrResult.text);
      
      logger.info('Form type detected', { formType });

      // Step 3: Enhanced AI Analysis with preprocessing
      logger.info('Starting AI analysis');
      const preprocessedText = this.preprocessTextForAI(ocrResult.text, formType);
      
      const analysis = await this.aiService.analyzeSafetyForm(
        preprocessedText, 
        formType,
        { 
          ocrConfidence: ocrResult.confidence,
          ocrProvider: ocrResult.provider,
          captureMethod: metadata.captureMethod,
          deviceType: metadata.deviceType,
          originalTextLength: ocrResult.text.length,
          ...metadata
        }
      );

      // Step 4: Calculate final risk score (combine AI + OCR confidence + context)
      const finalRiskScore = this.calculateEnhancedRiskScore(analysis, ocrResult, metadata);

      const processingTime = Date.now() - startTime;

      const result = {
        success: true,
        processingTime,
        formType,
        
        // Enhanced OCR results
        ocrProvider: ocrResult.provider,
        ocrConfidence: ocrResult.confidence,
        ocrProcessingTime: ocrResult.processingTime,
        preprocessingApplied: ocrResult.preprocessing || [],
        
        // AI Analysis results
        riskScore: finalRiskScore,
        analysis: {
          ...analysis,
          finalRiskScore,
          processingMetadata: {
            ocrTime: ocrResult.processingTime || 0,
            aiTime: analysis.metadata?.processingTimeMs || 0,
            totalTime: processingTime,
            ocrProvider: ocrResult.provider,
            captureMethod: metadata.captureMethod,
            deviceType: metadata.deviceType
          }
        },
        
        // Full OCR data (for debugging/audit)
        ocrResult: {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          provider: ocrResult.provider,
          processingTime: ocrResult.processingTime,
          metadata: ocrResult.metadata || {}
        }
      };

      logger.info('Form processing completed', {
        formType,
        riskScore: finalRiskScore,
        ocrProvider: ocrResult.provider,
        ocrConfidence: ocrResult.confidence,
        processingTime: `${processingTime}ms`,
        success: true
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Form processing failed', { 
        error: error.message,
        bufferSize: buffer.length,
        processingTime: `${processingTime}ms`,
        metadata
      });

      return {
        success: false,
        error: error.message,
        processingTime,
        formType: metadata.formType || 'unknown',
        riskScore: 5,
        analysis: {
          riskScore: 5,
          riskLevel: 'MEDIUM',
          error: 'Processing failed - manual review required',
          flaggedIssues: [{
            category: 'SYSTEM',
            description: 'Form processing error - requires manual safety review',
            severity: 'HIGH',
            recommendation: 'Please review form manually and contact IT support'
          }],
          requiresSupervisorReview: true,
          analysisStatus: 'FAILED'
        }
      };
    }
  }

  // Original file path-based method (kept for backwards compatibility)
  async processForm(imagePath, options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting form processing (file-based)', { imagePath, options });

      // Read file into buffer and use buffer-based processing
      const buffer = await fs.promises.readFile(imagePath);
      
      // Convert options to metadata format
      const metadata = {
        formType: options.formType || 'UNKNOWN',
        originalFileName: options.originalFileName,
        fileSize: options.fileSize,
        captureMethod: 'file_upload', // Since it's a file path
        deviceType: 'desktop', // Assume desktop for file uploads
        ...options
      };

      // Use the buffer-based processing
      const result = await this.processFormBuffer(buffer, metadata);
      
      // Add file path info for backwards compatibility
      if (result.success) {
        result.filePath = imagePath;
      }

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('File-based form processing failed', { 
        error: error.message,
        imagePath,
        processingTime: `${processingTime}ms`
      });

      return {
        success: false,
        error: error.message,
        processingTime,
        formType: 'unknown',
        analysis: {
          riskScore: 5,
          riskLevel: 'MEDIUM',
          error: 'Processing failed - manual review required',
          flaggedIssues: [{
            category: 'SYSTEM',
            description: 'Form processing error - requires manual safety review',
            severity: 'HIGH',
            recommendation: 'Please review form manually and contact IT support'
          }],
          requiresSupervisorReview: true,
          analysisStatus: 'FAILED'
        }
      };
    }
  }

  // Helper method to calculate image quality from buffer
  calculateImageQuality(buffer, metadata) {
    let quality = 0.7; // Default quality
    
    // File size-based quality estimation
    const sizeInMB = buffer.length / (1024 * 1024);
    if (sizeInMB > 5) quality += 0.2;
    else if (sizeInMB > 2) quality += 0.1;
    else if (sizeInMB < 0.5) quality -= 0.2;
    
    // Capture method adjustment
    if (metadata.captureMethod === 'mobile_camera') {
      quality -= 0.1; // Mobile cameras might have more variability
    }
    
    return Math.max(0.1, Math.min(1.0, quality));
  }

  // Enhanced risk score calculation with more context
  calculateEnhancedRiskScore(analysis, ocrResult, metadata) {
    let riskScore = analysis.riskScore || 5;
    
    // OCR confidence adjustments
    if (ocrResult.confidence < 30) {
      riskScore = Math.min(10, riskScore + 2);
      logger.warn('Very low OCR confidence, increasing risk score', {
        originalScore: analysis.riskScore,
        adjustedScore: riskScore,
        ocrConfidence: ocrResult.confidence
      });
    } else if (ocrResult.confidence < 50) {
      riskScore = Math.min(10, riskScore + 1);
    }

    // Mobile capture adjustments (mobile photos might miss details)
    if (metadata.captureMethod === 'mobile_camera' && ocrResult.confidence < 80) {
      riskScore = Math.min(10, riskScore + 1);
      logger.info('Mobile capture with moderate OCR confidence, increasing risk score', {
        captureMethod: metadata.captureMethod,
        ocrConfidence: ocrResult.confidence
      });
    }

    // Form completeness adjustments
    if (analysis.formCompleteness === 'INCOMPLETE') {
      riskScore = Math.min(10, riskScore + 1);
    }

    // Critical missing fields
    if (analysis.missingFields && analysis.missingFields.length > 2) {
      riskScore = Math.min(10, riskScore + 1);
    }

    return riskScore;
  }

  detectFormType(text) {
    if (!text) return 'UNKNOWN';
    
    const upperText = text.toUpperCase();
    
    // Enhanced form type detection patterns
    const formPatterns = {
      'SWMS': [
        /SAFE\s+WORK\s+METHOD\s+STATEMENT/i,
        /SWMS/i,
        /WORK\s+METHOD/i
      ],
      'JSA': [
        /JOB\s+SAFETY\s+ANALYSIS/i,
        /JSA/i,
        /JOB\s+HAZARD\s+ANALYSIS/i
      ],
      'JHA': [
        /JOB\s+HAZARD\s+ANALYSIS/i,
        /JHA/i
      ],
      'TAKE5': [
        /TAKE\s*5/i,
        /TAKE\s+FIVE/i,
        /5\s+MINUTE/i
      ],
      'PERMIT': [
        /WORK\s+PERMIT/i,
        /PERMIT\s+TO\s+WORK/i,
        /HOT\s+WORK\s+PERMIT/i
      ],
      'INSPECTION': [
        /SAFETY\s+INSPECTION/i,
        /INSPECTION\s+CHECKLIST/i,
        /PRE.*INSPECTION/i
      ],
      'HAZARD_ASSESSMENT': [
        /HAZARD\s+ASSESSMENT/i,
        /RISK\s+ASSESSMENT/i,
        /HAZARD.*IDENTIFICATION/i
      ]
    };

    // Check for form type patterns
    for (const [formType, patterns] of Object.entries(formPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(upperText)) {
          logger.info('Form type detected', { formType, pattern: pattern.toString() });
          return formType;
        }
      }
    }

    // Fallback: look for safety-related keywords
    const safetyKeywords = ['HAZARD', 'RISK', 'PPE', 'SAFETY', 'WORK', 'PROCEDURE'];
    const keywordCount = safetyKeywords.filter(keyword => 
      upperText.includes(keyword)
    ).length;

    if (keywordCount >= 2) {
      return 'SAFETY_FORM';
    }

    return 'UNKNOWN';
  }

  // Enhanced text preprocessing for better AI analysis
  preprocessTextForAI(text, formType) {
    if (!text) return '';

    let processed = text;

    // Clean up whitespace and line breaks
    processed = processed.replace(/\n+/g, '\n');
    processed = processed.replace(/\s+/g, ' ');
    processed = processed.trim();

    // Structure the text better for AI analysis
    const sections = [];
    const lines = processed.split('\n').filter(line => line.trim());
    let currentSection = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if this looks like a section header
      if (this.isSectionHeader(trimmed)) {
        if (currentSection.length > 0) {
          sections.push(currentSection.join(' '));
          currentSection = [];
        }
        currentSection.push(`\n[SECTION: ${trimmed}]`);
      } else {
        currentSection.push(trimmed);
      }
    }
    
    if (currentSection.length > 0) {
      sections.push(currentSection.join(' '));
    }

    const structuredText = sections.join('\n');
    
    // Add form context for better AI understanding
    return `[FORM_TYPE: ${formType}]\n[TEXT_LENGTH: ${text.length} characters]\n\n${structuredText}`;
  }

  isSectionHeader(text) {
    if (!text || text.length > 100) return false;
    
    const headerPatterns = [
      /^[A-Z\s]+:$/,  // ALL CAPS with colon
      /^(HAZARD|RISK|PPE|CONTROL|PROCEDURE|EMERGENCY|WORK|TASK|EQUIPMENT)/i,
      /ASSESSMENT|IDENTIFICATION|ANALYSIS|METHOD|STATEMENT/i,
      /^\d+\./,  // Numbered sections
      /^[A-Z]\./  // Lettered sections
    ];
    
    return headerPatterns.some(pattern => pattern.test(text.trim()));
  }

  // Helper method for batch processing (enhanced)
  async processBatch(items, options = {}) {
    const results = [];
    const { maxConcurrent = 1, isBufferBased = false } = options;

    for (let i = 0; i < items.length; i += maxConcurrent) {
      const batch = items.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (item, index) => {
        try {
          let result;
          if (isBufferBased) {
            // item should be { buffer, metadata }
            result = await this.processFormBuffer(item.buffer, item.metadata);
          } else {
            // item should be imagePath string
            result = await this.processForm(item, options);
          }
          
          return { 
            index: i + index, 
            item: isBufferBased ? 'buffer' : item,
            ...result 
          };
        } catch (error) {
          return { 
            index: i + index, 
            item: isBufferBased ? 'buffer' : item,
            success: false, 
            error: error.message 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to be gentle on resources
      if (i + maxConcurrent < items.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  // Health check method
  async healthCheck() {
    try {
      const ocrHealth = this.ocrService.healthCheck ? 
        await this.ocrService.healthCheck() : 
        { status: 'OK', message: 'OCR service running' };
        
      const aiHealth = await this.aiService.healthCheck();
      
      return {
        status: (ocrHealth.status === 'OK' && aiHealth.status === 'OK') ? 'OK' : 'ERROR',
        services: {
          ocr: ocrHealth,
          ai: aiHealth
        },
        capabilities: {
          bufferBasedProcessing: true,
          fileBasedProcessing: true,
          batchProcessing: true,
          multiProviderOCR: true,
          enhancedRiskScoring: true
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = FormProcessor;