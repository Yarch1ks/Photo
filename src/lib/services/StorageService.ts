import { promises as fs } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES } from '@/lib/config'

export interface StoredFile {
  id: string
  originalName: string
  fileName: string
  filePath: string
  type: 'image' | 'video'
  size: number
  sku: string
  uploadedAt: Date
}

export interface StorageOptions {
  sku: string
  files: File[]
  maxFileSize?: number
  allowedTypes?: string[]
}

export class StorageService {
  private readonly tempDir: string
  private readonly maxFileSize: number
  private readonly allowedTypes: string[]

  constructor(
    tempDir: string = process.cwd() + '/temp',
    maxFileSize: number = MAX_FILE_SIZE,
    allowedTypes: string[] = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]
  ) {
    this.tempDir = tempDir
    this.maxFileSize = maxFileSize
    this.allowedTypes = allowedTypes
  }

  /**
   * Сохраняет файлы во временное хранилище
   */
  async storeFiles(options: StorageOptions): Promise<StoredFile[]> {
    const { sku, files, maxFileSize = this.maxFileSize, allowedTypes = this.allowedTypes } = options

    if (!sku || !files || files.length === 0) {
      throw new Error('SKU and files are required')
    }

    // Создаем директорию для SKU если не существует
    const skuDir = join(this.tempDir, sku)
    await fs.mkdir(skuDir, { recursive: true })

    const storedFiles: StoredFile[] = []

    for (const file of files) {
      // Валидация размера
      if (file.size > maxFileSize) {
        throw new Error(`File ${file.name} exceeds maximum size of ${maxFileSize} bytes`)
      }

      // Валидация типа файла
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File ${file.name} has unsupported type: ${file.type}`)
      }

      // Генерируем уникальное имя файла
      const fileExtension = file.name.split('.').pop()
      const fileName = `${uuidv4()}.${fileExtension}`
      const filePath = join(skuDir, fileName)

      // Сохраняем файл
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(filePath, buffer)

      storedFiles.push({
        id: uuidv4(),
        originalName: file.name,
        fileName: fileName,
        filePath: filePath,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        size: file.size,
        sku: sku,
        uploadedAt: new Date()
      })
    }

    return storedFiles
  }

  /**
   * Получает файл по ID
   */
  async getFile(fileId: string): Promise<StoredFile | null> {
    try {
      // Ищем файл во всех SKU директориях
      const skuDirs = await fs.readdir(this.tempDir)
      
      for (const skuDir of skuDirs) {
        const skuPath = join(this.tempDir, skuDir)
        const files = await fs.readdir(skuPath)
        
        for (const fileName of files) {
          const filePath = join(skuPath, fileName)
          const stats = await fs.stat(filePath)
          
          // Проверяем, соответствует ли файл ID (простая проверка по имени)
          if (fileName.includes(fileId)) {
            return {
              id: fileId,
              originalName: fileName,
              fileName: fileName,
              filePath: filePath,
              type: fileName.includes('image') ? 'image' : 'video',
              size: stats.size,
              sku: skuDir,
              uploadedAt: stats.birthtime
            }
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting file:', error)
      return null
    }
  }

  /**
   * Получает все файлы для SKU
   */
  async getFilesBySKU(sku: string): Promise<StoredFile[]> {
    try {
      const skuDir = join(this.tempDir, sku)
      const files = await fs.readdir(skuDir)
      const storedFiles: StoredFile[] = []

      for (const fileName of files) {
        const filePath = join(skuDir, fileName)
        const stats = await fs.stat(filePath)
        
        storedFiles.push({
          id: uuidv4(),
          originalName: fileName,
          fileName: fileName,
          filePath: filePath,
          type: fileName.includes('image') ? 'image' : 'video',
          size: stats.size,
          sku: sku,
          uploadedAt: stats.birthtime
        })
      }

      return storedFiles
    } catch (error) {
      console.error('Error getting files by SKU:', error)
      return []
    }
  }

  /**
   * Удаляет файл
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const file = await this.getFile(fileId)
      if (!file) {
        return false
      }

      await fs.unlink(file.filePath)
      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      return false
    }
  }

  /**
   * Удаляет все файлы для SKU
   */
  async deleteFilesBySKU(sku: string): Promise<boolean> {
    try {
      const skuDir = join(this.tempDir, sku)
      await fs.rm(skuDir, { recursive: true, force: true })
      return true
    } catch (error) {
      console.error('Error deleting files by SKU:', error)
      return false
    }
  }

  /**
   * Проверяет существование файла
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Получает статистику хранилища
   */
  async getStorageStats(): Promise<{
    totalFiles: number
    totalSize: number
    filesByType: { image: number; video: number }
    filesBySKU: Record<string, number>
  }> {
    try {
      const skuDirs = await fs.readdir(this.tempDir)
      let totalFiles = 0
      let totalSize = 0
      const filesByType = { image: 0, video: 0 }
      const filesBySKU: Record<string, number> = {}

      for (const skuDir of skuDirs) {
        const skuPath = join(this.tempDir, skuDir)
        const files = await fs.readdir(skuPath)
        
        filesBySKU[skuDir] = files.length
        totalFiles += files.length

        for (const fileName of files) {
          const filePath = join(skuPath, fileName)
          const stats = await fs.stat(filePath)
          totalSize += stats.size

          if (fileName.includes('image')) {
            filesByType.image++
          } else {
            filesByType.video++
          }
        }
      }

      return {
        totalFiles,
        totalSize,
        filesByType,
        filesBySKU
      }
    } catch (error) {
      console.error('Error getting storage stats:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        filesByType: { image: 0, video: 0 },
        filesBySKU: {}
      }
    }
  }

  /**
   * Очищает старые файлы (старше N дней)
   */
  async cleanupOldFiles(daysOld: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)
      
      const skuDirs = await fs.readdir(this.tempDir)
      let deletedFiles = 0

      for (const skuDir of skuDirs) {
        const skuPath = join(this.tempDir, skuDir)
        const files = await fs.readdir(skuPath)
        
        for (const fileName of files) {
          const filePath = join(skuPath, fileName)
          const stats = await fs.stat(filePath)
          
          if (stats.birthtime < cutoffDate) {
            await fs.unlink(filePath)
            deletedFiles++
          }
        }
      }

      return deletedFiles
    } catch (error) {
      console.error('Error cleaning up old files:', error)
      return 0
    }
  }
}