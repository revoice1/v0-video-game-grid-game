import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test'

export const fakePuzzle = {
  id: 'test-puzzle',
  date: new Date().toISOString().slice(0, 10),
  is_daily: true,
  created_at: new Date().toISOString(),
  row_categories: [
    { type: 'genre', id: 'genre-rpg', name: 'RPG' },
    { type: 'genre', id: 'genre-action', name: 'Action' },
    { type: 'genre', id: 'genre-platformer', name: 'Platformer' },
  ],
  col_categories: [
    { type: 'platform', id: 'platform-pc', name: 'PC' },
    { type: 'decade', id: 'decade-2000s', name: '2000s' },
    { type: 'game_mode', id: 'mode-single', name: 'Single player' },
  ],
  cell_metadata: Array.from({ length: 9 }, (_, cellIndex) => ({
    cellIndex,
    validOptionCount: 120 + cellIndex,
    difficulty: 'fair',
    difficultyLabel: 'Fair',
  })),
}

export const fakeSearchResult = {
  id: 101,
  name: 'World of Warcraft',
  slug: 'world-of-warcraft',
  background_image: null,
  released: '2004-11-23',
  metacritic: 93,
  genres: [{ id: 1, name: 'Role-playing (RPG)', slug: 'role-playing-rpg' }],
  platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
}

export async function mockGuessApi(target: Page | BrowserContext) {
  await target.route('**/api/guess', async (route) => {
    const method = route.request().method()
    let requestBody: Record<string, unknown> = {}

    try {
      requestBody = route.request().postDataJSON() as Record<string, unknown>
    } catch {
      requestBody = {}
    }

    if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    if (method === 'POST') {
      const gameId =
        typeof requestBody.gameId === 'number' ? requestBody.gameId : fakeSearchResult.id
      const gameName =
        typeof requestBody.gameName === 'string' ? requestBody.gameName : fakeSearchResult.name

      if (requestBody.lookupOnly === true) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: false,
            duplicate: false,
            matchesRow: false,
            matchesCol: false,
            game: {
              id: gameId,
              name: gameName,
              slug: fakeSearchResult.slug,
              url: null,
              background_image: null,
              released: fakeSearchResult.released,
              metacritic: fakeSearchResult.metacritic,
              stealRating: 93,
              genres: ['Role-playing (RPG)'],
              platforms: ['PC (Microsoft Windows)'],
              developers: [],
              publishers: [],
              tags: [],
              gameModes: ['Single player'],
              themes: [],
              perspectives: [],
              companies: [],
            },
            selectedGame: null,
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          duplicate: false,
          matchesRow: true,
          matchesCol: true,
          game: {
            id: gameId,
            name: gameName,
            slug: fakeSearchResult.slug,
            url: null,
            background_image: null,
            released: fakeSearchResult.released,
            metacritic: fakeSearchResult.metacritic,
            stealRating: 93,
            genres: ['Role-playing (RPG)'],
            platforms: ['PC (Microsoft Windows)'],
            developers: [],
            publishers: [],
            tags: [],
            gameModes: ['Single player'],
            themes: [],
            perspectives: [],
            companies: [],
          },
          selectedGame: {
            id: gameId,
            name: gameName,
            slug: fakeSearchResult.slug,
            url: null,
            background_image: null,
          },
        }),
      })
      return
    }

    await route.fallback()
  })
}

export async function resetStorage(page: Page) {
  const seededDailyState = {
    puzzleId: fakePuzzle.id,
    puzzle: fakePuzzle,
    guesses: Array(9).fill(null),
    guessesRemaining: 9,
    isComplete: false,
    date: new Date().toISOString().slice(0, 10),
  }

  await page.route('**/api/puzzle-stream?*', async (route) => {
    const url = route.request().url()
    const mode = new URL(url).searchParams.get('mode')

    if (mode !== 'daily') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
      body:
        [
          `data: ${JSON.stringify({ type: 'progress', pct: 20, message: 'Preparing daily board...' })}`,
          '',
          `data: ${JSON.stringify({ type: 'puzzle', puzzle: fakePuzzle })}`,
          '',
        ].join('\n') + '\n',
    })
  })

  await page.goto('/')
  await page.evaluate((dailyState) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem(
      `gamegrid_daily_state:${dailyState.date ?? new Date().toISOString().slice(0, 10)}`,
      JSON.stringify(dailyState)
    )
  }, seededDailyState)
  await page.reload()
}

export async function seedDailyPuzzle(page: Page) {
  const payload = {
    puzzleId: fakePuzzle.id,
    puzzle: fakePuzzle,
    guesses: Array(9).fill(null),
    guessesRemaining: 9,
    isComplete: false,
    date: new Date().toISOString().slice(0, 10),
  }

  await page.addInitScript((state) => {
    window.localStorage.setItem(
      `gamegrid_daily_state:${state.date ?? new Date().toISOString().slice(0, 10)}`,
      JSON.stringify(state)
    )
  }, payload)
}

export async function seedAchievements(page: Page, achievementIds: string[]) {
  await page.addInitScript((ids) => {
    window.localStorage.setItem('gamegrid_achievements', JSON.stringify(ids))
  }, achievementIds)
}

export async function seedStorageValue(page: Page, key: string, value: unknown) {
  await page.addInitScript(
    ([storageKey, storageValue]) => {
      if (
        storageKey === 'gamegrid_daily_state' &&
        storageValue &&
        typeof storageValue === 'object' &&
        'date' in (storageValue as Record<string, unknown>)
      ) {
        const date =
          (storageValue as { date?: string | null }).date ?? new Date().toISOString().slice(0, 10)
        window.localStorage.setItem(`gamegrid_daily_state:${date}`, JSON.stringify(storageValue))
        return
      }

      window.localStorage.setItem(storageKey, JSON.stringify(storageValue))
    },
    [key, value] as const
  )
}

export async function seedSessionValue(page: Page, key: string, value: unknown) {
  await page.addInitScript(
    ([storageKey, storageValue]) => {
      window.sessionStorage.setItem(storageKey, JSON.stringify(storageValue))
    },
    [key, value] as const
  )
}

export function buildCompletedGuesses() {
  return Array.from({ length: 9 }, (_, index) => ({
    gameId: index + 1,
    gameName: `Game ${index + 1}`,
    gameImage: null,
    isCorrect: true,
  }))
}

export async function openSettings(page: Page) {
  const settingsButton = page.getByRole('button', { name: 'Open settings' })
  await expect(settingsButton).toBeVisible()
  await expect(settingsButton).toBeEnabled()
  await safeClick(settingsButton)
  if ((await settingsButton.getAttribute('aria-expanded')) !== 'true') {
    await settingsButton.click({ force: true })
  }
  if ((await settingsButton.getAttribute('aria-expanded')) !== 'true') {
    await settingsButton.evaluate((button) => {
      ;(button as HTMLButtonElement).click()
    })
  }
  await expect(settingsButton).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('Theme')).toBeVisible()
}

export async function safeClick(locator: Locator) {
  await expect(locator).toBeVisible()
  await expect(locator).toBeEnabled()

  try {
    await locator.click({ timeout: 2_000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('stable')) {
      throw error
    }

    await locator.click({ force: true })
  }
}

export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await openSettings(page)

  const switchToThemeLabel = theme === 'light' ? 'Switch to light mode' : 'Switch to dark mode'
  const oppositeThemeLabel = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

  const themeToggle = page.getByRole('button', { name: switchToThemeLabel })
  if (await themeToggle.isVisible().catch(() => false)) {
    await safeClick(themeToggle)
  }

  await expect(page.getByRole('button', { name: oppositeThemeLabel })).toBeVisible()
  await expect
    .poll(async () => {
      return page.evaluate(() => document.documentElement.classList.contains('light'))
    })
    .toBe(theme === 'light')

  await safeClick(page.getByRole('button', { name: 'Open settings' }))
}

export async function mockPuzzleStream(page: Page, puzzle: typeof fakePuzzle) {
  await page.route('**/api/puzzle-stream?*', async (route) => {
    const url = route.request().url()
    const mode = new URL(url).searchParams.get('mode')

    if (mode !== 'daily' && mode !== 'practice' && mode !== 'versus') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
      body:
        [
          `data: ${JSON.stringify({ type: 'progress', pct: 20, message: `Preparing ${mode} board...` })}`,
          '',
          `data: ${JSON.stringify({ type: 'puzzle', puzzle: { ...puzzle, id: `${mode}-puzzle`, is_daily: mode === 'daily', date: mode === 'daily' ? puzzle.date : null } })}`,
          '',
        ].join('\n') + '\n',
    })
  })
}
