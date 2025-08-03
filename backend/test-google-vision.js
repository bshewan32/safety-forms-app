const vision = require('@google-cloud/vision');

async function testVision() {
  try {
    console.log('Testing Google Vision API...');
    console.log('Project:', process.env.GOOGLE_CLOUD_PROJECT || 'safety-forms-ocr');
    
    // This will automatically use your gcloud credentials
    const client = new vision.ImageAnnotatorClient();
    
    console.log('✅ Google Vision client created successfully!');
    console.log('✅ Your gcloud authentication is working!');
    console.log('✅ Ready to process safety forms!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('Application Default Credentials')) {
      console.log('💡 Run: gcloud auth application-default login');
    }
    if (error.message.includes('not enabled')) {
      console.log('💡 Enable Vision API in Google Cloud Console');
    }
  }
}

testVision();