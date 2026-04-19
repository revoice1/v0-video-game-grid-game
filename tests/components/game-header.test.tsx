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

  it('shows the online multiplayer row for a local versus board', () => {
    render(
      <GameHeader
        mode="versus"
        guessesRemaining={0}
        score={0}
        currentPlayer="x"
        winner={null}
        versusRecord={{ xWins: 0, oWins: 0 }}
        versusObjectionRule="one"
        versusObjectionsUsed={{ x: 0, o: 0 }}
        onModeChange={() => {}}
        onHowToPlay={() => {}}
        onAchievements={() => {}}
        onStartOnlineMatch={() => {}}
        onNewGame={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: 'Play Online' })).toBeInTheDocument()
    expect(screen.queryByText('You')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Match' })).toBeInTheDocument()
  })

  it('shows the online identity row for an active online versus board', () => {
    render(
      <GameHeader
        mode="versus"
        guessesRemaining={0}
        score={0}
        currentPlayer="o"
        myOnlineRole="o"
        winner={null}
        versusRecord={{ xWins: 0, oWins: 0 }}
        versusObjectionRule="one"
        versusObjectionsUsed={{ x: 0, o: 1 }}
        onModeChange={() => {}}
        onHowToPlay={() => {}}
        onAchievements={() => {}}
        onEndOnlineMatch={() => {}}
        onNewGame={() => {}}
      />
    )

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getAllByText('O').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'End Online Match' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Online Room' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play Online' })).not.toBeInTheDocument()
  })

  it('shows continue in room for a finished host-side online match', () => {
    render(
      <GameHeader
        mode="versus"
        guessesRemaining={0}
        score={0}
        currentPlayer="o"
        myOnlineRole="x"
        isOnlineHost
        winner="x"
        versusRecord={{ xWins: 0, oWins: 0 }}
        versusObjectionRule="one"
        versusObjectionsUsed={{ x: 0, o: 1 }}
        onModeChange={() => {}}
        onHowToPlay={() => {}}
        onAchievements={() => {}}
        onEndOnlineMatch={() => {}}
        onNewGame={() => {}}
        onContinueOnlineRoom={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: 'Continue In Room' })).toBeInTheDocument()
  })

  it('shows continue in room for a finished guest-side online match when O wins', () => {
    render(
      <GameHeader
        mode="versus"
        guessesRemaining={0}
        score={0}
        currentPlayer="x"
        myOnlineRole="o"
        isOnlineHost
        winner="o"
        versusRecord={{ xWins: 0, oWins: 0 }}
        versusObjectionRule="one"
        versusObjectionsUsed={{ x: 0, o: 1 }}
        onModeChange={() => {}}
        onHowToPlay={() => {}}
        onAchievements={() => {}}
        onEndOnlineMatch={() => {}}
        onNewGame={() => {}}
        onContinueOnlineRoom={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: 'Continue In Room' })).toBeInTheDocument()
  })

  it('does not show continue in room for a finished guest-side online match', () => {
    render(
      <GameHeader
        mode="versus"
        guessesRemaining={0}
        score={0}
        currentPlayer="x"
        myOnlineRole="o"
        winner="o"
        versusRecord={{ xWins: 0, oWins: 0 }}
        versusObjectionRule="one"
        versusObjectionsUsed={{ x: 0, o: 1 }}
        onModeChange={() => {}}
        onHowToPlay={() => {}}
        onAchievements={() => {}}
        onEndOnlineMatch={() => {}}
        onNewGame={() => {}}
        onContinueOnlineRoom={() => {}}
      />
    )

    expect(screen.queryByRole('button', { name: 'Continue In Room' })).not.toBeInTheDocument()
  })
})
