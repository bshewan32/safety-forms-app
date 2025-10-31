// Database Tracking Service - PATCHED VERSION (Non-Crashing)
const { Pool } = require('pg');
const logger = require('../utils/logger');

class TrackingService {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.initializePool();
    }

    initializePool() {
        try {
            if (!process.env.DATABASE_URL) {
                logger.warn('DATABASE_URL not configured - running without database tracking');
                return;
            }

            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                connectionTimeoutMillis: 5000,
                idleTimeoutMillis: 30000,
                max: 10
            });

            // Handle pool errors gracefully
            this.pool.on('error', (err) => {
                logger.error('Unexpected database pool error:', err);
                this.isConnected = false;
            });

            // Test connection asynchronously (non-blocking)
            this.testConnectionAsync();

        } catch (error) {
            logger.error('Failed to initialize database pool:', error);
            this.isConnected = false;
        }
    }

    async testConnectionAsync() {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            this.isConnected = true;
            logger.info('Database connection successful');
        } catch (error) {
            logger.warn('Database connection failed - running in offline mode:', error.message);
            this.isConnected = false;
        }
    }

    async testConnection() {
        if (!this.pool) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as current_time');
            client.release();
            this.isConnected = true;
            return { 
                success: true, 
                timestamp: result.rows[0].current_time 
            };
        } catch (error) {
            this.isConnected = false;
            logger.error('Database connection test failed:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // Wrapper for all database operations
    async safeQuery(queryFn, fallbackValue = null) {
        if (!this.pool || !this.isConnected) {
            logger.debug('Database not available, skipping query');
            return fallbackValue;
        }

        try {
            return await queryFn();
        } catch (error) {
            logger.warn('Database query failed:', error.message);
            this.isConnected = false;
            return fallbackValue;
        }
    }

    // Create processing session
    async createProcessingSession({ sessionToken, userIdentifier, deviceInfo, locationData }) {
        return this.safeQuery(async () => {
            const query = `
                INSERT INTO processing_sessions (
                    session_token, user_identifier, device_info, 
                    location_data, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (session_token) 
                DO UPDATE SET 
                    updated_at = NOW(),
                    device_info = EXCLUDED.device_info,
                    location_data = EXCLUDED.location_data
                RETURNING *
            `;
            
            const result = await this.pool.query(query, [
                sessionToken,
                userIdentifier,
                deviceInfo,
                locationData
            ]);
            
            return result.rows[0];
        }, { id: sessionToken, session_token: sessionToken });
    }

    // Create form record
    async createFormRecord({ sessionId, formType, fileName, fileSize, ocrMethod }) {
        return this.safeQuery(async () => {
            const query = `
                INSERT INTO forms (
                    session_id, form_type, file_name, file_size,
                    ocr_method, status, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
                RETURNING *
            `;
            
            const result = await this.pool.query(query, [
                sessionId,
                formType,
                fileName,
                fileSize,
                ocrMethod
            ]);
            
            return result.rows[0];
        }, { id: `temp-${Date.now()}`, status: 'pending' });
    }

    // Update form analysis
    async updateFormAnalysis(formId, analysisData) {
        return this.safeQuery(async () => {
            const query = `
                UPDATE forms
                SET 
                    extracted_text = $1,
                    ai_analysis = $2,
                    risk_score = $3,
                    status = $4,
                    confidence_score = $5,
                    processing_time_ms = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING *
            `;
            
            const result = await this.pool.query(query, [
                analysisData.extractedText,
                analysisData.aiAnalysis,
                analysisData.riskScore,
                analysisData.status || 'completed',
                analysisData.confidenceScore,
                analysisData.processingTimeMs,
                formId
            ]);
            
            return result.rows[0];
        }, { id: formId, status: 'completed' });
    }

    // Log audit event
    async logAuditEvent(formId, sessionId, eventType, eventData) {
        return this.safeQuery(async () => {
            const query = `
                INSERT INTO audit_logs (
                    form_id, session_id, event_type, event_data, created_at
                )
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING *
            `;
            
            const result = await this.pool.query(query, [
                formId,
                sessionId,
                eventType,
                eventData
            ]);
            
            return result.rows[0];
        });
    }

    // Get analytics summary
    async getAnalyticsSummary(startDate, endDate) {
        return this.safeQuery(async () => {
            const query = `
                SELECT 
                    COUNT(*) as total_forms,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    AVG(risk_score) as avg_risk_score,
                    AVG(confidence_score) as avg_confidence,
                    AVG(processing_time_ms) as avg_processing_time,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_forms,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_forms
                FROM forms
                WHERE created_at BETWEEN $1 AND $2
            `;
            
            const result = await this.pool.query(query, [startDate, endDate]);
            return result.rows[0];
        }, {
            total_forms: 0,
            unique_sessions: 0,
            avg_risk_score: 0,
            avg_confidence: 0,
            avg_processing_time: 0,
            completed_forms: 0,
            failed_forms: 0
        });
    }

    // Get recent forms
    async getRecentForms(limit = 10) {
        return this.safeQuery(async () => {
            const query = `
                SELECT 
                    f.*,
                    ps.user_identifier,
                    ps.device_info
                FROM forms f
                LEFT JOIN processing_sessions ps ON f.session_id = ps.id
                ORDER BY f.created_at DESC
                LIMIT $1
            `;
            
            const result = await this.pool.query(query, [limit]);
            return result.rows;
        }, []);
    }

    // Cleanup old sessions (for maintenance)
    async cleanupOldSessions(daysOld = 90) {
        return this.safeQuery(async () => {
            const query = `
                DELETE FROM processing_sessions
                WHERE created_at < NOW() - INTERVAL '${daysOld} days'
                RETURNING COUNT(*) as deleted_count
            `;
            
            const result = await this.pool.query(query);
            return result.rows[0];
        }, { deleted_count: 0 });
    }

    // Create form processing record (alias for createFormRecord)
    async createFormProcessingRecord({ sessionId, formType, fileName, fileSize, ocrMethod }) {
        return this.createFormRecord({ sessionId, formType, fileName, fileSize, ocrMethod });
    }

    // Update form processing with OCR results
    async updateFormProcessingOCR(formId, ocrData) {
        return this.safeQuery(async () => {
            const query = `
                UPDATE forms
                SET 
                    extracted_text = $2,
                    ocr_method = $3,
                    confidence_score = $4,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await this.pool.query(query, [
                formId,
                ocrData.extractedText,
                ocrData.ocrMethod,
                ocrData.confidence
            ]);
            return result.rows[0];
        }, { id: formId, updated: true });
    }

    // Update form processing with AI analysis results
    async updateFormProcessingAI(formId, aiData) {
        return this.safeQuery(async () => {
            const query = `
                UPDATE forms
                SET 
                    ai_analysis = $2,
                    risk_score = $3,
                    status = $4,
                    confidence_score = $5,
                    processing_time_ms = $6,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await this.pool.query(query, [
                formId,
                aiData.analysis,
                aiData.riskScore,
                aiData.status || 'completed',
                aiData.confidence,
                aiData.processingTime
            ]);
            return result.rows[0];
        }, { id: formId, status: 'completed' });
    }

    // Mark form processing as error
    async markFormProcessingError(formId, error) {
        return this.safeQuery(async () => {
            const query = `
                UPDATE forms
                SET 
                    status = 'failed',
                    ai_analysis = $2,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await this.pool.query(query, [
                formId,
                { error: error.message || error }
            ]);
            return result.rows[0];
        }, { id: formId, status: 'failed' });
    }

    // Update processing session statistics
    async updateProcessingSession(sessionId, stats) {
        return this.safeQuery(async () => {
            const query = `
                UPDATE processing_sessions
                SET 
                    updated_at = NOW(),
                    device_info = COALESCE($2, device_info)
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await this.pool.query(query, [sessionId, stats]);
            return result.rows[0];
        }, { id: sessionId, updated: true });
    }

    // Close pool connection
    async close() {
        if (this.pool) {
            try {
                await this.pool.end();
                logger.info('Database connection pool closed');
            } catch (error) {
                logger.error('Error closing database pool:', error);
            }
        }
    }
}

// Export singleton instance
module.exports = new TrackingService();