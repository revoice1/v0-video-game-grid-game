import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://gamegrid.games'),
  title: {
    default: 'GameGrid | Daily Video Game Grid Puzzle',
    template: '%s | GameGrid',
  },
  description:
    'Play a daily video game trivia grid inspired by immaculate grid-style puzzles. Match games to genres, platforms, decades, themes, perspectives, and modes.',
  generator: 'v0.app',
  applicationName: 'GameGrid',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'video game grid',
    'video game trivia',
    'daily video game puzzle',
    'gaming immaculate grid',
    'video game guessing game',
    'game grid puzzle',
    'video game categories',
    'gaming trivia challenge',
    'IGDB video game puzzle',
    'video game nerd puzzle',
  ],
  authors: [{ name: 'GameGrid' }],
  creator: 'GameGrid',
  publisher: 'GameGrid',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://gamegrid.games/',
    siteName: 'GameGrid',
    title: 'GameGrid | Daily Video Game Grid Puzzle',
    description:
      'Fill the 3x3 grid with games that match both categories. Daily and practice video game trivia for genre, platform, decade, theme, and perspective nerds.',
  },
  twitter: {
    card: 'summary',
    title: 'GameGrid | Daily Video Game Grid Puzzle',
    description:
      'A daily video game trivia grid for people who know their JRPGs, boomer shooters, consoles, decades, and deep-cut metadata.',
  },
  category: 'games',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased min-h-screen">
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
