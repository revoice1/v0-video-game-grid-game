import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://gamegrid.games/sitemap.xml',
    host: 'https://gamegrid.games',
  }
}
