import { expect, test } from '@playwright/test'
import {
  fakePuzzle,
  resetStorage,
  safeClick,
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

test('mobile failed steal closes search and shows the showdown overlay', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_search_confirm', false)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-mobile-failed-steal',
    puzzle: { ...fakePuzzle, id: 'versus-mobile-failed-steal', is_daily: false, date: null },
    guesses: [
      {
        gameId: 1,
        gameName: 'Defender Game',
        gameImage: null,
        isCorrect: true,
        owner: 'x',
        stealRating: 71,
      },
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
          stealRating: 88,
          stealRatingCount: 245,
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

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await page.getByTestId('grid-cell-0').click({ force: true })
  await page.getByPlaceholder('Search for a video game...').fill('ti')
  await safeClick(page.getByRole('button', { name: /tie breaker game/i }))

  await expect(page.getByTestId('steal-showdown-overlay')).toBeVisible()
  await expect(page.getByPlaceholder('Search for a video game...')).toHaveCount(0)
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
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  const nonTargetCell = page.getByTestId('grid-cell-0')
  const targetCell = page.getByTestId('grid-cell-2')

  await expect(nonTargetCell).toHaveClass(/opacity-35/)
  await expect(targetCell).toHaveClass(/final-steal-focus/)

  await safeClick(nonTargetCell)
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
    versusDisableDraws: true,
    versusObjectionRule: 'one',
    versusObjectionsUsed: { x: 1, o: 1 },
    versusEventLog: [
      { type: 'claim', player: 'x', cellIndex: 0, gameName: 'X1', viaObjection: false },
      { type: 'claim', player: 'x', cellIndex: 1, gameName: 'X2', viaObjection: false },
      { type: 'claim', player: 'x', cellIndex: 2, gameName: 'X3', viaObjection: false },
      {
        type: 'steal',
        player: 'o',
        cellIndex: 3,
        gameName: 'O4',
        successful: false,
        viaObjection: false,
        hadShowdownScores: true,
        finalSteal: false,
        attackingScore: 74,
        defendingGameName: 'X2',
        defendingScore: 81,
      },
      {
        type: 'objection',
        player: 'o',
        cellIndex: 3,
        gameName: 'O4',
        verdict: 'overruled',
        onSteal: true,
      },
    ],
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 'none',
    turnTimeLeft: null,
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  const winnerDialog = page.getByRole('dialog')
  await expect(winnerDialog.getByText('X wins', { exact: true }).first()).toBeVisible()
  await expect(winnerDialog.getByRole('button', { name: 'View Summary' })).toBeVisible()
  await expect(winnerDialog.getByText('Match Summary')).toHaveCount(0)
  await expect(winnerDialog.getByText('All Picks')).toHaveCount(0)
  await safeClick(winnerDialog.getByRole('button', { name: 'View Summary' }))
  await expect(winnerDialog.getByText('Match Summary')).toBeVisible()
  await expect(winnerDialog.getByText('Steals: Lower score')).toBeVisible()
  await expect(winnerDialog.getByText('Steal attempts: 1')).toBeVisible()
  await expect(winnerDialog.getByText('Failed steals: 1')).toBeVisible()
  await expect(winnerDialog.getByText('All Picks')).toBeVisible()
  await expect(page.getByTestId('grid-cell-0')).toContainText('X1')
  await safeClick(winnerDialog.getByRole('button', { name: 'Hide', exact: true }))
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
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  const drawDialog = page.getByRole('dialog')
  await expect(drawDialog.getByText('Draw game').first()).toBeVisible()
  await expect(
    drawDialog.getByText('No line was completed before the board filled up.')
  ).toBeVisible()
  await safeClick(drawDialog.getByRole('button', { name: 'View Summary' }))
  await expect(drawDialog.getByText('Match Summary')).toBeVisible()
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
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  await safeClick(page.getByTestId('grid-cell-8'))
  await page.getByPlaceholder('Search for a video game...').fill('ti')
  await expect(page.getByText('Tie Breaker Game')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Tie Breaker Game/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'Confirm Tie Breaker Game' }))

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
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  const doubleAlarmCell = page.getByTestId('grid-cell-2')
  await expect(doubleAlarmCell).toBeVisible()

  const initialBorderColor = await doubleAlarmCell.evaluate(
    (element) => window.getComputedStyle(element as HTMLElement).borderColor
  )
  expect(initialBorderColor).not.toBe('')

  await expect
    .poll(
      async () => {
        return doubleAlarmCell.evaluate(
          (element) => window.getComputedStyle(element as HTMLElement).borderColor
        )
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
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  await expect(page.getByText('Turn', { exact: true })).toBeVisible()
  await expect(page.getByText('X', { exact: true })).toBeVisible()
  await expect(page.getByText('Turn: 0:20')).toBeVisible()
  await expect(page.getByText('Timer', { exact: true })).toBeVisible({ timeout: 13000 })
  await expect(
    page.locator('.timer-danger-pulse').filter({ hasText: /Turn: 0:1\d|Turn: 0:0\d/ })
  ).toBeVisible()
})

test('local versus timer expiry closes an open search and passes the turn', async ({ page }) => {
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-turn-expiry-search-open',
    puzzle: {
      ...fakePuzzle,
      id: 'versus-turn-expiry-search-open',
      is_daily: false,
      date: null,
    },
    guesses: Array(9).fill(null),
    guessesRemaining: 9,
    isComplete: false,
    selectedCell: 0,
    searchQuery: '',
    currentPlayer: 'x',
    stealableCell: null,
    winner: null,
    pendingFinalSteal: null,
    versusCategoryFilters: {},
    versusStealRule: 'lower',
    versusTimerOption: 20,
    turnTimeLeft: 0,
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  await expect(page.getByText('Turn expired', { exact: true })).toBeVisible({ timeout: 4000 })
  await expect(page.getByText('O is up.', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Search for a video game...')).toHaveCount(0)
  await expect(page.getByText('Turn', { exact: true })).toBeVisible()
  await expect(page.getByText('O', { exact: true })).toBeVisible()
})
