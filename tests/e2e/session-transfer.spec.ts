import { expect, test } from '@playwright/test'
import { openSettings, resetStorage, seedDailyPuzzle } from './test-helpers'

const TRANSFER_CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/
const TRANSFER_CODE = 'ABCD-EFGH'

test('export: creates and copies a temporary transfer code', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await resetStorage(page)
  await seedDailyPuzzle(page)
  await page.route('**/api/session/export', async (route) => {
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
  await page.getByRole('button', { name: 'Create transfer code' }).click()
  await expect(page.getByText('Copied!')).toBeVisible()
  await expect(page.getByText('This code expires in about 10 minutes.')).toBeVisible()
  await expect(page.getByLabel('Transfer QR code')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open transfer link' })).toHaveAttribute(
    'href',
    /\/transfer\?code=ABCD-EFGH$/
  )
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toMatch(TRANSFER_CODE_RE)
})

test('import: rejects an invalid code', async ({ page }) => {
  await resetStorage(page)
  await seedDailyPuzzle(page)
  await page.goto('/')
  await openSettings(page)
  await page.getByRole('button', { name: 'Import on this device' }).click()
  await page.getByPlaceholder('Paste code here...').fill('not-a-uuid')
  await page.getByRole('button', { name: 'Replace history' }).click()
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
  await page.getByRole('button', { name: 'Import on this device' }).click()
  await page.getByPlaceholder('Paste code here...').fill(TRANSFER_CODE)
  const reloadPromise = page.waitForURL('/')
  await page.getByRole('button', { name: 'Replace history' }).click()
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
  await page.getByRole('button', { name: 'Import on this device' }).click()
  await page.getByPlaceholder('Paste code here...').fill(TRANSFER_CODE)
  await page.getByRole('button', { name: 'Replace history' }).click()
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
  await page.getByRole('button', { name: 'Replace history' }).click()
  await expect(page.getByText('Transfer complete')).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const todayKey = `gamegrid_daily_state:${new Date().toISOString().slice(0, 10)}`
        return window.localStorage.getItem(todayKey)
      })
    )
    .toBeNull()
  await page.getByRole('link', { name: 'Open GameGrid' }).click()
  await page.waitForURL('/')
})
