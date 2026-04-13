import { expect, test } from '@playwright/test'
import {
  fakePuzzle,
  openSettings,
  resetStorage,
  safeClick,
  seedDailyPuzzle,
  seedStorageValue,
} from './test-helpers'

test('home loads and settings can open', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'GameGrid' })).toBeVisible()

  await safeClick(page.getByRole('button', { name: 'Open settings' }))

  await expect(page.getByText('Settings')).toBeVisible()
  await expect(page.getByText('Confirm Picks')).toBeVisible()
  await expect(page.getByText('Theme')).toBeVisible()
})

test('settings panel links through to the changelog', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'Open settings' }))
  await expect(page.getByText('Feedback')).toBeVisible()

  await safeClick(page.getByRole('link', { name: 'Changelog' }))

  await page.waitForURL('**/changelog')
  await expect(page.getByRole('heading', { name: "What's new in GameGrid" })).toBeVisible()
  await expect(page.getByText('Recent updates, newest first')).toBeVisible()
})

test('changelog can return back to the game', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/changelog')

  await expect(page.getByRole('heading', { name: "What's new in GameGrid" })).toBeVisible()

  await safeClick(page.getByRole('link', { name: 'Back to Game' }))

  await page.waitForURL('**/')
  await expect(page.getByRole('heading', { name: 'GameGrid' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeVisible()
})

test('changelog jump links update the page hash', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/changelog')

  await expect(page.getByRole('heading', { name: "What's new in GameGrid" })).toBeVisible()

  await safeClick(page.getByRole('link', { name: 'March 27, 2026' }))

  await expect(page).toHaveURL(/#2026-03-27-versus-objections$/)
  await expect(
    page.getByRole('heading', { name: 'Versus Objections And Custom Rules' })
  ).toBeVisible()
  await expect
    .poll(async () => {
      return page.evaluate(() =>
        document.getElementById('2026-03-27-versus-objections')?.matches(':target')
      )
    })
    .toBe(true)
})

test('confirm picks setting persists after reload', async ({ page }) => {
  await resetStorage(page)
  await page.goto('/')

  await safeClick(page.getByRole('button', { name: 'Open settings' }))

  await expect
    .poll(async () => {
      return page.evaluate(() => window.localStorage.getItem('gamegrid_search_confirm'))
    })
    .toBe(null)

  await page.reload()
  await safeClick(page.getByRole('button', { name: 'Open settings' }))

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

  await safeClick(page.getByRole('button', { name: 'Turn off animations' }))

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

  await page.getByRole('button', { name: 'Open settings' }).click({ force: true })
  await safeClick(page.getByRole('button', { name: 'Versus' }))
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
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  await openSettings(page)
  await safeClick(page.getByRole('button', { name: 'Turn off versus alarms' }))
  await safeClick(page.getByRole('button', { name: 'Open settings' }))

  await expect(page.getByTitle('Versus alarms are disabled in settings')).toContainText('OFF')
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
