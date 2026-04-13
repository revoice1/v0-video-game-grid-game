import { expect, test } from '@playwright/test'
import {
  fakeSearchResult,
  mockGuessApi,
  safeClick,
  seedDailyPuzzle,
  setTheme,
} from './test-helpers'

test.beforeEach(async ({ context }) => {
  await mockGuessApi(context)
})

test('search confirm flow can pick a correct answer onto the board', async ({ page }) => {
  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [fakeSearchResult] }),
    })
  })

  await page.route('**/api/guess', async (route) => {
    // Only intercept POST guess submissions — fall through for PATCH (objection
    // persistence) and lookupOnly requests so the beforeEach mockGuessApi handles them.
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    const requestBody = route.request().postDataJSON() as Record<string, unknown>
    if (requestBody.lookupOnly === true) {
      await route.fallback()
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
          id: requestBody.gameId,
          name: requestBody.gameName,
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
      }),
    })
  })

  await seedDailyPuzzle(page)
  await page.goto('/')

  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('wo')
  await expect(page.getByText('World of Warcraft')).toBeVisible()

  await safeClick(page.getByRole('button', { name: /World of Warcraft/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'Confirm World of Warcraft' }))

  await expect(page.getByTestId('grid-cell-0')).toContainText('World of Warcraft')
})

test('search cover preview opens a larger image dialog', async ({ page }) => {
  const previewResult = {
    ...fakeSearchResult,
    background_image: 'https://images.igdb.com/wow-cover.jpg',
  }

  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [previewResult] }),
    })
  })

  await seedDailyPuzzle(page)
  await page.goto('/')

  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('wo')
  await expect(page.getByText('World of Warcraft')).toBeVisible()

  await safeClick(page.getByTitle('Preview cover for World of Warcraft'))
  const previewDialog = page.getByRole('dialog')
  await expect(previewDialog).toBeVisible()
  await expect(previewDialog.getByAltText('World of Warcraft')).toBeVisible()
  await expect(previewDialog.getByText('World of Warcraft', { exact: true })).toBeVisible()
})

test('category definition dialog shows local guide copy without loading for non-platform categories', async ({
  page,
}) => {
  await seedDailyPuzzle(page)
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: /RPG/i }))
  const definitionDialog = page.getByRole('dialog')
  await expect(definitionDialog.getByText('GameGrid guide')).toBeVisible()
  await expect(definitionDialog.getByText('Loading')).toHaveCount(0)
  await expect(
    definitionDialog.getByText(
      'Games built around character growth, stats, party building, quests, and long-term progression choices.'
    )
  ).toBeVisible()
})

test('confirm flow renders cleanly in both light and dark themes', async ({ page }) => {
  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [fakeSearchResult] }),
    })
  })

  await seedDailyPuzzle(page)
  await page.goto('/')

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)
    await safeClick(page.getByTestId('grid-cell-0'))
    await page.getByPlaceholder('Search for a video game...').fill('wo')
    await expect(page.getByText('World of Warcraft')).toBeVisible()
    await safeClick(page.getByRole('button', { name: /World of Warcraft/i }))
    await expect(page.getByText('Confirm this answer?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel World of Warcraft' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm World of Warcraft' })).toBeVisible()
    await safeClick(page.getByRole('button', { name: 'Cancel World of Warcraft' }))
    await expect(page.getByText('Confirm this answer?')).toHaveCount(0)
    await page.mouse.click(8, 8)
    await expect(page.getByPlaceholder('Search for a video game...')).toHaveCount(0)
  }
})

test('toast appears for duplicate guess rejection', async ({ page }) => {
  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [fakeSearchResult] }),
    })
  })

  await page.route('**/api/guess', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    const requestBody = route.request().postDataJSON() as Record<string, unknown>
    if (requestBody.lookupOnly === true) {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: false,
        duplicate: true,
        matchesRow: true,
        matchesCol: true,
        game: null,
      }),
    })
  })

  await seedDailyPuzzle(page)
  await page.goto('/')

  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('wo')
  await expect(page.getByText('World of Warcraft')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /World of Warcraft/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'Confirm World of Warcraft' }))

  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText('Game already used', { exact: true })).toBeVisible()
  await expect(notifications.getByText('Each game can only be used once per grid.')).toBeVisible()
})

test('search disambiguation surfaces port-family representative labels', async ({ page }) => {
  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: 1086,
            name: 'Donkey Kong',
            slug: 'donkey-kong-arcade',
            background_image: null,
            released: '1981-07-09',
            metacritic: 84,
            gameTypeLabel: 'Original',
            originalPlatformName: 'Arcade',
            hasSameNamePortFamily: true,
            genres: [{ id: 1, name: 'Platform', slug: 'platform' }],
            platforms: [{ platform: { id: 52, name: 'Arcade', slug: 'arcade' } }],
          },
          {
            id: 1089,
            name: 'Donkey Kong',
            slug: 'donkey-kong-gb',
            background_image: null,
            released: '1994-06-14',
            metacritic: 87,
            gameTypeLabel: 'Remake',
            originalPlatformName: 'Game Boy',
            hasSameNamePortFamily: false,
            genres: [{ id: 1, name: 'Platform', slug: 'platform' }],
            platforms: [{ platform: { id: 33, name: 'Game Boy', slug: 'game-boy' } }],
          },
        ],
      }),
    })
  })

  await seedDailyPuzzle(page)
  await page.goto('/')

  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('don')
  await expect(page.getByText('Donkey Kong (ARC+Ports)', { exact: true })).toBeVisible()
  await expect(page.getByText('Donkey Kong (GB)', { exact: true })).toBeVisible()
})
