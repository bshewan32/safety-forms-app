// backend/test-deepseek.js - Direct DeepSeek API test
require('dotenv').config();
const AIAnalysisService = require('./src/services/ai/aiAnalysisService');

async function testDeepSeek() {
  console.log('🧪 Testing DeepSeek API Integration...\n');

  // Sample safety form text (extracted from OCR)
  const sampleText = `
SAFE WORK METHOD STATEMENT (SWMS)
Project: Office Renovation - Level 3
Date: 15/07/2024
Worker: John Smith
Supervisor: Sarah Wilson

WORK DESCRIPTION:
Installing new electrical outlets in office cubicles
Working with 240V power supply
Using power drill and cable pulling equipment

HAZARDS IDENTIFIED:
- Electrical shock from live wires
- Falls from ladder work (2m height)
- Dust from drilling concrete walls

PPE REQUIRED:
- Safety glasses
- Work boots

CONTROL MEASURES:
- Turn off power at main switchboard
- Use insulated tools
- Step ladder to be used for height access

EMERGENCY CONTACTS:
Site Supervisor: 0412 345 678
  `;

  try {
    console.log('📝 Sample text length:', sampleText.length, 'characters');
    console.log('🔧 AI Provider:', process.env.AI_PROVIDER || 'deepseek');
    console.log('🔑 API Key configured:', !!process.env.DEEPSEEK_API_KEY);
    console.log('');

    const aiService = new AIAnalysisService();
    
    // Test health check first
    console.log('🏥 Health Check...');
    const health = await aiService.healthCheck();
    console.log('Health Status:', health);
    console.log('');

    if (health.status !== 'OK') {
      console.log('❌ Health check failed. Please check your configuration.');
      return;
    }

    // Test analysis
    console.log('🤖 Starting AI Analysis...');
    const startTime = Date.now();
    
    const analysis = await aiService.analyzeSafetyForm(sampleText, 'SWMS');
    
    const endTime = Date.now();
    console.log('✅ Analysis completed in', endTime - startTime, 'ms\n');

    // Display results
    console.log('📊 ANALYSIS RESULTS:');
    console.log('===================');
    console.log('Risk Score:', analysis.riskScore, '/10');
    console.log('Risk Level:', analysis.riskLevel);
    console.log('Supervisor Review Required:', analysis.requiresSupervisorReview);
    console.log('Form Completeness:', analysis.formCompleteness);
    console.log('');

    console.log('🚨 FLAGGED ISSUES (' + analysis.flaggedIssues.length + '):');
    analysis.flaggedIssues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.category}] ${issue.description}`);
      console.log(`   Severity: ${issue.severity}`);
      console.log(`   Recommendation: ${issue.recommendation}`);
      console.log('');
    });

    console.log('📋 COMPLIANCE ISSUES (' + analysis.complianceIssues.length + '):');
    analysis.complianceIssues.forEach((issue, index) => {
      console.log(`${index + 1}. Standard: ${issue.standard}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Action: ${issue.action}`);
      console.log('');
    });

    console.log('✅ POSITIVE FINDINGS:');
    analysis.positiveFindings.forEach((finding, index) => {
      console.log(`${index + 1}. ${finding}`);
    });
    console.log('');

    console.log('📝 SUMMARY:', analysis.summary);
    console.log('');

    console.log('🔧 METADATA:');
    console.log('Provider:', analysis.metadata.provider);
    console.log('Processing Time:', analysis.metadata.processingTimeMs + 'ms');
    console.log('Status:', analysis.analysisStatus);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDeepSeek();

