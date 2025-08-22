import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sku, files } = body

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU is required' },
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

    // Симулируем успешную обработку
    const processedFiles = files?.map((file: any, index: number) => ({
      id: `file-${index + 1}`,
      originalName: file.name || `file_${index + 1}.jpg`,
      fileName: `${sku}_${String(index + 1).padStart(3, '0')}.jpg`,
      type: file.type || 'image/jpeg',
      size: file.size || 1024000,
      status: 'queued',
      progress: 0
    })) || []

    return NextResponse.json({
      success: true,
      sku,
      files: processedFiles,
      message: 'Files processed successfully'
    })

  } catch (error) {
    console.error('Test upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}