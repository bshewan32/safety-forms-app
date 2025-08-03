const OCRService = require('./src/services/ocr/ocrService');
const path = require('path');

async function testOCR() {
  const ocrService = new OCRService();
  
  // Add a test image to backend/test-images/
  const testImagePath = path.join(__dirname, 'test-images', 'sample-form.jpg');
  
  try {
    const result = await ocrService.extractSafetyFormData(testImagePath);
    console.log('OCR Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('OCR Test failed:', error);
  }
}

testOCR();