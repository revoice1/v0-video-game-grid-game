import { expect, test } from '@playwright/test'
import { openSettings, resetStorage, safeClick, seedDailyPuzzle } from './test-helpers'

const TRANSFER_CODE = 'ABCD-EFGH'

test('export: requests a temporary transfer code from settings', async ({ page }) => {
  await resetStorage(page)
  await seedDailyPuzzle(page)
  let exportHit = 0
  await page.route('**/api/session/export', async (route) => {
    exportHit += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: TRANSFER_CODE,
        expiresAt: '2099-01-01T00:10:00.000Z',
        expiresInMinutes: 10,
      }),
    })
  })

  await page.goto('/')
  await openSettings(page)
  await safeClick(page.getByRole('button', { name: 'Create transfer code' }))
  await expect.poll(() => exportHit).toBe(1)
})

test('import: rejects an invalid code', async ({ page }) => {
  await resetStorage(page)
  await seedDailyPuzzle(page)
  await page.goto('/')
  await openSettings(page)
  await safeClick(page.getByRole('button', { name: 'Import on this device' }))
  await page.getByPlaceholder('Paste code here...').fill('not-a-uuid')
  await safeClick(page.getByRole('button', { name: 'Replace history' }))
  await expect(page.getByText("That code doesn't look right")).toBeVisible()
})

test('import: accepts a valid transfer code and reloads', async ({ page }) => {
  await resetStorage(page)
  await seedDailyPuzzle(page)
  await page.route('**/api/session/import', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.goto('/')
  await openSettings(page)
  await safeClick(page.getByRole('button', { name: 'Import on this device' }))
  await page.getByPlaceholder('Paste code here...').fill(TRANSFER_CODE)
  const reloadPromise = page.waitForURL('/')
  await safeClick(page.getByRole('button', { name: 'Replace history' }))
  await reloadPromise
})

test('import: shows rate-limit message on 429', async ({ page }) => {
  await resetStorage(page)
  await seedDailyPuzzle(page)
  await page.route('**/api/session/import', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Too many attempts' }),
    })
  })

  await page.goto('/')
  await openSettings(page)
  await safeClick(page.getByRole('button', { name: 'Import on this device' }))
  await page.getByPlaceholder('Paste code here...').fill(TRANSFER_CODE)
  await safeClick(page.getByRole('button', { name: 'Replace history' }))
  await expect(page.getByText('Too many attempts. Please wait a moment.')).toBeVisible()
})

test('transfer page: warns before importing a scanned link', async ({ page }) => {
  await resetStorage(page)
  await seedDailyPuzzle(page)
  await page.route('**/api/session/import', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.goto(`/transfer?code=${TRANSFER_CODE}`)
  await expect(page.getByText('Import history?')).toBeVisible()
  await expect(
    page.getByText('This replaces completed history on this device. Boards in progress stay local.')
  ).toBeVisible()
  await safeClick(page.getByRole('button', { name: 'Replace history' }))
  await expect(page.getByText('Transfer complete')).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const todayKey = `gamegrid_daily_state:${new Date().toISOString().slice(0, 10)}`
        return window.localStorage.getItem(todayKey)
      })
    )
    .toBeNull()
  await safeClick(page.getByRole('link', { name: 'Open GameGrid' }))
  await page.waitForURL('/')
})
