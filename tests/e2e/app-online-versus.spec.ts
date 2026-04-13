/**
 * E2E tests for the online versus hardening changes.
 *
 * The online versus room hook relies on Supabase Realtime which is not
 * available in the e2e environment. These tests instead verify the behaviors
 * that are testable via:
 *  1. API route mocking (clientEventId, duplicate game rejection, etc.)
 *  2. seeded local versus state + window.__gameGridDev triggers
 *     (steal-objection replay, showdown display)
 *
 * Full end-to-end online room flows are covered by unit tests in
 * tests/lib/versus-event-route.test.ts and
 * tests/lib/online-versus-event-validation.test.ts.
 */

import { expect, test } from '@playwright/test'
import { type Page } from '@playwright/test'
import {
  fakePuzzle,
  mockPuzzleStream,
  resetStorage,
  safeClick,
  seedDailyPuzzle,
  seedStorageValue,
} from './test-helpers'

// Clears the stored room entry so the visibility-based catch-up hook does
// not fire a fetch against the real server after the test assertions complete.
async function clearRoomEntry(page: Page) {
  await page.evaluate(() => localStorage.removeItem('gg_online_versus_room'))
}

// Silences the snapshot-save endpoint so it does not leak through to the real
// Supabase-backed server and produce noise in the dev-server log.
async function mockRoomStateSave(page: Page) {
  await page.route('**/api/versus/room/*/state', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })
}

// ── Shared search/guess mock helpers ────────────────────────────────────────

const fakeSearchResult = {
  id: 202,
  name: 'Half-Life 2',
  slug: 'half-life-2',
  background_image: null,
  released: '2004-11-16',
  metacritic: 96,
  genres: [{ id: 1, name: 'Action', slug: 'action' }],
  platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
}

const fakeGuessResponse = (overrides: Record<string, unknown> = {}) => ({
  valid: true,
  duplicate: false,
  matchesRow: true,
  matchesCol: true,
  game: {
    id: 202,
    slug: 'half-life-2',
    url: null,
    background_image: null,
    released: '2004-11-16',
    releaseDates: ['2004-11-16'],
    metacritic: 96,
    stealRating: 88,
    stealRatingCount: 500,
    genres: ['Action'],
    platforms: ['PC (Microsoft Windows)'],
    developers: ['Valve'],
    publishers: ['Valve'],
    tags: [],
    gameModes: ['Single player'],
    themes: [],
    perspectives: [],
    companies: ['Valve'],
  },
  selectedGame: {
    id: 202,
    name: 'Half-Life 2',
    slug: 'half-life-2',
    url: null,
    background_image: null,
  },
  ...overrides,
})

// ── Tests ────────────────────────────────────────────────────────────────────

test('versus: claim sends clientEventId to the event endpoint', async ({ page }) => {
  /**
   * Verifies that when a guess is submitted in an online match, the claim event
   * includes a non-empty clientEventId for deduplication.
   *
   * We simulate an online match by seeding a versus state with a fake roomId
   * in localStorage and mocking the room/event APIs.
   */
  const capturedEventBodies: Array<Record<string, unknown>> = []

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
      body: JSON.stringify(fakeGuessResponse()),
    })
  })

  await page.route('**/api/versus/event', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    capturedEventBodies.push(body)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, type: body.type, payload: body.payload }),
    })
  })
  await mockRoomStateSave(page)

  // Mock the room endpoints so the hook enters active state
  const fakeRoom = {
    id: 'room-1',
    code: 'ABCDE',
    status: 'active',
    match_number: 1,
    puzzle_id: `versus-puzzle`,
    puzzle_data: { ...fakePuzzle, id: 'versus-puzzle', is_daily: false, date: null },
    host_session_id: 'host-s',
    guest_session_id: 'guest-s',
    settings: {
      stealRule: 'lower',
      timerOption: 'none',
      disableDraws: false,
      objectionRule: 'one',
      categoryFilters: {},
    },
    state_data: null,
    turn_deadline_at: null,
    created_at: new Date().toISOString(),
  }

  await page.route('**/api/versus/room/ABCDE/join', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom, role: 'x' }),
    })
  })
  await page.route('**/api/versus/room/ABCDE', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom }),
    })
  })
  await page.route('**/api/versus/room-events/room-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })
  await page.route('**/api/puzzle-stream**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
      body:
        [
          `data: ${JSON.stringify({ type: 'puzzle', puzzle: { ...fakePuzzle, id: 'versus-puzzle', is_daily: false, date: null } })}`,
          '',
          '',
        ].join('\n') + '\n',
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'ABCDE', role: 'x' }))
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await expect(page.getByTestId('grid-cell-0')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'End Online Match' })).toBeVisible({
    timeout: 5_000,
  })
  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('hal')
  await safeClick(page.getByRole('button', { name: /Half-Life 2/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Confirm Half-Life 2/i }))

  await expect
    .poll(() => capturedEventBodies.some((b) => b.type === 'claim'), { timeout: 5_000 })
    .toBe(true)

  const claimBody = capturedEventBodies.find((b) => b.type === 'claim')
  const payload = claimBody?.payload as Record<string, unknown> | undefined
  expect(typeof payload?.clientEventId).toBe('string')
  expect((payload?.clientEventId as string).length).toBeGreaterThan(0)

  await clearRoomEntry(page)
})

test('versus: duplicate game rejection from server leaves board unchanged', async ({ page }) => {
  /**
   * When the server returns 409 duplicate_game, the client should not
   * commit the guess to the board.
   *
   * This test uses an online room mock so the event route fires. The claim
   * handler in game-client awaits sendOnlineEventWithRecovery and returns
   * early on error, so the board should stay empty.
   */
  const portalSearchResult = {
    id: 101,
    name: 'Portal 2',
    slug: 'portal-2',
    background_image: null,
    released: '2011-04-19',
    metacritic: 95,
    genres: [{ id: 1, name: 'Puzzle', slug: 'puzzle' }],
    platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
  }

  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [portalSearchResult] }),
    })
  })

  await page.route('**/api/guess', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: true,
        duplicate: false,
        matchesRow: true,
        matchesCol: true,
        game: {
          id: 101,
          slug: null,
          url: null,
          released: null,
          metacritic: null,
          stealRating: null,
          stealRatingCount: null,
          genres: [],
          platforms: [],
          developers: [],
          publishers: [],
          tags: [],
          gameModes: [],
          themes: [],
          perspectives: [],
          companies: [],
        },
        selectedGame: {
          id: 101,
          name: 'Portal 2',
          slug: 'portal-2',
          url: null,
          background_image: null,
        },
      }),
    })
  })

  // Server rejects the duplicate claim
  await page.route('**/api/versus/event', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'That game has already been used on this board.',
        code: 'duplicate_game',
      }),
    })
  })
  await mockRoomStateSave(page)

  const fakeRoom = {
    id: 'room-dup',
    code: 'DUPXX',
    status: 'active',
    match_number: 1,
    puzzle_id: 'versus-dup-test',
    puzzle_data: { ...fakePuzzle, id: 'versus-dup-test', is_daily: false, date: null },
    host_session_id: 'h',
    guest_session_id: 'g',
    settings: {
      stealRule: 'lower',
      timerOption: 'none',
      disableDraws: false,
      objectionRule: 'one',
      categoryFilters: {},
    },
    state_data: null,
    turn_deadline_at: null,
    created_at: new Date().toISOString(),
  }
  await page.route('**/api/versus/room/DUPXX/join', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom, role: 'x' }),
    })
  })
  await page.route('**/api/versus/room/DUPXX', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom }),
    })
  })
  await page.route('**/api/versus/room-events/room-dup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })
  await page.route('**/api/puzzle-stream**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
      body:
        [
          `data: ${JSON.stringify({ type: 'puzzle', puzzle: { ...fakePuzzle, id: 'versus-dup-test', is_daily: false, date: null } })}`,
          '',
          '',
        ].join('\n') + '\n',
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'DUPXX', role: 'x' }))
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await expect(page.getByTestId('grid-cell-0')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'End Online Match' })).toBeVisible({
    timeout: 5_000,
  })
  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('por')
  await safeClick(page.getByRole('button', { name: /Portal 2/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Confirm Portal 2/i }))

  // After server rejects with duplicate_game, cell stays empty
  await expect(page.getByTestId('grid-cell-0')).not.toContainText('Portal 2', { timeout: 3_000 })

  await clearRoomEntry(page)
})

test('versus: miss event sends clientEventId', async ({ page }) => {
  /**
   * Verifies that miss events (invalid guess) include a clientEventId.
   * Uses an online room mock with puzzle_data so the board loads without
   * needing a seeded local state — isCurrentOnlineMatch becomes true once
   * the room joins and the event route fires on invalid guess submission.
   */
  const capturedEventBodies: Array<Record<string, unknown>> = []

  const puzzleId = 'versus-miss-test'

  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [fakeSearchResult] }),
    })
  })

  // Guess returns invalid — triggers a miss event
  await page.route('**/api/guess', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: false,
        duplicate: false,
        matchesRow: false,
        matchesCol: false,
        game: null,
        selectedGame: null,
      }),
    })
  })

  await page.route('**/api/versus/event', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    capturedEventBodies.push(body)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, type: body.type, payload: body.payload }),
    })
  })
  await mockRoomStateSave(page)

  const fakeRoom = {
    id: 'room-miss',
    code: 'MISSZ',
    status: 'active',
    match_number: 1,
    puzzle_id: puzzleId,
    puzzle_data: { ...fakePuzzle, id: puzzleId, is_daily: false, date: null },
    host_session_id: 'h',
    guest_session_id: 'g',
    settings: {
      stealRule: 'lower',
      timerOption: 'none',
      disableDraws: false,
      objectionRule: 'off',
      categoryFilters: {},
    },
    state_data: null,
    turn_deadline_at: null,
    created_at: new Date().toISOString(),
  }

  await page.route('**/api/versus/room/MISSZ/join', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom, role: 'x' }),
    })
  })
  await page.route('**/api/versus/room/MISSZ', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom }),
    })
  })
  await page.route('**/api/versus/room-events/room-miss', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })
  await page.route('**/api/puzzle-stream**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
      body:
        [
          `data: ${JSON.stringify({ type: 'puzzle', puzzle: { ...fakePuzzle, id: puzzleId, is_daily: false, date: null } })}`,
          '',
          '',
        ].join('\n') + '\n',
    })
  })

  await page.addInitScript(() => {
    // Only seed the room key — the board loads via room.puzzle_data.
    // Seeding gamegrid_versus_state is avoided because the room prep effect
    // calls clearGameState('versus') before the saved state is read, so it
    // would be wiped anyway and would only add confusion.
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'MISSZ', role: 'x' }))
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await expect(page.getByTestId('grid-cell-0')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'End Online Match' })).toBeVisible({
    timeout: 5_000,
  })
  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('hal')
  await safeClick(page.getByRole('button', { name: /Half-Life 2/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Confirm Half-Life 2/i }))

  await expect
    .poll(() => capturedEventBodies.some((b) => b.type === 'miss'), { timeout: 5_000 })
    .toBe(true)

  const missBody = capturedEventBodies.find((b) => b.type === 'miss')
  const payload = missBody?.payload as Record<string, unknown> | undefined
  expect(typeof payload?.clientEventId).toBe('string')
  expect((payload?.clientEventId as string).length).toBeGreaterThan(0)

  await clearRoomEntry(page)
})

test('versus: failed steal showdown overlay shows with server-provided scores', async ({
  page,
}) => {
  /**
   * Verifies the steal showdown overlay renders correctly when driven by
   * externally-provided scores (the shape the server returns in its
   * authoritative steal payload). This exercises the overlay rendering path
   * via __gameGridDev; the server payload handling itself is covered by
   * the steal clientEventId test below.
   */
  await resetStorage(page)
  await seedStorageValue(page, 'gamegrid_versus_state', {
    puzzleId: 'versus-steal-showdown',
    puzzle: { ...fakePuzzle, id: 'versus-steal-showdown', is_daily: false, date: null },
    guesses: [
      {
        gameId: 1,
        gameName: 'Defender Game',
        gameImage: null,
        isCorrect: true,
        owner: 'x',
        stealRating: 95,
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

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))

  await expect.poll(async () => page.evaluate(() => Boolean(window.__gameGridDev))).toBe(true)

  // Trigger the showdown with scores matching what the server would return
  await page.evaluate(() => {
    window.__gameGridDev?.triggerStealShowdown({
      successful: false,
      attackerScore: 88,
      defenderScore: 95,
    })
    window.__gameGridDev?.triggerStealMiss()
  })

  await expect(page.getByTestId('steal-showdown-overlay')).toBeVisible()
  await expect(page.getByTestId('steal-miss-splash')).toBeVisible()
})

test('versus: steal event sends clientEventId', async ({ page }) => {
  /**
   * Verifies that steal events include a clientEventId so the server can
   * deduplicate on retry.
   */
  const capturedEventBodies: Array<Record<string, unknown>> = []

  const attackingGame = {
    id: 202,
    name: 'Half-Life 2',
    slug: 'half-life-2',
    background_image: null,
    released: '2004-11-16',
    metacritic: 96,
    genres: [{ id: 1, name: 'Action', slug: 'action' }],
    platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
  }

  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [attackingGame] }),
    })
  })

  await page.route('**/api/guess', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: true,
        duplicate: false,
        matchesRow: true,
        matchesCol: true,
        game: {
          id: 202,
          slug: 'half-life-2',
          url: null,
          background_image: null,
          released: '2004-11-16',
          releaseDates: ['2004-11-16'],
          metacritic: 96,
          stealRating: 88,
          stealRatingCount: 500,
          genres: ['Action'],
          platforms: ['PC (Microsoft Windows)'],
          developers: ['Valve'],
          publishers: ['Valve'],
          tags: [],
          gameModes: ['Single player'],
          themes: [],
          perspectives: [],
          companies: ['Valve'],
        },
        selectedGame: {
          id: 202,
          name: 'Half-Life 2',
          slug: 'half-life-2',
          url: null,
          background_image: null,
        },
      }),
    })
  })

  await page.route('**/api/versus/event', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    capturedEventBodies.push(body)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, type: body.type, payload: body.payload }),
    })
  })
  await mockRoomStateSave(page)

  const fakeRoom = {
    id: 'room-steal',
    code: 'STEAL',
    status: 'active',
    match_number: 1,
    puzzle_id: 'versus-steal-ceid',
    puzzle_data: { ...fakePuzzle, id: 'versus-steal-ceid', is_daily: false, date: null },
    host_session_id: 'h',
    guest_session_id: 'g',
    settings: {
      stealRule: 'lower',
      timerOption: 'none',
      disableDraws: false,
      objectionRule: 'one',
      categoryFilters: {},
    },
    // Seed state_data so the board starts with a claimed+stealable cell 0
    state_data: {
      guesses: [
        {
          gameId: 1,
          gameName: 'Defender Game',
          owner: 'x',
          gameImage: null,
          isCorrect: true,
          stealRating: 95,
          stealRatingCount: 100,
          released: null,
          metacritic: null,
          gameSlug: null,
          gameUrl: null,
          genres: [],
          platforms: [],
          developers: [],
          publishers: [],
          tags: [],
          gameModes: [],
          themes: [],
          perspectives: [],
          companies: [],
          matchedRow: true,
          matchedCol: true,
          validationExplanation: null,
          objectionUsed: false,
          objectionVerdict: null,
          objectionExplanation: null,
          objectionOriginalMatchedRow: null,
          objectionOriginalMatchedCol: null,
        },
        ...Array(8).fill(null),
      ],
      guessesRemaining: 9,
      currentPlayer: 'o',
      stealableCell: 0,
      winner: null,
      pendingFinalSteal: null,
      objectionsUsed: { x: 0, o: 0 },
      turnDeadlineAt: null,
    },
    turn_deadline_at: null,
    created_at: new Date().toISOString(),
  }

  await page.route('**/api/versus/room/STEAL/join', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom, role: 'o' }),
    })
  })
  await page.route('**/api/versus/room/STEAL', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom }),
    })
  })
  await page.route('**/api/versus/room-events/room-steal', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })
  await page.route('**/api/puzzle-stream**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
      body:
        [
          `data: ${JSON.stringify({ type: 'puzzle', puzzle: { ...fakePuzzle, id: 'versus-steal-ceid', is_daily: false, date: null } })}`,
          '',
          '',
        ].join('\n') + '\n',
    })
  })

  await page.addInitScript(() => {
    const puzzleId = 'versus-steal-ceid'
    // Seed the versus state with the same board that state_data describes.
    // This is necessary because the app's auto-load effect can overwrite the
    // board that state_data hydration applied (the hydration signature guard
    // prevents re-application after a subsequent loadPuzzle wipes the guesses).
    // room.state_data still drives the authoritative currentPlayer='o' and
    // stealableCell=0 fields applied by the room settings override in the
    // room prep effect, so a regression in those fields would still surface.
    localStorage.setItem(
      'gamegrid_versus_state',
      JSON.stringify({
        puzzleId,
        puzzle: {
          id: puzzleId,
          is_daily: false,
          date: null,
          row_categories: [
            { type: 'genre', id: 'g1', name: 'RPG' },
            { type: 'genre', id: 'g2', name: 'Action' },
            { type: 'genre', id: 'g3', name: 'Platformer' },
          ],
          col_categories: [
            { type: 'platform', id: 'p1', name: 'PC' },
            { type: 'decade', id: 'd1', name: '2000s' },
            { type: 'game_mode', id: 'm1', name: 'Single player' },
          ],
          cell_metadata: Array.from({ length: 9 }, (_, i) => ({
            cellIndex: i,
            validOptionCount: 120 + i,
            difficulty: 'fair',
            difficultyLabel: 'Fair',
          })),
        },
        guesses: [
          {
            gameId: 1,
            gameName: 'Defender Game',
            gameImage: null,
            isCorrect: true,
            owner: 'x',
            stealRating: 95,
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
    )
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'STEAL', role: 'o' }))
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  // Defender Game must be present — it comes from the seeded local state which mirrors
  // state_data. This confirms the board loaded; the authoritative turn/steal fields
  // (currentPlayer=o, stealableCell=0) come from the room prep effect.
  await expect(page.getByTestId('grid-cell-0')).toContainText('Defender Game', { timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'End Online Match' })).toBeVisible({
    timeout: 5_000,
  })

  // Click the stealable cell
  await page.getByTestId('grid-cell-0').click({ force: true })
  await page.getByPlaceholder('Search for a video game...').fill('hal')
  await safeClick(page.getByRole('button', { name: /Half-Life 2/i }))
  // Confirm the selection (same confirm dialog as claims)
  await expect(page.getByRole('button', { name: /Confirm Half-Life 2/i })).toBeVisible({
    timeout: 3_000,
  })
  await safeClick(page.getByRole('button', { name: /Confirm Half-Life 2/i }))

  await expect
    .poll(() => capturedEventBodies.some((b) => b.type === 'steal'), { timeout: 5_000 })
    .toBe(true)

  const stealBody = capturedEventBodies.find((b) => b.type === 'steal')
  const payload = stealBody?.payload as Record<string, unknown> | undefined
  expect(typeof payload?.clientEventId).toBe('string')
  expect((payload?.clientEventId as string).length).toBeGreaterThan(0)

  await clearRoomEntry(page)
})

// ── New contract-gap tests ───────────────────────────────────────────────────

test('versus: joining a non-existent room shows an error, not a crash', async ({ page }) => {
  /**
   * When the join endpoint returns 404, the UI must surface an error message
   * and must NOT render the game board.
   */
  await mockPuzzleStream(page, fakePuzzle)
  await seedDailyPuzzle(page)

  await page.route('**/api/versus/room/GONE1/join', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Room not found' }),
    })
  })
  await page.route('**/api/versus/room/GONE1', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Room not found' }),
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'GONE1', role: 'x' }))
  })

  await page.goto('/')
  // No user interaction needed — auto-resume fires on mount

  // Lobby opens automatically; humanizeError maps "Room not found" →
  // "We couldn't find a match with that code."
  await expect(page.getByText(/couldn't find a match|not found/i).first()).toBeVisible({
    timeout: 8_000,
  })

  // No active online match — "End Online Match" button must not be present
  await expect(page.getByRole('button', { name: 'End Online Match' })).not.toBeVisible({
    timeout: 2_000,
  })

  await page.evaluate(() => localStorage.removeItem('gg_online_versus_room'))
})

test('versus: joining an expired room shows an error, not a crash', async ({ page }) => {
  /**
   * When the join endpoint returns 410 (room expired/closed), the UI must
   * surface an error and must NOT render the game board.
   */
  await mockPuzzleStream(page, fakePuzzle)
  await seedDailyPuzzle(page)

  await page.route('**/api/versus/room/EXPRD/join', async (route) => {
    await route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Room has expired' }),
    })
  })
  await page.route('**/api/versus/room/EXPRD', async (route) => {
    await route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Room has expired' }),
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'EXPRD', role: 'x' }))
  })

  await page.goto('/')
  // Auto-resume fires on mount; lobby opens automatically

  // humanizeError maps "Room has expired" → "That invite has expired."
  await expect(page.getByText(/invite has expired|expired/i).first()).toBeVisible({
    timeout: 8_000,
  })

  // No active online match — "End Online Match" button must not be present
  await expect(page.getByRole('button', { name: 'End Online Match' })).not.toBeVisible({
    timeout: 2_000,
  })

  await page.evaluate(() => localStorage.removeItem('gg_online_versus_room'))
})

test('versus: resuming a finished room shows finish screen, not active board', async ({ page }) => {
  /**
   * When a stored room entry points to a room whose status is 'finished',
   * the UI must show a finished/result screen and not an active game board
   * with interactive cells.
   */
  await mockPuzzleStream(page, fakePuzzle)
  await seedDailyPuzzle(page)

  const puzzleId = 'versus-finished-test'
  const fakeRoom = {
    id: 'room-fin',
    code: 'FINSH',
    status: 'finished',
    match_number: 1,
    puzzle_id: puzzleId,
    puzzle_data: { ...fakePuzzle, id: puzzleId, is_daily: false, date: null },
    host_session_id: 'h',
    guest_session_id: 'g',
    settings: {
      stealRule: 'off',
      timerOption: 'none',
      disableDraws: false,
      objectionRule: 'off',
      categoryFilters: {},
    },
    state_data: {
      guesses: Array(9).fill(null),
      guessesRemaining: 0,
      currentPlayer: 'x',
      stealableCell: null,
      winner: 'x',
      pendingFinalSteal: null,
      objectionsUsed: { x: 0, o: 0 },
      turnDeadlineAt: null,
    },
    turn_deadline_at: null,
    created_at: new Date().toISOString(),
  }

  await page.route('**/api/versus/room/FINSH/join', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom, role: 'x' }),
    })
  })
  await page.route('**/api/versus/room/FINSH', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom }),
    })
  })
  await page.route('**/api/versus/room-events/room-fin', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })
  await mockRoomStateSave(page)

  await page.addInitScript(() => {
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'FINSH', role: 'x' }))
  })

  await page.goto('/')
  // Auto-resume fires on mount; lobby opens automatically showing finished state

  // Lobby renders "That match has already finished." for phase='finished'
  await expect(page.getByText(/already finished/i).first()).toBeVisible({ timeout: 8_000 })

  // Active board must not be present
  await expect(page.getByRole('button', { name: 'End Online Match' })).not.toBeVisible({
    timeout: 2_000,
  })

  await page.evaluate(() => localStorage.removeItem('gg_online_versus_room'))
})

test('versus: stale match rejection from server triggers board refresh', async ({ page }) => {
  /**
   * When the event endpoint returns 409 stale_match, the client should fire a
   * catch-up fetch against room-events and must NOT commit the guess to the board.
   *
   * We verify the catch-up by checking that room-events is requested after the
   * event rejection, and that the guess does not appear on the board.
   */
  const catchUpRequests: string[] = []
  const puzzleId = 'versus-stale-test'

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
      body: JSON.stringify(fakeGuessResponse()),
    })
  })

  await page.route('**/api/versus/event', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Stale match', code: 'stale_match' }),
    })
  })

  // Catch-up endpoint — track calls
  await page.route('**/api/versus/room-events/room-stale', async (route) => {
    catchUpRequests.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })
  await mockRoomStateSave(page)

  const fakeRoom = {
    id: 'room-stale',
    code: 'STALE',
    status: 'active',
    match_number: 1,
    puzzle_id: puzzleId,
    puzzle_data: { ...fakePuzzle, id: puzzleId, is_daily: false, date: null },
    host_session_id: 'h',
    guest_session_id: 'g',
    settings: {
      stealRule: 'off',
      timerOption: 'none',
      disableDraws: false,
      objectionRule: 'off',
      categoryFilters: {},
    },
    state_data: null,
    turn_deadline_at: null,
    created_at: new Date().toISOString(),
  }

  await page.route('**/api/versus/room/STALE/join', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom, role: 'x' }),
    })
  })
  await page.route('**/api/versus/room/STALE', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom }),
    })
  })
  await page.route('**/api/puzzle-stream**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
      body:
        [
          `data: ${JSON.stringify({ type: 'puzzle', puzzle: { ...fakePuzzle, id: puzzleId, is_daily: false, date: null } })}`,
          '',
          '',
        ].join('\n') + '\n',
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'STALE', role: 'x' }))
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await expect(page.getByTestId('grid-cell-0')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'End Online Match' })).toBeVisible({
    timeout: 5_000,
  })

  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('hal')
  await safeClick(page.getByRole('button', { name: /Half-Life 2/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Confirm Half-Life 2/i }))

  // Catch-up fetch must fire after stale_match rejection
  await expect.poll(() => catchUpRequests.length > 1, { timeout: 6_000 }).toBe(true)

  // Guess must NOT be committed to the board
  await expect(page.getByTestId('grid-cell-0')).not.toContainText('Half-Life 2', {
    timeout: 3_000,
  })

  await page.evaluate(() => localStorage.removeItem('gg_online_versus_room'))
})

test('versus: server returning duplicateEvent:true does not double-apply the guess', async ({
  page,
}) => {
  /**
   * When the event endpoint returns { duplicateEvent: true }, the client should
   * treat the response as a no-op and NOT apply the guess a second time.
   *
   * We seed a board where cell 0 is empty, submit a guess, and get a
   * duplicateEvent response. The guess must appear at most once on the board.
   */
  const capturedClaimBodies: Array<Record<string, unknown>> = []
  const puzzleId = 'versus-dedup-test'

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
      body: JSON.stringify(fakeGuessResponse()),
    })
  })

  await page.route('**/api/versus/event', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    if ((body as { type?: string }).type === 'claim') {
      capturedClaimBodies.push(body)
    }
    // Always return duplicateEvent:true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, duplicateEvent: true, type: body.type }),
    })
  })
  await mockRoomStateSave(page)

  const fakeRoom = {
    id: 'room-dedup',
    code: 'DEDUP',
    status: 'active',
    match_number: 1,
    puzzle_id: puzzleId,
    puzzle_data: { ...fakePuzzle, id: puzzleId, is_daily: false, date: null },
    host_session_id: 'h',
    guest_session_id: 'g',
    settings: {
      stealRule: 'off',
      timerOption: 'none',
      disableDraws: false,
      objectionRule: 'off',
      categoryFilters: {},
    },
    state_data: null,
    turn_deadline_at: null,
    created_at: new Date().toISOString(),
  }

  await page.route('**/api/versus/room/DEDUP/join', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom, role: 'x' }),
    })
  })
  await page.route('**/api/versus/room/DEDUP', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ room: fakeRoom }),
    })
  })
  await page.route('**/api/versus/room-events/room-dedup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })
  await page.route('**/api/puzzle-stream**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
      body:
        [
          `data: ${JSON.stringify({ type: 'puzzle', puzzle: { ...fakePuzzle, id: puzzleId, is_daily: false, date: null } })}`,
          '',
          '',
        ].join('\n') + '\n',
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('gg_online_versus_room', JSON.stringify({ code: 'DEDUP', role: 'x' }))
  })

  await page.goto('/')
  await safeClick(page.getByRole('button', { name: 'Versus' }))
  await expect(page.getByTestId('grid-cell-0')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'End Online Match' })).toBeVisible({
    timeout: 5_000,
  })

  // Submit a guess
  await safeClick(page.getByTestId('grid-cell-0'))
  await page.getByPlaceholder('Search for a video game...').fill('hal')
  await safeClick(page.getByRole('button', { name: /Half-Life 2/i }))
  await expect(page.getByText('Confirm this answer?')).toBeVisible()
  await safeClick(page.getByRole('button', { name: /Confirm Half-Life 2/i }))

  // Wait for at least one claim event to be recorded
  await expect.poll(() => capturedClaimBodies.length >= 1, { timeout: 5_000 }).toBe(true)

  // Cell 0 must contain the game name at most once — duplicateEvent must not double-apply
  const cellText = await page.getByTestId('grid-cell-0').textContent()
  const occurrences = (cellText ?? '').split('Half-Life 2').length - 1
  expect(occurrences).toBeLessThanOrEqual(1)

  await page.evaluate(() => localStorage.removeItem('gg_online_versus_room'))
})

test('objection flow — sustained verdict updates button label in modal', async ({ page }) => {
  /**
   * Exercises the full client-side objection flow in daily mode where clicking
   * a filled cell unconditionally opens the guess details modal:
   *
   *  1. Daily board starts with an incorrect guess on cell 0.
   *  2. Player clicks cell 0 → GuessDetailsModal opens.
   *  3. Player clicks "Objection!" → /api/objection called.
   *  4. Server returns { verdict: 'sustained' }.
   *  5. Button label inside the modal changes to "Objection sustained".
   *
   * Note: in versus mode filled cells don't open the detail modal (they are
   * only interactable for steals), so this test uses daily mode instead.
   */
  await mockPuzzleStream(page, fakePuzzle)

  const today = new Date().toISOString().slice(0, 10)
  await page.addInitScript(
    ([key, state]) => {
      window.localStorage.setItem(key as string, JSON.stringify(state))
    },
    [
      `gamegrid_daily_state:${today}`,
      {
        puzzleId: fakePuzzle.id,
        puzzle: fakePuzzle,
        date: today,
        guesses: [
          {
            gameId: 99,
            gameName: 'Wrong Game',
            gameImage: null,
            isCorrect: false,
            matchedRow: false,
            matchedCol: true,
            objectionUsed: false,
            objectionVerdict: null,
            objectionExplanation: null,
            objectionOriginalMatchedRow: null,
            objectionOriginalMatchedCol: null,
          },
          ...Array(8).fill(null),
        ],
        guessesRemaining: 8,
        isComplete: false,
      },
    ]
  )

  await page.route('**/api/objection', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verdict: 'sustained',
        confidence: 'high',
        explanation: 'The judge agrees this pick fits the intersection.',
      }),
    })
  })

  // Silence the objection persistence PATCH so it does not leak to the real
  // Supabase-backed server and produce noise in the dev-server log.
  await page.route('**/api/guess', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }
    await route.fallback()
  })

  await page.goto('/')

  // Cell 0 has an incorrect guess — clicking it opens the guess details modal
  await expect(page.getByTestId('grid-cell-0')).toBeVisible({ timeout: 10_000 })
  await safeClick(page.getByTestId('grid-cell-0'))

  // Scope all assertions to the dialog to avoid ambiguity with cell text
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 5_000 })
  await expect(modal.getByRole('heading', { name: 'Wrong Game' })).toBeVisible()

  // Objection button must be present and enabled
  const objectionBtn = modal.getByRole('button', { name: 'Objection!' })
  await expect(objectionBtn).toBeVisible()
  await safeClick(objectionBtn)

  // After sustained verdict the button label must change
  await expect(modal.getByRole('button', { name: 'Objection sustained' })).toBeVisible({
    timeout: 5_000,
  })
})
