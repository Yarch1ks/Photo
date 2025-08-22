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