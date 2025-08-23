import { readFile, unlink, writeFile, open } from 'fs/promises'
import { join } from 'path'

// Ограничение на одновременные запросы к PhotoRoom
const MAX_CONCURRENT_REQUESTS = 3
let activeRequests = 0

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body
    const { sku, files } = body

    if (!sku || !files || files.length === 0) {
      return res.status(400).json({ error: 'SKU and files are required' })
    }

    const results = []

    // Фильтруем только изображения для обработки
    const imageFiles = files.filter(file => file.type === 'image')
    const videoFiles = files.filter(file => file.type === 'video')

    // Считаем общее количество файлов для правильной нумерации
    const totalFiles = imageFiles.length + videoFiles.length
    let fileCounter = 1
    
    // Сохраняем пути к оригинальным файлам для удаления после обработки
    const originalFilesToDelete = []

    // Обрабатываем видео (просто пропускаем)
    for (const videoFile of videoFiles) {
      const finalName = `${sku}_${String(fileCounter).padStart(3, '0')}.mp4`
      results.push({
        id: videoFile.id,
        originalName: videoFile.fileName,
        finalName: finalName,
        status: 'skipped'
      })
      fileCounter++
    }

    // Обрабатываем изображения с ограничением concurrent запросов
    for (let i = 0; i < imageFiles.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = imageFiles.slice(i, i + MAX_CONCURRENT_REQUESTS)
      
      // Ждем, если слишком много активных запросов
      while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      activeRequests++

      const batchPromises = batch.map(async (file) => {
        try {
          // Генерируем уникальное имя файла для этого конкретного файла
          const currentFileCounter = fileCounter++
          
          // PhotoRoom всегда возвращает JPG формат
          const finalName = `${sku}_${String(currentFileCounter).padStart(3, '0')}.jpg`
          
          // Читаем файл из правильной директории
          const uploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
          const filePath = join(uploadDir, file.fileName)
          const fileBuffer = await readFile(filePath)
          
          // Удаляем фон через PhotoRoom
          const processedBuffer = await removeBackground(fileBuffer)
          
          // Сохраняем обработанный файл в ту же директорию
          const processedPath = join(uploadDir, finalName)
          await writeFile(processedPath, processedBuffer)
          
          console.log(`Processed file saved to: ${processedPath}`)
          
          // Добавляем оригинальный файл в список для удаления
          originalFilesToDelete.push(filePath)
          
          return {
            id: file.id,
            originalName: file.originalName,
            finalName: finalName,
            status: 'done',
            processedPath
          }
          
        } catch (error) {
          console.error(`Error processing file ${file.fileName}:`, error)
          
          // Генерируем уникальное имя файла для ошибки
          const currentFileCounter = fileCounter++
          
          // В случае ошибки, оставляем оригинал и помечаем как ошибку
          const originalExtension = file.fileName.split('.').pop() || 'jpg'
          const errorFinalName = `${sku}_${String(currentFileCounter).padStart(3, '0')}.${originalExtension}`
          
          // В случае ошибки не удаляем оригинал
          return {
            id: file.id,
            originalName: file.originalName,
            finalName: errorFinalName,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            processedPath: join(process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads', file.fileName)
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchPromises)
      
      activeRequests--
    }

    // Сохраняем информацию о процессинге в отдельный файл для использования при скачивании
    const uploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    const processInfoPath = join(uploadDir, `${sku}-process-info.json`)
    await writeFile(processInfoPath, JSON.stringify(results, null, 2))

    // Удаляем оригинальные файлы после успешной обработки
    for (const filePath of originalFilesToDelete) {
      try {
        await unlink(filePath)
        console.log(`Deleted original file: ${filePath}`)
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error)
      }
    }

    return res.status(200).json({
      success: true,
      results,
      sku
    })

  } catch (error) {
    console.error('Process error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// Заглушка для PhotoRoom сервиса
async function removeBackground(buffer) {
  // В реальном приложении здесь будет вызов PhotoRoom API
  // Для тестирования просто возвращаем тот же буфер
  return buffer
}

// Обработка multipart/form-data для pages/api
export const config = {
  api: {
    bodyParser: false,
  },
}