import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const duplicatePortFamilyResults: Game[] = [
  {
    id: 2,
    name: 'Donkey Kong',
    slug: 'donkey-kong-arcade',
    background_image: null,
    released: '1981-07-09',
    metacritic: 88,
    hasSameNamePortFamily: true,
    originalPlatformName: 'Arcade',
    genres: [{ id: 2, name: 'Platform', slug: 'platform' }],
    platforms: [{ platform: { id: 52, name: 'Arcade', slug: 'arcade' } }],
  },
  {
    id: 3,
    name: 'Donkey Kong',
    slug: 'donkey-kong-gb',
    background_image: null,
    released: '1994-06-14',
    metacritic: 90,
    originalPlatformName: 'Game Boy',
    genres: [{ id: 2, name: 'Platform', slug: 'platform' }],
    platforms: [{ platform: { id: 33, name: 'Game Boy', slug: 'game-boy' } }],
  },
]

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

  it('uses enter and escape to interact with the confirm step', async () => {
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

    expect(screen.getByText('Confirm this answer?')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Confirm this answer?')).not.toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /World of Warcraft/i }))
    expect(screen.getByText('Confirm this answer?')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Enter' })

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(fakeGame)
    })
  })

  it('renders shared short labels for duplicate titles and same-name port families', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ results: duplicatePortFamilyResults }),
      })
    )

    const user = userEvent.setup()

    render(
      <GameSearch
        isOpen
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText('Search for a video game...'), 'don')

    await screen.findByText('Donkey Kong (ARC+Ports)')
    await screen.findByText('Donkey Kong (GB)')
  })

  it('ignores stale search responses when a newer query finishes later', async () => {
    vi.useFakeTimers()
    try {
      type SearchPayload = { results: Game[] }
      let firstResolve: ((value: SearchPayload) => void) | undefined
      let secondResolve: ((value: SearchPayload) => void) | undefined

      vi.stubGlobal(
        'fetch',
        vi.fn((input: string | URL | Request) => {
          const rawUrl =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
          const url = new URL(rawUrl, 'https://example.com')
          const query = url.searchParams.get('q')

          return new Promise((resolve) => {
            const resolveResponse = (results: { results: Game[] }) =>
              resolve({
                json: async () => results,
              })

            if (query === 'wo') {
              firstResolve = resolveResponse
              return
            }

            secondResolve = resolveResponse
          })
        })
      )

      render(
        <GameSearch
          isOpen
          rowCategory={rowCategory}
          colCategory={colCategory}
          onSelect={() => {}}
          onClose={() => {}}
        />
      )

      const input = screen.getByPlaceholderText('Search for a video game...')

      fireEvent.change(input, { target: { value: 'wo' } })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      fireEvent.change(input, { target: { value: 'wor' } })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(secondResolve).toBeDefined()
      await act(async () => {
        secondResolve?.({
          results: [{ ...fakeGame, id: 4, name: 'World of Goo', slug: 'world-of-goo' }],
        })
        await Promise.resolve()
      })

      expect(screen.getByText('World of Goo')).toBeInTheDocument()

      expect(firstResolve).toBeDefined()
      await act(async () => {
        firstResolve?.({
          results: [fakeGame],
        })
        await Promise.resolve()
      })

      expect(screen.getByText('World of Goo')).toBeInTheDocument()
      expect(screen.queryByText('World of Warcraft')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
