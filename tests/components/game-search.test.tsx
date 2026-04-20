import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameSearch } from '@/components/game/game-search'
import type { Category, Game } from '@/lib/types'

type SearchResultFixture = Game & {
  disambiguationPlatform?: string | null
  disambiguationYear?: string | null
}

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

const duplicateSamePlatformResults: SearchResultFixture[] = [
  {
    id: 11,
    name: 'Tetris',
    slug: 'tetris-gb-1989',
    background_image: null,
    released: '1989-06-14',
    metacritic: 90,
    originalPlatformName: 'Game Boy',
    disambiguationPlatform: 'Game Boy',
    disambiguationYear: '1989',
    genres: [{ id: 2, name: 'Puzzle', slug: 'puzzle' }],
    platforms: [{ platform: { id: 33, name: 'Game Boy', slug: 'game-boy' } }],
  },
  {
    id: 12,
    name: 'Tetris',
    slug: 'tetris-gb-1990',
    background_image: null,
    released: '1990-11-21',
    metacritic: 87,
    originalPlatformName: 'Game Boy',
    disambiguationPlatform: 'Game Boy',
    disambiguationYear: '1990',
    genres: [{ id: 2, name: 'Puzzle', slug: 'puzzle' }],
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
    vi.useRealTimers()
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

  it('submits only once when Enter is mashed during the confirm step', async () => {
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

    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Enter' })

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(fakeGame)
    })
  })

  it('ignores Enter while a newer search request is still loading', async () => {
    vi.useFakeTimers()
    const onSelect = vi.fn()
    const firstResults = [fakeGame]
    let resolveSecondSearch: ((value: { results: Game[] }) => void) | null = null
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ results: firstResults }),
      })
      .mockResolvedValueOnce({
        json: async () =>
          await new Promise<{ results: Game[] }>((resolve) => {
            resolveSecondSearch = resolve
          }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <GameSearch
        isOpen
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={onSelect}
        onClose={() => {}}
      />
    )

    const input = screen.getByPlaceholderText('Search for a video game...')
    fireEvent.change(input, { target: { value: 'wo' } })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('World of Warcraft')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'wor' } })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await Promise.resolve()
      await Promise.resolve()
    })

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()

    await act(async () => {
      resolveSecondSearch?.({ results: firstResults })
      await Promise.resolve()
    })
  })

  it('ignores Enter during the debounce gap after the query changes', async () => {
    vi.useFakeTimers()
    const onSelect = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ results: [fakeGame] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <GameSearch
        isOpen
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={onSelect}
        onClose={() => {}}
      />
    )

    const input = screen.getByPlaceholderText('Search for a video game...')
    fireEvent.change(input, { target: { value: 'wo' } })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('World of Warcraft')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'wor' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('submits only once when Enter is mashed after results settle', async () => {
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
    const input = screen.getByPlaceholderText('Search for a video game...')

    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(fakeGame)
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
    await screen.findAllByText('Platformer')
    await screen.findByText('Family')
  })

  it('falls back to year when duplicate-title platform labels would still collide', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ results: duplicateSamePlatformResults }),
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

    await user.type(screen.getByPlaceholderText('Search for a video game...'), 'tet')

    await screen.findByText('Tetris (1989)')
    await screen.findByText('Tetris (1990)')
  })

  it('shows the active turn timer in the search header when provided', () => {
    render(
      <GameSearch
        isOpen
        turnTimerLabel="Turn: 0:09"
        turnTimerSeconds={9}
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    expect(screen.getByText('Turn: 0:09')).toBeInTheDocument()
  })

  it('shows a matched alternate title hint when search matched an alias', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          results: [
            {
              ...fakeGame,
              id: 13,
              name: 'The King of Fighters 2006',
              slug: 'the-king-of-fighters-2006',
              matchedAltName: 'KOF Maximum Impact 2',
            },
          ],
        }),
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

    await user.type(screen.getByPlaceholderText('Search for a video game...'), 'ko')

    await screen.findByText('The King of Fighters 2006')
    await screen.findByText('Matched alt title: KOF Maximum Impact 2')
  })

  it('restores the initial query when reopened', async () => {
    const { rerender } = render(
      <GameSearch
        isOpen={false}
        initialQuery="mass"
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    rerender(
      <GameSearch
        isOpen
        initialQuery="mass"
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search for a video game...')).toHaveValue('mass')
    })
  })

  it('reports query changes to the parent draft state', async () => {
    const onQueryChange = vi.fn()
    const user = userEvent.setup()

    render(
      <GameSearch
        isOpen
        initialQuery="ma"
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={() => {}}
        onQueryChange={onQueryChange}
        onClose={() => {}}
      />
    )

    const input = await screen.findByPlaceholderText('Search for a video game...')
    await user.type(input, 'ss')

    expect(onQueryChange).toHaveBeenNthCalledWith(1, 'mas')
    expect(onQueryChange).toHaveBeenNthCalledWith(2, 'mass')
  })

  it('includes search mode in the API request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ results: [fakeGame] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()

    render(
      <GameSearch
        isOpen
        searchMode="daily"
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText('Search for a video game...'), 'wo')
    await screen.findByText('World of Warcraft')

    const requestUrl = String(fetchMock.mock.calls.at(-1)?.[0] ?? '')
    expect(requestUrl).toContain('mode=daily')
  })

  it('includes versus steal state in the API request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ results: [fakeGame] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()

    render(
      <GameSearch
        isOpen
        searchMode="versus"
        versusStealsEnabled={false}
        rowCategory={rowCategory}
        colCategory={colCategory}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText('Search for a video game...'), 'wo')
    await screen.findByText('World of Warcraft')

    const requestUrl = String(fetchMock.mock.calls.at(-1)?.[0] ?? '')
    expect(requestUrl).toContain('mode=versus')
    expect(requestUrl).toContain('versusStealsEnabled=false')
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
        vi.advanceTimersByTime(450)
      })

      fireEvent.change(input, { target: { value: 'wor' } })
      await act(async () => {
        vi.advanceTimersByTime(450)
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
