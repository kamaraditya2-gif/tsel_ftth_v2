/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    INTERNAL_API_URL: process.env.INTERNAL_API_URL || 'http://localhost:3000',
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
}

module.exports = nextConfig
