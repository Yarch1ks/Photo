/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Photo' : '',
  webpack: (config) => {
    config.module.rules.push({
      test: /\.heic$/i,
      use: 'file-loader'
    })
    return config
  },
  // Добавляем поддержку для GitHub Pages
  distDir: 'out',
  generateBuildId: false,
  generateEtags: false,
  generateMapId: false,
}

module.exports = nextConfig