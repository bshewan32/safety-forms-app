#!/usr/bin/env node

// Test Tracking Integration Script
// Verifies that the database tracking is working properly

require('dotenv').config();
const trackingService = require('../backend/src/services/database/trackingService');
const { v4: uuidv4 } = require('uuid');

async function testTrackingIntegration() {
    console.log('🧪 Testing Safety Forms Tracking Integration');
    console.log('==========================================\n');

    try {
        // Test 1: Database Connection
        console.log('1️⃣  Testing database connection...');
        const health = await trackingService.healthCheck();
        if (health.status === 'healthy') {
            console.log('   ✅ Database connection: OK');
            console.log(`   📊 Recent forms processed: ${health.recentForms}`);
        } else {
            throw new Error(`Database unhealthy: ${health.error}`);
        }

        // Test 2: Session Management
        console.log('\n2️⃣  Testing session management...');
        const sessionData = {
            sessionToken: `test-${uuidv4()}`,
            userIdentifier: 'test-user-123',
            deviceInfo: {
                userAgent: 'Test Script v1.0',
                ip: '127.0.0.1',
                source: 'integration-test'
            },
            locationData: {
                latitude: -37.8136,
                longitude: 144.9631,
                accuracy: 10,
                location: 'Melbourne, VIC'
            }
        };

        const session = await trackingService.createProcessingSession(sessionData);
        console.log(`   ✅ Session created: ${session.id}`);
        console.log(`   🎫 Session token: ${session.session_token}`);

        // Test 3: Form Processing Record
        console.log('\n3️⃣  Testing form processing record...');
        const formData = {
            sessionId: session.id,
            originalFilename: 'test-safety-form.jpg',
            fileSizeBytes: 2048576, // 2MB
            fileType: 'image/jpeg',
            imageDimensions: { width: 1920, height: 1080 }
        };

        const formRecord = await trackingService.createFormProcessingRecord(formData);
        console.log(`   ✅ Form record created: ${formRecord.id}`);
        console.log(`   📄 Filename: ${formRecord.original_filename}`);

        // Test 4: OCR Results Update
        console.log('\n4️⃣  Testing OCR results tracking...');
        const ocrData = {
            providerUsed: 'tesseract',
            confidenceScore: 95.7,
            processingTimeMs: 3420,
            extractedTextLength: 1847,
            fallbackUsed: false,
            extractedText: 'HAZARD ASSESSMENT FORM\n\nSite: Construction Site A\nDate: 2025-08-01\nAssessor: John Smith\n\nHazards Identified:\n1. Unguarded machinery\n2. Poor lighting conditions\n3. Slippery surfaces\n\nRisk Level: HIGH\nRecommendations: Install guards, improve lighting, apply anti-slip coating'
        };

        const updatedForm = await trackingService.updateFormProcessingOCR(formRecord.id, ocrData);
        console.log(`   ✅ OCR data updated`);
        console.log(`   🔍 Provider: ${updatedForm.ocr_provider_used}`);
        console.log(`   📊 Confidence: ${updatedForm.ocr_confidence_score}%`);

        // Test 5: AI Analysis Results
        console.log('\n5️⃣  Testing AI analysis tracking...');
        const aiData = {
            aiProvider: 'deepseek',
            processingTimeMs: 18500,
            formTypeDetected: 'HAZARD_ASSESSMENT',
            riskScore: 8,
            riskLevel: 'HIGH',
            riskEscalated: false,
            supervisorFlagged: true,
            australianStandardsReferenced: ['AS/NZS 4801:2001', 'AS/NZS 1885.1:2015'],
            complianceGapsIdentified: 2,
            analysisResult: {
                formType: 'HAZARD_ASSESSMENT',
                riskAssessment: {
                    score: 8,
                    level: 'HIGH',
                    reasoning: 'Multiple high-severity hazards identified requiring immediate attention'
                },
                complianceCheck: {
                    status: 'PARTIAL',
                    gaps: ['Missing control measures', 'No review schedule defined']
                }
            },
            hazardsIdentified: [
                {
                    type: 'mechanical',
                    category: 'equipment',
                    severity: 9,
                    description: 'Unguarded machinery poses crushing/cutting risk',
                    locationOnForm: 'Hazards section, item 1',
                    australianStandardViolated: 'AS/NZS 4801:2001',
                    recommendedAction: 'Install machine guards immediately',
                    actionPriority: 'IMMEDIATE'
                },
                {
                    type: 'environmental',
                    category: 'workplace_conditions',
                    severity: 6,
                    description: 'Poor lighting increases accident risk',
                    locationOnForm: 'Hazards section, item 2',
                    recommendedAction: 'Improve lighting to minimum 500 lux',
                    actionPriority: 'HIGH'
                }
            ],
            recommendations: [
                'Install machine guards on all exposed machinery',
                'Upgrade lighting to meet AS/NZS standards',
                'Apply anti-slip coating to walkways',
                'Schedule weekly safety inspections'
            ]
        };

        const finalForm = await trackingService.updateFormProcessingAI(formRecord.id, aiData);
        console.log(`   ✅ AI analysis data updated`);
        console.log(`   ⚠️  Risk level: ${finalForm.risk_level} (${finalForm.risk_score}/10)`);
        console.log(`   👮 Supervisor flagged: ${finalForm.supervisor_flagged ? 'Yes' : 'No'}`);
        console.log(`   📋 Standards referenced: ${finalForm.australian_standards_referenced?.length || 0}`);

        // Test 6: Session Statistics Update
        console.log('\n6️⃣  Testing session statistics...');
        await trackingService.updateProcessingSession(session.id, {
            totalFormsProcessed: 1,
            totalProcessingTimeMs: 22000,
            endTime: new Date()
        });
        console.log('   ✅ Session statistics updated');

        // Test 7: Retrieval Functions
        console.log('\n7️⃣  Testing data retrieval...');
        
        // Get form by ID
        const retrievedForm = await trackingService.getFormById(formRecord.id);
        console.log(`   ✅ Form retrieval: Found ${retrievedForm.hazards.length} hazards`);
        
        // Get session forms
        const sessionForms = await trackingService.getSessionForms(session.session_token);
        console.log(`   ✅ Session forms: ${sessionForms.length} forms found`);

        // Test 8: Analytics
        console.log('\n8️⃣  Testing analytics...');
        
        // Processing summary
        const summary = await trackingService.getProcessingSummary('1 hour');
        console.log(`   ✅ Processing summary: ${summary.total_forms} total forms`);
        console.log(`   📊 Average risk score: ${parseFloat(summary.average_risk_score || 0).toFixed(1)}`);
        console.log(`   ⚡ Average processing time: ${parseInt(summary.average_processing_time || 0)}ms`);
        
        // Hazard trends
        const hazardTrends = await trackingService.getHazardTrends('1 day');
        console.log(`   ✅ Hazard trends: ${hazardTrends.length} hazard types identified`);
        if (hazardTrends.length > 0) {
            console.log(`   🔥 Top hazard: ${hazardTrends[0].hazard_type} (${hazardTrends[0].occurrence_count} occurrences)`);
        }

        // Test 9: Error Handling
        console.log('\n9️⃣  Testing error handling...');
        
        // Test error logging
        const errorFormData = {
            sessionId: session.id,
            originalFilename: 'error-test.jpg',
            fileSizeBytes: 1024,
            fileType: 'image/jpeg'
        };
        
        const errorForm = await trackingService.createFormProcessingRecord(errorFormData);
        await trackingService.markFormProcessingError(errorForm.id, {
            stage: 'ocr',
            error: 'Test error for integration testing',
            details: { testError: true }
        });
        console.log(`   ✅ Error logging: Form ${errorForm.id} marked as failed`);

        // Test 10: Cleanup (Optional)
        console.log('\n🧹 Cleaning up test data...');
        
        // Note: In production, you might want to keep test data for debugging
        // For now, we'll just report what was created
        console.log(`   📝 Created session: ${session.id}`);
        console.log(`   📝 Created forms: ${formRecord.id}, ${errorForm.id}`);
        console.log('   💡 Test data left in database for inspection');

        // Final Summary
        console.log('\n🎉 Integration Test Results:');
        console.log('============================');
        console.log('   ✅ Database connection');
        console.log('   ✅ Session management');
        console.log('   ✅ Form processing tracking');
        console.log('   ✅ OCR results storage');
        console.log('   ✅ AI analysis storage');
        console.log('   ✅ Hazard tracking');
        console.log('   ✅ Analytics queries');
        console.log('   ✅ Error handling');
        console.log('   ✅ Data retrieval');

        console.log('\n🚀 Tracking integration is working perfectly!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Deploy updated forms route');
        console.log('   2. Test with real form uploads');
        console.log('   3. Monitor analytics dashboard');
        console.log('   4. Set up production monitoring');

        return true;

    } catch (error) {
        console.error('\n❌ Integration test failed:', error);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Database connection failed - check:');
            console.error('   • DATABASE_URL environment variable');
            console.error('   • PostgreSQL server is running');
            console.error('   • Run: npm run db:setup');
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
            console.error('\n💡 Database tables missing - run:');
            console.error('   npm run db:setup');
        } else {
            console.error('\n💡 Unexpected error - check:');
            console.error('   • Database schema is deployed');
            console.error('   • TrackingService module path');
            console.error('   • Network connectivity');
        }
        
        return false;
    }
}

// Health check function for monitoring
async function quickHealthCheck() {
    try {
        const health = await trackingService.healthCheck();
        console.log('🏥 Database Health:', health.status);
        console.log('📊 Recent forms:', health.recentForms);
        console.log('⏰ Timestamp:', health.timestamp);
        return health.status === 'healthy';
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        return false;
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--health') || args.includes('-h')) {
        console.log('🔍 Quick Health Check');
        console.log('====================');
        const healthy = await quickHealthCheck();
        process.exit(healthy ? 0 : 1);
    } else {
        const success = await testTrackingIntegration();
        process.exit(success ? 0 : 1);
    }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n❌ Unhandled Rejection:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('\n❌ Uncaught Exception:', error);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⚠️  Test interrupted by user');
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ Test script failed:', error.message);
        process.exit(1);
    });
}

module.exports = { testTrackingIntegration, quickHealthCheck };