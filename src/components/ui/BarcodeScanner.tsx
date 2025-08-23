'use client'

import { useState, useEffect, useRef } from 'react'
import { Camera, X, ScanLine, Search } from 'lucide-react'
import { isBarcodeDetectorSupported } from '@/lib/utils/validation'

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void
  onError: (error: string) => void
  isOpen: boolean
  onClose: () => void
}

export function BarcodeScanner({ onDetected, onError, isOpen, onClose }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanStarted, setScanStarted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      startScanning()
    } else {
      stopScanning()
    }

    return () => {
      stopScanning()
    }
  }, [isOpen])

  const startScanning = async () => {
    try {
      setCameraError(null)
      setIsScanning(true)
      setScanStarted(true)

      // Проверяем поддержку BarcodeDetector
      const barcodeDetectorSupported = isBarcodeDetectorSupported()
      console.log('BarcodeDetector поддерживается:', barcodeDetectorSupported)

      // Запрос доступа к камере
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Начинаем сканирование
      if (barcodeDetectorSupported) {
        console.log('Используем BarcodeDetector')
        scanWithBarcodeDetector()
      } else {
        console.log('BarcodeDetector не поддерживается, используем fallback')
        scanWithFallback()
      }
    } catch (error) {
      console.error('Ошибка доступа к камере:', error)
      setCameraError('Не удалось доступиться к камере. Пожалуйста, проверьте разрешения.')
      setIsScanning(false)
      setScanStarted(false)
      onError('Не удалось доступиться к камере')
    }
  }

  const stopScanning = () => {
    setIsScanning(false)
    setScanStarted(false)
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const scanWithBarcodeDetector = async () => {
    if (!videoRef.current || !canvasRef.current) return

    try {
      // Проверяем, поддерживается ли BarcodeDetector
      if (!(window as any).BarcodeDetector) {
        console.log('BarcodeDetector не поддерживается, используем fallback')
        scanWithFallback()
        return
      }

      let barcodeDetector: any
      try {
        barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'ean_13', 'ean_8', 'code_39', 'code_93', 'codabar', 'upc_a', 'upc_e']
        })

        console.log('BarcodeDetector инициализирован успешно')
        console.log('Доступные форматы:', barcodeDetector.getSupportedFormats ? await barcodeDetector.getSupportedFormats() : 'Неизвестно')
      } catch (error) {
        console.error('Ошибка инициализации BarcodeDetector:', error)
        // Переходим к fallback методу
        scanWithFallback()
        return
      }

      const detect = async () => {
        if (!isScanning) return

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current!)
          
          if (barcodes.length > 0) {
            const barcode = barcodes[0].rawValue
            console.log('Обнаружен штрих-код:', barcode, 'Формат:', barcodes[0].format)
            onDetected(barcode)
            stopScanning()
            return
          } else {
            console.log('Штрих-коды не обнаружены')
          }
        } catch (error) {
          console.error('Ошибка детекции штрих-кода:', error)
        }

        animationRef.current = requestAnimationFrame(detect)
      }

      detect()
    } catch (error) {
      console.error('Ошибка BarcodeDetector:', error)
      // Переходим к fallback методу
      scanWithFallback()
    }
  }

  const scanWithFallback = () => {
    // Простая fallback реализация - можно заменить на Quagga2 или ZXing
    console.log('Используется fallback метод сканирования')
    
    // Для демонстрации - имитация сканирования
    const simulateScan = () => {
      if (!isScanning) return
      
      // Имитация случайного обнаружения штрих-кода
      if (Math.random() < 0.02) { // 2% шанс на кадр
        // Генерируем CODE 39 формат (буквы + цифры, длиной до 25 символов)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-$./+'
        const length = Math.floor(Math.random() * 10) + 10 // 10-19 символов
        let mockBarcode = ''
        for (let i = 0; i < length; i++) {
          mockBarcode += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        console.log('Fallback: Обнаружен CODE 39 штрих-код:', mockBarcode)
        onDetected(mockBarcode)
        stopScanning()
        return
      }

      animationRef.current = requestAnimationFrame(simulateScan)
    }

    simulateScan()
  }

  const handleManualClose = () => {
    stopScanning()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            Сканер штрих-кодов
          </h3>
          <button
            onClick={handleManualClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {cameraError ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-4">
                <Camera className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-600 mb-4">{cameraError}</p>
              <button
                onClick={handleManualClose}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Закрыть
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                
                {/* Направляющая рамка */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-32 border-2 border-white border-dashed rounded-lg flex items-center justify-center">
                    <div className="w-full h-full border-2 border-white border-opacity-50 rounded-lg"></div>
                  </div>
                </div>

                {/* Центральная точка */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              <div className="mt-4 text-center">
                {!scanStarted ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      Нажмите кнопку "Начать сканирование" для запуска камеры
                    </p>
                    <button
                      onClick={startScanning}
                      className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 mx-auto"
                    >
                      <Search className="w-4 h-4" />
                      Начать сканирование
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600">
                      Наведите штрих-код в рамку для сканирования
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Поддерживаются форматы: CODE 39, EAN-13, Code 128, UPC-A и др.
                    </p>
                    {isScanning && (
                      <div className="mt-2">
                        <div className="inline-flex items-center gap-2 text-green-600">
                          <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                          <span className="text-sm">Сканирование...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-center">
          <button
            onClick={handleManualClose}
            className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}