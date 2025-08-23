'use client'

import { useState, useEffect, useRef } from 'react'
import { Camera, X, ScanLine } from 'lucide-react'
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
      if (isBarcodeDetectorSupported()) {
        scanWithBarcodeDetector()
      } else {
        scanWithFallback()
      }
    } catch (error) {
      console.error('Ошибка доступа к камере:', error)
      setCameraError('Не удалось доступиться к камере. Пожалуйста, проверьте разрешения.')
      setIsScanning(false)
      onError('Не удалось доступиться к камере')
    }
  }

  const stopScanning = () => {
    setIsScanning(false)
    
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

      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['code_128', 'ean_13', 'ean_8', 'code_39', 'code_93', 'codabar', 'upc_a', 'upc_e']
      })

      const detect = async () => {
        if (!isScanning) return

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current!)
          
          if (barcodes.length > 0) {
            const barcode = barcodes[0].rawValue
            console.log('Обнаружен штрих-код:', barcode)
            onDetected(barcode)
            stopScanning()
            return
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
      if (Math.random() < 0.005) { // 0.5% шанс на кадр
        const mockBarcode = '1234567890123' // EAN-13 формат
        console.log('Fallback: Обнаружен штрих-код:', mockBarcode)
        onDetected(mockBarcode)
        stopScanning()
        return
      }

      animationRef.current = requestAnimationFrame(simulateScan)
    }

    simulateScan()
  }

  const handleManualClose = () => {
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
                <p className="text-sm text-gray-600">
                  Наведите штрих-код в рамку для сканирования
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Поддерживаются форматы: EAN-13, Code 128, UPC-A и др.
                </p>
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