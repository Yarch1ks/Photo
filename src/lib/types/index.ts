// Типы для SKU
export interface SKUInput {
  value: string
  isValid: boolean
  error?: string
}

// Типы для файлов
export interface MediaFile {
  id: string
  file: File
  name: string
  size: number
  type: 'image' | 'video'
  converted?: boolean
  preview?: string
  status: 'pending' | 'converting' | 'ready' | 'processing' | 'done' | 'error'
  error?: string
}

// Типы для обработки
export interface ProcessingManifest {
  sku: string
  files: Array<{
    clientName: string
    targetName: string
    type: 'image' | 'video'
    status: 'pending' | 'processing' | 'done' | 'skipped' | 'error'
    error?: string
  }>
  createdAt: string
}

// Типы для прогресса
export interface ProgressUpdate {
  fileId: string
  status: 'queued' | 'processing' | 'done' | 'error'
  progress?: number
  error?: string
  resultUrl?: string
}

// Типы для PhotoRoom API
export interface PhotoRoomResponse {
  success: boolean
  resultUrl?: string
  error?: string
}

// Типы для приложения
export type AppScreen = 'sku' | 'media' | 'processing' | 'results'

// Конфигурация
export interface AppConfig {
  maxFileSize: number
  allowedImageTypes: string[]
  allowedVideoTypes: string[]
  maxConcurrentRequests: number
  retryAttempts: number
  retryDelay: number
}

// Статусы обработки
export enum ProcessingStatus {
  PENDING = 'pending',
  CONVERTING = 'converting',
  READY = 'ready',
  PROCESSING = 'processing',
  DONE = 'done',
  SKIPPED = 'skipped',
  ERROR = 'error'
}

// Типы для ошибок
export interface AppError {
  code: string
  message: string
  details?: any
}

// Типы для прогресса файлов
export interface ProgressFile {
  id: string
  originalName: string
  finalName: string
  status: 'done' | 'error' | 'skipped'
  error?: string
  previewUrl?: string
  type: 'image' | 'video'
}