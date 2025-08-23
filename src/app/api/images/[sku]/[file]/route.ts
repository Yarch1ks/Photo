import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { sku: string; file: string } }
) {
  try {
    const baseUploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    const filePath = join(baseUploadDir, params.sku, params.file)
    
    console.log(`Serving image from: ${filePath}`)
    console.log(`SKU: ${params.sku}, File: ${params.file}`)
    
    // Читаем файл
    const fileBuffer = await readFile(filePath)
    
    // Определяем MIME тип по расширению
    const extension = params.file.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }
    
    const mimeType = mimeTypes[extension || ''] || 'application/octet-stream'
    
    return new NextResponse(fileBuffer.buffer as any, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Кэшируем на 1 год
      },
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return NextResponse.json(
      { error: 'Image not found' },
      { status: 404 }
    )
  }
}