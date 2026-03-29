# Refactor And Test Audit

This is the working checklist for the current cleanup pass after the curated-generation work.

## Table Of Contents

- [Goals](#goals)
- [Game Client Extraction Order](#game-client-extraction-order)
- [Concrete Test Gaps](#concrete-test-gaps)
- [Test Efficiency Opportunities](#test-efficiency-opportunities)
- [Suggested Execution Order](#suggested-execution-order)

## Goals

- Keep shrinking `components/game/game-client.tsx` by responsibility, not by random helper churn.
- Add tests where recent product rules are still mostly protected by manual QA.
- Make the e2e suite easier to extend without adding more repeated setup code.
- Keep the docs honest about what has already been extracted and what still carries risk.

## Game Client Extraction Order

### 1. Guess Submission And Resolution

Status:

- In progress, but much healthier than when this document started.
- Pure helper logic now lives in `components/game/game-client-helpers.ts`.
- Guess transport, post-guess state, completion effect, and daily stats helpers now live in `components/game/game-client-submission.ts`.
- Runtime helpers for filter state, miss-copy, animation quality, audio cue, and versus-record storage now live in `components/game/game-client-runtime-helpers.ts`.
- Remaining work is mostly the large async/eventful branch structure inside `handleGameSelect`.

Current hot spots:

- `hydrateGuessDetails`
- `handleCellClick`
- `handleGameSelect`

Why this should move first:

- It mixes UI intent, API calls, toast copy, duplicate prevention, save-state logic, and versus end-state resolution.
- It is the biggest concentration of "business rules hidden inside event handlers".
- It is the easiest place for subtle regressions when search/validation rules change.

Good target shape:

- `useGuessSubmission` or `useGuessResolution`
- pure helpers for:
  - duplicate detection
  - guess payload shaping
  - non-versus persistence payload shaping
  - completion effects and stats posting
  - versus win/draw/final-steal resolution

### 2. Versus Turn And Match Flow

Status:

- Started.
- Pure versus rule helpers now live in `components/game/game-client-versus-helpers.ts`.
- Final-steal cue and turn timer effect handling now live in `hooks/use-versus-turn-timer.ts`.
- The rerender-related timer starvation bug is now fixed and covered.
- The main versus gameplay spec coverage has been split into `tests/e2e/app-versus.spec.ts`.
- Remaining work is the effect/state-machine orchestration and timer flow.

Current hot spots:

- turn timer effects
- final-steal state
- disable-draws resolution
- winner banner dismissal / versus record updates

Why this should move next:

- It is already conceptually a state machine.
- The rules are fairly stable now, which makes extraction safer.
- The current logic is spread across multiple `useEffect` blocks and event branches.

Good target shape:

- `useVersusMatchController`
- `useVersusTurnTimer`
- keep only the board wiring in `game-client.tsx`

### 3. Celebration And Achievement Orchestration

Status:

- `EASTER_EGG_DEFINITIONS`, all particle helpers, and the `EasterEggCelebration` /
  `PerfectGridCelebration` components now live in
  `components/game/easter-egg-celebrations.tsx`.
- `game-client.tsx` imports these and retains only the trigger functions
  (`triggerEasterEggCelebration`, `triggerPerfectCelebration`, `triggerRealStinkerCelebration`)
  which need state access.
- `docs/adding-achievements.md` documents the full authoring workflow.

Remaining work:

- `triggerEasterEggCelebration` and friends still inline in `game-client.tsx` —
  candidate for `useCelebrationController` once the versus extraction is done.
- perfect/steal miss/showdown/double-KO overlay lifecycles
- achievement toast unlock plumbing

Why this is a good third step:

- It is visually noisy and inflates the file a lot.
- It is mostly orthogonal to puzzle loading and board rules.
- It would make the main client much easier to scan.

Good target shape:

- move `EASTER_EGG_DEFINITIONS` into a dedicated module
- extract overlay lifecycle management into `useCelebrationController`
- keep just a small render section in `game-client.tsx`

### 4. Standalone Overlay Components

Status:

- Started.
- `StealShowdownOverlay` has been extracted into its own component.
- `StealMissSplash`, `DoubleKoSplash`, and the mode start screen are now extracted.
- Remaining work is mostly celebration state ownership, not render extraction.

Why it is worth splitting:

- The largest visual branches are now decoupled from `game-client.tsx`.
- Follow-up work should focus on lifecycle/control extraction instead of more JSX-only moves.

Good target shape:

- `components/game/steal-showdown-overlay.tsx`
- optional follow-up for other overlay/splash components

### 5. Puzzle Load Orchestration

Current hot spots:

- `loadPuzzle`
- SSE event handling
- restored-state vs fresh-load branching

Why this is later:

- It already improved with `PuzzleLoadingScreen`.
- It is still a good extraction target, but it touches more route/state edges than the items above.

Good target shape:

- `usePuzzleLoader`
- pure helper to map stream events to loading-attempt state transitions

## Concrete Test Gaps

### Search And Validation

- The temporary zero-result unrated fallback has been removed, so search is back on the stricter rated path.
- Search UI now has component coverage for duplicate suffixes, `+Ports` labeling, and stale request protection.
- Still worth adding one end-to-end regression around rejected-guess details hydration so sparse detail lookups cannot silently wipe already-known metadata.

### Guess And Family Rules

- Add a focused integration/unit test for duplicate prevention behavior versus resolved family behavior.
- Add a regression test for "same family, different entry" cases so we are explicit about whether they are allowed or blocked.
- Add coverage for guess hydration failure handling so detail-modal fetch issues do not silently rot.

### Loading Flow

Progress made:

- `tests/components/puzzle-loading-screen.test.tsx` now covers:
  - daily mode copy
  - practice/versus mode copy
  - attempt note rendering
  - `OK` vs exact-count vs pending intersection states
- `hooks/use-timed-overlay-dismiss.ts` now removes three repeated timed overlay cleanup effects from `game-client.tsx`.

Still worth adding:

- a tighter state-transition test around the live upgrade from validation `OK` to metadata counts if we want to lock the stream behavior down more directly.

### Versus Rules

- There is already good coverage for final steal and disable-draws.
- Timer danger state now has both e2e coverage and component-level header coverage.
- Timer expiration plus pending final-steal interactions still deserve one more targeted case.
- Add a regression for "failed final steal with alarms off" so the no-alarm visual/audio path stays intentional.

### Achievements And Celebrations

- Achievement coverage is stronger now:
  - correct hidden trigger unlocks
  - wrong hidden trigger does not unlock
  - `Real Stinker` now has browser coverage for its falling celebration
- Add unit coverage for achievement unlock branching that is currently only protected indirectly through e2e if we want cheaper non-browser protection.
- Add at least one small render-level test for the hidden-achievement tile behavior:
  - locked shorthand
  - unlocked special icon

## Test Efficiency Opportunities

### Split The Large E2E File

`tests/e2e/app.spec.ts` used to carry the whole product surface in one file.

Better shape:

- `app-settings.spec.ts`
- `app-versus.spec.ts`
- `app-achievements.spec.ts`
- `app-search.spec.ts`
- `app-modes.spec.ts`
- `app-dev-overlays.spec.ts`

Progress made:

- `app-modes.spec.ts`
- `app-settings.spec.ts`
- `app-versus.spec.ts`
- `app-achievements-results.spec.ts`
- `app-search-ui.spec.ts`
- `app-dev-overlays.spec.ts`
- shared setup moved into `tests/e2e/test-helpers.ts`

Benefits:

- easier navigation
- narrower failures
- less review noise on future test changes

### Promote Shared Playwright Fixtures

There is already useful local helper code in `app.spec.ts`, but it should move into a shared fixture/helper layer.

Best candidates:

- seeded daily puzzle
- seeded versus state
- puzzle-stream mock
- storage/session seeding helpers

Benefits:

- less copy/paste
- faster new regression authoring
- clearer intent in each test

### Grow Component-Level Coverage Around Search

`tests/components/game-search.test.tsx` only covers immediate submit vs explicit confirm.

Progress made:

- duplicate title suffix rendering
- `+Ports` labeling

Still worth adding:

- more rejected-guess detail rendering cases if we want to lock down sparse metadata behavior at the component level

Benefits:

- less pressure on Playwright for search presentation checks
- faster iteration on search UX

### Keep Heavy Logic In Unit Tests Where Possible

Good examples already exist:

- `tests/lib/igdb.test.ts`
- `tests/lib/versus-steal.test.ts`

We should keep pushing rule-heavy logic there instead of only verifying it through browser flows.

## Suggested Execution Order

1. Keep extracting the remaining async/eventful center of `game-client.tsx`.
2. Add one more targeted versus timer/final-steal interaction regression.
3. Add a rejected-guess details regression that exercises sparse metadata preservation end-to-end.
4. Continue carving celebration/achievement orchestration out of `game-client.tsx`.
5. Do a dedicated formatting/hygiene pass when we want `npm test` to go fully green again.
