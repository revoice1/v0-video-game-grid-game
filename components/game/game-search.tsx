'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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
  Dreamcast: 'Dreamcast',
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
  DOS: 'PC',
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
  const rankedPlatform = PLATFORM_PREFERENCE.find((platformName) =>
    platforms.includes(platformName)
  )

  return getDisplayPlatformName(rankedPlatform ?? platforms[0])
}

interface GameSearchProps {
  isOpen: boolean
  puzzleId?: string
  hideScores?: boolean
  confirmBeforeSelect?: boolean
  lowEffects?: boolean
  activeCategoryTypes?: Category['type'][]
  rowCategory: Category | null
  colCategory: Category | null
  onSelect: (game: Game) => void
  onClose: () => void
}

export function GameSearch({
  isOpen,
  puzzleId,
  hideScores = false,
  confirmBeforeSelect = false,
  lowEffects = false,
  activeCategoryTypes = [],
  rowCategory,
  colCategory,
  onSelect,
  onClose,
}: GameSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pendingConfirmationId, setPendingConfirmationId] = useState<number | null>(null)
  const [previewGame, setPreviewGame] = useState<Game | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultRefs = useRef<Array<HTMLDivElement | null>>([])
  const activeCategoryTypesKey = [...activeCategoryTypes].sort().join(',')
  const pendingConfirmationGame =
    pendingConfirmationId !== null
      ? (results.find((game) => game.id === pendingConfirmationId) ?? null)
      : null

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setPendingConfirmationId(null)
      setPreviewGame(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Search with debounce
  const search = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        const params = new URLSearchParams({ q: searchQuery })
        const categoryTypes =
          activeCategoryTypesKey.length > 0
            ? activeCategoryTypesKey
                .split(',')
                .filter((type): type is Category['type'] => Boolean(type))
            : [rowCategory?.type, colCategory?.type].filter((type): type is Category['type'] =>
                Boolean(type)
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
        setPendingConfirmationId(null)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
        setPendingConfirmationId(null)
      } finally {
        setIsLoading(false)
      }
    },
    [activeCategoryTypesKey, colCategory?.type, puzzleId, rowCategory?.type]
  )

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  useEffect(() => {
    if (!isOpen || results.length === 0) {
      return
    }

    resultRefs.current[selectedIndex]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [isOpen, results.length, selectedIndex])

  useEffect(() => {
    if (pendingConfirmationId === null) {
      return
    }

    if (!results.some((game) => game.id === pendingConfirmationId)) {
      setPendingConfirmationId(null)
    }
  }, [pendingConfirmationId, results])

  const handleSelect = useCallback(
    (game: Game) => {
      if (!confirmBeforeSelect) {
        onSelect(game)
        return
      }

      setPendingConfirmationId(game.id)
    },
    [confirmBeforeSelect, onSelect]
  )

  const handleConfirm = useCallback(() => {
    if (!pendingConfirmationGame) {
      return
    }

    onSelect(pendingConfirmationGame)
  }, [onSelect, pendingConfirmationGame])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (pendingConfirmationId !== null) {
        setPendingConfirmationId(null)
      }
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (pendingConfirmationId !== null) {
        setPendingConfirmationId(null)
      }
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      if (pendingConfirmationGame?.id === results[selectedIndex].id) {
        handleConfirm()
        return
      }

      handleSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      if (pendingConfirmationId !== null) {
        setPendingConfirmationId(null)
        return
      }
      onClose()
    }
  }

  if (!isOpen) return null

  const getResultMetadata = (game: Game) => {
    const preferredPlatform = getPreferredPlatform(game)

    return [
      game.released ? { label: 'Year', value: game.released.slice(0, 4) } : null,
      !hideScores && game.metacritic !== null
        ? { label: 'Score', value: `${game.metacritic}` }
        : null,
      game.gameTypeLabel ? { label: 'Type', value: game.gameTypeLabel } : null,
      game.genres?.[0]?.name ? { label: 'Genre', value: game.genres[0].name } : null,
      preferredPlatform ? { label: 'Platform', value: preferredPlatform } : null,
    ].filter((item): item is { label: string; value: string } => item !== null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-background/80',
          lowEffects ? 'backdrop-blur-0' : 'backdrop-blur-sm'
        )}
        onClick={onClose}
      />

      {/* Search dialog */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header with category info */}
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <p className="text-sm text-muted-foreground text-center">
            Find a game that is both{' '}
            <span className="font-semibold text-foreground">{rowCategory?.name}</span> and{' '}
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
            <div className="p-4 text-center text-muted-foreground text-sm">No games found</div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="py-2">
              {results.map((game, index) => {
                const metadata = getResultMetadata(game)
                const isPendingConfirmation = pendingConfirmationId === game.id
                const isDimmed = pendingConfirmationId !== null && !isPendingConfirmation

                return (
                  <div
                    key={game.id}
                    ref={(element) => {
                      resultRefs.current[index] = element
                    }}
                    className={cn(
                      'relative w-full text-left transition-[opacity,transform] duration-150',
                      isDimmed && 'opacity-30 saturate-50',
                      isPendingConfirmation && 'z-10'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(game)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left transition-[background-color,box-shadow] duration-150',
                        index === selectedIndex ? 'bg-primary/20' : 'hover:bg-secondary/50',
                        isPendingConfirmation &&
                          'bg-primary/10 shadow-[0_0_0_1px_rgba(34,197,94,0.3)]'
                      )}
                    >
                      <div
                        onClick={(event) => {
                          event.stopPropagation()
                          setPreviewGame(game)
                        }}
                        className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-secondary transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                        title={`Preview cover for ${game.name}`}
                      >
                        {game.background_image ? (
                          <Image
                            src={game.background_image}
                            alt={game.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            ?
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{game.name}</p>
                        {metadata.length > 0 && (
                          <div className="relative mt-1">
                            {isPendingConfirmation && (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'pointer-events-none absolute -inset-1.5 rounded-2xl border border-primary/55',
                                  lowEffects
                                    ? 'opacity-100 shadow-[0_0_0_1px_rgba(34,197,94,0.22)]'
                                    : 'animate-pulse shadow-[0_0_0_1px_rgba(34,197,94,0.24),0_0_24px_rgba(34,197,94,0.18)]'
                                )}
                              />
                            )}
                            <div
                              className={cn(
                                'relative z-10 flex flex-wrap gap-1.5 rounded-xl px-1.5 py-1 transition-colors duration-150',
                                isPendingConfirmation ? 'ring-1 ring-primary/30' : 'bg-transparent'
                              )}
                            >
                              {metadata.map((item) => (
                                <span
                                  key={`${game.id}-${item.label}`}
                                  className={cn(
                                    'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors duration-150',
                                    isPendingConfirmation
                                      ? 'border-primary/35 bg-primary/20 text-foreground shadow-[0_0_12px_rgba(34,197,94,0.12)]'
                                      : 'border-transparent bg-secondary/80 text-muted-foreground'
                                  )}
                                >
                                  <span className="font-medium uppercase tracking-wide text-foreground/70">
                                    {item.label}
                                  </span>
                                  <span className="truncate">{item.value}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                    {isPendingConfirmation && confirmBeforeSelect && (
                      <div className="mx-4 mt-1 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-background/80 px-3 py-2">
                        <p className="text-xs font-medium text-foreground/85">
                          Confirm this answer?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingConfirmationId(null)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/15 hover:text-destructive"
                            aria-label={`Cancel ${game.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirm}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                            aria-label={`Confirm ${game.name}`}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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

      <Dialog open={previewGame !== null} onOpenChange={(open) => !open && setPreviewGame(null)}>
        <DialogContent
          className="max-w-2xl overflow-hidden border-border bg-card p-3 sm:p-4"
          showCloseButton={true}
        >
          {previewGame?.background_image ? (
            <div className="space-y-3">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-secondary">
                <Image
                  src={previewGame.background_image}
                  alt={previewGame.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 90vw, 720px"
                />
              </div>
              <p className="text-center text-sm font-medium text-foreground">{previewGame.name}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-secondary p-8 text-center text-sm text-muted-foreground">
              No cover available.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
