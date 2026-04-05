import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModeStartScreen } from '@/components/game/mode-start-screen'

function renderVersusStartScreen(overrides: Partial<ComponentProps<typeof ModeStartScreen>> = {}) {
  const props: ComponentProps<typeof ModeStartScreen> = {
    mode: 'versus',
    guessesRemaining: 9,
    score: 0,
    currentPlayer: 'x',
    winner: null,
    versusRecord: { xWins: 0, oWins: 0 },
    isHowToPlayOpen: false,
    isAchievementsOpen: false,
    hasActiveCustomSetup: false,
    minimumCellOptions: null,
    dailyResetLabel: '12h',
    showPracticeSetup: false,
    showVersusSetup: false,
    practiceSetupError: null,
    versusSetupError: null,
    practiceCategoryFilters: {},
    practiceMinimumValidOptions: null,
    versusCategoryFilters: {},
    versusMinimumValidOptions: null,
    minimumValidOptionsDefault: 6,
    versusStealRule: 'lower',
    versusTimerOption: 300,
    versusDisableDraws: true,
    versusObjectionRule: 'one',
    versusObjectionsUsed: { x: 0, o: 0 },
    onModeChange: vi.fn(),
    onAchievementsOpen: vi.fn(),
    onAchievementsClose: vi.fn(),
    onHowToPlayOpen: vi.fn(),
    onHowToPlayClose: vi.fn(),
    onOpenPracticeSetup: vi.fn(),
    onOpenVersusSetup: vi.fn(),
    onClosePracticeSetup: vi.fn(),
    onCloseVersusSetup: vi.fn(),
    onStartStandard: vi.fn(),
    onHostOnlineStandardMatch: vi.fn(),
    onHostOnlineCustomMatch: vi.fn(),
    onJoinOnlineMatch: vi.fn(),
    onApplyPracticeFilters: vi.fn(),
    onApplyVersusFilters: vi.fn(),
    ...overrides,
  }

  return render(<ModeStartScreen {...props} />)
}

describe('ModeStartScreen versus flow', () => {
  it('starts by asking players to choose local or online', () => {
    renderVersusStartScreen()

    expect(screen.getByRole('button', { name: /^Local\b/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Online\b/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Host Match\b/i })).not.toBeInTheDocument()
  })

  it('shows host and join after selecting online', () => {
    renderVersusStartScreen()

    fireEvent.click(screen.getByRole('button', { name: /^Online\b/i }))

    expect(screen.getByRole('button', { name: /^Host Match\b/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Join Match\b/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('shows standard and custom host options after choosing to host online', () => {
    renderVersusStartScreen()

    fireEvent.click(screen.getByRole('button', { name: /^Online\b/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Host Match\b/i }))

    expect(screen.getByRole('button', { name: /^Standard Online Match\b/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Custom Online Match\b/i })).toBeInTheDocument()
  })

  it('shows standard and custom local options after choosing local', () => {
    renderVersusStartScreen()

    fireEvent.click(screen.getByRole('button', { name: /^Local\b/i }))

    expect(screen.getByRole('button', { name: /^Standard Local Match\b/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Custom Local Match\b/i })).toBeInTheDocument()
  })

  it('calls the online join callback from the online branch', () => {
    const onJoinOnlineMatch = vi.fn()
    renderVersusStartScreen({ onJoinOnlineMatch })

    fireEvent.click(screen.getByRole('button', { name: /^Online\b/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Join Match\b/i }))

    expect(onJoinOnlineMatch).toHaveBeenCalledTimes(1)
  })
})
