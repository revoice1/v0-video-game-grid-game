import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.gamegrid.games'),
  title: {
    default: 'GameGrid | Video Game Immaculate Grid',
    template: '%s | GameGrid',
  },
  description:
    'Play a daily video game immaculate grid-style puzzle. Match games to genres, platforms, decades, themes, perspectives, and modes in a 3x3 trivia grid.',
  applicationName: 'GameGrid',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'video game grid',
    'video game immaculate grid style',
    'video game trivia',
    'daily video game puzzle',
    'gaming immaculate grid',
    'immaculate grid video games',
    'video game immaculate grid',
    'video game immaculate grid style puzzle',
    'daily immaculate grid video game puzzle',
    'gaming grid game',
    'video game trivia grid',
    'video game immaculate grid game',
    'video game cross category puzzle',
    'video game category grid',
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
    url: 'https://www.gamegrid.games/',
    siteName: 'GameGrid',
    title: 'GameGrid | Video Game Immaculate Grid',
    description:
      'Fill the 3x3 grid with games that match both categories. A daily video game immaculate grid-style puzzle for genre, platform, decade, theme, and perspective nerds.',
    images: [
      {
        url: '/og-homepage.png',
        width: 1200,
        height: 630,
        alt: 'GameGrid daily video game puzzle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GameGrid | Video Game Immaculate Grid',
    description:
      'A daily video game immaculate grid-style puzzle for people who know their JRPGs, boomer shooters, consoles, decades, and deep-cut metadata.',
    images: ['/og-homepage.png'],
  },
  category: 'games',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon',
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
  const isE2E = process.env.NEXT_PUBLIC_E2E === '1'

  return (
    <html lang="en" suppressHydrationWarning data-e2e={isE2E ? 'true' : undefined}>
      <body
        className={`${geist.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
