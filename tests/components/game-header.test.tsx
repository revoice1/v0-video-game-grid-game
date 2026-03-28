import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameHeader } from '@/components/game/game-header'

describe('GameHeader objection tracker', () => {
  it('shows objection circles for the active player when versus objections are enabled', () => {
    render(
      <GameHeader
        mode="versus"
        guessesRemaining={0}
        score={0}
        currentPlayer="x"
        winner={null}
        versusRecord={{ xWins: 0, oWins: 0 }}
        versusObjectionRule="three"
        versusObjectionsUsed={{ x: 1, o: 3 }}
        onModeChange={() => {}}
        onHowToPlay={() => {}}
        onAchievements={() => {}}
      />
    )

    expect(screen.getByText('Turn')).toBeInTheDocument()
    expect(screen.getByLabelText('X objections used: 1 of 3')).toBeInTheDocument()
    expect(screen.queryByLabelText('O objections used: 3 of 3')).not.toBeInTheDocument()
  })

  it('hides objection circles when versus objections are off', () => {
    render(
      <GameHeader
        mode="versus"
        guessesRemaining={0}
        score={0}
        currentPlayer="x"
        winner={null}
        versusRecord={{ xWins: 0, oWins: 0 }}
        versusObjectionRule="off"
        versusObjectionsUsed={{ x: 0, o: 0 }}
        onModeChange={() => {}}
        onHowToPlay={() => {}}
        onAchievements={() => {}}
      />
    )

    expect(screen.queryByLabelText(/objections used:/i)).not.toBeInTheDocument()
  })
})
