import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GuessDetailsModal } from '@/components/game/guess-details-modal'
import type { Category, CellGuess } from '@/lib/types'

const rowCategory: Category = {
  type: 'perspective',
  id: 'perspective-first-person',
  name: 'First person',
}

const colCategory: Category = {
  type: 'company',
  id: 'company-square-enix',
  name: 'Square Enix',
}

describe('GuessDetailsModal', () => {
  it('hides the objection panel for a normal correct pick with no review history', () => {
    const guess: CellGuess = {
      gameId: 1,
      gameName: 'Chrono Trigger',
      gameImage: null,
      isCorrect: true,
      matchedRow: true,
      matchedCol: true,
      objectionUsed: false,
      objectionVerdict: null,
      objectionExplanation: null,
      objectionOriginalMatchedRow: null,
      objectionOriginalMatchedCol: null,
    }

    render(
      <GuessDetailsModal
        isOpen
        onClose={() => {}}
        guess={guess}
        rowCategory={rowCategory}
        colCategory={colCategory}
      />
    )

    expect(screen.queryByText('Objection')).not.toBeInTheDocument()
  })

  it('keeps objection details visible after a sustained review and only highlights the rescued category in orange', () => {
    const guess: CellGuess = {
      gameId: 359,
      gameName: 'Final Fantasy XV',
      gameImage: null,
      isCorrect: true,
      matchedRow: true,
      matchedCol: true,
      released: '2016-11-29',
      metacritic: 79,
      objectionUsed: true,
      objectionVerdict: 'sustained',
      objectionExplanation:
        'Royal Edition adds a first-person mode, so this family can satisfy the perspective.',
      objectionOriginalMatchedRow: false,
      objectionOriginalMatchedCol: true,
    }

    render(
      <GuessDetailsModal
        isOpen
        onClose={() => {}}
        guess={guess}
        rowCategory={rowCategory}
        colCategory={colCategory}
        objectionVerdict="sustained"
        objectionExplanation={guess.objectionExplanation}
        objectionDisabled
      />
    )

    expect(screen.getByText('This pick counted for the cell after review.')).toBeInTheDocument()
    expect(screen.getByText('Objection sustained')).toBeDisabled()
    expect(screen.getByText('Sustained')).toBeInTheDocument()
    expect(screen.getByText(/Royal Edition adds a first-person mode/i)).toBeInTheDocument()

    const matchedLabels = screen.getAllByText('Matched')
    expect(matchedLabels).toHaveLength(2)
    expect(matchedLabels[0]?.className).toContain('text-[#fb923c]')
    expect(matchedLabels[1]?.className).toContain('text-primary')
  })

  it('keeps objection details visible for an overruled result', () => {
    const guess: CellGuess = {
      gameId: 47,
      gameName: 'Myst',
      gameImage: null,
      isCorrect: false,
      matchedRow: false,
      matchedCol: true,
      objectionUsed: true,
      objectionVerdict: 'overruled',
      objectionExplanation: 'The game is first-person, but it is not published by Square Enix.',
      objectionOriginalMatchedRow: false,
      objectionOriginalMatchedCol: true,
    }

    render(
      <GuessDetailsModal
        isOpen
        onClose={() => {}}
        guess={guess}
        rowCategory={rowCategory}
        colCategory={colCategory}
        objectionVerdict="overruled"
        objectionExplanation={guess.objectionExplanation}
        objectionDisabled
      />
    )

    expect(screen.getByText('This pick was rejected for the cell.')).toBeInTheDocument()
    expect(screen.getByText('Overruled')).toBeInTheDocument()
    expect(screen.getByText(/not published by Square Enix/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Objection overruled' })).toBeDisabled()
  })
})
