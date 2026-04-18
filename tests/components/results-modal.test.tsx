import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildShareText, ResultsModal } from '@/components/game/results-modal'
import type { Category, CellGuess } from '@/lib/types'

const rowCategories: Category[] = [
  { type: 'genre', id: 'rpg', name: 'RPG' },
  { type: 'genre', id: 'platformer', name: 'Platformer' },
  { type: 'genre', id: 'strategy', name: 'Strategy' },
]

const colCategories: Category[] = [
  { type: 'platform', id: 'ps1', name: 'PlayStation' },
  { type: 'platform', id: 'ps2', name: 'PlayStation 2' },
  { type: 'platform', id: 'ps3', name: 'PlayStation 3' },
]

describe('ResultsModal', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      json: async () => ({
        cellStats: {},
        totalCompletions: 42,
        dailySummary: {
          currentStreak: 3,
          bestStreak: 8,
          completedCount: 17,
          perfectCount: 4,
        },
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the daily streak summary in the daily results view', async () => {
    render(
      <ResultsModal
        isOpen
        onClose={() => {}}
        guesses={Array(9).fill(null)}
        puzzleId="daily-2026-03-28"
        puzzleDate="2026-03-28"
        rowCategories={rowCategories}
        colCategories={colCategories}
        isDaily
        onPlayAgain={() => {}}
      />
    )

    expect(await screen.findByText('Daily Progress')).toBeInTheDocument()
    expect(screen.getByText('This browser session')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Best')).toBeInTheDocument()
    expect(screen.getByText('Played')).toBeInTheDocument()
    expect(screen.getByText('Perfects')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('uses orange squares in copied spoiler-free results for sustained objections', async () => {
    const guesses: (CellGuess | null)[] = [
      {
        gameId: 1,
        gameName: 'Reviewed Winner',
        gameImage: null,
        isCorrect: true,
        objectionVerdict: 'sustained',
      },
      {
        gameId: 2,
        gameName: 'Normal Correct',
        gameImage: null,
        isCorrect: true,
      },
      {
        gameId: 3,
        gameName: 'Wrong Answer',
        gameImage: null,
        isCorrect: false,
      },
      ...Array(6).fill(null),
    ]

    const firstRow = buildShareText(guesses, true, '2026-03-28').split('\n')[1]
    expect(Array.from(firstRow ?? '').map((char) => char.codePointAt(0)?.toString(16))).toEqual([
      '1f7e7',
      '1f7e9',
      '1f7e5',
    ])
  })

  it('highlights the current player pick and shows player-based percentages in all players view', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        cellStats: {
          0: {
            correct: [
              {
                puzzle_id: 'daily-2026-03-28',
                cell_index: 0,
                game_id: 1,
                game_name: 'Final Fantasy VII',
                game_image: null,
                count: 2,
              },
            ],
            incorrect: [
              {
                puzzle_id: 'daily-2026-03-28',
                cell_index: 0,
                game_id: 2,
                game_name: 'Parasite Eve',
                game_image: null,
                count: 1,
              },
            ],
          },
        },
        totalCompletions: 4,
        dailySummary: {
          currentStreak: 3,
          bestStreak: 8,
          completedCount: 17,
          perfectCount: 4,
        },
      }),
    })

    const guesses: (CellGuess | null)[] = [
      {
        gameId: 1,
        gameName: 'Final Fantasy VII',
        gameImage: null,
        isCorrect: true,
      },
      ...Array(8).fill(null),
    ]

    render(
      <ResultsModal
        isOpen
        onClose={() => {}}
        guesses={guesses}
        puzzleId="daily-2026-03-28"
        puzzleDate="2026-03-28"
        rowCategories={rowCategories}
        colCategories={colCategories}
        isDaily
        onPlayAgain={() => {}}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: 'All Players' }))

    const cellCard = screen.getByText('RPG x PlayStation').closest('div.rounded-xl')
    expect(cellCard).not.toBeNull()

    const correctRow = within(cellCard as HTMLElement)
      .getByText('Final Fantasy VII')
      .closest('[data-selected-by-player]')
    expect(correctRow).toHaveAttribute('data-selected-by-player', 'true')
    expect(within(correctRow as HTMLElement).getByText('50% of players')).toBeInTheDocument()

    const incorrectRow = within(cellCard as HTMLElement)
      .getByText('Parasite Eve')
      .closest('[data-selected-by-player]')
    expect(incorrectRow).toHaveAttribute('data-selected-by-player', 'false')
    expect(within(incorrectRow as HTMLElement).getByText('25% of players')).toBeInTheDocument()
  })
})
