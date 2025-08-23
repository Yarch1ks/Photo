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
    
    // Просто возвращаем успешный ответ без сохранения файлов
    const processedFiles = Array.from(files).map((file, index) => ({
      id: `file_${index + 1}`,
      originalName: file.name,
      fileName: `${sku}_${String(index + 1).padStart(3, '0')}.jpg`,
      filePath: `/tmp/uploads/${sku}_${String(index + 1).padStart(3, '0')}.jpg`,
      type: 'image',
      size: file.size,
      sku: sku
    }))

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