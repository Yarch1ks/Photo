'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Send
} from 'lucide-react'
import { ProgressTracker } from '@/components/ui/ProgressTracker'
import type { ProgressFile } from '@/lib/types'
import { generateFileName } from '@/lib/utils/validation'

interface ProcessingProps {
  sku: string
  files: any[]
  onBack: () => void
  onComplete: (results: ProgressFile[]) => void
  onError: (error: string) => void
}

export function Processing({ 
  sku, 
  files, 
  onBack, 
  onComplete, 
  onError 
}: ProcessingProps) {
  const [progressFiles, setProgressFiles] = useState<ProgressFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(null)
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false)

  useEffect(() => {
    // Инициализация прогресса при загрузке компонента
    initializeProgress()
  }, [files, sku])

  const initializeProgress = () => {
    console.log('Initializing progress with files:', files)
    
    const initializedFiles: ProgressFile[] = files.map((file, index) => {
      // Извлекаем только расширение файла
      const extension = file.file.name.split('.').pop() || 'jpg'
      const finalName = generateFileName(sku, index + 1, extension)
      
      return {
        id: file.id,
        name: file.name,
        type: file.type,
        status: file.type === 'video' ? 'skipped' : 'queued',
        originalName: file.name,
        finalName: finalName,
        progress: 0
      }
    })

    console.log('Initialized progress files:', initializedFiles)
    setProgressFiles(initializedFiles)
  }

  const startProcessing = async () => {
    setIsProcessing(true)
    setProcessingStartTime(new Date())

    try {
      // Сначала загружаем файлы на сервер
      const formData = new FormData()
      formData.append('sku', sku)
      
      // Добавляем файлы в FormData
      files.forEach((file) => {
        formData.append('files', file.file) // file.file это File объект
      })

      console.log('Uploading files:', files.map(f => f.name))
      console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? value.name : value]))
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        console.error('Upload error response:', errorData)
        throw new Error(errorData.error || 'Failed to upload files')
      }

      const uploadResult = await uploadResponse.json()
      console.log('Upload result:', uploadResult)
      
      // Запускаем обработку загруженных файлов
      const processPayload = {
        sku,
        files: uploadResult.files.map((file: any) => ({
          id: file.id,
          fileName: file.fileName,
          filePath: file.filePath,
          type: file.type,
          // Добавляем оригинальное имя для сопоставления
          originalName: file.originalName
        }))
      }
      
      // Обновляем progressFiles с правильными ID из uploadResult
      const updatedProgressFiles = progressFiles.map((file, index) => {
        const uploadFile = uploadResult.files[index]
        if (uploadFile) {
          return {
            ...file,
            id: uploadFile.id,
            originalName: uploadFile.originalName
          }
        }
        return file
      })
      
      setProgressFiles(updatedProgressFiles)
      
      console.log('Process payload:', processPayload)
      
      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processPayload),
      })

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}))
        console.error('Process error response:', errorData)
        throw new Error(errorData.error || 'Failed to process files')
      }

      const processResult = await processResponse.json()
      console.log('Process result:', processResult)
      console.log('Process result results:', processResult.results)
      console.log('Progress files before update:', progressFiles.map(f => ({ id: f.id, name: f.name })))
      
      // Обновляем прогресс на основе результатов
      const updatedFiles = progressFiles.map(file => {
        console.log(`Looking for processed file for: ${file.name} (original: ${file.originalName})`)
        
        // Ищем processed файл по оригинальному имени файла из upload result
        const processedFile = processResult.results.find((r: any) => {
          // Ищем соответствующий файл в upload result по оригинальному имени
          const uploadFile = uploadResult.files.find((uf: any) => uf.originalName === r.originalName)
          if (uploadFile) {
            // Сравниваем оригинальное имя из upload с текущим файлом
            const matchByName = uploadFile.originalName === file.name || uploadFile.fileName === file.name
            console.log(`Comparing ${r.originalName} with ${file.name}: name match: ${matchByName}`)
            return matchByName
          }
          return false
        })
        
        if (processedFile) {
          console.log(`Found processed file:`, processedFile)
          return {
            ...file,
            status: processedFile.status,
            finalName: processedFile.finalName,
            error: processedFile.error,
            processedPath: processedFile.processedPath
          }
        }
        
        console.log(`Processed file not found for: ${file.name}`)
        return file
      })

      console.log('Updated files:', updatedFiles)
      console.log('Updated files details:', updatedFiles.map(f => ({
        id: f.id,
        name: f.name,
        status: f.status,
        finalName: f.finalName,
        originalName: f.originalName
      })))
      setProgressFiles(updatedFiles)
      
    } catch (error) {
      console.error('Processing error:', error)
      onError(error instanceof Error ? error.message : 'Произошла ошибка при обработке файлов')
    } finally {
      setIsProcessing(false)
    }
  }

  // Удаляем simulateProcessing функцию так как теперь используем реальное API

  const updateFileStatus = (fileId: string, status: ProgressFile['status']) => {
    setProgressFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, status } : file
    ))
  }

  const updateFileProgress = (fileId: string, progress: number) => {
    setProgressFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, progress } : file
    ))
  }

  const handleComplete = () => {
    onComplete(progressFiles)
  }

  const handleRetry = async () => {
    // Сбрасываем статус ошибочных файлов
    const resetFiles = progressFiles.map(file =>
      file.status === 'error' ? { ...file, status: 'queued' as const, error: undefined } : file
    )
    
    setProgressFiles(resetFiles)
    await startProcessing()
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

  const getProcessingStats = () => {
    const total = progressFiles.length
    const images = progressFiles.filter(f => f.type === 'image').length
    const videos = progressFiles.filter(f => f.type === 'video').length
    const done = progressFiles.filter(f => f.status === 'done').length
    const errors = progressFiles.filter(f => f.status === 'error').length
    const processing = progressFiles.filter(f => f.status === 'processing').length

    return { total, images, videos, done, errors, processing }
  }

  const stats = getProcessingStats()
  const hasErrors = stats.errors > 0
  const allDone = stats.done + stats.errors === stats.total

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Photo SKU Processor
          </h1>
          <p className="text-gray-600">
            Обработка фотографий товаров с привязкой к штрих-коду
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Обработка файлов
                </h2>
                <p className="text-sm text-gray-600">
                  SKU: {sku}
                </p>
              </div>
              
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Обработка...</span>
                </div>
              )}
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.images}
                </div>
                <div className="text-xs text-gray-600">Изображений</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.videos}
                </div>
                <div className="text-xs text-gray-600">Видео</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.done}
                </div>
                <div className="text-xs text-gray-600">Готово</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {stats.errors}
                </div>
                <div className="text-xs text-gray-600">Ошибок</div>
              </div>
            </div>

            {/* Предупреждение */}
            {stats.videos > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Важно</p>
                    <p>
                      Видео файлы не будут обработаны в Photoroom. Они будут включены 
                      в финальный архив без изменений.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Кнопка старта */}
            {!isProcessing && stats.done === 0 && (
              <div className="text-center mb-6">
                <button
                  onClick={() => {
                    console.log('Start processing clicked, files:', files)
                    console.log('Progress files before start:', progressFiles)
                    startProcessing()
                  }}
                  disabled={files.length === 0}
                  className="bg-blue-600 text-white py-3 px-8 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  Начать обработку
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  Максимально 3 файла обрабатываются одновременно
                </p>
              </div>
            )}

            {/* Кнопка повтора при ошибках */}
            {hasErrors && !isProcessing && (
              <div className="text-center mb-6">
                <button
                  onClick={handleRetry}
                  className="bg-orange-600 text-white py-2 px-6 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  Повторить обработку ошибочных файлов
                </button>
              </div>
            )}

            {/* Завершение */}
            {allDone && !isProcessing && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      Обработка завершена!
                    </p>
                    <p className="text-sm text-green-600">
                      {stats.done} файлов успешно обработано
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Трекер прогресса */}
          <ProgressTracker
            files={progressFiles}
            title="Прогресс обработки"
            subtitle="Следите за статусом каждого файла"
            onComplete={handleComplete}
          />

          {/* Кнопки управления */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={onBack}
              className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>

            {allDone && !isProcessing && (
              <>
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
                  onClick={handleComplete}
                  className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Показать результаты
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}