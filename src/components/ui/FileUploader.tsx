'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Video, FileImage, AlertCircle } from 'lucide-react'
import { validateFile, formatFileSize, isImageFile, isVideoFile, isHeicFile } from '@/lib/utils/validation'
import type { MediaFile } from '@/lib/types'

interface FileUploaderProps {
  onFilesChange: (files: MediaFile[]) => void
  acceptedTypes?: string[]
  maxSize?: number
  multiple?: boolean
}

export function FileUploader({ 
  onFilesChange, 
  acceptedTypes = [
    'image/jpeg', 
    'image/png', 
    'image/heic',
    'video/mp4', 
    'video/quicktime'
  ], 
  maxSize = 25 * 1024 * 1024, // 25MB
  multiple = true 
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [files, setFiles] = useState<MediaFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const processFile = async (file: File): Promise<MediaFile> => {
    const id = generateId()
    const isImage = isImageFile(file)
    const isVideo = isVideoFile(file)
    
    const mediaFile: MediaFile = {
      id,
      file,
      name: file.name,
      size: file.size,
      type: isImage ? 'image' : 'video',
      status: 'pending'
    }

    // Создаем превью для изображений
    if (isImage) {
      try {
        const preview = await createImagePreview(file)
        mediaFile.preview = preview
      } catch (error) {
        console.error('Error creating preview:', error)
      }
    }

    return mediaFile
  }

  const createImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFiles = async (newFiles: FileList) => {
    const fileArray = Array.from(newFiles)
    const validFiles: MediaFile[] = []
    const errors: string[] = []

    for (const file of fileArray) {
      const validation = validateFile(file)
      
      if (!validation.isValid) {
        errors.push(`${file.name}: ${validation.error}`)
        continue
      }

      try {
        const processedFile = await processFile(file)
        validFiles.push(processedFile)
      } catch (error) {
        errors.push(`${file.name}: Ошибка обработки файла`)
      }
    }

    if (errors.length > 0) {
      console.warn('File validation errors:', errors)
    }

    const updatedFiles = multiple ? [...files, ...validFiles] : validFiles
    setFiles(updatedFiles)
    onFilesChange(updatedFiles)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles)
    }
  }, [files, multiple])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      handleFiles(selectedFiles)
    }
  }

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId)
    setFiles(updatedFiles)
    onFilesChange(updatedFiles)
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      {/* Область загрузки */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-3">
          <Upload className="w-12 h-12 text-gray-400" />
          <div>
            <p className="text-lg font-medium text-gray-900">
              Перетащите файлы сюда
            </p>
            <p className="text-sm text-gray-500">
              или нажмите для выбора
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {acceptedTypes.map(type => (
              <span key={type} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {type}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Максимальный размер: {formatFileSize(maxSize)}
          </p>
        </div>
      </div>

      {/* Список загруженных файлов */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Загруженные файлы ({files.length})
          </h3>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
              >
                {/* Превью */}
                <div className="flex-shrink-0">
                  {file.type === 'image' ? (
                    <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden">
                      {file.preview ? (
                        <img 
                          src={file.preview} 
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-full h-full text-gray-400" />
                      )}
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                      <Video className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Информация о файле */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {file.type === 'image' ? (
                        <>
                          <FileImage className="w-3 h-3" />
                          Изображение
                        </>
                      ) : (
                        <>
                          <Video className="w-3 h-3" />
                          Видео
                        </>
                      )}
                    </span>
                    {isHeicFile(file.file) && (
                      <>
                        <span>•</span>
                        <span className="text-orange-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Требуется конвертация
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Кнопка удаления */}
                <button
                  onClick={() => removeFile(file.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}