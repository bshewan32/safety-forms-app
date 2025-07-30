// backend/src/services/forms/formProcessor.js

const { OCRService } = require('../ocr/ocrService');
const { AIAnalysisService, RiskScorer } = require('../ai/aiAnalysisService');
const { prisma } = require('../../utils/database');
const { logger } = require('../../utils/logger');

class FormProcessor {
  constructor() {
    this.ocrService = new OCRService();
    this.aiService = new AIAnalysisService();
  }

  async processForm(imageBuffer, metadata) {
    const processingId = `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`Starting form processing: ${processingId}`);

      // Step 1: OCR Extraction
      const extractedText = await this.ocrService.extractText(imageBuffer);
      
      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error('Insufficient text extracted from image');
      }

      // Step 2: AI Analysis
      const analysis = await this.aiService.analyzeSafetyForm(
        extractedText, 
        metadata.formType || 'TAKE5'
      );

      // Step 3: Risk Scoring
      const riskScore = RiskScorer.calculateOverallRisk(analysis.flaggedIssues);
      const requiresReview = RiskScorer.shouldFlag(riskScore, analysis.flaggedIssues);

      // Step 4: Save to Database
      const processedForm = await this.saveProcessedForm({
        processingId,
        metadata,
        extractedText,
        analysis,
        riskScore,
        requiresReview
      });

      logger.info(`Form processing completed: ${processingId}, Risk Score: ${riskScore}`);

      return {
        success: true,
        processingId,
        formId: processedForm.id,
        riskScore,
        requiresReview,
        analysis: analysis,
        summary: this.generateSummary(analysis, riskScore)
      };

    } catch (error) {
      logger.error(`Form processing failed: ${processingId}`, error);
      
      // Save failed processing record
      await this.saveFailedProcessing(processingId, metadata, error.message);
      
      throw error;
    }
  }

  async saveProcessedForm(data) {
    return await prisma.processedForm.create({
      data: {
        processingId: data.processingId,
        originalFileName: data.metadata.fileName,
        formType: data.metadata.formType,
        workerName: data.metadata.workerName,
        site: data.metadata.site,
        extractedText: data.extractedText,
        aiAnalysis: data.analysis,
        riskScore: data.riskScore,
        requiresSupervisorReview: data.requiresReview,
        status: data.requiresReview ? 'PENDING_REVIEW' : 'APPROVED',
        createdAt: new Date(),
        metadata: data.metadata
      }
    });
  }

  async saveFailedProcessing(processingId, metadata, errorMessage) {
    try {
      await prisma.processingLog.create({
        data: {
          processingId,
          status: 'FAILED',
          errorMessage,
          metadata,
          createdAt: new Date()
        }
      });
    } catch (logError) {
      logger.error('Failed to save processing log:', logError);
    }
  }

  generateSummary(analysis, riskScore) {
    const riskLevelText = riskScore >= 8 ? 'HIGH RISK' : 
                         riskScore >= 5 ? 'MEDIUM RISK' : 'LOW RISK';
    
    const issueCount = analysis.flaggedIssues?.length || 0;
    const complianceCount = analysis.complianceIssues?.length || 0;

    return {
      riskLevel: riskLevelText,
      issuesSummary: `${issueCount} safety issues identified`,
      complianceSummary: `${complianceCount} compliance concerns`,
      recommendation: analysis.requiresSupervisorReview ? 
        'Requires immediate supervisor review' : 
        'Form meets safety standards'
    };
  }

  // Batch processing for multiple forms
  async processBatch(forms) {
    const results = [];
    
    for (const form of forms) {
      try {
        const result = await this.processForm(form.imageBuffer, form.metadata);
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ 
          success: false, 
          fileName: form.metadata.fileName,
          error: error.message 
        });
      }
    }

    return results;
  }

  // Get processing statistics
  async getProcessingStats(timeframe = '24h') {
    const since = new Date();
    since.setHours(since.getHours() - (timeframe === '24h' ? 24 : 168)); // 24h or 7d

    const stats = await prisma.processedForm.groupBy({
      by: ['status', 'riskScore'],
      where: {
        createdAt: {
          gte: since
        }
      },
      _count: true
    });

    return {
      timeframe,
      totalProcessed: stats.reduce((sum, stat) => sum + stat._count, 0),
      pendingReview: stats.filter(s => s.status === 'PENDING_REVIEW')
                          .reduce((sum, stat) => sum + stat._count, 0),
      highRiskForms: stats.filter(s => s.riskScore >= 7)
                          .reduce((sum, stat) => sum + stat._count, 0),
      avgRiskScore: this.calculateAverageRisk(stats)
    };
  }

  calculateAverageRisk(stats) {
    const totalForms = stats.reduce((sum, stat) => sum + stat._count, 0);
    const weightedRisk = stats.reduce((sum, stat) => sum + (stat.riskScore * stat._count), 0);
    return totalForms > 0 ? (weightedRisk / totalForms).toFixed(2) : 0;
  }
}

module.exports = { FormProcessor };