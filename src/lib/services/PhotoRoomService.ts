import { PHOTOROOM_TOKEN } from '@/lib/config'

interface PhotoRoomResponse {
  success: boolean
  result?: {
    image: string // base64 encoded image
  }
  error?: string
}

export class PhotoRoomService {
  private readonly token: string
  private readonly baseUrl = 'https://image-api.photoroom.com/v2/edit'
  private readonly maxRetries = 3
  private readonly retryDelay = 1000 // 1 second

  constructor() {
    this.token = PHOTOROOM_TOKEN
    if (!this.token) {
      throw new Error('PHOTOROOM_TOKEN is required')
    }
  }

  /**
   * Удаляет фон изображения через PhotoRoom API
   * @param imageBuffer Buffer с изображением
   * @returns Promise<Buffer> с обработанным изображением
   */
  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const formData = new FormData()
    
    // Добавляем изображение как binary data
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' })
    formData.append('imageFile', blob, 'image.jpg')
    
    // Параметры для удаления фона и обработки
    formData.append('background.color', 'FFFFFF')
    formData.append('outputSize', '2000x2000')
    formData.append('position.gravity', 'center')
    formData.append('padding', '0.14')
    formData.append('export.format', 'jpg')

    let lastError: Error | null = null

    // Экспоненциальная задержка с ретраями
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Accept': 'image/png, application/json',
            'x-api-key': this.token,
          },
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          
          // Обработка специфичных ошибок PhotoRoom
          if (response.status === 429) {
            throw new Error('Too many requests to PhotoRoom API')
          } else if (response.status === 401) {
            throw new Error('Invalid PhotoRoom API token')
          } else if (response.status >= 500) {
            throw new Error(`PhotoRoom server error: ${errorData.error || 'Unknown error'}`)
          } else {
            throw new Error(`PhotoRoom API error: ${errorData.error || 'Unknown error'}`)
          }
        }

        // PhotoRoom возвращает изображение напрямую, а не JSON
        const imageBuffer = await response.arrayBuffer()
        return Buffer.from(imageBuffer)

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Если это последняя попытка, выбрасываем ошибку
        if (attempt === this.maxRetries) {
          break
        }

        // Экспоненциальная задержка перед следующей попыткой
        const delay = this.retryDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error('Failed to remove background after retries')
  }

  /**
   * Проверяет доступность PhotoRoom API
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      })

      return response.ok
    } catch {
      return false
    }
  }
}