const CACHE_NAME = 'photo-sku-processor-v1'
const API_CACHE_NAME = 'photo-sku-api-v1'

// Файлы для кэширования
const STATIC_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// API эндпоинты для кэширования
const API_CACHE_URLS = [
  '/api/upload',
  '/api/process',
  '/api/progress',
  '/api/download',
]

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Установка')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Кэширование статических файлов')
        return cache.addAll(STATIC_CACHE_URLS)
      })
      .then(() => self.skipWaiting())
  )
})

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Активация')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Service Worker: Удаление старого кэша', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Стратегия кэширования: Cache First для статических файлов, Network First для API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Для API запросов используем Network First стратегию
  if (API_CACHE_URLS.some(apiUrl => url.pathname.startsWith(apiUrl))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Кэшируем успешные ответы API
          if (response.status === 200) {
            const responseClone = response.clone()
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Если сеть недоступна, возвращаем кэшированный ответ
          return caches.match(event.request)
        })
    )
    return
  }
  
  // Для статических файлов используем Cache First стратегию
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response
        }
        
        return fetch(event.request).then((response) => {
          // Не кэшируем неуспешные ответы
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
          
          return response
        })
      })
  )
})

// Обработка push уведомлений
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('Photo SKU Processor', options)
  )
})

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  event.waitUntil(
    clients.openWindow('/')
  )
})

// Синхронизация в фоновом режиме
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Здесь можно добавить логику фоновой синхронизации
      console.log('Service Worker: Фоновая синхронизация')
    )
  }
})