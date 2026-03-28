import { expect, test } from '@playwright/test'
import {
  fakePuzzle,
  resetStorage,
  seedStorageValue,
  mockPuzzleStream,
  seedDailyPuzzle,
} from './test-helpers'

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
  await expect(page.getByRole('button', { name: /Rules/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Categories/i })).toBeVisible()
  await page.getByRole('button', { name: /Rules/i }).click()
  await expect(page.getByRole('heading', { name: 'Steals' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Turn Timer' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveCount(4)
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
