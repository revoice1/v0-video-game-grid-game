import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameSearch } from '@/components/game/game-search'
import type { Category, Game } from '@/lib/types'

const fakeGame: Game = {
  id: 1,
  name: 'World of Warcraft',
  slug: 'world-of-warcraft',
  background_image: null,
  released: '2004-11-23',
  metacritic: 93,
  genres: [{ id: 1, name: 'Role-playing (RPG)', slug: 'role-playing-rpg' }],
  platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
}

const rowCategory: Category = {
  type: 'genre',
  id: 'genre-rpg',
  name: 'RPG',
}

const colCategory: Category = {
  type: 'platform',
  id: 'platform-pc',
  name: 'PC',
}

describe('GameSearch', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ results: [fakeGame] }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('submits immediately when confirm is disabled', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(
      <GameSearch
        isOpen
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={onSelect}
        onClose={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText('Search for a video game...'), 'wo')

    await screen.findByText('World of Warcraft')
    await user.click(screen.getByRole('button', { name: /World of Warcraft/i }))

    expect(onSelect).toHaveBeenCalledWith(fakeGame)
  })

  it('requires explicit confirmation when confirm is enabled', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(
      <GameSearch
        isOpen
        confirmBeforeSelect
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={onSelect}
        onClose={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText('Search for a video game...'), 'wo')

    await screen.findByText('World of Warcraft')
    await user.click(screen.getByRole('button', { name: /World of Warcraft/i }))

    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByText('Confirm this answer?')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Confirm World of Warcraft'))

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(fakeGame)
    })
  })
})
