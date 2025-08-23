const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  try {
    // Создаем тестовый файл
    const testFilePath = path.join(__dirname, 'test-image.jpg');
    if (!fs.existsSync(testFilePath)) {
      // Создаем простой тестовый файл
      const buffer = Buffer.from('test image content');
      fs.writeFileSync(testFilePath, buffer);
      console.log('Created test file:', testFilePath);
    }

    // Создаем FormData
    const formData = new FormData();
    formData.append('sku', 'TEST123');
    formData.append('files', fs.createReadStream(testFilePath));

    console.log('Testing upload API...');
    
    // Отправляем запрос
    const response = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (response.status === 200) {
      console.log('✅ Upload test PASSED');
      return true;
    } else {
      console.log('❌ Upload test FAILED');
      return false;
    }

  } catch (error) {
    console.error('Test error:', error);
    return false;
  }
}

// Запускаем тест если файл выполняется напрямую
if (require.main === module) {
  testUpload().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testUpload };