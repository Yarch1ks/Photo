'use client'

import { useState, useCallback } from 'react'
import { 
  Upload, 
  Camera, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Video
} from 'lucide-react'
import { FileUploader } from '@/components/ui/FileUploader'
import { generateFileName, isHeicFile, formatFileSize } from '@/lib/utils/validation'
import type { MediaFile } from '@/lib/types'

interface MediaUploadProps {
  sku: string
  onBack: () => void
  onContinue: (files: MediaFile[]) => void
  onError: (error: string) => void
}

export function MediaUpload({ sku, onBack, onContinue, onError }: MediaUploadProps) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)

  const handleFilesChange = useCallback((newFiles: MediaFile[]) => {
    setFiles(newFiles)
  }, [])

  const handleConvertHeic = async () => {
    const heicFiles = files.filter(file => isHeicFile(file.file))
    
    if (heicFiles.length === 0) {
      onContinue(files)
      return
    }

    setIsConverting(true)
    setConversionProgress(0)

    try {
      const convertedFiles: MediaFile[] = []
      const totalFiles = heicFiles.length

      for (let i = 0; i < heicFiles.length; i++) {
        const file = heicFiles[i]
        setConversionProgress(Math.round(((i + 1) / totalFiles) * 100))

        try {
          // Конвертация HEIC в JPG
          const convertedFile = await convertHeicToJpg(file)
          convertedFiles.push(convertedFile)
        } catch (error) {
          console.error('Error converting HEIC file:', error)
          onError(`Не удалось конвертировать файл: ${file.name}`)
        }
      }

      // Обновляем список файлов, заменяя HEIC на JPG
      const updatedFiles = files
        .filter(file => !isHeicFile(file.file))
        .concat(convertedFiles)

      setFiles(updatedFiles)
      onContinue(updatedFiles)
    } catch (error) {
      onError('Произошла ошибка при конвертации файлов')
    } finally {
      setIsConverting(false)
      setConversionProgress(0)
    }
  }

  const convertHeicToJpg = async (file: MediaFile): Promise<MediaFile> => {
    // Импорт heic2any динамически, чтобы избежать ошибки SSR
    const heic2any = (await import('heic2any')).default
    
    const result = await heic2any({
      blob: file.file,
      quality: 0.92,
      toType: 'image/jpeg'
    })

    const jpgBlob = result as Blob
    const extension = 'jpg'
    const fileName = generateFileName(sku, files.findIndex(f => f.id === file.id) + 1, extension)
    const jpgFile = new File([jpgBlob], fileName, { type: 'image/jpeg' })

    // Создаем превью для конвертированного файла
    const preview = await createImagePreview(jpgFile)

    return {
      ...file,
      file: jpgFile,
      name: jpgFile.name,
      converted: true,
      preview,
      status: 'ready'
    }
  }

  const createImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleContinue = async () => {
    if (files.length === 0) {
      onError('Пожалуйста, загрузите хотя бы один файл')
      return
    }

    // Проверяем, есть ли HEIC файлы для конвертации
    const hasHeicFiles = files.some(file => isHeicFile(file.file))
    
    if (hasHeicFiles) {
      await handleConvertHeic()
    } else {
      onContinue(files)
    }
  }

  const handleClear = () => {
    setFiles([])
  }

  const getImageFiles = () => files.filter(file => file.type === 'image')
  const getVideoFiles = () => files.filter(file => file.type === 'video')

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-full mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Загрузка медиа файлов
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>SKU:</span>
          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
            {sku}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Загрузчик файлов */}
        <FileUploader
          onFilesChange={handleFilesChange}
          acceptedTypes={[
            'image/jpeg', 
            'image/png', 
            'image/heic',
            'video/mp4', 
            'video/quicktime'
          ]}
          maxSize={25 * 1024 * 1024} // 25MB
          multiple={true}
        />

        {/* Статистика файлов */}
        {files.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <span>
                  Изображения: {getImageFiles().length}
                  {getImageFiles().some(f => isHeicFile(f.file)) && (
                    <span className="text-orange-600 ml-1">
                      (HEIC требует конвертации)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-green-500" />
                <span>Видео: {getVideoFiles().length}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-gray-500" />
                <span>Всего: {files.length} файлов</span>
              </div>
            </div>
          </div>
        )}

        {/* Прогресс конвертации */}
        {isConverting && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="text-sm font-medium text-blue-800">
                Конвертация HEIC файлов в JPG...
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${conversionProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {conversionProgress}% завершено
            </p>
          </div>
        )}

        {/* Предупреждение */}
        {getVideoFiles().length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
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

        {/* Кнопки управления */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <button
            onClick={onBack}
            className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>

          <button
            onClick={handleClear}
            disabled={files.length === 0 || isConverting}
            className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Очистить
          </button>

          <button
            onClick={handleContinue}
            disabled={files.length === 0 || isConverting}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            {isConverting ? 'Конвертация...' : 'Продолжить'}
          </button>
        </div>
      </div>
    </div>
  )
}