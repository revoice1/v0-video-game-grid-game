function normalizeAllowedDevOrigin(value) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  try {
    return new URL(trimmed).hostname
  } catch {
    return trimmed
  }
}

/** @type {import('next').NextConfig} */
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => normalizeAllowedDevOrigin(origin))
  .filter(Boolean)

const defaultAllowedDevOrigins = [
  '127.0.0.1',
  'localhost',
  'ryans', // local dev machine hostname — keep so Next.js doesn't reject cross-origin requests during development
  normalizeAllowedDevOrigin(process.env.HOSTNAME ?? ''),
].filter(Boolean)

const nextConfig = {
  allowedDevOrigins: Array.from(new Set([...defaultAllowedDevOrigins, ...extraDevOrigins])),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
