import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readdir, rm } from 'fs/promises'
import { join } from 'path'
import { generateFileName } from '@/lib/utils/validation'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const sku = formData.get('sku') as string
    const files = formData.getAll('files') as File[]
    
    if (!sku) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Валидация SKU
    if (!/^[a-zA-Z0-9_-]+$/.test(sku)) {
      return NextResponse.json(
        { error: 'Invalid SKU format. Only letters, numbers, -, _ are allowed' },
        { status: 400 }
      )
    }

    // Создаем временную директорию для этого SKU
    // В Railway используем /tmp, в локальной среде - process.cwd()
    const workingDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp' : process.cwd()
    const uploadDir = join(workingDir, 'temp', sku)
    
    console.log(`Working directory: ${workingDir}`)
    console.log(`Upload directory: ${uploadDir}`)
    console.log(`Environment: Railway = ${!!process.env.RAILWAY_SERVICE_NAME}`)
    
    try {
      // Проверяем, существует ли директория
      const fs = require('fs').promises
      try {
        await fs.access(uploadDir)
        console.log(`Directory exists: ${uploadDir}`)
      } catch (error) {
        console.log(`Creating directory: ${uploadDir}`)
        await fs.mkdir(uploadDir, { recursive: true })
        console.log(`Directory created successfully: ${uploadDir}`)
      }
    } catch (error) {
      console.error('Error creating directory:', error)
      throw error
    }

    const processedFiles = []

    for (const file of files) {
      console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`)
      
      // Валидация размера (25MB max)
      if (file.size > 25 * 1024 * 1024) {
        console.error(`File ${file.name} exceeds 25MB limit`)
        return NextResponse.json(
          { error: `File ${file.name} exceeds 25MB limit` },
          { status: 400 }
        )
      }

      // Валидация типа файла
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/heic',
        'video/mp4', 'video/quicktime'
      ]
      
      if (!allowedTypes.includes(file.type)) {
        console.error(`File ${file.name} has unsupported type: ${file.type}`)
        return NextResponse.json(
          { error: `File ${file.name} has unsupported type: ${file.type}` },
          { status: 400 }
        )
      }

      // Генерируем имя файла по формату sku_{NNN}.{ext}
      const fileExtension = file.name.split('.').pop()
      const fileIndex: number = processedFiles.length + 1
      const fileName = generateFileName(sku, fileIndex, fileExtension!)
      const filePath = join(uploadDir, fileName)

      console.log(`Generated filename: ${fileName}`)
      console.log(`File path: ${filePath}`)

      try {
        // Сохраняем файл
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(filePath, buffer)
        console.log(`File saved successfully: ${filePath}`)
      } catch (error) {
        console.error(`Error saving file ${filePath}:`, error)
        throw error
      }

      processedFiles.push({
        id: `file_${fileIndex}`,
        originalName: file.name,
        fileName: fileName,
        filePath: filePath,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        size: file.size,
        sku: sku
      })
    }

    return NextResponse.json({
      success: true,
      files: processedFiles,
      sku: sku
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}