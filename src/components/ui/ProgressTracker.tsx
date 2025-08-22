'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2,
  FileImage,
  Video
} from 'lucide-react'

export type FileStatus = 'queued' | 'processing' | 'done' | 'error' | 'skipped'

export interface ProgressFile {
  id: string
  name: string
  type: 'image' | 'video'
  status: FileStatus
  progress?: number
  error?: string
  originalName: string
  finalName: string
  processedPath?: string
}

interface ProgressTrackerProps {
  files: ProgressFile[]
  title?: string
  subtitle?: string
  onComplete?: () => void
}

export function ProgressTracker({ 
  files, 
  title = "Обработка файлов", 
  subtitle = "Пожалуйста, дождитесь завершения обработки",
  onComplete 
}: ProgressTrackerProps) {
  const [completedFiles, setCompletedFiles] = useState(0)
  const [totalProgress, setTotalProgress] = useState(0)

  useEffect(() => {
    // Подсчет завершенных файлов
    const done = files.filter(f => f.status === 'done' || f.status === 'skipped').length
    setCompletedFiles(done)

    // Расчет общего прогресса
    const processingFiles = files.filter(f => f.status === 'processing')
    const progressSum = processingFiles.reduce((sum, file) => sum + (file.progress || 0), 0)
    const avgProgress = processingFiles.length > 0 ? progressSum / processingFiles.length : 0
    
    const total = (done / files.length) * 100 + (avgProgress * processingFiles.length / files.length)
    setTotalProgress(Math.round(total))

    // Проверка завершения
    if (done === files.length && files.length > 0) {
      onComplete?.()
    }
  }, [files, onComplete])

  const getStatusIcon = (status: FileStatus, type: 'image' | 'video') => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-gray-400" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'done':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'skipped':
        return <Video className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusText = (status: FileStatus) => {
    switch (status) {
      case 'queued':
        return 'В очереди'
      case 'processing':
        return 'Обработка...'
      case 'done':
        return 'Готово'
      case 'error':
        return 'Ошибка'
      case 'skipped':
        return 'Пропущено'
    }
  }

  const getStatusColor = (status: FileStatus) => {
    switch (status) {
      case 'queued':
        return 'text-gray-500'
      case 'processing':
        return 'text-blue-600'
      case 'done':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'skipped':
        return 'text-yellow-600'
    }
  }

  const getProgressBarColor = (status: FileStatus) => {
    switch (status) {
      case 'queued':
        return 'bg-gray-200'
      case 'processing':
        return 'bg-blue-500'
      case 'done':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'skipped':
        return 'bg-yellow-500'
    }
  }

  const imageFiles = files.filter(f => f.type === 'image')
  const videoFiles = files.filter(f => f.type === 'video')
  const processedImages = imageFiles.filter(f => f.status === 'done').length
  const skippedVideos = videoFiles.filter(f => f.status === 'skipped').length

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-full mx-auto">
      {/* Заголовок */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {title}
        </h2>
        <p className="text-gray-600">
          {subtitle}
        </p>
      </div>

      {/* Общий прогресс */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Общий прогресс
          </span>
          <span className="text-sm text-gray-500">
            {totalProgress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${totalProgress}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Обработано: {completedFiles}/{files.length}</span>
          <span>
            Изображения: {processedImages}, Видео: {skippedVideos}
          </span>
        </div>
      </div>

      {/* Список файлов */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {files.map((file) => (
          <div
            key={file.id}
            className="border rounded-lg p-4 bg-gray-50"
          >
            <div className="flex items-center gap-3 mb-3">
              {/* Иконка файла */}
              <div className="flex-shrink-0">
                {file.type === 'image' ? (
                  <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                    <FileImage className="w-5 h-5 text-blue-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-yellow-100 rounded flex items-center justify-center">
                    <Video className="w-5 h-5 text-yellow-600" />
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
                    {file.finalName.replace(/\.(\w+)\.\w+$/, '.$1')}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {getStatusIcon(file.status, file.type)}
                  <span className={`text-sm ${getStatusColor(file.status)}`}>
                    {getStatusText(file.status)}
                  </span>
                  {file.error && (
                    <span className="text-xs text-red-500">
                      ({file.error})
                    </span>
                  )}
                </div>
              </div>

              {/* Прогресс */}
              <div className="flex-shrink-0 w-24">
                {file.status === 'processing' && file.progress !== undefined && (
                  <div className="text-right">
                    <div className="text-xs text-blue-600 font-medium">
                      {file.progress}%
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Прогресс-бар */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(file.status)}`}
                style={{ 
                  width: file.status === 'processing' && file.progress !== undefined 
                    ? `${file.progress}%` 
                    : file.status === 'done' || file.status === 'skipped' 
                      ? '100%' 
                      : '0%'
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Статистика */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {imageFiles.filter(f => f.status === 'done').length}
            </div>
            <div className="text-gray-500">Изображений обработано</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {videoFiles.filter(f => f.status === 'skipped').length}
            </div>
            <div className="text-gray-500">Видео пропущено</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {files.filter(f => f.status === 'error').length}
            </div>
            <div className="text-gray-500">Ошибок</div>
          </div>
        </div>
      </div>
    </div>
  )
}