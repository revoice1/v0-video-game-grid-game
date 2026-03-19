'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Game, Category } from '@/lib/types'
import Image from 'next/image'

interface GameSearchProps {
  isOpen: boolean
  rowCategory: Category | null
  colCategory: Category | null
  onSelect: (game: Game) => void
  onClose: () => void
}

export function GameSearch({ isOpen, rowCategory, colCategory, onSelect, onClose }: GameSearchProps) {
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
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setResults(data.results || [])
      setSelectedIndex(0)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

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
              {results.map((game, index) => (
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
                  </div>
                </button>
              ))}
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
