import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { createReadStream, createWriteStream } from 'fs'
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
    const tempDir = join(process.cwd(), 'temp', sku)
    const files = await readdir(tempDir)
    
    if (files.length === 0) {
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
    const zipFilePath = join(tempDir, zipFileName)

    try {
      // Создаем ZIP архив с помощью archiver
      const output = createWriteStream(zipFilePath)
      const archive = archiver('zip', {
        zlib: { level: 9 } // Максимальное сжатие
      })

      output.on('close', () => {
        console.log(`ZIP archive created: ${zipFilePath}`)
      })

      archive.on('error', (err) => {
        throw err
      })

      // Записываем данные в файл
      archive.pipe(output)

      // Добавляем все файлы из директории в архив
      for (const file of files) {
        const filePath = join(tempDir, file)
        const fileStats = await readFile(filePath)
        archive.append(fileStats, { name: file })
      }

      // Завершаем архив
      await archive.finalize()
    } catch (error) {
      console.error('Error creating ZIP archive:', error)
      return NextResponse.json(
        { error: 'Failed to create ZIP archive' },
        { status: 500 }
      )
    }

    // Читаем ZIP файл как Buffer
    const zipFileBuffer = await readFile(zipFilePath)

    // Создаем File объект из Buffer с правильным преобразованием
    const zipFile = new File([new Uint8Array(zipFileBuffer)], zipFileName, {
      type: 'application/zip'
    })

    // Создаем FormData для отправки в Telegram
    const formData = new FormData()
    formData.append('chat_id', String(numericChatId))
    formData.append('document', zipFile)
    formData.append('caption', `Обработанные фотографии для артикула: ${sku}\nВсего файлов: ${files.length}`)

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