'use client'

import { useState } from 'react'
import { SKUInput } from '@/components/screens/SKUInput'
import { MediaUpload } from '@/components/screens/MediaUpload'
import { Processing } from '@/components/screens/Processing'
import { Results } from '@/components/screens/Results'
import type { ProgressFile } from '@/components/ui/ProgressTracker'

type Screen = 'sku' | 'media' | 'processing' | 'results'

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('sku')
  const [sku, setSku] = useState('')
  const [mediaFiles, setMediaFiles] = useState<any[]>([])
  const [processingResults, setProcessingResults] = useState<ProgressFile[]>([])

  const handleSkuSubmit = async (submittedSku: string) => {
    setSku(submittedSku)
    setCurrentScreen('media')
  }

  const handleMediaSubmit = (files: any[]) => {
    setMediaFiles(files)
    setCurrentScreen('processing')
  }

  const handleProcessingComplete = (results: ProgressFile[]) => {
    setProcessingResults(results)
    setCurrentScreen('results')
  }

  const handleRestart = () => {
    setCurrentScreen('sku')
    setSku('')
    setMediaFiles([])
    setProcessingResults([])
  }

  const handleError = (error: string) => {
    console.error('Error:', error)
    // Здесь будет обработка ошибок
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center">
            <img
              src="/favicon.ico"
              alt="Photo SKU Processor Logo"
              className="h-12 w-auto"
            />
          </div>
        </header>
<main className="max-w-4xl mx-auto">
  {currentScreen === 'sku' && (
    <SKUInput
      onSKUSubmit={handleSkuSubmit}
      onError={handleError}
    />
  )}

  {currentScreen === 'media' && (
    <MediaUpload
      sku={sku}
      onBack={() => setCurrentScreen('sku')}
      onContinue={handleMediaSubmit}
      onError={handleError}
    />
  )}

  {currentScreen === 'processing' && (
    <Processing
      sku={sku}
      files={mediaFiles}
      onBack={() => setCurrentScreen('media')}
      onComplete={handleProcessingComplete}
      onError={handleError}
    />
  )}

  {currentScreen === 'results' && (
    <Results
      sku={sku}
      files={processingResults}
      onBack={() => setCurrentScreen('processing')}
      onRestart={handleRestart}
      onError={handleError}
    />
  )}
</main>
      </div>
    </div>
  )
}