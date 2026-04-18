import { expect, test } from '@playwright/test'
import {
  fakePuzzle,
  fakeSearchResult,
  mockGuessApi,
  resetStorage,
  safeClick,
  seedStorageValue,
  mockPuzzleStream,
  seedDailyPuzzle,
} from './test-helpers'

test.beforeEach(async ({ context }) => {
  await mockGuessApi(context)
})

test('practice mode shows start options and opens custom setup', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'Practice' }))

  await expect(page.getByText('Practice Mode')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Standard Puzzle' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Custom Puzzle' })).toBeVisible()

  await safeClick(page.getByRole('button', { name: 'Custom Puzzle' }))

  await expect(page.getByRole('heading', { name: 'Practice Setup' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset to Default' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply Filters' })).toBeVisible()
})

test('versus mode shows start options and opens setup controls', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'Versus' }))

  await expect(page.getByText('Versus Mode')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Local\b/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Online\b/i })).toBeVisible()

  await safeClick(page.getByRole('button', { name: /^Local\b/i }))

  await expect(
    page.locator('button').filter({ hasText: 'Standard Local Match' }).first()
  ).toBeVisible()
  await expect(
    page.locator('button').filter({ hasText: 'Custom Local Match' }).first()
  ).toBeVisible()

  await safeClick(page.locator('button').filter({ hasText: 'Custom Local Match' }).first())

  await expect(page.getByRole('heading', { name: 'Versus Setup' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Rules/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Categories/i })).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Rules/i }))
  await expect(page.getByRole('heading', { name: 'Steals' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Objections' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Turn Timer' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveCount(4)
  await expect(page.getByRole('combobox').nth(1)).toContainText('1 each')
  await expect(page.getByRole('button', { name: 'Reset to Default' })).toBeVisible()
})

test('mode switching across daily practice and versus stays responsive', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'GameGrid' })).toBeVisible()

  await safeClick(page.getByRole('button', { name: 'Practice' }))
  await expect(page.getByText('Practice Mode')).toBeVisible()

  await safeClick(page.getByRole('button', { name: 'Daily' }))
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeVisible()

  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await expect(page.getByText('Versus Mode')).toBeVisible()

  await safeClick(page.getByRole('button', { name: 'Daily' }))
  await expect(page.getByRole('heading', { name: 'GameGrid' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeVisible()
})

test('practice standard puzzle generates a board from the setup screen', async ({ page }) => {
  await mockPuzzleStream(page, fakePuzzle)
  await resetStorage(page)
  await seedDailyPuzzle(page)

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Practice' }))
  await safeClick(page.getByRole('button', { name: 'Standard Puzzle' }))

  await expect(page.getByTestId('grid-cell-0')).toBeVisible()
  await expect(page.getByText('RPG')).toBeVisible()
})

test('local versus refresh restores the versus board instead of booting daily', async ({
  page,
}) => {
  await mockPuzzleStream(page, fakePuzzle)
  await resetStorage(page)
  await seedDailyPuzzle(page)

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await safeClick(page.getByRole('button', { name: /^Local\b/i }))
  await safeClick(page.locator('button').filter({ hasText: 'Standard Local Match' }).first())

  await expect(page.getByTestId('grid-cell-0')).toBeVisible()
  await expect(page.getByText(/Turn: \d+:\d{2}/)).toBeVisible()

  await page.reload()

  await expect(page.getByTestId('grid-cell-0')).toBeVisible()
  await expect(page.getByText(/Turn: \d+:\d{2}/)).toBeVisible()
  await expect(page.getByText('Versus Mode')).toHaveCount(0)
})

test('local versus refresh restores an open search with the typed query', async ({ page }) => {
  await mockPuzzleStream(page, fakePuzzle)
  await resetStorage(page)
  await seedDailyPuzzle(page)
  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [fakeSearchResult] }),
    })
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await safeClick(page.getByRole('button', { name: /^Local\b/i }))
  await safeClick(page.locator('button').filter({ hasText: 'Standard Local Match' }).first())

  await expect(page.getByTestId('grid-cell-0')).toBeVisible()
  await safeClick(page.getByTestId('grid-cell-0'))

  const searchInput = page.getByPlaceholder('Search for a video game...')
  await expect(searchInput).toBeVisible()
  await searchInput.fill('mass')
  await expect(searchInput).toHaveValue('mass')

  await page.reload()

  await expect(page.getByTestId('grid-cell-0')).toBeVisible()
  await expect(searchInput).toBeVisible()
  await expect(searchInput).toHaveValue('mass')
})

test('how to play modal stays available for daily and versus modes', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'How to Play' }))
  const dailyHowToDialog = page.getByRole('dialog')
  await expect(dailyHowToDialog.getByRole('heading', { name: 'How to Play' })).toBeVisible()
  await expect(page.getByText('Fill the Grid')).toBeVisible()
  await expect(page.getByText('Release Tags')).toBeVisible()
  await expect(page.getByText('Uniqueness Score')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Changelog' })).toBeVisible()
  await safeClick(dailyHowToDialog.getByRole('button', { name: 'Got it!' }))
  await expect(dailyHowToDialog).not.toBeVisible()

  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await expect(page.getByText('Versus Mode')).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'How to Play' }))
  const versusHowToDialog = page.getByRole('dialog')
  await expect(versusHowToDialog.getByRole('heading', { name: 'How to Play Versus' })).toBeVisible()
  await expect(page.getByText('Take Turns Claiming Squares')).toBeVisible()
  await expect(page.getByText('Steal Rating Rules')).toBeVisible()
  await expect(page.getByText('Final Square Tiebreak')).toBeVisible()
  await safeClick(versusHowToDialog.getByRole('button', { name: 'Got it!' }))
  await expect(versusHowToDialog).not.toBeVisible()
})

test('how to play modal can navigate to the changelog', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'How to Play' }))
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible()

  await safeClick(page.getByRole('link', { name: 'Changelog' }))

  await page.waitForURL('**/changelog')
  await expect(page.getByRole('heading', { name: "What's new in GameGrid" })).toBeVisible()
  await expect(page.getByText('Recent updates, newest first')).toBeVisible()
})

test('practice and versus restore in-progress boards from local storage', async ({ page }) => {
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_practice_state', {
    puzzleId: 'practice-puzzle',
    puzzle: { ...fakePuzzle, id: 'practice-puzzle', is_daily: false, date: null },
    guesses: [
      { gameId: 1, gameName: 'Restored Practice Game', gameImage: null, isCorrect: true },
      ...Array(8).fill(null),
    ],
    guessesRemaining: 8,
    isComplete: false,
  })
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-puzzle',
    puzzle: { ...fakePuzzle, id: 'versus-puzzle', is_daily: false, date: null },
    guesses: [
      { gameId: 2, gameName: 'Restored Versus Game', gameImage: null, isCorrect: true, owner: 'x' },
      ...Array(8).fill(null),
    ],
    guessesRemaining: 9,
    isComplete: false,
    currentPlayer: 'o',
    stealableCell: 0,
    winner: null,
    pendingFinalSteal: null,
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 'none',
    turnTimeLeft: null,
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Practice' }))
  await expect(page.getByTestId('grid-cell-0')).toContainText('Restored Practice Game')

  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await expect(page.getByTestId('grid-cell-0')).toContainText('Restored Versus Game')
})

test('daily archive calendar can open an older board and reflects the open day', async ({
  page,
}) => {
  const todayDate = fakePuzzle.date
  const archiveDate = '2026-03-27'
  const archivedPuzzle = {
    ...fakePuzzle,
    id: 'archived-daily-puzzle',
    date: archiveDate,
    row_categories: [
      { type: 'genre', id: 'genre-adventure', name: 'Adventure' },
      { type: 'genre', id: 'genre-action', name: 'Action' },
      { type: 'genre', id: 'genre-platformer', name: 'Platformer' },
    ],
  }

  await resetStorage(page)
  await page.route('**/api/daily-history', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: [
          { id: `daily-${todayDate}`, date: todayDate, is_completed: false, guess_count: 0 },
          { id: `daily-${archiveDate}`, date: archiveDate, is_completed: true, guess_count: 9 },
        ],
      }),
    })
  })
  await page.route('**/api/puzzle?*', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('mode') === 'daily' && url.searchParams.get('date') === archiveDate) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...archivedPuzzle,
          user_state: {
            guesses: Array(9).fill(null),
            guessesRemaining: 9,
            isComplete: false,
          },
        }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'Daily Archive' }))
  await expect(page.getByRole('heading', { name: 'Daily Archive' })).toBeVisible()
  await expect(page.getByText(/Open marks the board you have loaded right now\./i)).toBeVisible()
  const archiveLoad = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === 'GET' &&
      url.pathname === '/api/puzzle' &&
      url.searchParams.get('mode') === 'daily' &&
      url.searchParams.get('date') === archiveDate
    )
  })
  await safeClick(page.getByRole('button', { name: `${archiveDate}, Completed` }))
  await archiveLoad

  await expect(page.getByTestId('grid-cell-0')).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'Daily Archive' }).first())
  await expect(page.getByRole('button', { name: `${archiveDate}, Current board` })).toBeVisible()
})

test('daily boot hydrates today progress from streamed session state', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
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
          `data: ${JSON.stringify({
            type: 'puzzle',
            puzzle: fakePuzzle,
            user_state: {
              guesses: [
                {
                  gameId: 1,
                  gameName: 'Transferred Progress Game',
                  gameImage: null,
                  isCorrect: true,
                },
                ...Array(8).fill(null),
              ],
              guessesRemaining: 8,
              isComplete: false,
            },
          })}`,
          '',
        ].join('\n') + '\n',
    })
  })

  await page.goto('/')

  await expect(page.getByTestId('grid-cell-0')).toContainText('Transferred Progress Game')
})
