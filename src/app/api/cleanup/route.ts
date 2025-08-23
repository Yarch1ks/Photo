import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sku } = body

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }

    const baseUploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    const skuDir = join(baseUploadDir, sku)
    const processInfoPath = join(skuDir, `${sku}-process-info.json`)

    // Читаем информацию о файлах
    const processInfo = JSON.parse(await readFile(processInfoPath, 'utf-8'))
    const { processedFiles } = processInfo

    // Удаляем все файлы
    for (const file of processedFiles) {
      try {
        // Удаляем оригинальный файл
        await unlink(file.originalPath)
        console.log(`Deleted original file: ${file.originalPath}`)

        // Удаляем обработанный файл
        await unlink(file.processedPath)
        console.log(`Deleted processed file: ${file.processedPath}`)
      } catch (error) {
        console.error(`Error deleting file: ${error}`)
      }
    }

    // Удаляем process-info.json
    try {
      await unlink(processInfoPath)
      console.log(`Deleted process info: ${processInfoPath}`)
    } catch (error) {
      console.error(`Error deleting process info: ${error}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Files cleaned up successfully'
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}