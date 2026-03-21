/** @type {import('next').NextConfig} */
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const nextConfig = {
  allowedDevOrigins: ['http://127.0.0.1:3000', 'http://localhost:3000', ...extraDevOrigins],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
