import { NextRequest, NextResponse } from 'next/server'
import { WebSocketServer } from 'ws'

interface ProgressMessage {
  type: 'progress' | 'complete' | 'error'
  fileId: string
  status: 'queued' | 'processing' | 'done' | 'error'
  progress?: number
  message?: string
  error?: string
}

// Глобальный WebSocket сервер
let globalWebSocketServer: WebSocketServer | null = null

export async function GET(request: NextRequest) {
  try {
    // Инициализируем WebSocket сервер если еще не создан
    if (!globalWebSocketServer) {
      globalWebSocketServer = new WebSocketServer({ noServer: true })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId') || generateSessionId()

    // Создаем WebSocket соединение
    const upgrade = request.headers.get('upgrade')
    if (upgrade !== 'websocket') {
      return new NextResponse('Upgrade header required', { status: 426 })
    }

    // В реальном приложении здесь будет обработка WebSocket соединения
    // Для демонстрации возвращаем SSE
    const response = new NextResponse()
    response.headers.set('Content-Type', 'text/event-stream')
    response.headers.set('Cache-Control', 'no-cache')
    response.headers.set('Connection', 'keep-alive')
    response.headers.set('Access-Control-Allow-Origin', '*')

    // Отправляем начальное сообщение
    const encoder = new TextEncoder()
    const data = encoder.encode(`data: ${JSON.stringify({
      type: 'connected',
      sessionId,
      timestamp: new Date().toISOString()
    })}\n\n`)
    
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data)
        
        // Симулируем отправку прогресса
        const simulateProgress = () => {
          const progressMessage: ProgressMessage = {
            type: 'progress',
            fileId: sessionId,
            status: 'processing',
            progress: Math.floor(Math.random() * 100),
            message: 'Processing file...'
          }
          
          const progressData = encoder.encode(`data: ${JSON.stringify(progressMessage)}\n\n`)
          controller.enqueue(progressData)
        }

        // Отправляем прогресс каждые 2 секунды
        const interval = setInterval(simulateProgress, 2000)
        
        // Завершаем через 10 секунд
        setTimeout(() => {
          clearInterval(interval)
          
          const completeMessage: ProgressMessage = {
            type: 'complete',
            fileId: sessionId,
            status: 'done',
            message: 'Processing completed'
          }
          
          const completeData = encoder.encode(`data: ${JSON.stringify(completeMessage)}\n\n`)
          controller.enqueue(completeData)
          
          // Закрываем соединение
          setTimeout(() => {
            controller.close()
          }, 1000)
        }, 10000)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error) {
    console.error('Progress error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}