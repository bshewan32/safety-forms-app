// Database Setup Script - Initialize Safety Forms Database
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
    console.log('🚀 Starting database setup...\n');
    
    try {
        // Test connection
        console.log('📡 Testing database connection...');
        const testResult = await pool.query('SELECT NOW()');
        console.log('✅ Connected to database at:', testResult.rows[0].now);
        console.log();

        // Create processing_sessions table
        console.log('📋 Creating processing_sessions table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS processing_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_token VARCHAR(255) UNIQUE NOT NULL,
                user_identifier VARCHAR(255),
                device_info JSONB,
                location_data JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ processing_sessions table ready');

        // Create forms table
        console.log('📋 Creating forms table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS forms (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID REFERENCES processing_sessions(id) ON DELETE CASCADE,
                form_type VARCHAR(100),
                file_name VARCHAR(255),
                file_size INTEGER,
                ocr_method VARCHAR(50),
                extracted_text TEXT,
                ai_analysis JSONB,
                risk_score INTEGER,
                confidence_score DECIMAL(5,2),
                status VARCHAR(50) DEFAULT 'pending',
                processing_time_ms INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ forms table ready');

        // Create audit_logs table
        console.log('📋 Creating audit_logs table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
                session_id UUID REFERENCES processing_sessions(id) ON DELETE CASCADE,
                event_type VARCHAR(100),
                event_data JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ audit_logs table ready');

        // Create analytics table
        console.log('📋 Creating analytics table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS analytics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                metric_name VARCHAR(100),
                metric_value DECIMAL(10,2),
                metadata JSONB,
                recorded_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ analytics table ready');

        // Create indexes for better performance
        console.log('📋 Creating indexes...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_forms_session_id ON forms(session_id);
            CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_forms_risk_score ON forms(risk_score);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_form_id ON audit_logs(form_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON processing_sessions(session_token);
        `);
        console.log('✅ Indexes created');

        // Verify tables
        console.log('\n📊 Verifying database schema...');
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('✅ Tables created:');
        tablesResult.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        console.log('\n🎉 Database setup complete!');
        console.log('\n✨ Your Safety Forms database is ready to use!');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        console.error('\nError details:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run setup
setupDatabase();