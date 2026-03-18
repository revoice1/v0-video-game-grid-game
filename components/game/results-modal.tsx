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
  const [activeTab, setActiveTab] = useState<'your-results' | 'playerbase'>('your-results')

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

  // Get all answers across playerbase with their percentages
  const getAllAnswersWithPercentages = () => {
    if (!stats) return { top: [], bottom: [] }
    
    const allAnswers: { stat: AnswerStat; percentage: number; cellIndex: number }[] = []
    
    for (let i = 0; i < 9; i++) {
      const cellStats = stats[i] || []
      const totalForCell = cellStats.reduce((sum, s) => sum + s.count, 0)
      
      cellStats.forEach(stat => {
        if (totalForCell > 0) {
          allAnswers.push({
            stat,
            percentage: (stat.count / totalForCell) * 100,
            cellIndex: i
          })
        }
      })
    }
    
    // Sort by percentage
    const sorted = allAnswers.sort((a, b) => b.percentage - a.percentage)
    
    return {
      top: sorted.slice(0, 10),
      bottom: sorted.filter(a => a.stat.count <= 2).slice(-10).reverse()
    }
  }

  const { top: topAnswers, bottom: rarestAnswers } = getAllAnswersWithPercentages()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-center text-2xl font-bold">
            {isDaily ? 'Daily' : 'Practice'} Results
          </DialogTitle>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex border-b border-border flex-shrink-0">
          <button
            onClick={() => setActiveTab('your-results')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === 'your-results' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Your Results
          </button>
          <button
            onClick={() => setActiveTab('playerbase')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === 'playerbase' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All Players
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'your-results' ? (
            <div className="space-y-6 py-4 px-1">
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
                              <span className="text-destructive text-2xl">X</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Stats footer */}
              <div className="text-center text-xs text-muted-foreground">
                {totalCompletions} {totalCompletions === 1 ? 'player has' : 'players have'} completed this puzzle
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-4 px-1">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading stats...</div>
              ) : (
                <>
                  {/* Most Popular Answers */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      Most Popular Answers
                    </h4>
                    <div className="space-y-2">
                      {topAnswers.length > 0 ? (
                        topAnswers.map((item, i) => (
                          <div 
                            key={`${item.stat.game_id}-${item.cellIndex}`}
                            className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 border border-border"
                          >
                            <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                            {item.stat.game_image ? (
                              <Image
                                src={item.stat.game_image}
                                alt={item.stat.game_name}
                                width={32}
                                height={32}
                                className="rounded object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center text-xs">
                                ?
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{item.stat.game_name}</p>
                              <p className="text-xs text-muted-foreground">Cell {item.cellIndex + 1}</p>
                            </div>
                            <span className={cn('text-sm font-medium', getRarityClass(item.percentage))}>
                              {item.percentage.toFixed(0)}%
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No answers yet</p>
                      )}
                    </div>
                  </div>

                  {/* Rarest Answers */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full rarity-legendary"></span>
                      Rarest Answers
                    </h4>
                    <div className="space-y-2">
                      {rarestAnswers.length > 0 ? (
                        rarestAnswers.map((item, i) => (
                          <div 
                            key={`rare-${item.stat.game_id}-${item.cellIndex}`}
                            className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 border border-border"
                          >
                            <span className="text-xs rarity-legendary w-5">#{i + 1}</span>
                            {item.stat.game_image ? (
                              <Image
                                src={item.stat.game_image}
                                alt={item.stat.game_name}
                                width={32}
                                height={32}
                                className="rounded object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center text-xs">
                                ?
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{item.stat.game_name}</p>
                              <p className="text-xs text-muted-foreground">Cell {item.cellIndex + 1}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-medium rarity-legendary">
                                {item.percentage < 1 ? '<1' : item.percentage.toFixed(0)}%
                              </span>
                              <p className="text-xs text-muted-foreground">{item.stat.count} pick{item.stat.count !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No rare answers yet</p>
                      )}
                    </div>
                  </div>

                  {/* Total players */}
                  <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
                    Stats from {totalCompletions} completed {totalCompletions === 1 ? 'game' : 'games'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions - fixed at bottom */}
        <div className="flex gap-3 pt-4 border-t border-border flex-shrink-0">
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
      </DialogContent>
    </Dialog>
  )
}
