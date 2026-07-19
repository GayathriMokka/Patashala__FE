/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    API_URL: process.env.API_URL || 'http://localhost:5000/api',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  },
  async rewrites() {
    const apiHost = process.env.API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiHost}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiHost}/uploads/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
