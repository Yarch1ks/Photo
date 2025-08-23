import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// Простая функция генерации имени файла
function generateFileName(sku: string, index: number, extension: string): string {
  return `${sku}_${String(index).padStart(3, '0')}.${extension}`
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD API START ===')
    
    const formData = await request.formData()
    const sku = formData.get('sku') as string
    const files = formData.getAll('files') as File[]
    
    console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? value.name : value]))
    
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

    console.log(`Processing ${files.length} files for SKU: ${sku}`)
    
    // Простая директория для Railway
    const uploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    
    console.log(`Upload directory: ${uploadDir}`)
    
    try {
      await mkdir(uploadDir, { recursive: true })
      console.log(`Directory created: ${uploadDir}`)
    } catch (error) {
      console.error('Error creating directory:', error)
    }

    const processedFiles = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`)
      
      // Простое имя файла без сложной логики
      const fileName = `${sku}_${String(i + 1).padStart(3, '0')}.jpg`
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
        throw error
      }

      processedFiles.push({
        id: `file_${i + 1}`,
        originalName: file.name,
        fileName: fileName,
        filePath: filePath,
        type: 'image',
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}