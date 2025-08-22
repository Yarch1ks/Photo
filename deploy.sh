#!/bin/bash

echo "Building Next.js app..."
npm run build

echo "Creating out directory..."
rm -rf out
mkdir -p out

echo "Copying static files..."
cp -r .next/static out/
cp -r .next/public out/
cp -r public/* out/ 2>/dev/null || true

echo "Creating index.html..."
cat > out/index.html << 'EOF'
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CleanShot Pro</title>
    <link rel="stylesheet" href="/_next/static/css/app/layout.css">
    <link rel="icon" href="/favicon.ico">
</head>
<body>
    <div id="root">
        <!-- CleanShot Pro - Профессиональная обработка фотографий товаров -->
    </div>
    <script src="/_next/static/chunks/main-app.js"></script>
</body>
</html>
EOF

echo "Adding files to git..."
git add .

echo "Committing changes..."
git commit -m "Deploy Next.js app to GitHub Pages"

echo "Pushing to GitHub..."
git push origin main

echo "Deployment complete!"
echo "Your app will be available at: https://yarch1ks.github.io/Photo"