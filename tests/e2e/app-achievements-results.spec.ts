import { expect, test } from '@playwright/test'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { ROUTE_SLUG } from '@/lib/route-index'
import {
  buildCompletedGuesses,
  fakePuzzle,
  resetStorage,
  safeClick,
  seedAchievements,
  seedStorageValue,
} from './test-helpers'

test('achievements modal shows locked and unlocked states correctly', async ({ page }) => {
  await resetStorage(page)
  await seedAchievements(page, ['perfect-grid'])
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'Achievements' }))
  const achievementsDialog = page.getByRole('dialog')
  await expect(achievementsDialog.getByRole('heading', { name: 'Achievements' })).toBeVisible()
  await expect(achievementsDialog.getByText(`1/${ACHIEVEMENTS.length}`)).toBeVisible()
  await expect(achievementsDialog.getByText('Perfect Grid', { exact: true })).toBeVisible()
  await expect(achievementsDialog.getByText('Finish a board with a flawless 9/9.')).toBeVisible()
  await expect(achievementsDialog.getByText('???', { exact: true })).toBeVisible()
  await expect(achievementsDialog.getByText('Breakfast Defender', { exact: true })).toBeVisible()
  await expect(
    achievementsDialog.getByText('Unlocked by using its hidden trigger game as a correct answer.')
  ).toHaveCount(0)
  await safeClick(achievementsDialog.getByRole('button', { name: 'Close' }).first())
})

test('indexed route unlocks the hidden route achievement', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'Achievements' }))
  const achievementsDialog = page.getByRole('dialog')
  await expect(achievementsDialog.getByText(ROUTE_SLUG, { exact: true })).toHaveCount(0)
  await expect(achievementsDialog.getByText('???', { exact: true })).toBeVisible()
  await safeClick(achievementsDialog.getByRole('button', { name: 'Close' }).first())

  await page.goto(`/${ROUTE_SLUG}`)
  await expect(page.getByText(ROUTE_SLUG, { exact: true })).toBeVisible()
  await expect(page.getByText('...you found me')).toBeVisible()
  await page.waitForURL('**/')
  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText(`Achievement Unlocked: ${ROUTE_SLUG}`)).toBeVisible()

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Achievements' }))
  await expect(achievementsDialog.getByText(ROUTE_SLUG, { exact: true })).toBeVisible()
  await expect(
    achievementsDialog.getByText('Found the hidden route and slipped back out through the glitch.')
  ).toBeVisible()
})

test('indexed route gives a near-miss hint without unlocking on wrong casing', async ({ page }) => {
  await resetStorage(page)
  await page.goto(`/${ROUTE_SLUG.toLowerCase()}`)

  await expect(page.getByText('almost...')).toBeVisible()
  await expect(page.getByText('some routes only open when entered exactly.')).toBeVisible()
  await expect(page).toHaveURL(`/${ROUTE_SLUG.toLowerCase()}`)

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Achievements' }))
  const achievementsDialog = page.getByRole('dialog')
  await expect(achievementsDialog.getByText(ROUTE_SLUG, { exact: true })).toHaveCount(0)
  await expect(achievementsDialog.getByText('???', { exact: true })).toBeVisible()
})

test('correct easter egg answer unlocks achievement toast and collection entry', async ({
  page,
}) => {
  const haloResult = {
    id: 986,
    name: 'Halo 2',
    slug: 'halo-2',
    background_image: 'https://images.igdb.com/halo-2-cover.jpg',
    released: '2004-11-09',
    metacritic: 95,
    genres: [{ id: 5, name: 'Shooter', slug: 'shooter' }],
    platforms: [{ platform: { id: 11, name: 'Xbox (Original)', slug: 'xbox' } }],
  }

  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [haloResult] }),
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
          slug: haloResult.slug,
          url: null,
          background_image: haloResult.background_image,
          released: haloResult.released,
          metacritic: haloResult.metacritic,
          stealRating: 95,
          genres: ['Shooter'],
          platforms: ['Xbox (Original)'],
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
  await page.addInitScript(
    (state) => {
      window.localStorage.setItem(
        `gamegrid_daily_state:${state.date ?? new Date().toISOString().slice(0, 10)}`,
        JSON.stringify(state)
      )
    },
    {
      puzzleId: fakePuzzle.id,
      puzzle: {
        ...fakePuzzle,
        row_categories: [
          { type: 'genre', id: 'genre-shooter', name: 'Shooter' },
          fakePuzzle.row_categories[1],
          fakePuzzle.row_categories[2],
        ],
        col_categories: [
          { type: 'platform', id: 'platform-xbox', name: 'Xbox' },
          fakePuzzle.col_categories[1],
          fakePuzzle.col_categories[2],
        ],
      },
      guesses: Array(9).fill(null),
      guessesRemaining: 9,
      isComplete: false,
      date: new Date().toISOString().slice(0, 10),
    }
  )

  await page.goto('/')
  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('ha')
  await expect(page.getByText('Halo 2')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Halo 2/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'Confirm Halo 2' }))

  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText('Achievement Unlocked: Finish the Fight')).toBeVisible()
  await expect(
    notifications.getByText('Unlocked by using its hidden trigger game as a correct answer.')
  ).toBeVisible()

  await safeClick(page.getByRole('button', { name: 'Achievements' }))
  const achievementsDialog = page.getByRole('dialog')
  await expect(achievementsDialog.getByText(`1/${ACHIEVEMENTS.length}`)).toBeVisible()
  await expect(achievementsDialog.getByText('Finish the Fight', { exact: true })).toBeVisible()
  await expect(
    achievementsDialog.getByText('Unlocked by using its hidden trigger game as a correct answer.')
  ).toBeVisible()
  await expect(
    achievementsDialog.locator('img[src="https://images.igdb.com/halo-2-cover.jpg"]')
  ).toBeVisible()
})

test('wrong easter egg answer does not unlock the hidden achievement', async ({ page }) => {
  const haloResult = {
    id: 986,
    name: 'Halo 2',
    slug: 'halo-2',
    background_image: 'https://images.igdb.com/halo-2-cover.jpg',
    released: '2004-11-09',
    metacritic: 95,
    genres: [{ id: 5, name: 'Shooter', slug: 'shooter' }],
    platforms: [{ platform: { id: 11, name: 'Xbox (Original)', slug: 'xbox' } }],
  }

  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [haloResult] }),
    })
  })

  await page.route('**/api/guess', async (route) => {
    const requestBody = route.request().postDataJSON()

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: false,
        duplicate: false,
        matchesRow: false,
        matchesCol: true,
        game: {
          id: requestBody.gameId,
          name: requestBody.gameName,
          slug: haloResult.slug,
          url: null,
          background_image: haloResult.background_image,
          released: haloResult.released,
          metacritic: haloResult.metacritic,
          stealRating: 95,
          genres: ['Shooter'],
          platforms: ['Xbox (Original)'],
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
  await page.addInitScript(
    (state) => {
      window.localStorage.setItem(
        `gamegrid_daily_state:${state.date ?? new Date().toISOString().slice(0, 10)}`,
        JSON.stringify(state)
      )
    },
    {
      puzzleId: fakePuzzle.id,
      puzzle: {
        ...fakePuzzle,
        row_categories: [
          { type: 'genre', id: 'genre-rpg', name: 'RPG' },
          fakePuzzle.row_categories[1],
          fakePuzzle.row_categories[2],
        ],
        col_categories: [
          { type: 'platform', id: 'platform-xbox', name: 'Xbox' },
          fakePuzzle.col_categories[1],
          fakePuzzle.col_categories[2],
        ],
      },
      guesses: Array(9).fill(null),
      guessesRemaining: 9,
      isComplete: false,
      date: new Date().toISOString().slice(0, 10),
    }
  )

  await page.goto('/')
  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('ha')
  await expect(page.getByText('Halo 2')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Halo 2/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'Confirm Halo 2' }))

  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText('Achievement Unlocked: Finish the Fight')).toHaveCount(0)

  await safeClick(page.getByRole('button', { name: 'Achievements' }))
  const achievementsDialog = page.getByRole('dialog')
  await expect(achievementsDialog.getByText(`0/${ACHIEVEMENTS.length}`)).toBeVisible()
  await expect(achievementsDialog.getByText('???', { exact: true })).toBeVisible()
})

test('real stinker unlock plays the poop-fall celebration', async ({ page }) => {
  const stinkerResult = {
    id: 4040,
    name: 'Stinker Quest',
    slug: 'stinker-quest',
    background_image: 'https://images.igdb.com/stinker-quest-cover.jpg',
    released: '2001-02-03',
    metacritic: 42,
    genres: [{ id: 7, name: 'Adventure', slug: 'adventure' }],
    platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
  }

  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [stinkerResult] }),
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
          slug: stinkerResult.slug,
          url: null,
          background_image: stinkerResult.background_image,
          released: stinkerResult.released,
          metacritic: stinkerResult.metacritic,
          stealRating: 42,
          genres: ['Adventure'],
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
  await page.addInitScript(
    (state) => {
      window.localStorage.setItem(
        `gamegrid_daily_state:${state.date ?? new Date().toISOString().slice(0, 10)}`,
        JSON.stringify(state)
      )
    },
    {
      puzzleId: fakePuzzle.id,
      puzzle: {
        ...fakePuzzle,
        row_categories: [
          { type: 'genre', id: 'genre-adventure', name: 'Adventure' },
          fakePuzzle.row_categories[1],
          fakePuzzle.row_categories[2],
        ],
        col_categories: [
          { type: 'platform', id: 'platform-pc', name: 'PC' },
          fakePuzzle.col_categories[1],
          fakePuzzle.col_categories[2],
        ],
      },
      guesses: Array(9).fill(null),
      guessesRemaining: 9,
      isComplete: false,
      date: new Date().toISOString().slice(0, 10),
    }
  )

  await page.goto('/')
  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('sti')
  await expect(page.getByText('Stinker Quest')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Stinker Quest/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'Confirm Stinker Quest' }))

  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText('Achievement Unlocked: Real Stinker')).toBeVisible()
  await expect(page.getByTestId('easter-egg-celebration')).toBeVisible()
})

test('daily results modal keeps copy and playerbase features', async ({ page }) => {
  await page.route('**/api/stats?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cellStats: {},
        totalCompletions: 42,
        dailySummary: {
          currentStreak: 3,
          bestStreak: 8,
          completedCount: 17,
          perfectCount: 4,
        },
      }),
    })
  })

  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_daily_state', {
    puzzleId: fakePuzzle.id,
    puzzle: fakePuzzle,
    guesses: buildCompletedGuesses(),
    guessesRemaining: 0,
    isComplete: true,
    date: new Date().toISOString().slice(0, 10),
  })

  await page.goto('/')

  const resultsDialog = page.getByRole('dialog')
  await expect(resultsDialog.getByRole('heading', { name: 'Daily Results' })).toBeVisible()
  await expect(resultsDialog.getByText('Daily Progress')).toBeVisible()
  await expect(resultsDialog.getByText('This browser session')).toBeVisible()
  await expect(resultsDialog.getByText('Current')).toBeVisible()
  await expect(resultsDialog.getByText('Best')).toBeVisible()
  await expect(resultsDialog.getByRole('button', { name: 'Copy Results' })).toBeVisible()
  await expect(resultsDialog.getByRole('button', { name: 'All Players' })).toBeVisible()
})

test('practice results modal omits copy and playerbase features', async ({ page }) => {
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_practice_state', {
    puzzleId: 'practice-puzzle',
    puzzle: { ...fakePuzzle, id: 'practice-puzzle', is_daily: false, date: null },
    guesses: buildCompletedGuesses(),
    guessesRemaining: 0,
    isComplete: true,
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Practice' }))

  const resultsDialog = page.getByRole('dialog')
  await expect(resultsDialog.getByRole('heading', { name: 'Practice Results' })).toBeVisible()
  await expect(resultsDialog.getByRole('button', { name: 'Copy Results' })).toHaveCount(0)
  await expect(resultsDialog.getByRole('button', { name: 'All Players' })).toHaveCount(0)
  await expect(resultsDialog.getByRole('button', { name: 'New Game' })).toBeVisible()
})
