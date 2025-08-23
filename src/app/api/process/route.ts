import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink, writeFile, open } from 'fs/promises'
import { join } from 'path'
import { PhotoRoomService } from '@/lib/services/PhotoRoomService'

interface ProcessRequest {
  sku: string
  files: Array<{
    id: string
    fileName: string
    filePath: string
    type: string
    originalName: string
  }>
}

interface ProcessResponse {
  success: boolean
  results: Array<{
    id: string
    originalName: string
    finalName: string
    status: 'done' | 'error' | 'skipped'
    error?: string
    processedPath?: string
  }>
}

// Ограничение на одновременные запросы к PhotoRoom
const MAX_CONCURRENT_REQUESTS = 3
let activeRequests = 0

// Явно отключаем статическую генерацию для этого API route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ProcessRequest
    const { sku, files } = body

    if (!sku || !files || files.length === 0) {
      return NextResponse.json(
        { error: 'SKU and files are required' },
        { status: 400 }
      )
    }

    console.log('🔧 Initializing PhotoRoomService...')
    let photoRoomService: PhotoRoomService
    let results: ProcessResponse['results'] = []
    
    try {
      photoRoomService = new PhotoRoomService()
      console.log('🔧 PhotoRoomService initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize PhotoRoomService:', error)
      return NextResponse.json(
        { error: 'PhotoRoom service initialization failed' },
        { status: 500 }
      )
    }

    // Фильтруем только изображения для обработки
    const imageFiles = files.filter(file => file.type === 'image')
    const videoFiles = files.filter(file => file.type === 'video')

    // Считаем общее количество файлов для правильной нумерации
    const totalFiles = imageFiles.length + videoFiles.length
    let fileCounter = 1
    
    // Сохраняем пути к оригинальным файлам для удаления после обработки
    const originalFilesToDelete: string[] = []

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
    console.log(`🎯 Starting processing of ${imageFiles.length} image files...`)
    
    for (let i = 0; i < imageFiles.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = imageFiles.slice(i, i + MAX_CONCURRENT_REQUESTS)
      console.log(`📦 Processing batch ${Math.floor(i/MAX_CONCURRENT_REQUESTS) + 1} with ${batch.length} files...`)
      
      // Ждем, если слишком много активных запросов
      while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        console.log('⏳ Waiting for active requests to complete...')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      activeRequests++
      console.log(`🚀 Active requests: ${activeRequests}`)

      const batchPromises = batch.map(async (file) => {
        try {
          console.log(`🔍 Processing file: ${file.fileName}`)
          
          // Генерируем уникальное имя файла для этого конкретного файла
          const currentFileCounter = fileCounter++
          
          // PhotoRoom всегда возвращает JPG формат
          const finalName = `${sku}_${String(currentFileCounter).padStart(3, '0')}.jpg`
          console.log(`📝 Generated final name: ${finalName}`)
          
          // Читаем файл из правильной директории
          const baseUploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
          const uploadDir = join(baseUploadDir, sku)
          const filePath = join(uploadDir, file.fileName)
          const fileBuffer = await readFile(filePath)
          
          console.log(`📸 Sending file to PhotoRoom: ${file.fileName}, size: ${fileBuffer.length} bytes`)
          
          // Удаляем фон через PhotoRoom
          const processedBuffer = await photoRoomService.removeBackground(fileBuffer)
          
          console.log(`✅ PhotoRoom processing completed for: ${file.fileName}, processed size: ${processedBuffer.length} bytes`)
          
          // Сохраняем обработанный файл в ту же директорию
          const processedPath = join(uploadDir, finalName)
          await writeFile(processedPath, processedBuffer)
          
          console.log(`Processed file saved to: ${processedPath}`)
          
          // Добавляем оригинальный файл в список для удаления
          originalFilesToDelete.push(filePath)
          
          return {
            id: file.id,
            originalName: file.originalName, // <-- Используем оригинальное имя файла
            finalName: finalName,
            status: 'done' as const,
            processedPath,
            url: `/api/images/${sku}/${finalName}`
          }
          
        } catch (error) {
          console.error(`❌ Error processing file ${file.fileName}:`, error)
          
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
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
            processedPath: join(baseUploadDir, sku, file.fileName),
            url: `/api/images/${sku}/${file.fileName}`
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      activeRequests--
    }

    // Сохраняем информацию о процессинге в отдельный файл для использования при скачивании
    const baseUploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    const uploadDir = join(baseUploadDir, sku)
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

    return NextResponse.json({
      success: true,
      results,
      sku
    })

  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}