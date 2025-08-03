const OCRService = require('./src/services/ocr/ocrService');
const fs = require('fs');
const path = require('path');
require('dotenv').config();


async function testFormProcessing() {
  const ocrService = new OCRService();
  
  // Look for any image in uploads folder
  const uploadsDir = './uploads';
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const imageFiles = fs.readdirSync(uploadsDir).filter(file => 
    /\.(jpg|jpeg|png|pdf)$/i.test(file)
  );
  
  if (imageFiles.length === 0) {
    console.log('📁 No test images found in ./uploads/');
    console.log('💡 Add a safety form image to ./uploads/ and run this test again');
    return;
  }
  
  const testImage = path.join(uploadsDir, imageFiles[0]);
  console.log(`🧪 Testing with: ${testImage}`);
  
  try {
    const imageBuffer = fs.readFileSync(testImage);
    
    console.log('🔍 Processing with Google Vision API...');
    const result = await ocrService.extractText(imageBuffer, 'google_vision', {
      captureMethod: 'file_upload',
      deviceType: 'desktop'
    });
    
    console.log('✅ OCR Results:');
    console.log('📊 Provider:', result.provider);
    console.log('🎯 Confidence:', result.confidence + '%');
    console.log('📝 Text length:', result.text.length + ' characters');
    console.log('⏱️  Processing time:', result.processingTime + 'ms');
    console.log('📄 First 200 characters:', result.text.substring(0, 200) + '...');
    
    if (result.confidence > 90) {
      console.log('🎉 Excellent OCR quality!');
    } else if (result.confidence > 70) {
      console.log('👍 Good OCR quality');
    } else {
      console.log('⚠️  OCR quality could be better - try a clearer image');
    }
    
    await ocrService.cleanup();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFormProcessing();


