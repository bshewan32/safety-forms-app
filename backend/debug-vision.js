const vision = require('@google-cloud/vision');
require('dotenv').config();


async function debugVision() {
  console.log('🔍 Debugging Google Vision API setup...');
  
  // Check environment
  console.log('📋 Environment check:');
  console.log('  GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT || 'NOT SET');
  console.log('  GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET (using gcloud auth)');
  
  // Check gcloud auth
  console.log('\n🔐 Checking gcloud authentication...');
  const { exec } = require('child_process');
  
  exec('gcloud auth list --filter=status:ACTIVE --format="value(account)"', (error, stdout, stderr) => {
    if (error) {
      console.log('❌ gcloud auth check failed:', error.message);
    } else {
      console.log('✅ Active gcloud account:', stdout.trim());
    }
  });
  
  exec('gcloud config get-value project', (error, stdout, stderr) => {
    if (error) {
      console.log('❌ gcloud project check failed:', error.message);
    } else {
      console.log('✅ Active gcloud project:', stdout.trim());
    }
  });
  
  // Test Vision API client creation
  console.log('\n🧪 Testing Vision API client creation...');
  
  try {
    const client = new vision.ImageAnnotatorClient();
    console.log('✅ Vision client created successfully');
    
    // Test a simple API call
    console.log('🧪 Testing API permissions...');
    
    // This should work without any image - just tests auth
    const request = {
      image: {
        content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')
      }
    };
    
    const [result] = await client.textDetection(request);
    console.log('✅ Vision API call successful!');
    console.log('✅ Google Vision is ready to use!');
    
  } catch (error) {
    console.error('❌ Vision API error:', error.message);
    console.error('❌ Error code:', error.code);
    
    if (error.message.includes('API has not been used')) {
      console.log('💡 Solution: Enable Vision API in Google Cloud Console');
      console.log('   Go to: https://console.cloud.google.com/apis/library/vision.googleapis.com?project=safety-forms-ocr');
    }
    
    if (error.message.includes('permission')) {
      console.log('💡 Solution: Check project permissions or billing');
    }
    
    if (error.message.includes('quota')) {
      console.log('💡 Solution: Check API quotas in Google Cloud Console');
    }
  }
}

debugVision();

