import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { stat, readdir } from 'fs/promises'
import { UPLOADS_DIR } from './lib/config'

export async function middleware(request: Request) {
  const { pathname } = new URL(request.url)
  
  // Обрабатываем запросы к /uploads/*
  if (pathname.startsWith('/uploads/')) {
    try {
      const filePath = join(UPLOADS_DIR, pathname.substring('/uploads/'.length))
      
      // Проверяем, что файл существует и доступен
      const fileStats = await stat(filePath)
      
      if (fileStats.isFile()) {
        // Определяем MIME тип по расширению
        const extension = filePath.split('.').pop()?.toLowerCase() || ''
        const mimeTypes: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'mp4': 'video/mp4',
          'mov': 'video/quicktime'
        }
        
        const mimeType = mimeTypes[extension] || 'application/octet-stream'
        
        const fileBuffer = await readFile(filePath)
        
        return new NextResponse(fileBuffer.buffer as any, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      }
    } catch (error) {
      console.error(`Error serving file ${pathname}:`, error)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/uploads/:path*',
}