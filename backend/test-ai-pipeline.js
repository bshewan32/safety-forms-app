// backend/test-ai-pipeline.js - Fixed version
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const FormProcessor = require('./src/services/forms/formProcessor');

async function testFullPipeline() {
  console.log('🔄 Testing Full AI Pipeline (OCR → AI Analysis)...\n');

  const formProcessor = new FormProcessor();
  const testImagePath = path.join(__dirname, 'test-images', 'sample-form.jpg');

  // Check if test image exists
  if (!fs.existsSync(testImagePath)) {
    console.log('❌ Test image not found at:', testImagePath);
    console.log('📁 Available files in test-images directory:');
    
    const testImagesDir = path.join(__dirname, 'test-images');
    if (fs.existsSync(testImagesDir)) {
      const files = fs.readdirSync(testImagesDir);
      files.forEach(file => console.log(`   - ${file}`));
      
      if (files.length > 0) {
        // Use the first available image
        const firstImage = files.find(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        if (firstImage) {
          console.log(`\n🔄 Using ${firstImage} instead...\n`);
          return testFullPipeline_withImage(path.join(testImagesDir, firstImage));
        }
      }
    } else {
      console.log('   Directory does not exist. Please create test-images/ directory and add a sample form image.');
    }
    return;
  }

  return testFullPipeline_withImage(testImagePath);
}

async function testFullPipeline_withImage(imagePath) {
  const formProcessor = new FormProcessor();
  
  try {
    console.log('📁 Processing test image:', imagePath);
    console.log('🔧 Environment check:');
    console.log('   - AI Provider:', process.env.AI_PROVIDER || 'deepseek');
    console.log('   - API Key configured:', !!process.env.DEEPSEEK_API_KEY);
    console.log('');

    // Test health check first
    console.log('🏥 System Health Check...');
    const health = await formProcessor.healthCheck();
    console.log('   - Overall Status:', health.status);
    console.log('   - OCR Service:', health.services?.ocr?.status || 'Unknown');
    console.log('   - AI Service:', health.services?.ai?.status || 'Unknown');
    console.log('');

    if (health.status !== 'OK') {
      console.log('⚠️ System health check shows issues. Proceeding anyway...\n');
    }

    console.log('🚀 Starting full pipeline processing...');
    const startTime = Date.now();
    
    const result = await formProcessor.processForm(imagePath);
    
    const endTime = Date.now();
    console.log('✅ Pipeline completed in', endTime - startTime, 'ms\n');

    if (!result.success) {
      console.log('❌ Processing failed:', result.error);
      return;
    }

    console.log('📊 PIPELINE RESULTS:');
    console.log('==================');
    console.log('✅ Success:', result.success);
    console.log('📋 Form Type:', result.formType);
    console.log('🔍 OCR Confidence:', result.ocrResult.confidence + '%');
    console.log('⚠️ Risk Score:', result.analysis.riskScore + '/10');
    console.log('📈 Final Risk Score:', result.analysis.finalRiskScore + '/10');
    console.log('🚨 Risk Level:', result.analysis.riskLevel);
    console.log('👨‍💼 Supervisor Review Required:', result.analysis.requiresSupervisorReview);
    console.log('📝 Form Completeness:', result.analysis.formCompleteness);
    console.log('⏱️ Total Processing Time:', result.processingTime + 'ms');
    console.log('');

    // Performance breakdown
    if (result.analysis.processingMetadata) {
      console.log('⏱️ PERFORMANCE BREAKDOWN:');
      console.log('   - OCR Time:', result.analysis.processingMetadata.ocrTime + 'ms');
      console.log('   - AI Analysis Time:', result.analysis.processingMetadata.aiTime + 'ms');
      console.log('   - Total Time:', result.analysis.processingMetadata.totalTime + 'ms');
      console.log('');
    }

    console.log('🔍 EXTRACTED TEXT PREVIEW:');
    console.log('=' .repeat(50));
    const textPreview = result.ocrResult.text.substring(0, 300);
    console.log(textPreview + (result.ocrResult.text.length > 300 ? '...' : ''));
    console.log('=' .repeat(50));
    console.log('Full text length:', result.ocrResult.text.length, 'characters\n');

    console.log('🚨 FLAGGED ISSUES (' + result.analysis.flaggedIssues.length + '):');
    result.analysis.flaggedIssues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.category}] ${issue.severity}`);
      console.log(`   Issue: ${issue.description}`);
      console.log(`   Recommendation: ${issue.recommendation}`);
      if (issue.location) {
        console.log(`   Location: ${issue.location}`);
      }
      console.log('');
    });

    if (result.analysis.complianceIssues && result.analysis.complianceIssues.length > 0) {
      console.log('📋 COMPLIANCE ISSUES (' + result.analysis.complianceIssues.length + '):');
      result.analysis.complianceIssues.forEach((issue, index) => {
        console.log(`${index + 1}. Standard: ${issue.standard}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Required Action: ${issue.action}`);
        console.log('');
      });
    }

    if (result.analysis.positiveFindings && result.analysis.positiveFindings.length > 0) {
      console.log('✅ POSITIVE FINDINGS:');
      result.analysis.positiveFindings.forEach((finding, index) => {
        console.log(`${index + 1}. ${finding}`);
      });
      console.log('');
    }

    if (result.analysis.missingFields && result.analysis.missingFields.length > 0) {
      console.log('⚠️ MISSING FIELDS:');
      result.analysis.missingFields.forEach((field, index) => {
        console.log(`${index + 1}. ${field}`);
      });
      console.log('');
    }

    console.log('📝 SUMMARY:');
    console.log(result.analysis.summary);
    console.log('');

    console.log('🔧 TECHNICAL METADATA:');
    console.log('   - AI Provider:', result.analysis.metadata?.provider || 'Unknown');
    console.log('   - AI Model:', result.analysis.metadata?.model || 'Unknown');
    console.log('   - Analysis Status:', result.analysis.analysisStatus || 'Unknown');
    console.log('   - Timestamp:', result.analysis.metadata?.timestamp || new Date().toISOString());
    console.log('');

    console.log('🎉 Full pipeline test completed successfully!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   - Test the upload API endpoint: node test-upload-endpoint.js');
    console.log('   - Start building the frontend interface');
    console.log('   - Consider adding more test images for validation');

  } catch (error) {
    console.error('❌ Pipeline test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Additional debugging info
    console.log('\n🔍 DEBUGGING INFO:');
    console.log('   - Image path:', imagePath);
    console.log('   - Image exists:', fs.existsSync(imagePath));
    console.log('   - AI Provider:', process.env.AI_PROVIDER);
    console.log('   - API Key configured:', !!process.env.DEEPSEEK_API_KEY);
  }
}

// Helper function to create a simple test image if none exists
async function createTestImage() {
  const testDir = path.join(__dirname, 'test-images');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  console.log('📁 Created test-images directory');
  console.log('   Please add a safety form image (JPG, PNG) to this directory');
  console.log('   Example: sample-form.jpg, swms-form.png, etc.');
}

// Run the test
if (require.main === module) {
  testFullPipeline().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testFullPipeline, testFullPipeline_withImage };