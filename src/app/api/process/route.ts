import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, access } from 'fs/promises'
import { join } from 'path'
import { PhotoRoomService } from '@/lib/services/PhotoRoomService'
import {
  getUploadPath,
  ensureUploadDir,
  PUBLIC_ORIGIN,
  MAX_CONCURRENT_PHOTOROOM_REQUESTS,
  PHOTOROOM_MAX_RETRIES,
  PHOTOROOM_RETRY_DELAY
} from '@/lib/config'

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
    previewUrl?: string
  }>
}

// Ограничение на одновременные запросы к PhotoRoom
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

    console.log(`🔧 Processing SKU: ${sku}, ${files.length} files`)

    // Инициализируем PhotoRoomService
    let photoRoomService: PhotoRoomService
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

    // Создаем директорию для SKU
    const uploadDir = await ensureUploadDir(sku)

    // Фильтруем только изображения для обработки
    const imageFiles = files.filter(file => file.type === 'image')
    const videoFiles = files.filter(file => file.type === 'video')

    // Считаем общее количество файлов для правильной нумерации
    let fileCounter = 1
    const results: ProcessResponse['results'] = []

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
    
    for (let i = 0; i < imageFiles.length; i += MAX_CONCURRENT_PHOTOROOM_REQUESTS) {
      const batch = imageFiles.slice(i, i + MAX_CONCURRENT_PHOTOROOM_REQUESTS)
      console.log(`📦 Processing batch ${Math.floor(i/MAX_CONCURRENT_PHOTOROOM_REQUESTS) + 1} with ${batch.length} files...`)
      
      // Ждем, если слишком много активных запросов
      while (activeRequests >= MAX_CONCURRENT_PHOTOROOM_REQUESTS) {
        console.log('⏳ Waiting for active requests to complete...')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      activeRequests++
      console.log(`🚀 Active requests: ${activeRequests}`)

      const batchPromises = batch.map(async (file) => {
        try {
          console.log(`🔍 Processing file: ${file.fileName}`)
          
          // Генерируем уникальное имя файла для обработанного изображения
          const currentFileCounter = fileCounter++
          const finalName = `${sku}_${String(currentFileCounter).padStart(3, '0')}.jpg`
          
          // Читаем оригинальный файл
          const originalPath = getUploadPath(sku, file.fileName)
          const fileBuffer = await readFile(originalPath)
          console.log(`📸 Original file size: ${fileBuffer.length} bytes`)
          
          // Удаляем фон через PhotoRoom
          console.log('🚀 Calling PhotoRoom API...')
          const processedBuffer = await photoRoomService.removeBackground(fileBuffer)
          console.log(`✅ PhotoRoom processing completed, processed size: ${processedBuffer.length} bytes`)
          
          // Сохраняем обработанный файл с новым именем
          const processedPath = getUploadPath(sku, finalName)
          await writeFile(processedPath, processedBuffer)
          console.log(`✅ Processed file saved to: ${processedPath}`)
          
          // Проверяем, что файл был сохранен
          await access(processedPath)
          
          // Формируем публичный URL для превью
          const previewUrl = `${PUBLIC_ORIGIN}/uploads/${sku}/${finalName}`
          
          return {
            id: file.id,
            originalName: file.originalName,
            finalName: finalName,
            status: 'done' as const,
            previewUrl
          }
          
        } catch (error) {
          console.error(`❌ Error processing file ${file.fileName}:`, error)
          console.error(`❌ Error details:`, {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            fileName: file.fileName,
            originalName: file.originalName
          })
          
          // Генерируем уникальное имя файла для ошибки
          const currentFileCounter = fileCounter++
          const originalExtension = file.fileName.split('.').pop() || 'jpg'
          const errorFinalName = `${sku}_${String(currentFileCounter).padStart(3, '0')}.${originalExtension}`
          
          // В случае ошибки, оставляем оригинал и помечаем как ошибку
          const previewUrl = `${PUBLIC_ORIGIN}/uploads/${sku}/${file.fileName}`
          
          return {
            id: file.id,
            originalName: file.originalName,
            finalName: errorFinalName,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
            previewUrl
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      activeRequests--
    }

    console.log(`✅ Processing completed for SKU ${sku}: ${results.length} results`)

    return NextResponse.json({
      success: true,
      sku,
      results
    })

  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}