import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = join(process.cwd(), 'temp', ...params.path)
    console.log(`Serving image from: ${filePath}`)
    
    // Читаем файл
    const fileBuffer = await readFile(filePath)
    
    // Определяем MIME тип по расширению
    const extension = params.path[params.path.length - 1].split('.').pop()?.toLowerCase()
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
        'Cache-Control': 'public, max-age=3600', // Кэшируем на 1 час
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