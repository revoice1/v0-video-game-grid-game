import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HowToPlayModal } from '@/components/game/how-to-play-modal'

describe('HowToPlayModal', () => {
  it('renders versus guidance with the updated steal, timer, and online room copy', () => {
    render(<HowToPlayModal isOpen onClose={() => {}} mode="versus" />)

    expect(screen.getByRole('heading', { name: 'How to Play Versus' })).toBeInTheDocument()
    expect(screen.getByText(/opponent's freshest claim\./i)).toBeInTheDocument()
    expect(screen.getByText(/Steals compare each game's hidden rating\./i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /when steals are enabled, versus search favors games with rating or review data/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Rules and reminders for local and online head-to-head play.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /active objection reviews pause the clock until Judge Gemini returns a verdict/i
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/the host always controls room flow/i)).toBeInTheDocument()
    expect(screen.getByText(/winner becomes next match/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Changelog' })).toHaveAttribute('href', '/changelog')
    expect(screen.getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
      'href',
      expect.stringContaining('bug_report.yml')
    )
    expect(screen.getByRole('link', { name: 'Request a feature' })).toHaveAttribute(
      'href',
      expect.stringContaining('feature_request.yml')
    )
  })

  it('calls onClose when the primary action is pressed', () => {
    const onClose = vi.fn()

    render(<HowToPlayModal isOpen onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Got it!' }))
    expect(onClose).toHaveBeenCalled()
  })
})
