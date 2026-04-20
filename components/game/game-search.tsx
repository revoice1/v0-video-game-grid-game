'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/category-display'
import { getPlatformDisplayLabel } from '@/lib/category-display'
import type { Game, Category } from '@/lib/types'
import Image from 'next/image'

type SearchResultGame = Game & {
  disambiguationPlatform?: string | null
  disambiguationYear?: string | null
  matchedAltName?: string | null
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

function getPreferredPlatform(game: Game): string | null {
  if (game.originalPlatformName) {
    return getPlatformDisplayLabel(game.originalPlatformName)
  }

  if (!game.platforms?.length) {
    return null
  }

  const platforms = game.platforms.map(({ platform }) => platform.name)
  const rankedPlatform = PLATFORM_PREFERENCE.find((platformName) =>
    platforms.includes(platformName)
  )

  return getPlatformDisplayLabel(rankedPlatform ?? platforms[0])
}

function normalizeSearchResultTitle(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function getPreferredDuplicateSuffix(game: SearchResultGame): string | null {
  const preferredPlatform = game.disambiguationPlatform
    ? getPlatformDisplayLabel(game.disambiguationPlatform)
    : getPreferredPlatform(game)

  if (!preferredPlatform) {
    return null
  }

  return game.hasSameNamePortFamily ? `${preferredPlatform}+Ports` : preferredPlatform
}

function getDuplicateDisplayTitle(
  game: SearchResultGame,
  isDuplicateTitle: boolean,
  duplicateSuffixCounts: Map<string, number>
): string {
  if (!isDuplicateTitle) {
    return game.name
  }

  const suffix = getPreferredDuplicateSuffix(game)
  if (suffix) {
    const suffixKey = `${normalizeSearchResultTitle(game.name)}::${suffix}`
    if ((duplicateSuffixCounts.get(suffixKey) ?? 0) === 1) {
      return `${game.name} (${suffix})`
    }
  }

  if (game.disambiguationYear) {
    return `${game.name} (${game.disambiguationYear})`
  }

  if (suffix) {
    return `${game.name} (${suffix})`
  }

  return game.name
}

interface GameSearchProps {
  isOpen: boolean
  initialQuery?: string | null
  puzzleId?: string
  searchMode?: 'daily' | 'practice' | 'versus'
  versusStealsEnabled?: boolean
  hideScores?: boolean
  confirmBeforeSelect?: boolean
  lowEffects?: boolean
  turnTimerLabel?: string | null
  turnTimerSeconds?: number | null
  activeCategoryTypes?: Category['type'][]
  rowCategory: Category | null
  colCategory: Category | null
  onSelect: (game: Game) => void
  onQueryChange?: (query: string) => void
  onClose: () => void
}

export function GameSearch({
  isOpen,
  initialQuery = '',
  puzzleId,
  searchMode = 'versus',
  versusStealsEnabled = true,
  hideScores = false,
  confirmBeforeSelect = false,
  lowEffects = false,
  turnTimerLabel = null,
  turnTimerSeconds = null,
  activeCategoryTypes = [],
  rowCategory,
  colCategory,
  onSelect,
  onQueryChange,
  onClose,
}: GameSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultGame[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [settledQuery, setSettledQuery] = useState<string | null>(null)
  const [selectionLocked, setSelectionLocked] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pendingConfirmationId, setPendingConfirmationId] = useState<number | null>(null)
  const [previewGame, setPreviewGame] = useState<Game | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchRequestIdRef = useRef(0)
  const selectionLockedRef = useRef(false)
  const resultRefs = useRef<Array<HTMLDivElement | null>>([])
  const activeCategoryTypesKey = [...activeCategoryTypes].sort().join(',')
  const pendingConfirmationGame =
    pendingConfirmationId !== null
      ? (results.find((game) => game.id === pendingConfirmationId) ?? null)
      : null
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const canSelectSearchResults =
    !selectionLockedRef.current &&
    !selectionLocked &&
    !isLoading &&
    results.length > 0 &&
    settledQuery !== null &&
    settledQuery === normalizedQuery
  const duplicateTitleKeys = useMemo(() => {
    return new Set(
      Object.entries(
        results.reduce<Record<string, number>>((counts, game) => {
          const key = normalizeSearchResultTitle(game.name)
          counts[key] = (counts[key] ?? 0) + 1
          return counts
        }, {})
      )
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
    )
  }, [results])

  const duplicateSuffixCounts = useMemo(() => {
    return results.reduce((counts, game) => {
      const titleKey = normalizeSearchResultTitle(game.name)
      if (!duplicateTitleKeys.has(titleKey)) {
        return counts
      }

      const suffix = getPreferredDuplicateSuffix(game)
      if (!suffix) {
        return counts
      }

      const suffixKey = `${titleKey}::${suffix}`
      counts.set(suffixKey, (counts.get(suffixKey) ?? 0) + 1)
      return counts
    }, new Map<string, number>())
  }, [duplicateTitleKeys, results])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      searchAbortRef.current?.abort()
      setQuery(initialQuery ?? '')
      setResults([])
      setSettledQuery(null)
      selectionLockedRef.current = false
      setSelectionLocked(false)
      setSelectedIndex(0)
      setPendingConfirmationId(null)
      setPreviewGame(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [initialQuery, isOpen])

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort()
    }
  }, [])

  // Search with debounce
  const search = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        searchAbortRef.current?.abort()
        setIsLoading(false)
        setResults([])
        setSettledQuery(searchQuery.trim().toLocaleLowerCase())
        selectionLockedRef.current = false
        setSelectionLocked(false)
        return
      }

      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller
      const requestId = ++searchRequestIdRef.current

      setIsLoading(true)
      try {
        const params = new URLSearchParams({ q: searchQuery })
        params.set('mode', searchMode)
        if (searchMode === 'versus') {
          params.set('versusStealsEnabled', String(versusStealsEnabled))
        }
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

        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        })
        const data = await response.json()

        if (requestId !== searchRequestIdRef.current) {
          return
        }

        setResults(data.results || [])
        setSettledQuery(searchQuery.trim().toLocaleLowerCase())
        selectionLockedRef.current = false
        setSelectionLocked(false)
        setSelectedIndex(0)
        setPendingConfirmationId(null)
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return
        }

        if (requestId !== searchRequestIdRef.current) {
          return
        }

        console.error('Search error:', error)
        setResults([])
        setSettledQuery(searchQuery.trim().toLocaleLowerCase())
        selectionLockedRef.current = false
        setSelectionLocked(false)
        setPendingConfirmationId(null)
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [
      activeCategoryTypesKey,
      colCategory?.type,
      puzzleId,
      rowCategory?.type,
      searchMode,
      versusStealsEnabled,
    ]
  )

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => search(query), 450)
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
      if (!canSelectSearchResults) {
        return
      }

      if (!confirmBeforeSelect) {
        selectionLockedRef.current = true
        setSelectionLocked(true)
        onSelect(game)
        return
      }

      setPendingConfirmationId(game.id)
    },
    [canSelectSearchResults, confirmBeforeSelect, onSelect]
  )

  const handleConfirm = useCallback(() => {
    if (!pendingConfirmationGame || selectionLockedRef.current || selectionLocked) {
      return
    }

    selectionLockedRef.current = true
    setSelectionLocked(true)
    onSelect(pendingConfirmationGame)
  }, [onSelect, pendingConfirmationGame, selectionLocked])

  useEffect(() => {
    if (!isOpen || pendingConfirmationId === null) {
      return
    }

    const handlePendingConfirmationKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setPendingConfirmationId(null)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handlePendingConfirmationKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handlePendingConfirmationKeyDown, true)
    }
  }, [handleConfirm, isOpen, pendingConfirmationId])

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
    } else if (e.key === 'Enter' && canSelectSearchResults && results[selectedIndex]) {
      e.preventDefault()
      if (pendingConfirmationGame?.id === results[selectedIndex].id) {
        handleConfirm()
        return
      }

      handleSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      if (pendingConfirmationId !== null) {
        e.preventDefault()
        setPendingConfirmationId(null)
        return
      }
      onClose()
    }
  }

  if (!isOpen) return null

  const getResultMetadata = (game: SearchResultGame, isDuplicateTitle: boolean) => {
    const preferredPlatform = getPreferredPlatform(game)
    const primaryGenre = game.genres?.[0]
    const primaryGenreDisplay = primaryGenre
      ? getCategoryDisplayName({
          type: 'genre',
          id: primaryGenre.id,
          name: primaryGenre.name,
          slug: primaryGenre.slug,
        })
      : null
    const typeLabel = game.hasSameNamePortFamily ? 'Family' : game.gameTypeLabel

    return [
      game.released && !isDuplicateTitle
        ? { label: 'Year', value: game.released.slice(0, 4) }
        : null,
      !hideScores && game.metacritic !== null
        ? { label: 'Score', value: `${game.metacritic}` }
        : null,
      typeLabel ? { label: 'Type', value: typeLabel } : null,
      primaryGenreDisplay ? { label: 'Genre', value: primaryGenreDisplay } : null,
      preferredPlatform && !isDuplicateTitle
        ? { label: 'Platform', value: preferredPlatform }
        : null,
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
          {turnTimerLabel && turnTimerSeconds !== null && (
            <div className="mb-2 flex justify-center">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                  turnTimerSeconds <= 5
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : turnTimerSeconds <= 10
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                      : 'border-primary/30 bg-primary/10 text-primary'
                )}
              >
                {turnTimerLabel}
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            Find a game that is both{' '}
            <span className="font-semibold text-foreground whitespace-nowrap">
              {rowCategory?.name}
            </span>{' '}
            <span className="whitespace-nowrap">and</span>{' '}
            <span className="font-semibold text-foreground whitespace-nowrap">
              {colCategory?.name}
            </span>
          </p>
        </div>

        {/* Search input */}
        <div className="p-3 border-b border-border">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search for a video game..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSettledQuery(null)
              onQueryChange?.(e.target.value)
            }}
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
                const isDuplicateTitle = duplicateTitleKeys.has(
                  normalizeSearchResultTitle(game.name)
                )
                const metadata = getResultMetadata(game, isDuplicateTitle)
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
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-secondary transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
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
                        <p className="truncate font-medium text-foreground">
                          {getDuplicateDisplayTitle(game, isDuplicateTitle, duplicateSuffixCounts)}
                        </p>
                        {game.matchedAltName ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            Matched alt title: {game.matchedAltName}
                          </p>
                        ) : null}
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
          <DialogHeader className="sr-only">
            <DialogTitle>
              {previewGame ? `Cover preview for ${previewGame.name}` : 'Cover preview'}
            </DialogTitle>
            <DialogDescription>
              {previewGame
                ? `Expanded cover art preview for ${previewGame.name}.`
                : 'Expanded cover art preview.'}
            </DialogDescription>
          </DialogHeader>
          {previewGame?.background_image ? (
            <div className="space-y-3">
              <div className="relative aspect-3/4 w-full overflow-hidden rounded-xl bg-secondary">
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
