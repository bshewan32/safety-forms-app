#!/usr/bin/env node

// Database Setup Script
// Deploys the tracking schema to your PostgreSQL database

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database schema SQL
const SCHEMA_SQL = `
-- Safety Forms Tracking Database Schema
-- Comprehensive tracking for analytics, compliance, and audit trails

-- Processing sessions to track user journeys
CREATE TABLE IF NOT EXISTS processing_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_identifier VARCHAR(255),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    total_forms_processed INTEGER DEFAULT 0,
    total_processing_time_ms INTEGER DEFAULT 0,
    device_info JSONB,
    location_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Main forms processing table
CREATE TABLE IF NOT EXISTS forms_processing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES processing_sessions(id),
    
    -- File metadata
    original_filename VARCHAR(500),
    file_size_bytes INTEGER,
    file_type VARCHAR(100),
    image_dimensions JSONB,
    
    -- Processing metadata
    processing_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_end_time TIMESTAMP WITH TIME ZONE,
    total_processing_time_ms INTEGER,
    
    -- OCR details
    ocr_provider_used VARCHAR(50),
    ocr_confidence_score DECIMAL(5,2),
    ocr_processing_time_ms INTEGER,
    extracted_text_length INTEGER,
    ocr_fallback_used BOOLEAN DEFAULT FALSE,
    
    -- AI Analysis details
    ai_provider VARCHAR(50) DEFAULT 'deepseek',
    ai_processing_time_ms INTEGER,
    form_type_detected VARCHAR(100),
    
    -- Risk assessment
    risk_score INTEGER,
    risk_level VARCHAR(20),
    risk_escalated BOOLEAN DEFAULT FALSE,
    supervisor_flagged BOOLEAN DEFAULT FALSE,
    
    -- Compliance
    australian_standards_referenced TEXT[],
    compliance_gaps_identified INTEGER DEFAULT 0,
    
    -- Results storage
    extracted_text TEXT,
    ai_analysis_result JSONB,
    hazards_identified JSONB,
    recommendations JSONB,
    
    -- Status tracking
    processing_status VARCHAR(50) DEFAULT 'processing',
    error_details JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual hazards identified in forms
CREATE TABLE IF NOT EXISTS form_hazards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_processing_id UUID REFERENCES forms_processing(id),
    
    hazard_type VARCHAR(100),
    hazard_category VARCHAR(100),
    severity_level INTEGER,
    description TEXT,
    location_on_form TEXT,
    
    -- Compliance tracking
    australian_standard_violated VARCHAR(100),
    regulatory_requirement TEXT,
    
    -- Remediation
    recommended_action TEXT,
    action_priority VARCHAR(20),
    estimated_cost_impact VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log for all processing activities
CREATE TABLE IF NOT EXISTS forms_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_processing_id UUID REFERENCES forms_processing(id),
    session_id UUID REFERENCES processing_sessions(id),
    
    event_type VARCHAR(100),
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_details JSONB,
    
    -- System information
    server_instance VARCHAR(100),
    api_version VARCHAR(20),
    processing_node VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site/location tracking for multi-site analysis
CREATE TABLE IF NOT EXISTS processing_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name VARCHAR(200),
    site_code VARCHAR(50),
    coordinates POINT,
    address TEXT,
    site_type VARCHAR(100),
    
    -- Site statistics (calculated fields)
    total_forms_processed INTEGER DEFAULT 0,
    average_risk_score DECIMAL(3,2),
    high_risk_forms_count INTEGER DEFAULT 0,
    last_processing_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link forms to locations
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'forms_processing' 
        AND column_name = 'location_id'
    ) THEN
        ALTER TABLE forms_processing 
        ADD COLUMN location_id UUID REFERENCES processing_locations(id);
    END IF;
END $$;

-- Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_forms_processing_session ON forms_processing(session_id);
CREATE INDEX IF NOT EXISTS idx_forms_processing_risk_level ON forms_processing(risk_level);
CREATE INDEX IF NOT EXISTS idx_forms_processing_created_at ON forms_processing(created_at);
CREATE INDEX IF NOT EXISTS idx_forms_processing_form_type ON forms_processing(form_type_detected);
CREATE INDEX IF NOT EXISTS idx_forms_processing_status ON forms_processing(processing_status);

CREATE INDEX IF NOT EXISTS idx_form_hazards_form_id ON form_hazards(form_processing_id);
CREATE INDEX IF NOT EXISTS idx_form_hazards_severity ON form_hazards(severity_level);
CREATE INDEX IF NOT EXISTS idx_form_hazards_type ON form_hazards(hazard_type);

CREATE INDEX IF NOT EXISTS idx_audit_log_form_id ON forms_audit_log(form_processing_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON forms_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON forms_audit_log(event_timestamp);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON processing_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON processing_sessions(start_time);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_processing_sessions_updated_at ON processing_sessions;
CREATE TRIGGER update_processing_sessions_updated_at 
    BEFORE UPDATE ON processing_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_forms_processing_updated_at ON forms_processing;
CREATE TRIGGER update_forms_processing_updated_at 
    BEFORE UPDATE ON forms_processing 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_processing_locations_updated_at ON processing_locations;
CREATE TRIGGER update_processing_locations_updated_at 
    BEFORE UPDATE ON processing_locations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample views for common analytics queries
CREATE OR REPLACE VIEW high_risk_forms_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as processing_date,
    COUNT(*) as total_forms,
    COUNT(*) FILTER (WHERE risk_level IN ('HIGH', 'CRITICAL')) as high_risk_count,
    AVG(risk_score) as average_risk_score,
    AVG(total_processing_time_ms) as average_processing_time,
    STRING_AGG(DISTINCT form_type_detected, ', ') as form_types_processed
FROM forms_processing 
WHERE processing_status = 'completed'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY processing_date DESC;

CREATE OR REPLACE VIEW hazard_trends AS
SELECT 
    hazard_type,
    hazard_category,
    COUNT(*) as occurrence_count,
    AVG(severity_level) as average_severity,
    STRING_AGG(DISTINCT australian_standard_violated, ', ') as standards_violated,
    DATE_TRUNC('week', created_at) as week_starting
FROM form_hazards 
GROUP BY hazard_type, hazard_category, DATE_TRUNC('week', created_at)
ORDER BY week_starting DESC, occurrence_count DESC;
`;

async function setupDatabase() {
    console.log('🚀 Setting up Safety Forms Tracking Database...\n');

    // Initialize connection pool
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        // Test connection
        console.log('📡 Testing database connection...');
        const client = await pool.connect();
        const result = await client.query('SELECT NOW(), version()');
        console.log('✅ Connected to PostgreSQL:', result.rows[0].version.split(' ').slice(0, 2).join(' '));
        console.log('⏰ Server time:', result.rows[0].now);
        client.release();

        // Check if tables already exist
        console.log('\n🔍 Checking existing schema...');
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('processing_sessions', 'forms_processing', 'form_hazards', 'forms_audit_log')
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log('📋 Found existing tables:', tableCheck.rows.map(r => r.table_name).join(', '));
            console.log('⚠️  This will update the schema safely with IF NOT EXISTS clauses');
        } else {
            console.log('📄 No existing tracking tables found - fresh installation');
        }

        // Deploy schema
        console.log('\n🏗️  Deploying database schema...');
        await pool.query(SCHEMA_SQL);
        console.log('✅ Schema deployed successfully!');

        // Verify installation
        console.log('\n🔬 Verifying installation...');
        const verification = await pool.query(`
            SELECT 
                table_name,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
            FROM information_schema.tables t
            WHERE table_schema = 'public' 
            AND table_name IN ('processing_sessions', 'forms_processing', 'form_hazards', 'forms_audit_log', 'processing_locations')
            ORDER BY table_name
        `);

        console.log('\n📊 Database Tables Created:');
        verification.rows.forEach(table => {
            console.log(`   ✓ ${table.table_name} (${table.column_count} columns)`);
        });

        // Check indexes
        const indexCheck = await pool.query(`
            SELECT schemaname, tablename, indexname 
            FROM pg_indexes 
            WHERE tablename IN ('processing_sessions', 'forms_processing', 'form_hazards', 'forms_audit_log')
            AND indexname LIKE 'idx_%'
            ORDER BY tablename, indexname
        `);

        console.log('\n🔍 Performance Indexes:');
        indexCheck.rows.forEach(idx => {
            console.log(`   ✓ ${idx.tablename}.${idx.indexname}`);
        });

        // Check views
        const viewCheck = await pool.query(`
            SELECT viewname 
            FROM pg_views 
            WHERE schemaname = 'public' 
            AND viewname IN ('high_risk_forms_summary', 'hazard_trends')
            ORDER BY viewname
        `);

        console.log('\n📈 Analytics Views:');
        viewCheck.rows.forEach(view => {
            console.log(`   ✓ ${view.viewname}`);
        });

        // Test basic functionality
        console.log('\n🧪 Testing basic functionality...');
        
        // Test session creation
        const testSession = await pool.query(`
            INSERT INTO processing_sessions (session_token, user_identifier, device_info) 
            VALUES ('test-setup-session', 'setup-script', '{"test": true}') 
            RETURNING id, session_token
        `);
        console.log(`   ✓ Session creation: ${testSession.rows[0].id}`);

        // Test form processing record
        const testForm = await pool.query(`
            INSERT INTO forms_processing (session_id, original_filename, processing_status) 
            VALUES ($1, 'test-setup.jpg', 'completed') 
            RETURNING id
        `, [testSession.rows[0].id]);
        console.log(`   ✓ Form processing record: ${testForm.rows[0].id}`);

        // Test audit logging
        await pool.query(`
            INSERT INTO forms_audit_log (form_processing_id, session_id, event_type, event_details) 
            VALUES ($1, $2, 'setup_test', '{"test": "successful"}')
        `, [testForm.rows[0].id, testSession.rows[0].id]);
        console.log(`   ✓ Audit logging working`);

        // Clean up test data
        await pool.query('DELETE FROM processing_sessions WHERE session_token = $1', ['test-setup-session']);
        console.log(`   ✓ Test cleanup completed`);

        // Show summary statistics
        console.log('\n📊 Database Ready for Production:');
        console.log('   • Full tracking schema deployed');
        console.log('   • Performance indexes created');
        console.log('   • Analytics views available');
        console.log('   • Audit trail configured');
        console.log('   • Auto-timestamping enabled');
        
        console.log('\n🎯 Next Steps:');
        console.log('   1. Update your backend routes to use TrackingService');
        console.log('   2. Test with a real form upload');
        console.log('   3. Access analytics at /api/forms/analytics/summary');
        console.log('   4. Monitor health at /api/forms/health');

        console.log('\n✅ Database setup completed successfully!');

    } catch (error) {
        console.error('\n❌ Database setup failed:', error);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Connection refused - check:');
            console.error('   • DATABASE_URL environment variable');
            console.error('   • PostgreSQL server is running');
            console.error('   • Network connectivity to database');
        } else if (error.code === '28000') {
            console.error('\n💡 Authentication failed - check:');
            console.error('   • Database credentials in DATABASE_URL');
            console.error('   • User permissions for schema creation');
        } else if (error.code === '3D000') {
            console.error('\n💡 Database does not exist - check:');
            console.error('   • Database name in DATABASE_URL');
            console.error('   • Database was created on the server');
        }
        
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Environment variable validation
function validateEnvironment() {
    if (!process.env.DATABASE_URL) {
        console.error('❌ Missing DATABASE_URL environment variable');
        console.error('\n💡 Set your Railway PostgreSQL connection string:');
        console.error('   export DATABASE_URL="postgresql://username:password@host:port/database"');
        console.error('\n   Or create a .env file with:');
        console.error('   DATABASE_URL=postgresql://username:password@host:port/database');
        process.exit(1);
    }

    console.log('✅ Environment variables validated');
    console.log('📍 Database URL:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
}

// Main execution
async function main() {
    console.log('🔧 Safety Forms Database Setup Script');
    console.log('=====================================\n');

    // Load environment variables
    require('dotenv').config();
    
    // Validate environment
    validateEnvironment();
    
    // Setup database
    await setupDatabase();
}

// Error handling for the script
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('\n❌ Uncaught Exception:', error);
    process.exit(1);
});

// Handle script interruption
process.on('SIGINT', () => {
    console.log('\n⚠️  Setup interrupted by user');
    process.exit(0);
});

// Run the setup if this script is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ Setup failed:', error.message);
        process.exit(1);
    });
}

module.exports = { setupDatabase, SCHEMA_SQL };