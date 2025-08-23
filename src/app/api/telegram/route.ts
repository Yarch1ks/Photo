import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { createReadStream, createWriteStream, readFileSync } from 'fs'
import archiver from 'archiver'

interface TelegramRequest {
  sku: string
  chatId: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TelegramRequest
    const { sku, chatId } = body

    if (!sku || !chatId) {
      return NextResponse.json(
        { error: 'SKU and chatId are required' },
        { status: 400 }
      )
    }

    // Преобразуем chatId в числовой формат, если это возможно
    const numericChatId = chatId.startsWith('-') ? parseInt(chatId) : chatId
    console.log('Using chatId:', { original: chatId, numeric: numericChatId })

    // Проверяем, существует ли директория с обработанными файлами
    const uploadDir = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
    const skuDir = join(uploadDir, sku)
    
    // Читаем process-info.json для получения списка обработанных файлов
    const processInfoPath = join(uploadDir, `${sku}-process-info.json`)
    console.log(`Looking for process info at: ${processInfoPath}`)
    
    let processInfo
    try {
      // Проверяем, существует ли файл
      const stats = await readFile(processInfoPath, 'utf-8')
      console.log(`Process info file exists, content length: ${stats.length}`)
      
      processInfo = JSON.parse(stats)
      console.log('Process info parsed:', JSON.stringify(processInfo, null, 2))
      
      if (!processInfo.processedFiles || processInfo.processedFiles.length === 0) {
        console.log('No processed files found in process info')
        return NextResponse.json(
          { error: 'No processed files found for this SKU' },
          { status: 404 }
        )
      }
      
      console.log(`Found ${processInfo.processedFiles.length} processed files`)
    } catch (error) {
      console.error(`Error reading process info for SKU ${sku}:`, error)
      console.error(`Process info path: ${processInfoPath}`)
      console.error(`Upload dir: ${uploadDir}`)
      console.error(`SKU dir: ${skuDir}`)
      
      // Попробуем прочитать директорию, чтобы увидеть, какие файлы там есть
      try {
        const files = await readdir(skuDir)
        console.log(`Files in SKU directory: ${files}`)
      } catch (dirError) {
        console.error(`Error reading SKU directory:`, dirError)
      }
      
      return NextResponse.json(
        { error: 'No processed files found for this SKU' },
        { status: 404 }
      )
    }

    // Telegram Bot API configuration
    const botToken = '1405822759:AAFSEYxyfUQw_6m2P6lTDYgjvECrPxe0uG8'
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendDocument`

    // Создаем ZIP архив со всеми обработанными файлами
    const zipFileName = `${sku}.zip`
    const zipFilePath = join(uploadDir, zipFileName)

    try {
      // Создаем ZIP архив с помощью archiver и оборачиваем в Promise
      await new Promise((resolve, reject) => {
        const output = createWriteStream(zipFilePath)
        const archive = archiver('zip', {
          zlib: { level: 9 } // Максимальное сжатие
        })

        output.on('close', () => {
          console.log(`ZIP archive created: ${zipFilePath}`)
          resolve(true)
        })

        output.on('error', (err) => {
          console.error('Error writing ZIP file:', err)
          reject(err)
        })

        archive.on('error', (err) => {
          console.error('Archiver error:', err)
          reject(err)
        })

        archive.on('warning', (err) => {
          if (err.code === 'ENOENT') {
            console.warn('Archiver warning:', err)
          } else {
            reject(err)
          }
        })

        // Записываем данные в файл
        archive.pipe(output)

        // Добавляем только обработанные файлы в архив
        for (const file of processInfo.processedFiles) {
          if (file.type === 'image') {
            const filePath = file.processedPath
            console.log(`Adding file to archive: ${filePath}`)
            
            try {
              const fileStats = readFileSync(filePath)
              const fileName = filePath.split('/').pop() || ''
              archive.append(fileStats, { name: fileName })
              console.log(`✅ Added file to archive: ${fileName} (${fileStats.length} bytes)`)
            } catch (error) {
              console.error(`❌ Error adding file to archive:`, error)
              reject(new Error(`Failed to add file to archive: ${error}`))
              return
            }
          }
        }

        // Завершаем архив
        console.log('Finalizing ZIP archive...')
        archive.finalize()
      })

      console.log('✅ ZIP archive created successfully')
    } catch (error) {
      console.error('Error creating ZIP archive:', error)
      return NextResponse.json(
        { error: 'Failed to create ZIP archive' },
        { status: 500 }
      )
    }

    // Читаем ZIP файл как Buffer
    console.log(`Reading ZIP file: ${zipFilePath}`)
    const zipFileBuffer = await readFile(zipFilePath)
    console.log(`ZIP file size: ${zipFileBuffer.length} bytes`)

    // Создаем File объект из Buffer с правильным преобразованием
    const zipFile = new File([new Uint8Array(zipFileBuffer)], zipFileName, {
      type: 'application/zip'
    })

    // Создаем FormData для отправки в Telegram
    const formData = new FormData()
    formData.append('chat_id', String(numericChatId))
    formData.append('document', zipFile)
    formData.append('caption', `Обработанные фотографии для артикула: ${sku}\nВсего файлов: ${processInfo.processedFiles.length}`)

    console.log('Sending to Telegram with FormData:', {
      chatId,
      fileName: zipFileName,
      fileSize: zipFileBuffer.byteLength
    })

    // Отправляем ZIP файл в Telegram
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        // Удаляем заголовки, так как FormData установит их автоматически
      }
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Telegram API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to send file to Telegram' },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('File sent to Telegram successfully:', result)

    // Удаляем ZIP файл после отправки
    try {
      await unlink(zipFilePath)
      console.log(`Deleted ZIP file: ${zipFilePath}`)
    } catch (error) {
      console.error(`Error deleting ZIP file: ${error}`)
    }

    return NextResponse.json({
      success: true,
      message: 'File sent to Telegram successfully',
      telegramMessageId: result.result.message_id
    })

  } catch (error) {
    console.error('Telegram API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}