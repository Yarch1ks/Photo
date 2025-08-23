import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, access, unlink } from 'fs/promises'
import { join } from 'path'

// Явно отключаем статическую генерацию для этого API route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD API START ===')
    
    const formData = await request.formData()
    const sku = formData.get('sku') as string
    const files = formData.getAll('files')
    
    console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value && typeof value === 'object' && 'name' in value ? value.name : value]))
    
    if (!sku) {
      console.error('SKU is required')
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }

    if (!files || files.length === 0) {
      console.error('No files provided')
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Фильтруем и проверяем файлы для Node.js 18 совместимости
    const validFiles = []
    for (const file of files) {
      // Проверяем что файл имеет необходимые методы и свойства
      if (file && 
          typeof file === 'object' && 
          'name' in file && 
          'size' in file && 
          'type' in file && 
          typeof (file as any).arrayBuffer === 'function') {
        validFiles.push(file)
      } else {
        console.warn('Invalid file detected:', file)
      }
    }

    if (validFiles.length === 0) {
      console.error('No valid files provided')
      return NextResponse.json(
        { error: 'No valid files provided' },
        { status: 400 }
      )
    }

    console.log(`Processing ${validFiles.length} valid files for SKU: ${sku}`)

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
      return NextResponse.json(
        {
          error: 'Storage directory inaccessible',
          details: error instanceof Error ? error.message : 'Unknown error',
          uploadDir,
          isProduction
        },
        { status: 500 }
      )
    }

    const processedFiles = []

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      console.log(`Processing file ${i + 1}/${validFiles.length}: ${file.name}`)
      
      // Сохраняем оригинальное расширение файла
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const fileName = `${sku}_${String(i + 1).padStart(3, '0')}.${fileExtension}`
      const filePath = join(uploadDir, fileName)

      console.log(`File path: ${filePath}`)
      console.log(`File size: ${file.size}`)
      console.log(`File type: ${file.type}`)

      try {
        // Сохраняем файл с Node.js 18 совместимым способом
        const bytes = await (file as any).arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(filePath, buffer)
        console.log(`✅ File saved successfully: ${filePath}`)
      } catch (error) {
        console.error(`❌ Error saving file ${filePath}:`, error)
        return NextResponse.json(
          { error: `Failed to save file: ${file.name}` },
          { status: 500 }
        )
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
    
    return NextResponse.json({
      success: true,
      files: processedFiles,
      sku: sku
    })

  } catch (error) {
    console.error('❌ UPLOAD API ERROR:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}