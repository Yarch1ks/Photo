// Обязательные переменные окружения
export const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || ''
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''

// Проверка обязательных переменных
if (!PUBLIC_ORIGIN) {
  throw new Error('PUBLIC_ORIGIN is required')
}
if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required')
}
if (!TELEGRAM_CHAT_ID) {
  throw new Error('TELEGRAM_CHAT_ID is required')
}

export const PHOTOROOM_TOKEN = process.env.PHOTOROOM_TOKEN || ''

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic'
]
export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime'
]

export const MAX_CONCURRENT_PHOTOROOM_REQUESTS = 3
export const PHOTOROOM_RETRY_DELAY = 1000 // 1 second
export const PHOTOROOM_MAX_RETRIES = 3

export const SUPPORTED_FORMATS = {
  images: ['jpg', 'jpeg', 'png', 'heic'],
  videos: ['mp4', 'mov']
}

export const QUALITY_SETTINGS = {
  image: 0.92, // 92% quality for converted images
  zip: 6 // compression level for ZIP
}

// Пути для работы с файлами
export const UPLOADS_DIR = process.env.RAILWAY_SERVICE_NAME ? '/tmp/uploads' : './uploads'
export const TMP_DIR = process.env.RAILWAY_SERVICE_NAME ? '/tmp' : './tmp'

// Функция для безопасного создания пути
export function getUploadPath(sku: string, fileName: string): string {
  const path = require('path')
  const fullPath = path.join(UPLOADS_DIR, sku, fileName)
  
  // Проверка на path traversal
  if (!fullPath.startsWith(UPLOADS_DIR)) {
    throw new Error(`Invalid path: ${fullPath}`)
  }
  
  return fullPath
}

// Функция для создания директории
export async function ensureUploadDir(sku: string): Promise<string> {
  const fs = require('fs/promises')
  const path = require('path')
  
  const uploadDir = path.join(UPLOADS_DIR, sku)
  try {
    await fs.mkdir(uploadDir, { recursive: true })
    console.log(`Created directory: ${uploadDir}`)
    return uploadDir
  } catch (error) {
    console.error(`Error creating directory ${uploadDir}:`, error)
    throw error
  }
}