import { z } from 'zod'

// Схема валидации SKU - только 6 цифр
export const skuSchema = z.string()
  .min(6, 'SKU должен содержать ровно 6 цифр')
  .max(6, 'SKU должен содержать ровно 6 цифр')
  .regex(/^\d{6}$/, 'SKU должен содержать только цифры (ровно 6 символов)')

// Валидация SKU
export function validateSKU(sku: string): { isValid: boolean; error?: string } {
  try {
    skuSchema.parse(sku)
    return { isValid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        isValid: false, 
        error: error.errors[0]?.message || 'Некорректный формат SKU' 
      }
    }
    return { 
      isValid: false, 
      error: 'Произошла ошибка при валидации SKU' 
    }
  }
}

// Валидация файла
export function validateFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '26214400') // 25MB
  
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      error: `Файл слишком большой. Максимальный размер: ${Math.round(maxSize / 1024 / 1024)}MB` 
    }
  }
  
  const allowedImageTypes = process.env.NEXT_PUBLIC_ALLOWED_IMAGE_TYPES?.split(',') || [
    'image/jpeg', 
    'image/png', 
    'image/heic'
  ]
  
  const allowedVideoTypes = process.env.NEXT_PUBLIC_ALLOWED_VIDEO_TYPES?.split(',') || [
    'video/mp4', 
    'video/quicktime'
  ]
  
  const allAllowedTypes = [...allowedImageTypes, ...allowedVideoTypes]
  
  if (!allAllowedTypes.includes(file.type)) {
    const imageTypes = allowedImageTypes.join(', ')
    const videoTypes = allowedVideoTypes.join(', ')
    return { 
      isValid: false, 
      error: `Неподдерживаемый формат. Допустимые изображения: ${imageTypes}, видео: ${videoTypes}` 
    }
  }
  
  return { isValid: true }
}

// Генерация имени файла
export function generateFileName(sku: string, index: number, extension: string): string {
  const paddedIndex = index.toString().padStart(3, '0')
  return `${sku}_${paddedIndex}.${extension}`
}

// Проверка поддержки BarcodeDetector
export function isBarcodeDetectorSupported(): boolean {
  return 'BarcodeDetector' in window
}

// Проверка поддержки MediaDevices
export function isCameraSupported(): boolean {
  return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
}

// Форматирование размера файла
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Форматирование прогресса
export function formatProgress(progress: number): string {
  return `${Math.round(progress)}%`
}

// Очистка имени файла от недопустимых символов
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_./]/g, '_')
}

// Проверка, является ли файл изображением
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

// Проверка, является ли файл видео
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

// Проверка, является ли файл HEIC
export function isHeicFile(file: File): boolean {
  return file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')
}