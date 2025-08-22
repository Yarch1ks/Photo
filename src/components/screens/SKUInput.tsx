'use client'

import { useState } from 'react'
import { Camera, Barcode, CheckCircle, AlertCircle } from 'lucide-react'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { validateSKU } from '@/lib/utils/validation'
import type { SKUInput } from '@/lib/types'

interface SKUInputProps {
  onSKUSubmit: (sku: string) => void
  onError: (error: string) => void
}

export function SKUInput({ onSKUSubmit, onError }: SKUInputProps) {
  const [skuInput, setSkuInput] = useState('')
  const [validation, setValidation] = useState<SKUInput>({
    value: '',
    isValid: false
  })
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (value: string) => {
    setSkuInput(value)
    
    if (value.trim() === '') {
      setValidation({ value: '', isValid: false })
      return
    }

    const validationResult = validateSKU(value)
    setValidation({
      value: value,
      isValid: validationResult.isValid,
      error: validationResult.error
    })
  }

  const handleBarcodeDetected = (barcode: string) => {
    setSkuInput(barcode)
    const validationResult = validateSKU(barcode)
    setValidation({
      value: barcode,
      isValid: validationResult.isValid,
      error: validationResult.error
    })
    setIsScannerOpen(false)
  }

  const handleSubmit = async () => {
    if (!validation.isValid || !skuInput.trim()) {
      onError('Пожалуйста, введите корректный SKU')
      return
    }

    setIsSubmitting(true)
    try {
      await onSKUSubmit(skuInput.trim().toUpperCase())
    } catch (error) {
      onError('Произошла ошибка при обработке SKU')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleManualInput = () => {
    if (skuInput.trim()) {
      const validationResult = validateSKU(skuInput)
      if (validationResult.isValid) {
        handleSubmit()
      } else {
        onError(validationResult.error || 'Некорректный формат SKU')
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && validation.isValid) {
      handleSubmit()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          CleanShot Pro
        </h2>
        <p className="text-gray-600">
          Профессиональная обработка фотографий товаров
        </p>
      </div>

      <div className="space-y-6">
        {/* Поле ввода SKU */}
        <div>
          <label htmlFor="sku-input" className="block text-sm font-medium text-gray-700 mb-2">
            SKU или штрих-код
          </label>
          <div className="relative">
            <input
              id="sku-input"
              type="text"
              value={skuInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="123456"
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                validation.isValid
                  ? 'border-green-500 focus:border-green-500 focus:ring-green-200'
                  : validation.error
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
              disabled={isSubmitting}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {validation.isValid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : validation.error ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <Barcode className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {validation.error && (
            <p className="mt-1 text-sm text-red-600">{validation.error}</p>
          )}
          
          <p className="mt-2 text-xs text-gray-500">
            Строго 6 цифр
          </p>
        </div>

        {/* Кнопки действий */}
        <div className="space-y-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            {isSubmitting ? 'Сканирование...' : 'Сканировать штрих-код'}
          </button>

          <button
            onClick={handleManualInput}
            disabled={!validation.isValid || isSubmitting}
            className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            <Barcode className="w-5 h-5" />
            {isSubmitting ? 'Обработка...' : 'Ручной ввод'}
          </button>
        </div>

        {/* Подсказка */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <div className="text-blue-600 mt-0.5">
              <Barcode className="w-4 h-4" />
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Инструкция</p>
              <ul className="space-y-1 text-xs">
                <li>• Введите 6-значный артикул товара</li>
                <li>• Используйте только цифры (0-9)</li>
                <li>• Пример: 123456</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Компонент сканера */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={handleBarcodeDetected}
        onError={(error) => onError(error)}
      />
    </div>
  )
}