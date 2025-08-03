// -----------------------------------------------------------

// backend/test-upload-endpoint.js - Test the actual API endpoint
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUploadEndpoint() {
  console.log('🌐 Testing Upload API Endpoint...\n');

  const testImagePath = path.join(__dirname, 'test-images', 'sample-form.jpg');
  
  if (!fs.existsSync(testImagePath)) {
    console.log('❌ Test image not found at:', testImagePath);
    console.log('Please ensure you have a test image in the test-images directory');
    return;
  }

  try {
    // Check if server is running
    console.log('🏥 Checking server health...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('Server Status:', healthResponse.data.status);
    console.log('');

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(testImagePath));
    form.append('formType', 'SWMS');

    console.log('📤 Uploading test form...');
    const startTime = Date.now();

    const response = await axios.post('http://localhost:3001/api/forms/upload', form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 60000 // 60 second timeout for AI processing
    });

    const endTime = Date.now();
    console.log('✅ Upload completed in', endTime - startTime, 'ms\n');

    console.log('📊 API RESPONSE:');
    console.log('===============');
    console.log('Success:', response.data.success);
    console.log('File ID:', response.data.result.fileId);
    console.log('Risk Score:', response.data.result.analysis.riskScore + '/10');
    console.log('Risk Level:', response.data.result.analysis.riskLevel);
    console.log('Supervisor Review:', response.data.result.analysis.requiresSupervisorReview);
    console.log('');

    console.log('🚨 FLAGGED ISSUES:');
    response.data.result.analysis.flaggedIssues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.category}] ${issue.description}`);
    });
    console.log('');

    console.log('✅ API endpoint test completed successfully!');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server not running. Please start with: npm run dev');
    } else if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Test failed:', error.message);
    }
  }
}

// Uncomment to run endpoint test (make sure server is running first)
testUploadEndpoint();