import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import archiver from 'archiver'

interface DownloadRequest {
  sku: string
  includeOriginals?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DownloadRequest
    const { sku, includeOriginals = false } = body

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }

    // Проверяем, существует ли директория с файлами
    const uploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    const skuDir = join(uploadDir, sku)
    try {
      await readdir(skuDir)
    } catch {
      return NextResponse.json(
        { error: 'No files found for this SKU' },
        { status: 404 }
      )
    }

    // Создаем manifest.json
    const manifest = {
      sku,
      createdAt: new Date().toISOString(),
      files: [] as Array<{
        original: string
        final: string
        type: 'image' | 'video'
        status: 'done' | 'skipped' | 'error'
      }>
    }

    // Собираем файлы для архива
    const filesToArchive = []
    const files = await readdir(skuDir)

    // Читаем информацию о процессинге
    let processInfo = []
    try {
      const processInfoPath = join(skuDir, `${sku}-process-info.json`)
      const processInfoContent = await readFile(processInfoPath, 'utf-8')
      processInfo = JSON.parse(processInfoContent)
    } catch {
      // Если файл с информацией о процессинге не найден, создаем пустой массив
      processInfo = []
    }

    for (const file of files) {
      const filePath = join(skuDir, file)
      const stats = await import('fs').then(fs => fs.promises.stat(filePath))
      
      // Определяем тип файла
      const isImage = /\.(jpg|jpeg|png)$/i.test(file)
      const isVideo = /\.(mp4|mov)$/i.test(file)
      
      if (isImage || isVideo) {
        const type = isImage ? 'image' : 'video'
        const status = isImage ? 'done' : 'skipped'
        
        // Находим информацию оригинального имени
        const processRecord = processInfo.find((info: any) => info.finalName === file)
        const originalName = processRecord ? processRecord.originalName : file
        
        // Добавляем в manifest
        manifest.files.push({
          original: originalName,
          final: file,
          type,
          status
        })

        // Добавляем в архив
        filesToArchive.push({
          path: filePath,
          name: file
        })
      }
    }

    // Если включены оригиналы, добавляем их в отдельную папку
    if (includeOriginals) {
      const originalsDir = join(skuDir, 'originals')
      try {
        const originalFiles = await readdir(originalsDir)
        for (const file of originalFiles) {
          const filePath = join(originalsDir, file)
          filesToArchive.push({
            path: filePath,
            name: `originals/${file}`
          })
        }
      } catch {
        // Папка originals может не существовать, это нормально
      }
    }

    // Создаем ZIP архив в памяти
    const zipBuffer = await createZipArchive(filesToArchive, manifest)

    // Генерируем имя файла
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const hash = createHash('md5').update(sku + timestamp).digest('hex').substring(0, 8)
    const zipFileName = `photo-sku-${sku}-${timestamp}-${hash}.zip`

    // Очищаем временные файлы после создания архива
    try {
      await cleanupTempFiles(skuDir)
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error)
    }

    return new NextResponse(zipBuffer.buffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': zipBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function createZipArchive(
  files: Array<{ path: string; name: string }>,
  manifest: any
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    
    const archive = archiver('zip', {
      zlib: { level: 6 }
    })

    archive.on('data', (chunk) => chunks.push(chunk))
    archive.on('error', reject)
    archive.on('end', () => resolve(Buffer.concat(chunks)))

    // Добавляем manifest.json
    archive.append(JSON.stringify(manifest, null, 2), {
      name: 'manifest.json'
    })

    // Добавляем файлы
    for (const file of files) {
      archive.file(file.path, { name: file.name })
    }

    archive.finalize()
  })
}

async function cleanupTempFiles(dir: string): Promise<void> {
  const { readdir, unlink, rmdir } = await import('fs/promises')
  
  try {
    const files = await readdir(dir)
    
    for (const file of files) {
      const filePath = join(dir, file)
      await unlink(filePath)
    }
    
    await rmdir(dir)
  } catch (error) {
    console.warn('Failed to cleanup directory:', dir, error)
  }
}