#!/bin/bash

# Сборка для продакшена
echo "Building for production..."
npm run export:prod

# Копируем файлы в корень репозитория
echo "Copying files to root..."
rm -rf out
mkdir -p out
cp -r .next/static out/
cp -r .next/public out/
cp -r public/* out/

# Создаем кастомный index.html
echo "Creating custom index.html..."
cat > out/index.html << 'EOF'
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CleanShot Pro</title>
    <link rel="stylesheet" href="/_next/static/css/app/layout.css">
</head>
<body>
    <div id="root">
        <!-- Здесь будет ваше приложение -->
    </div>
    <script src="/_next/static/chunks/main-app.js"></script>
</body>
</html>
EOF

# Добавляем изменения в Git
echo "Committing changes..."
git add .
git commit -m "Deploy to GitHub Pages"

# Пушим на GitHub
echo "Pushing to GitHub..."
git push origin main

echo "Deployment complete!"