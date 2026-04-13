import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChangelogPage from '@/app/changelog/page'

describe('ChangelogPage', () => {
  it('renders player-facing updates and quick links', () => {
    render(<ChangelogPage />)

    expect(screen.getByRole('heading', { name: "What's new in GameGrid" })).toBeInTheDocument()
    expect(
      screen.getByText(
        'This page only tracks player-facing changes, not every internal refactor or dependency update.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Game' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'How to Play' })).toHaveAttribute(
      'href',
      '/how-to-play'
    )
    expect(screen.getByRole('navigation', { name: 'Changelog quick links' })).toBeInTheDocument()
    expect(screen.getByText('Jump to update')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'March 28, 2026' })).toHaveAttribute(
      'href',
      '#2026-03-28-daily-archive-streaks'
    )
    expect(screen.getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
      'href',
      expect.stringContaining('bug_report.yml')
    )
    expect(screen.getByText('Daily Archive, Streaks, And Versus Summary')).toBeInTheDocument()
  })
})
