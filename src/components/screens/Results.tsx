'use client'

import { useState } from 'react'
import {
  Download,
  ArrowLeft,
  RefreshCw,
  Image as ImageIcon,
  Video,
  FileImage,
  CheckCircle,
  AlertCircle,
  X,
  ZoomIn,
  Send,
  Loader2
} from 'lucide-react'
import { generateFileName } from '@/lib/utils/validation'
import type { ProgressFile } from '@/components/ui/ProgressTracker'

// Функция для извлечения правильного имени файла без оригинального расширения
const getCleanFileName = (finalName: string): string => {
  // Удаляем оригинальное расширение, если оно есть после точки
  const lastDotIndex = finalName.lastIndexOf('.')
  if (lastDotIndex > 0) {
    // Проверяем, есть ли в имени несколько точек (как в 123456_001.123123123123.png)
    // Мы хотим оставить только SKU_NNN.jpg
    const baseName = finalName.substring(0, lastDotIndex)
    const extension = finalName.substring(lastDotIndex)
    
    // Если в имени есть точка после SKU_NNN, это значит, что оригинальное расширение было добавлено
    // Берем только последнее расширение
    const finalLastDot = baseName.lastIndexOf('.')
    if (finalLastDot > 0) {
      return baseName.substring(finalLastDot + 1) + extension
    }
  }
  return finalName
}

interface ResultsProps {
  sku: string
  files: ProgressFile[]
  onBack: () => void
  onRestart: () => void
  onError: (error: string) => void
}

export function Results({
  sku,
  files,
  onBack,
  onRestart,
  onError
}: ResultsProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false)

  const successfulFiles = files.filter(f => f.status === 'done')
  const skippedFiles = files.filter(f => f.status === 'skipped')
  const errorFiles = files.filter(f => f.status === 'error')

  const handleDownload = async () => {
    if (successfulFiles.length === 0) {
      onError('Нет готовых файлов для скачивания')
      return
    }

    setIsDownloading(true)
    setDownloadProgress(0)

    try {
      // Отправляем запрос на скачивание ZIP архива
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku,
          includeOriginals: false
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to download ZIP file')
      }

      // Получаем данные архива
      const blob = await response.blob()
      
      // Создаем URL для скачивания
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photo-sku-${sku}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Download error:', error)
      onError('Произошла ошибка при скачивании ZIP файла')
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
    }
  }

  const handleDownloadWithOriginals = async () => {
    if (files.length === 0) {
      onError('Нет файлов для скачивания')
      return
    }

    setIsDownloading(true)
    setDownloadProgress(0)

    try {
      // Отправляем запрос на скачивание ZIP архива с оригиналами
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku,
          includeOriginals: true
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to download ZIP file')
      }

      // Получаем данные архива
      const blob = await response.blob()
      
      // Создаем URL для скачивания
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photo-sku-${sku}-${new Date().toISOString().replace(/[:.]/g, '-')}-with-originals.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Download error:', error)
      onError('Произошла ошибка при скачивании ZIP файла')
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
    }
  }

  const handleSendToTelegram = async () => {
    setIsSendingToTelegram(true)
    
    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku,
          chatId: '-4914435522' // ID канала
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to send files to Telegram')
      }

      const result = await response.json()
      console.log('Files sent to Telegram:', result)
      
      // Показываем сообщение об успехе
      alert('Файлы успешно отправлены в Telegram!')
      
    } catch (error) {
      console.error('Telegram send error:', error)
      alert(`Ошибка при отправке в Telegram: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSendingToTelegram(false)
    }
  }

  const getPreviewUrl = (file: ProgressFile) => {
    // Для обработанных изображений возвращаем URL из ответа API
    if (file.type === 'image' && file.status === 'done' && file.url) {
      return file.url
    }
    // Для ошибок или других случаев - placeholder
    return file.type === 'image' ? '/placeholder-image.jpg' : '/placeholder-video.jpg'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <main className="max-w-4xl mx-auto">
          {/* Статистика результатов */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Обработка завершена!
              </h2>
              <p className="text-gray-600">
                SKU: {sku}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {successfulFiles.length}
                </div>
                <div className="text-sm text-gray-600">Изображений обработано</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-2">
                  {skippedFiles.length}
                </div>
                <div className="text-sm text-gray-600">Видео пропущено</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {files.length}
                </div>
                <div className="text-sm text-gray-600">Всего файлов</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600 mb-2">
                  {errorFiles.length}
                </div>
                <div className="text-sm text-gray-600">Ошибок</div>
              </div>
            </div>

            {/* Предупреждение */}
            {errorFiles.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 mb-1">
                      Обнаружены ошибки при обработке
                    </p>
                    <p className="text-sm text-red-600">
                      Некоторые файлы не удалось обработать. Попробуйте загрузить их снова.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Кнопки скачивания */}
            <div className="space-y-3">
              <button
                onClick={handleDownload}
                disabled={isDownloading || successfulFiles.length === 0}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Создание архива...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Скачать ZIP (только обработанные изображения)
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadWithOriginals}
                disabled={isDownloading || files.length === 0}
                className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Создание архива...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Скачать ZIP (включая оригиналы и видео)
                  </>
                )}
              </button>
            </div>

            {/* Прогресс скачивания */}
            {isDownloading && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Создание архива
                  </span>
                  <span className="text-sm text-gray-500">
                    {downloadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Список результатов */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Результаты обработки
            </h3>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`border rounded-lg p-4 ${
                    file.status === 'done' ? 'bg-green-50 border-green-200' :
                    file.status === 'skipped' ? 'bg-yellow-50 border-yellow-200' :
                    file.status === 'error' ? 'bg-red-50 border-red-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Иконка файла */}
                    <div className="flex-shrink-0">
                      {file.type === 'image' ? (
                        <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                          <FileImage className="w-6 h-6 text-blue-600" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-yellow-100 rounded flex items-center justify-center">
                          <Video className="w-6 h-6 text-yellow-600" />
                        </div>
                      )}
                    </div>

                    {/* Информация о файле */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.originalName}
                        </p>
                        <span className="text-xs text-gray-500">
                          →
                        </span>
                        <p className="text-sm text-green-600 font-medium truncate">
                          {getCleanFileName(file.finalName)}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {file.status === 'done' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {file.status === 'skipped' && (
                          <Video className="w-4 h-4 text-yellow-500" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`text-sm ${
                          file.status === 'done' ? 'text-green-600' :
                          file.status === 'skipped' ? 'text-yellow-600' :
                          file.status === 'error' ? 'text-red-600' :
                          'text-gray-500'
                        }`}>
                          {file.status === 'done' ? 'Готово' :
                           file.status === 'skipped' ? 'Пропущено' :
                           file.status === 'error' ? 'Ошибка' : 'В обработке'}
                        </span>
                        {file.error && (
                          <span className="text-xs text-red-500">
                            ({file.error})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Превью */}
                    <div className="flex-shrink-0">
                      {file.type === 'image' && file.status === 'done' && (
                        <div
                          className="w-16 h-16 bg-gray-200 rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedImage(getPreviewUrl(file))}
                        >
                          <img
                            src={getPreviewUrl(file)}
                            alt={file.finalName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Кнопки управления */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={onBack}
              className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>

            <button
              onClick={handleSendToTelegram}
              disabled={isSendingToTelegram}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
            >
              {isSendingToTelegram ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Отправить в Telegram
                </>
              )}
            </button>

            <button
              onClick={onRestart}
              className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Начать заново
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}