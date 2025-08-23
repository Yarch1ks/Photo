# PhotoSku - Обработка фотографий для интернет-магазинов

Приложение для автоматической обработки фотографий товаров с удалением фона через PhotoRoom API и отправкой результатов в Telegram.

## 🚀 Функциональность

- 📸 Загрузка фотографий и видео
- 🎨 Автоматическое удаление фона через PhotoRoom API
- 📦 Создание ZIP архива с обработанными изображениями
- 📱 Отправка результатов в Telegram
- 👀 Превью обработанных изображений
- 🧪 Smoke-тесты для проверки функциональности

## 🛠️ Установка и запуск

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd photo-sku
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Создайте файл `.env.local` в корневой директории:

```env
# PhotoRoom API
PHOTOROOM_API_KEY=your_photoroom_api_key
PHOTOROOM_API_URL=https://api.photoroom.com/v1/remove-background

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=-4914435522

# Конфигурация
PUBLIC_ORIGIN=http://localhost:3000
TMP_DIR=./tmp
RAILWAY_SERVICE_NAME=false
```

### 4. Запуск приложения

```bash
# Режим разработки
npm run dev

# Сборка для продакшена
npm run build
npm start
```

## 🧪 Тестирование

### Smoke-тесты

Для проверки основных функциональностей используйте smoke-тесты:

```bash
npm run test:smoke
```

Тесты проверяют:
- ✅ Создание ZIP архива
- ✅ Отправку в Telegram
- ✅ Middleware для статики
- ✅ API эндпоинты

### Ручное тестирование

1. Откройте приложение в браузере: `http://localhost:3000`
2. Введите SKU товара
3. Загрузите изображения
4. Дождитесь обработки
5. Проверьте превью изображений
6. Нажмите "Отправить в Telegram"

## 📁 Структура проекта

```
src/
├── app/
│   ├── api/
│   │   ├── process/        # Обработка изображений
│   │   ├── telegram/       # Отправка в Telegram
│   │   ├── download/       # Скачивание ZIP
│   │   └── images/         # Раздача статики
│   ├── components/         # React компоненты
│   ├── lib/               # Утилиты и сервисы
│   └── types/             # TypeScript типы
```

## 🔧 Конфигурация

### Файл конфигурации: `src/lib/config.ts`

```typescript
export const config = {
  // PhotoRoom
  PHOTOROOM_API_KEY: process.env.PHOTOROOM_API_KEY,
  PHOTOROOM_API_URL: process.env.PHOTOROOM_API_URL,
  PHOTOROOM_MAX_RETRIES: 3,
  PHOTOROOM_RETRY_DELAY: 1000,
  
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  
  // Сервер
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || 'http://localhost:3000',
  TMP_DIR: process.env.TMP_DIR || './tmp',
  RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME === 'true',
  
  // Обработка
  MAX_CONCURRENT_PHOTOROOM_REQUESTS: 5,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime']
}
```

## 🚀 Развертывание

### Railway

1. Подключите репозиторий к Railway
2. Добавьте переменные окружения в Railway Dashboard
3. Railway автоматически развернет приложение

### Vercel

1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения
3. Настройте переадресацию для `/uploads/*` в `vercel.json`

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 Отладка

### Логи

Приложение выводит подробные логи в консоль:

- 🔧 Инициализация сервисов
- 📁 Обработка файлов
- 🗜️ Создание ZIP архива
- 📤 Отправка в Telegram

### Проблемы с ZIP архивом

Если возникает ошибка "Failed to create ZIP archive":

1. Проверьте права доступа к директориям
2. Убедитесь, что файлы существуют
3. Проверьте свободное место на диске

### Проблемы с превью

Если изображения не отображаются:

1. Проверьте URL в `previewUrl`
2. Убедитесь, что middleware работает корректно
3. Проверьте права доступа к файлам

## 📄 Лицензия

MIT License

## 🤝 Contributing

1. Fork репозитория
2. Создайте ветку (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в ветку (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Поддержка

При возникновении проблем создайте issue в репозитории.
