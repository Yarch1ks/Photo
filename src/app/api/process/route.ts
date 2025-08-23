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
const MAX_CONCURRENT_REQUESTS = 5
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
    
    console.log('🔑 PhotoRoom token status check completed')

    // Фильтруем только изображения для обработки
    const imageFiles = files.filter(file => file.type === 'image')
    const videoFiles = files.filter(file => file.type === 'video')

    // Считаем общее количество файлов для правильной нумерации
    const totalFiles = imageFiles.length + videoFiles.length
    let fileCounter = 1
    
    // Массив для хранения информации о файлах
    const processedFiles: {
      originalPath: string;
      processedPath: string;
      type: 'image' | 'video';
    }[] = []

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
          console.log('🚀 Calling PhotoRoom API...')
          const processedBuffer = await photoRoomService.removeBackground(fileBuffer)
          
          console.log(`✅ PhotoRoom processing completed for: ${file.fileName}, processed size: ${processedBuffer.length} bytes`)
          
          // Сохраняем обработанный файл в ту же директорию
          const processedPath = join(uploadDir, finalName)
          await writeFile(processedPath, processedBuffer)
          
          console.log(`Processed file saved to: ${processedPath}`)
          
          // Сохраняем информацию о файлах
          processedFiles.push({
            originalPath: filePath,
            processedPath: processedPath,
            type: 'image'
          })
          
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
          const baseUploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
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

    // Сохраняем информацию о процессинге и файлах для удаления
    const baseUploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    const uploadDir = join(baseUploadDir, sku)
    const processInfoPath = join(uploadDir, `${sku}-process-info.json`)
    
    const processInfo = {
      results,
      processedFiles
    }
    
    console.log(`Writing process info to: ${processInfoPath}`)
    console.log(`Process info contains ${processedFiles.length} processed files`)
    
    await writeFile(processInfoPath, JSON.stringify(processInfo, null, 2))
    console.log(`Process info saved successfully`)
    
    // Проверяем, что файл был создан
    try {
      const savedContent = await readFile(processInfoPath, 'utf-8')
      console.log(`Process info file size: ${savedContent.length} bytes`)
      console.log(`Process info preview: ${savedContent.substring(0, 200)}...`)
    } catch (error) {
      console.error(`Error reading saved process info:`, error)
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