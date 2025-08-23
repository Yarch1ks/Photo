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
    
    let skuFiles: string[]
    try {
      skuFiles = await readdir(skuDir)
      console.log(`Found ${skuFiles.length} files for SKU ${sku}:`, skuFiles)
      
      if (skuFiles.length === 0) {
        return NextResponse.json(
          { error: 'No processed files found for this SKU' },
          { status: 404 }
        )
      }
    } catch (error) {
      console.error(`Error reading directory for SKU ${sku}:`, error)
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

        // Добавляем все файлы из SKU директории в архив
        for (const file of skuFiles) {
          const filePath = join(skuDir, file)
          console.log(`Adding file to archive: ${filePath}`)
          
          try {
            const fileStats = readFileSync(filePath)
            archive.append(fileStats, { name: file })
            console.log(`✅ Added file to archive: ${file} (${fileStats.length} bytes)`)
          } catch (error) {
            console.error(`❌ Error adding file ${file} to archive:`, error)
            reject(new Error(`Failed to add file ${file} to archive: ${error}`))
            return
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
    formData.append('caption', `Обработанные фотографии для артикула: ${sku}\nВсего файлов: ${skuFiles.length}`)

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

    // Читаем process-info.json для получения списка файлов для удаления
    const processInfoPath = join(skuDir, `${sku}-process-info.json`)
    const processInfo = JSON.parse(await readFile(processInfoPath, 'utf-8'))

    // Удаляем оригинальные файлы после успешной отправки
    if (processInfo.filesToDelete) {
      for (const filePath of processInfo.filesToDelete) {
        try {
          await unlink(filePath)
          console.log(`Deleted original file: ${filePath}`)
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error)
        }
      }
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