// Database Tracking Service
// Handles all database operations for safety forms processing tracking

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

function mapSeverityToInteger(severity) {
    const severityMap = {
        'LOW': 1,
        'MEDIUM': 2, 
        'HIGH': 3,
        'CRITICAL': 4
    };
    
    return severityMap[severity?.toUpperCase()] || 2; // Default to MEDIUM (2) if unknown
}

function mapPriorityToInteger(priority) {
    const priorityMap = {
        'LOW': 1,
        'MEDIUM': 2,
        'HIGH': 3,
        'CRITICAL': 4
    };
    
    return priorityMap[priority?.toUpperCase()] || 2; // Default to MEDIUM (2) if unknown
}

class TrackingService {
  constructor() {
    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection on initialization
    this.testConnection();
  }

  async testConnection() {
    try {
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();
      logger.info("Database connection established successfully");
    } catch (error) {
      logger.error("Database connection failed:", error);
      throw error;
    }
  }

  // Session Management
  async createProcessingSession(sessionData) {
    const client = await this.pool.connect();
    try {
      const sessionToken = sessionData.sessionToken || uuidv4();
      const query = `
                INSERT INTO processing_sessions (
                    session_token, user_identifier, device_info, location_data
                ) VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
      const values = [
        sessionToken,
        sessionData.userIdentifier,
        sessionData.deviceInfo ? JSON.stringify(sessionData.deviceInfo) : null,
        sessionData.locationData
          ? JSON.stringify(sessionData.locationData)
          : null,
      ];

      const result = await client.query(query, values);
      logger.info(`Processing session created: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating processing session:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProcessingSession(sessionId, updates) {
    const client = await this.pool.connect();
    try {
      const query = `
                UPDATE processing_sessions 
                SET 
                    end_time = COALESCE($2, end_time),
                    total_forms_processed = COALESCE($3, total_forms_processed),
                    total_processing_time_ms = COALESCE($4, total_processing_time_ms),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
      const values = [
        sessionId,
        updates.endTime,
        updates.totalFormsProcessed,
        updates.totalProcessingTimeMs,
      ];

      const result = await client.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating processing session:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Form Processing Tracking
  async createFormProcessingRecord(formData) {
    const client = await this.pool.connect();
    try {
      const query = `
                INSERT INTO forms_processing (
                    session_id, original_filename, file_size_bytes, file_type,
                    image_dimensions, processing_start_time
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;
      const values = [
        formData.sessionId,
        formData.originalFilename,
        formData.fileSizeBytes,
        formData.fileType,
        formData.imageDimensions
          ? JSON.stringify(formData.imageDimensions)
          : null,
        new Date(),
      ];

      const result = await client.query(query, values);
      const formId = result.rows[0].id;

      // Log audit event
      await this.logAuditEvent(
        formId,
        formData.sessionId,
        "form_processing_started",
        {
          filename: formData.originalFilename,
          fileSize: formData.fileSizeBytes,
        }
      );

      logger.info(`Form processing record created: ${formId}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating form processing record:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateFormProcessingOCR(formId, ocrData) {
    const client = await this.pool.connect();
    try {
      const query = `
                UPDATE forms_processing 
                SET 
                    ocr_provider_used = $2,
                    ocr_confidence_score = $3,
                    ocr_processing_time_ms = $4,
                    extracted_text_length = $5,
                    ocr_fallback_used = $6,
                    extracted_text = $7,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
      const values = [
        formId,
        ocrData.providerUsed,
        ocrData.confidenceScore,
        ocrData.processingTimeMs,
        ocrData.extractedTextLength,
        ocrData.fallbackUsed || false,
        ocrData.extractedText,
      ];

      const result = await client.query(query, values);

      // Log audit event
      await this.logAuditEvent(formId, null, "ocr_completed", {
        provider: ocrData.providerUsed,
        confidence: ocrData.confidenceScore,
        textLength: ocrData.extractedTextLength,
        fallbackUsed: ocrData.fallbackUsed,
      });

      return result.rows[0];
    } catch (error) {
      logger.error("Error updating OCR data:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateFormProcessingAI(formId, aiData) {
    const client = await this.pool.connect();
    try {
      const query = `
                UPDATE forms_processing 
                SET 
                    ai_provider = $2,
                    ai_processing_time_ms = $3,
                    form_type_detected = $4,
                    risk_score = $5,
                    risk_level = $6,
                    risk_escalated = $7,
                    supervisor_flagged = $8,
                    australian_standards_referenced = $9,
                    compliance_gaps_identified = $10,
                    ai_analysis_result = $11,
                    hazards_identified = $12,
                    recommendations = $13,
                    processing_status = 'completed',
                    processing_end_time = NOW(),
                    total_processing_time_ms = EXTRACT(EPOCH FROM (NOW() - processing_start_time)) * 1000,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
      const values = [
        formId,
        aiData.aiProvider || "deepseek",
        aiData.processingTimeMs,
        aiData.formTypeDetected,
        aiData.riskScore,
        aiData.riskLevel,
        aiData.riskEscalated || false,
        aiData.supervisorFlagged || false,
        aiData.australianStandardsReferenced,
        aiData.complianceGapsIdentified || 0,
        JSON.stringify(aiData.analysisResult),
        JSON.stringify(aiData.hazardsIdentified),
        JSON.stringify(aiData.recommendations),
      ];

      const result = await client.query(query, values);

      // Log audit event
      await this.logAuditEvent(formId, null, "ai_analysis_completed", {
        riskScore: aiData.riskScore,
        riskLevel: aiData.riskLevel,
        formType: aiData.formTypeDetected,
        hazardCount: aiData.hazardsIdentified?.length || 0,
      });

      // Store individual hazards
      if (aiData.hazardsIdentified && aiData.hazardsIdentified.length > 0) {
        await this.storeFormHazards(formId, aiData.hazardsIdentified);
      }

      return result.rows[0];
    } catch (error) {
      logger.error("Error updating AI analysis data:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async storeFormHazards(formId, hazards) {
    const client = await this.pool.connect();
    try {
      for (const hazard of hazards) {
        const query = `
                INSERT INTO form_hazards (
                    form_processing_id, hazard_type, hazard_category,
                    severity_level, description, location_on_form,
                    australian_standard_violated, regulatory_requirement,
                    recommended_action, action_priority, estimated_cost_impact
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `;
        const values = [
          formId,
          hazard.type || hazard.category || "GENERAL", // fallback if type missing
          hazard.category || "GENERAL",
          mapSeverityToInteger(hazard.severity), // FIX: Convert text to integer
          hazard.description || "",
          hazard.location || hazard.locationOnForm || "",
          hazard.australianStandardViolated || null,
          hazard.regulatoryRequirement || null,
          hazard.recommendation || hazard.recommendedAction || "",
          mapPriorityToInteger(hazard.actionPriority || "MEDIUM"), // FIX: Convert text to integer
          hazard.estimatedCostImpact || null,
        ];

        await client.query(query, values);
      }

      logger.info(`Stored ${hazards.length} hazards for form ${formId}`);
    } catch (error) {
      logger.error("Error storing form hazards:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async markFormProcessingError(formId, errorDetails) {
    const client = await this.pool.connect();
    try {
      const query = `
                UPDATE forms_processing 
                SET 
                    processing_status = 'failed',
                    error_details = $2,
                    processing_end_time = NOW(),
                    total_processing_time_ms = EXTRACT(EPOCH FROM (NOW() - processing_start_time)) * 1000,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
      const values = [formId, JSON.stringify(errorDetails)];

      const result = await client.query(query, values);

      // Log audit event
      await this.logAuditEvent(formId, null, "processing_failed", errorDetails);

      return result.rows[0];
    } catch (error) {
      logger.error("Error marking form processing error:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Audit Logging
  async logAuditEvent(formId, sessionId, eventType, eventDetails) {
    const client = await this.pool.connect();
    try {
      const query = `
                INSERT INTO forms_audit_log (
                    form_processing_id, session_id, event_type, event_details,
                    server_instance, api_version
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `;
      const values = [
        formId,
        sessionId,
        eventType,
        JSON.stringify(eventDetails),
        process.env.SERVER_INSTANCE || "local",
        process.env.API_VERSION || "1.0.0",
      ];

      await client.query(query, values);
    } catch (error) {
      logger.error("Error logging audit event:", error);
      // Don't throw here - audit logging shouldn't break main flow
    } finally {
      client.release();
    }
  }

  // Analytics Queries
  async getProcessingSummary(timeRange = "24 hours") {
    const client = await this.pool.connect();
    try {
      const query = `
                SELECT 
                    COUNT(*) as total_forms,
                    COUNT(*) FILTER (WHERE processing_status = 'completed') as completed_forms,
                    COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_forms,
                    COUNT(*) FILTER (WHERE risk_level IN ('HIGH', 'CRITICAL')) as high_risk_forms,
                    AVG(risk_score) as average_risk_score,
                    AVG(total_processing_time_ms) as average_processing_time,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    STRING_AGG(DISTINCT form_type_detected, ', ') as form_types_processed
                FROM forms_processing 
                WHERE created_at >= NOW() - INTERVAL '${timeRange}'
            `;

      const result = await client.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error("Error getting processing summary:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getHazardTrends(timeRange = "7 days") {
    const client = await this.pool.connect();
    try {
      const query = `
                SELECT 
                    hazard_type,
                    hazard_category,
                    COUNT(*) as occurrence_count,
                    AVG(severity_level) as average_severity,
                    STRING_AGG(DISTINCT australian_standard_violated, ', ') as standards_violated
                FROM form_hazards 
                WHERE created_at >= NOW() - INTERVAL '${timeRange}'
                GROUP BY hazard_type, hazard_category
                ORDER BY occurrence_count DESC
                LIMIT 20
            `;

      const result = await client.query(query);
      return result.rows;
    } catch (error) {
      logger.error("Error getting hazard trends:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getFormById(formId) {
    const client = await this.pool.connect();
    try {
      const query = `
                SELECT fp.*, 
                       ps.session_token, ps.user_identifier,
                       COALESCE(
                           json_agg(
                               json_build_object(
                                   'id', fh.id,
                                   'type', fh.hazard_type,
                                   'category', fh.hazard_category,
                                   'severity', fh.severity_level,
                                   'description', fh.description,
                                   'recommendedAction', fh.recommended_action,
                                   'actionPriority', fh.action_priority
                               )
                           ) FILTER (WHERE fh.id IS NOT NULL), 
                           '[]'
                       ) as hazards
                FROM forms_processing fp
                LEFT JOIN processing_sessions ps ON fp.session_id = ps.id
                LEFT JOIN form_hazards fh ON fp.id = fh.form_processing_id
                WHERE fp.id = $1
                GROUP BY fp.id, ps.session_token, ps.user_identifier
            `;

      const result = await client.query(query, [formId]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error getting form by ID:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessionForms(sessionToken) {
    const client = await this.pool.connect();
    try {
      const query = `
                SELECT fp.*, ps.session_token
                FROM forms_processing fp
                JOIN processing_sessions ps ON fp.session_id = ps.id
                WHERE ps.session_token = $1
                ORDER BY fp.created_at DESC
            `;

      const result = await client.query(query, [sessionToken]);
      return result.rows;
    } catch (error) {
      logger.error("Error getting session forms:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Health check
  async healthCheck() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT COUNT(*) FROM forms_processing WHERE created_at >= NOW() - INTERVAL '1 hour'"
      );
      return {
        status: "healthy",
        recentForms: parseInt(result.rows[0].count),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  // Cleanup old data (for maintenance)
  async cleanupOldData(retentionDays = 90) {
    const client = await this.pool.connect();
    try {
      // Delete old audit logs
      const auditQuery = `DELETE FROM forms_audit_log WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`;
      const auditResult = await client.query(auditQuery);

      // Delete old sessions and cascade
      const sessionQuery = `DELETE FROM processing_sessions WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`;
      const sessionResult = await client.query(sessionQuery);

      logger.info(
        `Cleaned up ${auditResult.rowCount} audit logs and ${sessionResult.rowCount} old sessions`
      );

      return {
        auditLogsDeleted: auditResult.rowCount,
        sessionsDeleted: sessionResult.rowCount,
      };
    } catch (error) {
      logger.error("Error during cleanup:", error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new TrackingService();