/** @type {import('next').NextConfig} */
const nextConfig = {
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
  }
}

module.exports = nextConfig