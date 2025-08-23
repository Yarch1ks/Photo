import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir, unlink, access, stat } from 'fs/promises'
import { join } from 'path'
import { createWriteStream, statSync, readFileSync } from 'fs'
import archiver from 'archiver'
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TMP_DIR } from '@/lib/config'

interface TelegramRequest {
  sku: string
  files: Array<{
    finalName: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TelegramRequest
    const { sku, files } = body

    if (!sku || !files || files.length === 0) {
      return NextResponse.json(
        { error: 'SKU and files are required' },
        { status: 400 }
      )
    }

    console.log(`📦 Starting Telegram processing for SKU: ${sku}, ${files.length} files`)

    // Преобразуем chatId в числовой формат
    const numericChatId = TELEGRAM_CHAT_ID.startsWith('-') ? parseInt(TELEGRAM_CHAT_ID) : TELEGRAM_CHAT_ID
    console.log('Using chatId:', { original: TELEGRAM_CHAT_ID, numeric: numericChatId })

    // Проверяем, существует ли директория с обработанными файлами
    const uploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    const skuDir = join(uploadDir, sku)
    
    try {
      await access(skuDir)
      console.log(`✅ SKU directory exists: ${skuDir}`)
    } catch (error) {
      console.error(`❌ SKU directory not found: ${skuDir}`)
      return NextResponse.json(
        { error: `No processed files found for SKU ${sku}` },
        { status: 404 }
      )
    }

    // Проверяем существование каждого файл
    const validFiles: Array<{ finalName: string }> = []
    for (const file of files) {
      const filePath = join(skuDir, file.finalName)
      try {
        const fileStats = await stat(filePath)
        if (fileStats.isFile()) {
          validFiles.push(file)
          console.log(`✅ File exists: ${filePath} (${fileStats.size} bytes)`)
        } else {
          console.error(`❌ Path is not a file: ${filePath}`)
        }
      } catch (error) {
        console.error(`❌ File not found: ${filePath}`)
      }
    }

    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid files found for this SKU' },
        { status: 400 }
      )
    }

    console.log(`📁 Found ${validFiles.length} valid files for ZIP creation`)

    // Telegram Bot API configuration
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`

    // Создаем ZIP архив во временный файл
    const timestamp = Date.now()
    const zipFileName = `photos_${sku}_${timestamp}.zip`
    const zipFilePath = join(TMP_DIR, zipFileName)

    console.log(`🗜️ Creating ZIP archive: ${zipFilePath}`)

    try {
      // Создаем ZIP архив с помощью archiver и оборачиваем в Promise
      await new Promise((resolve, reject) => {
        const output = createWriteStream(zipFilePath)
        const archive = archiver('zip', {
          zlib: { level: 9 } // Максимальное сжатие
        })

        output.on('close', () => {
          console.log(`✅ ZIP archive created: ${zipFilePath}, size: ${archive.pointer()} bytes`)
          resolve(true)
        })

        output.on('error', (err) => {
          console.error('❌ Error writing ZIP file:', err)
          reject(err)
        })

        archive.on('error', (err) => {
          console.error('❌ Archiver error:', err)
          reject(err)
        })

        archive.on('warning', (err) => {
          if (err.code === 'ENOENT') {
            console.warn('⚠️ Archiver warning:', err)
          } else {
            reject(err)
          }
        })

        // Записываем данные в файл
        archive.pipe(output)

        // Добавляем все файлы в архив
        for (const file of validFiles) {
          const filePath = join(skuDir, file.finalName)
          console.log(`📄 Adding file to archive: ${file.finalName}`)
          
          try {
            const fileStats = statSync(filePath)
            archive.append(readFileSync(filePath), { name: file.finalName })
            console.log(`✅ Added file to archive: ${file.finalName} (${fileStats.size} bytes)`)
          } catch (error) {
            console.error(`❌ Error adding file ${file.finalName} to archive:`, error)
            reject(new Error(`Failed to add file ${file.finalName} to archive: ${error}`))
            return
          }
        }

        // Завершаем архив
        console.log('🏁 Finalizing ZIP archive...')
        archive.finalize()
      })

      console.log('✅ ZIP archive finalized successfully')

      // Читаем ZIP файл как Buffer
      console.log(`📖 Reading ZIP file: ${zipFilePath}`)
      const zipFileBuffer = await readFile(zipFilePath)
      console.log(`✅ ZIP file size: ${zipFileBuffer.length} bytes`)

      // Создаем File объект из Buffer
      const zipFile = new File([new Uint8Array(zipFileBuffer)], `${sku}.zip`, {
        type: 'application/zip'
      })

      // Создаем FormData для отправки в Telegram
      const formData = new FormData()
      formData.append('chat_id', String(numericChatId))
      formData.append('document', zipFile)
      formData.append('caption', `Обработанные фотографии для артикула: ${sku}\nВсего файлов: ${validFiles.length}`)

      console.log('📤 Sending to Telegram with FormData:', {
        chatId: numericChatId,
        fileName: `${sku}.zip`,
        fileSize: zipFileBuffer.byteLength
      })

      // Отправляем ZIP файл в Telegram
      const response = await fetch(telegramApiUrl, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('❌ Telegram API error:', errorData)
        return NextResponse.json(
          { error: 'Failed to send file to Telegram' },
          { status: 500 }
        )
      }

      const result = await response.json()
      console.log('✅ File sent to Telegram successfully:', result)

      // Удаляем временный ZIP файл
      try {
        await unlink(zipFilePath)
        console.log(`🗑️ Temporary ZIP file deleted: ${zipFilePath}`)
      } catch (error) {
        console.error(`⚠️ Error deleting temporary ZIP file:`, error)
      }

      return NextResponse.json({
        success: true,
        message: 'File sent to Telegram successfully',
        telegramMessageId: result.result.message_id
      })

    } catch (error) {
      console.error('❌ Error creating ZIP archive:', error)
      return NextResponse.json(
        { error: 'Failed to create ZIP archive' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Telegram API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}