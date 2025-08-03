const vision = require('@google-cloud/vision');

console.log('Environment check:');
console.log('GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT);
console.log('DEEPSEEK_API_KEY exists:', !!process.env.DEEPSEEK_API_KEY);

async function testClean() {
  try {
    const client = new vision.ImageAnnotatorClient();
    console.log('✅ Google Vision client created without dotenv!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testClean();