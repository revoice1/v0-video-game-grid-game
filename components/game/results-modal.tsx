'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CellGuess, AnswerStat } from '@/lib/types'
import Image from 'next/image'

interface CellStatsData {
  [key: number]: AnswerStat[]
}

interface ResultsModalProps {
  isOpen: boolean
  onClose: () => void
  guesses: (CellGuess | null)[]
  puzzleId: string
  isDaily: boolean
  onPlayAgain: () => void
}

function getRarityClass(percentage: number): string {
  if (percentage <= 1) return 'rarity-legendary'
  if (percentage <= 5) return 'rarity-epic'
  if (percentage <= 15) return 'rarity-rare'
  if (percentage <= 30) return 'rarity-uncommon'
  return 'rarity-common'
}

function getRarityLabel(percentage: number): string {
  if (percentage <= 1) return 'Legendary'
  if (percentage <= 5) return 'Epic'
  if (percentage <= 15) return 'Rare'
  if (percentage <= 30) return 'Uncommon'
  return 'Common'
}

export function ResultsModal({ 
  isOpen, 
  onClose, 
  guesses, 
  puzzleId, 
  isDaily, 
  onPlayAgain 
}: ResultsModalProps) {
  const [stats, setStats] = useState<CellStatsData | null>(null)
  const [totalCompletions, setTotalCompletions] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const correctGuesses = guesses.filter(g => g?.isCorrect).length
  const score = correctGuesses

  useEffect(() => {
    if (isOpen && puzzleId) {
      setIsLoading(true)
      fetch(`/api/stats?puzzleId=${puzzleId}`)
        .then(res => res.json())
        .then(data => {
          setStats(data.cellStats || {})
          setTotalCompletions(data.totalCompletions || 0)
        })
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [isOpen, puzzleId])

  // Calculate rarity for each of user's guesses
  const getCellRarity = (cellIndex: number): number | null => {
    const guess = guesses[cellIndex]
    if (!guess?.isCorrect || !stats) return null
    
    const cellStats = stats[cellIndex] || []
    const totalForCell = cellStats.reduce((sum, s) => sum + s.count, 0)
    if (totalForCell === 0) return null
    
    const userStat = cellStats.find(s => s.game_id === guess.gameId)
    if (!userStat) return 100 // First person to pick this!
    
    return (userStat.count / totalForCell) * 100
  }

  // Calculate overall rarity score (average of all correct guesses' rarity)
  const calculateOverallRarity = (): number => {
    const rarities = guesses
      .map((_, i) => getCellRarity(i))
      .filter((r): r is number => r !== null)
    
    if (rarities.length === 0) return 0
    return rarities.reduce((sum, r) => sum + (100 - r), 0) / rarities.length
  }

  const overallRarity = calculateOverallRarity()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            {isDaily ? 'Daily' : 'Practice'} Results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Score */}
          <div className="text-center">
            <div className="text-6xl font-bold text-primary mb-2">
              {score}<span className="text-2xl text-muted-foreground">/9</span>
            </div>
            <p className="text-muted-foreground">
              {score === 9 ? 'Perfect!' : score >= 7 ? 'Great job!' : score >= 5 ? 'Nice work!' : 'Keep practicing!'}
            </p>
          </div>

          {/* Rarity Score */}
          {score > 0 && (
            <div className="text-center p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Rarity Score</p>
              <div className={cn('text-3xl font-bold', getRarityClass(100 - overallRarity))}>
                {overallRarity.toFixed(1)}
              </div>
              <p className={cn('text-sm font-medium', getRarityClass(100 - overallRarity))}>
                {getRarityLabel(100 - overallRarity)} Picks
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Higher = more unique answers
              </p>
            </div>
          )}

          {/* Grid overview with rarity */}
          <div className="grid grid-cols-3 gap-2">
            {guesses.map((guess, index) => {
              const rarity = getCellRarity(index)
              const percentage = rarity !== null ? rarity : null
              
              return (
                <div
                  key={index}
                  className={cn(
                    'aspect-square rounded-lg overflow-hidden relative',
                    'border border-border',
                    guess?.isCorrect ? 'bg-primary/20' : 'bg-secondary/30'
                  )}
                >
                  {guess && (
                    <>
                      {guess.gameImage ? (
                        <Image
                          src={guess.gameImage}
                          alt={guess.gameName}
                          fill
                          className={cn(
                            'object-cover',
                            !guess.isCorrect && 'opacity-40 grayscale'
                          )}
                          sizes="100px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground p-1 text-center">
                          {guess.gameName}
                        </div>
                      )}
                      {guess.isCorrect && percentage !== null && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                          <p className={cn('text-[10px] font-medium text-center', getRarityClass(percentage))}>
                            {percentage < 1 ? '<1' : percentage.toFixed(0)}%
                          </p>
                        </div>
                      )}
                      {!guess.isCorrect && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-destructive text-2xl">✕</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Top/Bottom answers */}
          {!isLoading && stats && score > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-center text-muted-foreground">
                Answer Popularity
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-2 text-center">Most Popular</p>
                  <div className="space-y-1">
                    {Object.values(stats)
                      .flat()
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 3)
                      .map((stat, i) => (
                        <p key={i} className="text-xs truncate">
                          {stat.game_name}
                        </p>
                      ))}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-2 text-center">Rarest Picks</p>
                  <div className="space-y-1">
                    {Object.values(stats)
                      .flat()
                      .filter(s => s.count === 1)
                      .slice(0, 3)
                      .map((stat, i) => (
                        <p key={i} className={cn('text-xs truncate', 'rarity-legendary')}>
                          {stat.game_name}
                        </p>
                      ))}
                    {Object.values(stats).flat().filter(s => s.count === 1).length === 0 && (
                      <p className="text-xs text-muted-foreground">No unique picks yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats footer */}
          <div className="text-center text-xs text-muted-foreground">
            {totalCompletions} {totalCompletions === 1 ? 'player has' : 'players have'} completed this puzzle
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {!isDaily && (
              <Button onClick={onPlayAgain} className="flex-1">
                New Game
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              className={isDaily ? 'flex-1' : ''}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
