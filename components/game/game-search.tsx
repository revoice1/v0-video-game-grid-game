'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Game, Category } from '@/lib/types'
import Image from 'next/image'

const PLATFORM_LABELS: Record<string, string> = {
  'Family Computer': 'NES',
  'Family Computer Disk System': 'NES',
  'Nintendo Entertainment System': 'NES',
  'Super Famicom': 'SNES',
  'Super Nintendo Entertainment System': 'SNES',
  'Sega Mega Drive/Genesis': 'Genesis',
  'Dreamcast': 'Dreamcast',
  'Game Boy': 'Game Boy',
  'Game Boy Advance': 'GBA',
  'Nintendo DS': 'DS',
  'Nintendo 3DS': '3DS',
  'Nintendo 64': 'N64',
  'Nintendo GameCube': 'GameCube',
  'Nintendo Switch': 'Switch',
  'Nintendo Switch 2': 'Switch 2',
  'PlayStation (Original)': 'PS1',
  'PlayStation 2': 'PS2',
  'PlayStation 3': 'PS3',
  'PlayStation 4': 'PS4',
  'PlayStation 5': 'PS5',
  'PlayStation Portable': 'PSP',
  'PlayStation Vita': 'Vita',
  'Xbox (Original)': 'Xbox',
  'Xbox 360': 'Xbox 360',
  'Xbox One': 'Xbox One',
  'Xbox Series X|S': 'Series X|S',
  'DOS': 'PC',
  'PC (Windows/DOS)': 'PC',
  'PC (Microsoft Windows)': 'PC',
}

const PLATFORM_PREFERENCE = [
  'Atari 2600',
  'Family Computer',
  'Family Computer Disk System',
  'Nintendo Entertainment System',
  'Super Famicom',
  'Super Nintendo Entertainment System',
  'Sega Mega Drive/Genesis',
  'Sega Saturn',
  'Dreamcast',
  'Game Boy',
  'Game Boy Advance',
  'Nintendo DS',
  'Nintendo 3DS',
  'Nintendo 64',
  'Nintendo GameCube',
  'Wii',
  'Wii U',
  'Nintendo Switch',
  'Nintendo Switch 2',
  'PlayStation (Original)',
  'PlayStation 2',
  'PlayStation 3',
  'DOS',
  'PC (Windows/DOS)',
  'PC (Microsoft Windows)',
  'PlayStation 4',
  'PlayStation 5',
  'PlayStation Portable',
  'PlayStation Vita',
  'Xbox (Original)',
  'Xbox 360',
  'Xbox One',
  'Xbox Series X|S',
]

function getDisplayPlatformName(platformName: string): string {
  return PLATFORM_LABELS[platformName] ?? platformName
}

function getPreferredPlatform(game: Game): string | null {
  if (game.originalPlatformName) {
    return getDisplayPlatformName(game.originalPlatformName)
  }

  if (!game.platforms?.length) {
    return null
  }

  const platforms = game.platforms.map(({ platform }) => platform.name)
  const rankedPlatform = PLATFORM_PREFERENCE.find(platformName => platforms.includes(platformName))

  return getDisplayPlatformName(rankedPlatform ?? platforms[0])
}

interface GameSearchProps {
  isOpen: boolean
  puzzleId?: string
  rowCategory: Category | null
  colCategory: Category | null
  onSelect: (game: Game) => void
  onClose: () => void
}

export function GameSearch({ isOpen, puzzleId, rowCategory, colCategory, onSelect, onClose }: GameSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Search with debounce
  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({ q: searchQuery })
      const categoryTypes = [rowCategory?.type, colCategory?.type].filter(
        (type): type is Category['type'] => Boolean(type)
      )

      if (puzzleId) {
        params.set('puzzleId', puzzleId)
      }

      if (categoryTypes.length > 0) {
        params.set('categoryTypes', categoryTypes.join(','))
      }

      const response = await fetch(`/api/search?${params.toString()}`)
      const data = await response.json()
      setResults(data.results || [])
      setSelectedIndex(0)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [colCategory?.type, puzzleId, rowCategory?.type])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      onSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  const getResultMetadata = (game: Game) => {
    const preferredPlatform = getPreferredPlatform(game)

    return [
      game.released ? { label: 'Year', value: game.released.slice(0, 4) } : null,
      game.metacritic !== null ? { label: 'Score', value: `${game.metacritic}` } : null,
      game.gameTypeLabel ? { label: 'Type', value: game.gameTypeLabel } : null,
      game.genres?.[0]?.name ? { label: 'Genre', value: game.genres[0].name } : null,
      preferredPlatform
        ? { label: 'Platform', value: preferredPlatform }
        : null,
    ].filter((item): item is { label: string; value: string } => item !== null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Search dialog */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header with category info */}
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <p className="text-sm text-muted-foreground text-center">
            Find a game that is both{' '}
            <span className="font-semibold text-foreground">{rowCategory?.name}</span>
            {' '}and{' '}
            <span className="font-semibold text-foreground">{colCategory?.name}</span>
          </p>
        </div>

        {/* Search input */}
        <div className="p-3 border-b border-border">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search for a video game..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-secondary border-0 focus-visible:ring-primary"
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && query.length >= 2 && results.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No games found
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="py-2">
              {results.map((game, index) => {
                const metadata = getResultMetadata(game)

                return (
                  <button
                    key={game.id}
                    onClick={() => onSelect(game)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left',
                      'transition-colors duration-100',
                      index === selectedIndex ? 'bg-primary/20' : 'hover:bg-secondary/50'
                    )}
                  >
                    <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-secondary">
                      {game.background_image ? (
                        <Image
                          src={game.background_image}
                          alt={game.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          ?
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{game.name}</p>
                      {metadata.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {metadata.map((item) => (
                            <span
                              key={`${game.id}-${item.label}`}
                              className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              <span className="font-medium uppercase tracking-wide text-foreground/70">
                                {item.label}
                              </span>
                              <span className="truncate">{item.value}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {!isLoading && query.length < 2 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
