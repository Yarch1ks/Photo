/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp']
  },
  images: {
    domains: ['localhost'],
    unoptimized: false
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