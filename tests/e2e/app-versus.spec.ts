import { expect, test } from '@playwright/test'
import {
  fakePuzzle,
  resetStorage,
  seedDailyPuzzle,
  seedSessionValue,
  seedStorageValue,
} from './test-helpers'

test('versus failed steal shows the destructive toast path', async ({ page }) => {
  await seedDailyPuzzle(page)
  await page.goto('/')

  await expect
    .poll(async () => {
      return page.evaluate(() => Boolean(window.__gameGridDev))
    })
    .toBe(true)

  await page.evaluate(() => {
    window.__gameGridDev?.triggerStealShowdown({
      successful: false,
      attackerScore: 88,
      defenderScore: 81,
    })
    window.__gameGridDev?.triggerStealMiss()
  })

  await expect(page.getByTestId('steal-showdown-overlay')).toBeVisible()
  await expect(page.getByTestId('steal-miss-splash')).toBeVisible()
})

test('final steal locks interaction to the target cell and dims the rest of the board', async ({
  page,
}) => {
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-final-steal-focus',
    puzzle: { ...fakePuzzle, id: 'versus-final-steal-focus', is_daily: false, date: null },
    guesses: [
      { gameId: 1, gameName: 'X1', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 2, gameName: 'X2', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 3, gameName: 'X3', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 4, gameName: 'O4', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 5, gameName: 'X5', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 6, gameName: 'O6', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 7, gameName: 'X7', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 8, gameName: 'O8', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 9, gameName: 'X9', gameImage: null, isCorrect: true, owner: 'x' },
    ],
    guessesRemaining: 9,
    isComplete: false,
    currentPlayer: 'o',
    stealableCell: 2,
    winner: null,
    pendingFinalSteal: { defender: 'x', cellIndex: 2 },
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 'none',
    turnTimeLeft: null,
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Versus' }).click()

  const nonTargetCell = page.getByTestId('grid-cell-0')
  const targetCell = page.getByTestId('grid-cell-2')

  await expect(nonTargetCell).toHaveClass(/opacity-35/)
  await expect(targetCell).toHaveClass(/final-steal-focus/)

  await nonTargetCell.click()
  await expect(page.getByPlaceholder('Search for a video game...')).toHaveCount(0)

  await targetCell.click({ force: true })
  await expect(page.getByPlaceholder('Search for a video game...')).toBeVisible()
})

test('versus winner panel can be dismissed while keeping the board visible', async ({ page }) => {
  await resetStorage(page)
  await seedSessionValue(page, 'gamegrid_versus_record', { xWins: 2, oWins: 1 })
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-win-panel',
    puzzle: { ...fakePuzzle, id: 'versus-win-panel', is_daily: false, date: null },
    guesses: [
      { gameId: 1, gameName: 'X1', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 2, gameName: 'X2', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 3, gameName: 'X3', gameImage: null, isCorrect: true, owner: 'x' },
      ...Array(6).fill(null),
    ],
    guessesRemaining: 9,
    isComplete: true,
    currentPlayer: 'x',
    stealableCell: null,
    winner: 'x',
    pendingFinalSteal: null,
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 'none',
    turnTimeLeft: null,
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Versus' }).click()

  await expect(page.getByText('X wins', { exact: true })).toBeVisible()
  await expect(page.getByTestId('grid-cell-0')).toContainText('X1')
  await page.getByRole('button', { name: 'Hide' }).click()
  await expect(page.getByText('Match Over')).toHaveCount(0)
  await expect(page.getByTestId('grid-cell-0')).toContainText('X1')
})

test('versus draw restore renders tie state without a winner', async ({ page }) => {
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-draw-panel',
    puzzle: { ...fakePuzzle, id: 'versus-draw-panel', is_daily: false, date: null },
    guesses: [
      { gameId: 1, gameName: 'X1', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 2, gameName: 'X2', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 3, gameName: 'O3', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 4, gameName: 'O4', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 5, gameName: 'O5', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 6, gameName: 'X6', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 7, gameName: 'X7', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 8, gameName: 'O8', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 9, gameName: 'X9', gameImage: null, isCorrect: true, owner: 'x' },
    ],
    guessesRemaining: 9,
    isComplete: true,
    currentPlayer: 'x',
    stealableCell: null,
    winner: 'draw',
    pendingFinalSteal: null,
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 'none',
    turnTimeLeft: null,
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Versus' }).click()

  await expect(page.getByText('Draw game')).toBeVisible()
  await expect(page.getByText('No line was completed before the board filled up.')).toBeVisible()
  await expect(page.locator('header').getByText('Result', { exact: true })).toBeVisible()
  await expect(page.locator('header').getByText('Tie', { exact: true })).toBeVisible()
})

test('disable draws gives O a final steal chance before an X 5-4 claims win resolves', async ({
  page,
}) => {
  const versusSearchResult = {
    id: 202,
    name: 'Tie Breaker Game',
    slug: 'tie-breaker-game',
    background_image: null,
    released: '2005-10-11',
    metacritic: 81,
    genres: [{ id: 1, name: 'Action', slug: 'action' }],
    platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
  }

  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [versusSearchResult] }),
    })
  })

  await page.route('**/api/guess', async (route) => {
    const requestBody = route.request().postDataJSON()

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: true,
        duplicate: false,
        matchesRow: true,
        matchesCol: true,
        game: {
          id: requestBody.gameId,
          name: requestBody.gameName,
          slug: versusSearchResult.slug,
          url: null,
          background_image: null,
          released: versusSearchResult.released,
          releaseDates: [versusSearchResult.released],
          metacritic: versusSearchResult.metacritic,
          stealRating: 81,
          genres: ['Action'],
          platforms: ['PC (Microsoft Windows)'],
          developers: [],
          publishers: [],
          tags: [],
          gameModes: ['Single player'],
          themes: [],
          perspectives: [],
          companies: [],
        },
      }),
    })
  })

  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-disable-draws-finish',
    puzzle: { ...fakePuzzle, id: 'versus-disable-draws-finish', is_daily: false, date: null },
    guesses: [
      { gameId: 1, gameName: 'X1', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 2, gameName: 'O2', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 3, gameName: 'X3', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 4, gameName: 'X4', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 5, gameName: 'O5', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 6, gameName: 'O6', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 7, gameName: 'O7', gameImage: null, isCorrect: true, owner: 'o' },
      { gameId: 8, gameName: 'X8', gameImage: null, isCorrect: true, owner: 'x' },
      null,
    ],
    guessesRemaining: 9,
    isComplete: false,
    currentPlayer: 'x',
    stealableCell: null,
    winner: null,
    pendingFinalSteal: null,
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 'none',
    versusDisableDraws: true,
    turnTimeLeft: null,
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Versus' }).click()

  await page.getByTestId('grid-cell-8').click()
  await page.getByPlaceholder('Search for a video game...').fill('ti')
  await expect(page.getByText('Tie Breaker Game')).toBeVisible()
  await page.getByRole('button', { name: /Tie Breaker Game/i }).click()
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Tie Breaker Game' }).click()

  await expect(page.getByText('X wins', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Draw game')).toHaveCount(0)

  await expect(page.getByTestId('grid-cell-8')).toHaveClass(/final-steal-focus/)
  await expect(page.locator('header').getByText('Turn', { exact: true })).toBeVisible()
  await expect(page.locator('header').getByText('O', { exact: true })).toBeVisible()

  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText('Last chance steal')).toBeVisible()
  await expect(
    notifications.getByText('O gets one chance to answer back on that square.')
  ).toBeVisible()
})

test('double alarm cells alternate between steal and game point only', async ({ page }) => {
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-double-alarm',
    puzzle: { ...fakePuzzle, id: 'versus-double-alarm', is_daily: false, date: null },
    guesses: [
      { gameId: 1, gameName: 'X1', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 2, gameName: 'X2', gameImage: null, isCorrect: true, owner: 'x' },
      { gameId: 3, gameName: 'O3', gameImage: null, isCorrect: true, owner: 'o' },
      ...Array(6).fill(null),
    ],
    guessesRemaining: 9,
    isComplete: false,
    currentPlayer: 'x',
    stealableCell: 2,
    winner: null,
    pendingFinalSteal: null,
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 'none',
    turnTimeLeft: null,
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Versus' }).click()

  const doubleAlarmCell = page.getByTestId('grid-cell-2')
  await expect(doubleAlarmCell).toBeVisible()

  const initialBorderColor = await doubleAlarmCell.evaluate(
    (element) => (element as HTMLElement).style.borderColor
  )
  expect(initialBorderColor).not.toBe('')

  await expect
    .poll(
      async () => {
        return doubleAlarmCell.evaluate((element) => (element as HTMLElement).style.borderColor)
      },
      { timeout: 5000 }
    )
    .not.toBe(initialBorderColor)
})

test('versus timer enters danger state in the last 10 seconds', async ({ page }) => {
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-timer-puzzle',
    puzzle: { ...fakePuzzle, id: 'versus-timer-puzzle', is_daily: false, date: null },
    guesses: Array(9).fill(null),
    guessesRemaining: 9,
    isComplete: false,
    currentPlayer: 'x',
    stealableCell: null,
    winner: null,
    pendingFinalSteal: null,
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 20,
    turnTimeLeft: 20,
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Versus' }).click()

  await expect(page.getByText('Turn', { exact: true })).toBeVisible()
  await expect(page.getByText('X', { exact: true })).toBeVisible()
  await expect(page.getByText('Turn: 0:20')).toBeVisible()
  await expect(page.getByText('Timer', { exact: true })).toBeVisible({ timeout: 13000 })
  await expect(
    page.locator('.timer-danger-pulse').filter({ hasText: /Turn: 0:1\d|Turn: 0:0\d/ })
  ).toBeVisible()
})
