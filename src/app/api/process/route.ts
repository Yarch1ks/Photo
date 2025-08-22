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

    const photoRoomService = new PhotoRoomService()
    const results: ProcessResponse['results'] = []

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
          
          // Читаем файл
          const filePath = join(process.cwd(), 'temp', sku, file.fileName)
          const fileBuffer = await readFile(filePath)
          
          // Удаляем фон через PhotoRoom
          const processedBuffer = await photoRoomService.removeBackground(fileBuffer)
          
          // Сохраняем обработанный файл
          const processedPath = join(process.cwd(), 'temp', sku, finalName)
          await writeFile(processedPath, processedBuffer)
          
          // Принудительно синхронизируем файл с диском
          const fileHandle = await open(processedPath, 'r+')
          await fileHandle.sync()
          await fileHandle.close()
          
          console.log(`Processed file saved to: ${processedPath}`)
          
          // Добавляем оригинальный файл в список для удаления
          originalFilesToDelete.push(filePath)
          
          return {
            id: file.id,
            originalName: file.originalName, // <-- Используем оригинальное имя файла
            finalName: finalName,
            status: 'done' as const,
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
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
            processedPath: join(process.cwd(), 'temp', sku, file.fileName)
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      activeRequests--
    }

    // Сохраняем информацию о процессинге в отдельный файл для использования при скачивании
    const processInfoPath = join(process.cwd(), 'temp', sku, 'process-info.json')
    await writeFile(processInfoPath, JSON.stringify(results, null, 2))

    // Не удаляем оригинальные файлы - они могут быть полезны для отладки
    // и занимают мало места по сравнению с обработанными файлами
    console.log('Original files preserved for debugging:', originalFilesToDelete)

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