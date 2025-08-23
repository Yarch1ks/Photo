/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  assetPrefix: process.env.ASSET_PREFIX || '',
  // Отключаем статическую генерацию для всех API routes
  experimental: {
    serverComponentsExternalPackages: ['fs', 'path']
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.heic$/i,
      use: 'file-loader'
    })
    return config
  }
}

module.exports = nextConfig