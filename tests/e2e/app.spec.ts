import { expect, test, type Page } from '@playwright/test'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { EASTER_EGGS } from '@/lib/easter-eggs'
import { ROUTE_SLUG } from '@/lib/route-index'

const fakePuzzle = {
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

const fakeSearchResult = {
  id: 101,
  name: 'World of Warcraft',
  slug: 'world-of-warcraft',
  background_image: null,
  released: '2004-11-23',
  metacritic: 93,
  genres: [{ id: 1, name: 'Role-playing (RPG)', slug: 'role-playing-rpg' }],
  platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
}

async function resetStorage(page: Page) {
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
    window.localStorage.setItem('gamegrid_daily_state', JSON.stringify(dailyState))
  }, seededDailyState)
  await page.reload()
}

async function seedDailyPuzzle(page: Page) {
  const payload = {
    puzzleId: fakePuzzle.id,
    puzzle: fakePuzzle,
    guesses: Array(9).fill(null),
    guessesRemaining: 9,
    isComplete: false,
    date: new Date().toISOString().slice(0, 10),
  }

  await page.addInitScript((state) => {
    window.localStorage.setItem('gamegrid_daily_state', JSON.stringify(state))
  }, payload)
}

async function seedAchievements(page: Page, achievementIds: string[]) {
  await page.addInitScript((ids) => {
    window.localStorage.setItem('gamegrid_achievements', JSON.stringify(ids))
  }, achievementIds)
}

async function seedStorageValue(page: Page, key: string, value: unknown) {
  await page.addInitScript(
    ([storageKey, storageValue]) => {
      window.localStorage.setItem(storageKey, JSON.stringify(storageValue))
    },
    [key, value] as const
  )
}

async function seedSessionValue(page: Page, key: string, value: unknown) {
  await page.addInitScript(
    ([storageKey, storageValue]) => {
      window.sessionStorage.setItem(storageKey, JSON.stringify(storageValue))
    },
    [key, value] as const
  )
}

function buildCompletedGuesses() {
  return Array.from({ length: 9 }, (_, index) => ({
    gameId: index + 1,
    gameName: `Game ${index + 1}`,
    gameImage: null,
    isCorrect: true,
  }))
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByText('Settings')).toBeVisible()
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await openSettings(page)

  const switchToThemeLabel = theme === 'light' ? 'Switch to light mode' : 'Switch to dark mode'
  const oppositeThemeLabel = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

  const themeToggle = page.getByRole('button', { name: switchToThemeLabel })
  if (await themeToggle.isVisible().catch(() => false)) {
    await themeToggle.click()
  }

  await expect(page.getByRole('button', { name: oppositeThemeLabel })).toBeVisible()
  await expect
    .poll(async () => {
      return page.evaluate(() => document.documentElement.classList.contains('light'))
    })
    .toBe(theme === 'light')

  await page.getByRole('button', { name: 'Open settings' }).click()
}

async function mockPuzzleStream(page: Page, puzzle: typeof fakePuzzle) {
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

test('home loads and settings can open', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'GameGrid' })).toBeVisible()

  await page.getByRole('button', { name: 'Open settings' }).click()

  await expect(page.getByText('Settings')).toBeVisible()
  await expect(page.getByText('Confirm Picks')).toBeVisible()
  await expect(page.getByText('Theme')).toBeVisible()
})

test('confirm picks setting persists after reload', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Open settings' }).click()

  await expect
    .poll(async () => {
      return page.evaluate(() => window.localStorage.getItem('gamegrid_search_confirm'))
    })
    .toBe(null)

  await page.reload()
  await page.getByRole('button', { name: 'Open settings' }).click()

  await expect
    .poll(async () => {
      return page.evaluate(() => window.localStorage.getItem('gamegrid_search_confirm'))
    })
    .toBe(null)
  await expect(page.getByText('Ask before submitting')).toBeVisible()
  await expect
    .poll(async () => {
      return page
        .getByRole('button', { name: /search confirmation/i })
        .first()
        .getAttribute('aria-label')
    })
    .toBe('Turn off search confirmation')
})

test('animations setting persists and disables root animation mode', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await openSettings(page)
  await expect(page.getByText('Animations')).toBeVisible()
  await expect(page.getByText('Show effects and pulses')).toBeVisible()

  await page.getByRole('button', { name: 'Turn off animations' }).click()

  await expect
    .poll(async () => {
      return page.evaluate(() => window.localStorage.getItem('gamegrid_animations'))
    })
    .toBe('false')
  await expect
    .poll(async () => {
      return page.evaluate(() => document.documentElement.dataset.gamegridAnimations)
    })
    .toBe('off')
})

test('versus alarms setting only appears in versus settings', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await openSettings(page)
  await expect(page.getByText('Versus Alarms')).toHaveCount(0)

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: 'Versus' }).click()
  await expect(page.getByText('Versus Mode')).toBeVisible()

  await openSettings(page)
  await expect(page.getByText('Versus Alarms')).toBeVisible()
  await expect(page.getByText('Show timer and threat alarms')).toBeVisible()
})

test('turning versus alarms off changes the board alarm pill to off', async ({ page }) => {
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-alarm-toggle',
    puzzle: { ...fakePuzzle, id: 'versus-alarm-toggle', is_daily: false, date: null },
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

  await openSettings(page)
  await page.getByRole('button', { name: 'Turn off versus alarms' }).click()
  await page.getByRole('button', { name: 'Open settings' }).click()

  await expect(page.getByTitle('Versus alarms are disabled in settings')).toContainText('OFF')
})

test('practice mode shows start options and opens custom setup', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Practice' }).click()

  await expect(page.getByText('Practice Mode')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Standard Puzzle' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Custom Puzzle' })).toBeVisible()

  await page.getByRole('button', { name: 'Custom Puzzle' }).click()

  await expect(page.getByRole('heading', { name: 'Practice Setup' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset to Default' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply Filters' })).toBeVisible()
})

test('versus mode shows start options and opens setup controls', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Versus' }).click()

  await expect(page.getByText('Versus Mode')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Standard Match' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Custom Match' })).toBeVisible()

  await page.getByRole('button', { name: 'Custom Match' }).click()

  await expect(page.getByRole('heading', { name: 'Versus Setup' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Steal Rule' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Turn Timer' })).toBeVisible()
  await expect(page.getByRole('button', { name: '20 sec' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset to Default' })).toBeVisible()
})

test('mode switching across daily practice and versus stays responsive', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'GameGrid' })).toBeVisible()

  await page.getByRole('button', { name: 'Practice' }).click()
  await expect(page.getByText('Practice Mode')).toBeVisible()

  await page.getByRole('button', { name: 'Daily' }).click()
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeVisible()

  await page.getByRole('button', { name: 'Versus' }).click()
  await expect(page.getByText('Versus Mode')).toBeVisible()

  await page.getByRole('button', { name: 'Daily' }).click()
  await expect(page.getByRole('heading', { name: 'GameGrid' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeVisible()
})

test('practice standard puzzle generates a board from the setup screen', async ({ page }) => {
  await mockPuzzleStream(page, fakePuzzle)
  await resetStorage(page)
  await seedDailyPuzzle(page)

  await page.goto('/')
  await page.getByRole('button', { name: 'Practice' }).click()
  await page.getByRole('button', { name: 'Standard Puzzle' }).click()

  await expect(page.getByTestId('grid-cell-0')).toBeVisible()
  await expect(page.getByText('RPG')).toBeVisible()
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

  await page.getByTestId('grid-cell-0').click()
  await page.getByPlaceholder('Search for a video game...').fill('wo')
  await expect(page.getByText('World of Warcraft')).toBeVisible()

  await page.getByRole('button', { name: /World of Warcraft/i }).click()
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm World of Warcraft' }).click()

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

  await page.getByTestId('grid-cell-0').click()
  await page.getByPlaceholder('Search for a video game...').fill('wo')
  await expect(page.getByText('World of Warcraft')).toBeVisible()

  await page.getByTitle('Preview cover for World of Warcraft').click()
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

  await page.getByRole('button', { name: /RPG/i }).click()
  const definitionDialog = page.getByRole('dialog')
  await expect(definitionDialog.getByText('GameGrid guide')).toBeVisible()
  await expect(definitionDialog.getByText('Loading')).toHaveCount(0)
  await expect(
    definitionDialog.getByText(
      'Games built around character growth, stats, party building, quests, and long-term progression choices.'
    )
  ).toBeVisible()
})

test('dev hooks can trigger animation overlays for visual and perf passes', async ({ page }) => {
  await seedDailyPuzzle(page)
  await page.goto('/')
  await expect
    .poll(async () => {
      return page.evaluate(() => Boolean(window.__gameGridDev))
    })
    .toBe(true)

  await page.evaluate(() => {
    window.__gameGridDev?.triggerEasterEgg(986)
  })
  await expect(page.getByTestId('easter-egg-celebration')).toBeVisible()

  await page.evaluate(() => {
    window.__gameGridDev?.triggerPerfectCelebration()
  })
  await expect(page.getByTestId('perfect-grid-celebration')).toBeVisible()

  await page.evaluate(() => {
    window.__gameGridDev?.triggerStealShowdown({
      successful: false,
      attackerScore: 77,
      defenderScore: 81,
    })
  })
  await expect(page.getByTestId('steal-showdown-overlay')).toBeVisible()

  await page.evaluate(() => {
    window.__gameGridDev?.triggerStealMiss()
  })
  await expect(page.getByTestId('steal-miss-splash')).toBeVisible()
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
    await page.getByTestId('grid-cell-0').click()
    await page.getByPlaceholder('Search for a video game...').fill('wo')
    await expect(page.getByText('World of Warcraft')).toBeVisible()
    await page.getByRole('button', { name: /World of Warcraft/i }).click()
    await expect(page.getByText('Confirm this answer?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel World of Warcraft' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm World of Warcraft' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel World of Warcraft' }).click()
    await expect(page.getByText('Confirm this answer?')).toHaveCount(0)
    await page.mouse.click(8, 8)
    await expect(page.getByPlaceholder('Search for a video game...')).toHaveCount(0)
  }
})

test('animation matrix cycles through easter eggs and showdown states', async ({ page }) => {
  await seedDailyPuzzle(page)
  await page.goto('/')

  await expect
    .poll(async () => {
      return page.evaluate(() => Boolean(window.__gameGridDev))
    })
    .toBe(true)

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)

    for (const easterEgg of EASTER_EGGS) {
      const triggerGameId = easterEgg.triggerGameIds[0]

      const triggered = await page.evaluate((gameId) => {
        return window.__gameGridDev?.triggerEasterEgg(gameId) ?? false
      }, triggerGameId)

      expect(triggered).toBe(true)
      await expect(page.getByTestId('easter-egg-celebration')).toBeVisible()
      await page.waitForTimeout(180)
    }

    await page.evaluate(() => {
      window.__gameGridDev?.triggerPerfectCelebration()
    })
    await expect(page.getByTestId('perfect-grid-celebration')).toBeVisible()
    await page.waitForTimeout(220)

    await page.evaluate(() => {
      window.__gameGridDev?.triggerStealShowdown({
        successful: true,
        attackerScore: 71,
        defenderScore: 84,
      })
    })
    await expect(page.getByTestId('steal-showdown-overlay')).toBeVisible()
    await page.waitForTimeout(250)

    await page.evaluate(() => {
      window.__gameGridDev?.triggerStealShowdown({
        successful: false,
        attackerScore: 88,
        defenderScore: 81,
      })
    })
    await expect(page.getByTestId('steal-showdown-overlay')).toBeVisible()
    await page.waitForTimeout(250)

    await page.evaluate(() => {
      window.__gameGridDev?.triggerStealMiss()
    })
    await expect(page.getByTestId('steal-miss-splash')).toBeVisible()
    await page.waitForTimeout(250)
  }
})

test('how to play modal stays available for daily and versus modes', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'How to Play' }).click()
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible()
  await expect(page.getByText('Fill the Grid')).toBeVisible()
  await expect(page.getByText('Release Tags')).toBeVisible()
  await expect(page.getByText('Rarity Score')).toBeVisible()
  await page.getByRole('button', { name: 'Got it!' }).click()
  await expect(page.getByRole('heading', { name: 'How to Play' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Versus' }).click()
  await expect(page.getByText('Versus Mode')).toBeVisible()
  await page.getByRole('button', { name: 'How to Play' }).click()
  await expect(page.getByRole('heading', { name: 'How to Play Versus' })).toBeVisible()
  await expect(page.getByText('Take Turns Claiming Squares')).toBeVisible()
  await expect(page.getByText('Steal Rating Rules')).toBeVisible()
  await expect(page.getByText('Final Square Tiebreak')).toBeVisible()
  await page.getByRole('button', { name: 'Got it!' }).click()
  await expect(page.getByRole('heading', { name: 'How to Play Versus' })).toHaveCount(0)
})

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

test('toast appears for duplicate guess rejection', async ({ page }) => {
  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [fakeSearchResult] }),
    })
  })

  await page.route('**/api/guess', async (route) => {
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

  await page.getByTestId('grid-cell-0').click()
  await page.getByPlaceholder('Search for a video game...').fill('wo')
  await expect(page.getByText('World of Warcraft')).toBeVisible()
  await page.getByRole('button', { name: /World of Warcraft/i }).click()
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm World of Warcraft' }).click()

  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText('Game already used', { exact: true })).toBeVisible()
  await expect(notifications.getByText('Each game can only be used once per grid.')).toBeVisible()
})

test('achievements modal shows locked and unlocked states correctly', async ({ page }) => {
  await resetStorage(page)
  await seedAchievements(page, ['perfect-grid'])
  await page.goto('/')

  await page.getByRole('button', { name: 'Achievements' }).click()
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
  await achievementsDialog.getByRole('button', { name: 'Close' }).first().click()
})

test('indexed route unlocks the hidden route achievement', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Achievements' }).click()
  const achievementsDialog = page.getByRole('dialog')
  await expect(achievementsDialog.getByText(ROUTE_SLUG, { exact: true })).toHaveCount(0)
  await expect(achievementsDialog.getByText('???', { exact: true })).toBeVisible()
  await achievementsDialog.getByRole('button', { name: 'Close' }).first().click()

  await page.goto(`/${ROUTE_SLUG}`)
  await expect(page.getByText(ROUTE_SLUG, { exact: true })).toBeVisible()
  await expect(page.getByText('...you found me')).toBeVisible()
  await page.waitForURL('**/')
  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText(`Achievement Unlocked: ${ROUTE_SLUG}`)).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Achievements' }).click()
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
  await page.getByRole('button', { name: 'Achievements' }).click()
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
      window.localStorage.setItem('gamegrid_daily_state', JSON.stringify(state))
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
  await page.getByTestId('grid-cell-0').click()
  await page.getByPlaceholder('Search for a video game...').fill('ha')
  await expect(page.getByText('Halo 2')).toBeVisible()
  await page.getByRole('button', { name: /Halo 2/i }).click()
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Halo 2' }).click()

  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText('Achievement Unlocked: Finish the Fight')).toBeVisible()
  await expect(
    notifications.getByText('Unlocked by using its hidden trigger game as a correct answer.')
  ).toBeVisible()

  await page.getByRole('button', { name: 'Achievements' }).click()
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

test('daily results modal keeps copy and playerbase features', async ({ page }) => {
  await page.route('**/api/stats?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cellStats: {},
        totalCompletions: 42,
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
  await page.getByRole('button', { name: 'Practice' }).click()

  const resultsDialog = page.getByRole('dialog')
  await expect(resultsDialog.getByRole('heading', { name: 'Practice Results' })).toBeVisible()
  await expect(resultsDialog.getByRole('button', { name: 'Copy Results' })).toHaveCount(0)
  await expect(resultsDialog.getByRole('button', { name: 'All Players' })).toHaveCount(0)
  await expect(resultsDialog.getByRole('button', { name: 'New Game' })).toBeVisible()
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
  await page.getByRole('button', { name: 'Practice' }).click()
  await expect(page.getByTestId('grid-cell-0')).toContainText('Restored Practice Game')

  await page.getByRole('button', { name: 'Versus' }).click()
  await expect(page.getByTestId('grid-cell-0')).toContainText('Restored Versus Game')
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

test('disable draws awards the full-board versus winner by claimed cells', async ({ page }) => {
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

  await expect(page.getByText('X wins', { exact: true })).toBeVisible()
  await expect(page.getByText('Draw game')).toHaveCount(0)

  const notifications = page.getByRole('region', { name: 'Notifications (F8)' })
  await expect(notifications.getByText('X wins on cells!')).toBeVisible()
  await expect(notifications.getByText('X claimed 5 squares to 4.')).toBeVisible()
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

  await expect(page.getByText('Turn: 0:20')).toBeVisible()

  const dangerTimerPill = page
    .locator('.timer-danger-pulse')
    .filter({ hasText: /Turn: 0:1\d|Turn: 0:0\d/ })
  await expect(dangerTimerPill).toBeVisible({ timeout: 13000 })
})

test('reduced motion mode still supports the animation hooks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedDailyPuzzle(page)
  await page.goto('/')

  await expect
    .poll(async () => {
      return page.evaluate(() => Boolean(window.__gameGridDev))
    })
    .toBe(true)

  await page.evaluate(() => {
    window.__gameGridDev?.triggerPerfectCelebration()
  })
  await expect(page.getByTestId('perfect-grid-celebration')).toBeVisible()

  await page.evaluate(() => {
    window.__gameGridDev?.triggerStealShowdown({
      successful: true,
      attackerScore: 72,
      defenderScore: 85,
    })
  })
  await expect(page.getByTestId('steal-showdown-overlay')).toBeVisible()
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

  await page.getByTestId('grid-cell-0').click()
  await page.getByPlaceholder('Search for a video game...').fill('don')
  await expect(page.getByText('Donkey Kong (ARC+Ports)', { exact: true })).toBeVisible()
  await expect(page.getByText('Donkey Kong (GB)', { exact: true })).toBeVisible()
})
