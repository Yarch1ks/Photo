import { writeFile, mkdir, access, unlink } from 'fs/promises'
import { join } from 'path'

// Простая функция генерации имени файла
function generateFileName(sku, index, extension) {
  return `${sku}_${String(index).padStart(3, '0')}.${extension}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('=== UPLOAD API START (pages) ===')
    
    // Для pages/api нам нужно обработать multipart/form-data вручную
    // или использовать middleware, но для простоты используем ту же логику
    
    const formData = req.body
    const sku = formData.sku
    const files = Array.isArray(formData.files) ? formData.files : [formData.files].filter(Boolean)
    
    console.log('FormData entries:', Object.keys(formData))
    
    if (!sku) {
      console.error('SKU is required')
      return res.status(400).json({ error: 'SKU is required' })
    }

    if (!files || files.length === 0) {
      console.error('No files provided')
      return res.status(400).json({ error: 'No files provided' })
    }

    console.log(`Processing ${files.length} files for SKU: ${sku}`)
    
    // Детальное логирование переменных окружения для диагностики
    console.log('Environment variables for debugging:')
    console.log('NODE_ENV:', process.env.NODE_ENV)
    console.log('RAILWAY_SERVICE_NAME:', process.env.RAILWAY_SERVICE_NAME)
    console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT)
    
    // Множественные способы определения продакшн-окружения
    const isProduction = 
      process.env.NODE_ENV === 'production' || 
      process.env.RAILWAY_SERVICE_NAME || 
      process.env.RAILWAY_ENVIRONMENT === 'production' ||
      process.env.VERCEL_ENV === 'production'
    
    const uploadDir = isProduction ? '/tmp/uploads' : './uploads'
    
    console.log(`Upload directory: ${uploadDir}, Production: ${isProduction}`)
    
    try {
      // Проверяем доступность директории с более надежной обработкой
      try {
        await access(uploadDir)
        console.log(`Directory already exists: ${uploadDir}`)
        
        // Проверяем права на запись
        const testFilePath = join(uploadDir, '.test-write')
        await writeFile(testFilePath, 'test')
        await unlink(testFilePath)
        console.log(`Directory is writable: ${uploadDir}`)
        
      } catch {
        // Создаем директорию если не существует
        console.log(`Creating directory: ${uploadDir}`)
        await mkdir(uploadDir, { recursive: true, mode: 0o755 })
        console.log(`Directory created: ${uploadDir}`)
        
        // Проверяем что директория создалась и доступна для записи
        const testFilePath = join(uploadDir, '.test-write')
        await writeFile(testFilePath, 'test')
        await unlink(testFilePath)
        console.log(`New directory is writable: ${uploadDir}`)
      }
    } catch (error) {
      console.error('❌ CRITICAL: Error accessing/creating directory:', error)
      return res.status(500).json({ 
        error: 'Storage directory inaccessible',
        details: error instanceof Error ? error.message : 'Unknown error',
        uploadDir,
        isProduction
      })
    }

    const processedFiles = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`)
      
      // Сохраняем оригинальное расширение файла
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const fileName = `${sku}_${String(i + 1).padStart(3, '0')}.${fileExtension}`
      const filePath = join(uploadDir, fileName)

      console.log(`File path: ${filePath}`)
      console.log(`File size: ${file.size}`)
      console.log(`File type: ${file.type}`)

      try {
        // Сохраняем файл
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(filePath, buffer)
        console.log(`✅ File saved successfully: ${filePath}`)
      } catch (error) {
        console.error(`❌ Error saving file ${filePath}:`, error)
        return res.status(500).json({ error: `Failed to save file: ${file.name}` })
      }

      processedFiles.push({
        id: `file_${i + 1}`,
        originalName: file.name,
        fileName: fileName,
        filePath: filePath,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        size: file.size,
        sku: sku
      })
    }

    console.log('=== UPLOAD API SUCCESS ===')
    console.log('Processed files:', processedFiles)
    
    return res.status(200).json({
      success: true,
      files: processedFiles,
      sku: sku
    })

  } catch (error) {
    console.error('❌ UPLOAD API ERROR:', error)
    return res.status(500).json({
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Обработка multipart/form-data для pages/api
export const config = {
  api: {
    bodyParser: false,
  },
}