# Online Versus

These notes cover the current online-versus architecture, setup requirements, and the main limits
to keep in mind while the feature is still being hardened.

## Table Of Contents

- [Current Shape](#current-shape)
- [Supabase Setup](#supabase-setup)
- [How Sync Works](#how-sync-works)
- [Snapshot Save Discipline](#snapshot-save-discipline)
- [Current Limits](#current-limits)
- [Future Same-Room Rematch](#future-same-room-rematch)

## Current Shape

Online versus currently uses:

- backend routes for room creation, join, finish, puzzle publish, event append, and snapshot saves
- Supabase Realtime subscriptions for live room and event updates
- a room snapshot (`versus_rooms.state_data`) for rejoin/reload after a page refresh
- a host-driven in-room continue flow after game end that clears the prior match and reuses the
  invite code for the next board

The model is intentionally split:

- `host_session_id` / `guest_session_id` remain the stable room owners
- `state_data.roleAssignments` decides who is currently `X` and `O`
- host-only routes still control room lifecycle (`continue`, puzzle publish, finish-room flow)
- gameplay auth (`claim`, `miss`, `steal`, `objection`) follows the current `X/O` assignment

The intended authority chain today is:

1. both host and guest drive local state forward by processing events as they arrive via Realtime
2. the host additionally writes a canonical snapshot after each state change
3. on rejoin or page reload, clients hydrate from the snapshot if one exists — otherwise from event
   history
4. events are the live sync primitive during active play; snapshots are the persistence primitive
   for reload/rejoin

That gives the server meaningful authority over move legality and room state transitions, though the rematch lifecycle and some edge cases around disconnection are still lightweight.

## Supabase Setup

Run these migrations in order:

```text
scripts/008_create_versus_tables.sql
scripts/009_add_online_versus_room_state.sql
scripts/010_expand_versus_event_types.sql
scripts/011_add_online_versus_match_number.sql
scripts/012_update_expires_at_defaults.sql
scripts/013_cleanup_fn_security_definer.sql
```

Then publish these tables to Supabase Realtime:

```text
versus_rooms
versus_events
```

The current schema intentionally keeps only public `SELECT` policies for these tables so Realtime
subscriptions can function. Writes are expected to go through backend routes, not direct client DB
mutation.

## How Sync Works

### Rooms

`versus_rooms` stores:

- invite code
- host/guest anonymous session ownership
- room status
- rules/settings
- published puzzle
- current snapshot state

### Events

`versus_events` is the append-only room event log. It currently carries:

- `claim`
- `miss`
- `objection`
- `steal`
- `ready`
- `rematch`

Both host and guest subscribe to `versus_events` inserts via Realtime. Each client processes
incoming events from the opponent to advance their local board state. The event processing loop
deduplicates by event ID (`appliedOnlineEventIdsRef`) so Realtime re-delivery and history-fetch
overlap are both safe.

During `isHydratingHistory` (while event history is being fetched over HTTP on join/rejoin),
animations and overlay cues are suppressed so fetched history replays silently.

### Snapshots

`state_data` is the rejoin/reload payload. It currently tracks:

- puzzle id
- guesses
- guesses remaining
- current player
- winner
- steal/final-steal state
- objections used
- role assignments for the active match
- turn deadline / duration

Snapshots are **not** used for live sync during active play. They are written by the host after
each state change so a page reload or network drop can resume without replaying the full event log.
When a client rejoins and `state_data` is present, it hydrates from the snapshot directly.

## Snapshot Save Discipline

`game-client.tsx` serialises all snapshot saves through `enqueueSaveSnapshot(snapshot, onConfirmed?)`:

- **In-flight guard**: if a save is already in flight, the newest snapshot is queued (at most one
  pending). Earlier queued snapshots are dropped (newest-wins).
- **Deduplication**: saves whose JSON signature matches `lastSavedOnlineSnapshotRef` are skipped;
  `onConfirmed` is called immediately in that case.
- **Queue drain**: after each save completes, the pending snapshot is saved if its signature
  differs from what was just confirmed. The callback from a dropped earlier snapshot is not
  called — only the callback attached to the snapshot that actually lands is called.
- **Confirmed-only ref updates**: `lastSavedOnlineSnapshotRef` and `lastAppliedOnlineSnapshotRef`
  are updated only inside the `.then()` success branch, never before the request resolves.
- **Finish path**: the final snapshot before calling `markFinished` is saved via
  `enqueueSaveSnapshot(finalSnapshot, () => { void markFinished() })` so the finish request only
  fires after the snapshot write is confirmed.

Both `saveSnapshot` and `markFinished` in `use-online-versus-room.ts` carry an 8-second
`AbortController` timeout and return `{ ok: false, error: 'Request timed out.' }` on abort.

## Objection Authority

Online objections now have two server-owned stages:

1. `POST /api/objection`
   - reviews the guess with Gemini
   - returns the visible verdict/explanation
   - for sustained verdicts, also returns a short-lived signed proof tied to:
     - `gameId`
     - row category
     - column category
     - verdict = `sustained`
2. `POST /api/versus/event`
   - validates turn legality, objection limits, and live room state
   - verifies the signed proof for sustained online objections
   - rebuilds the authoritative guess from resolved IGDB details before inserting the event

That proof step exists because a sustained objection can be correct even when plain
`validateIGDBGameForCell()` would still reject the game due to incomplete metadata.

## Timer Behavior

- Online turn timers pause while an objection review is pending.
- Once Judge Gemini returns, the objection event is applied and the timer resumes from the updated
  authoritative state.

## Current Limits

The online loop is real enough to play, but these caveats still matter:

- **Server-side gameplay validation covers move legality** — the event route (`POST /api/versus/event`) rejects wrong-turn actions, illegal claims/steals, objection overuse, and post-finish writes, and rejects stale requests from an older `match_number`. The state route additionally guards writes with `status = active` and `match_number` checks so stale clients cannot overwrite finished-room state. Remaining gaps are around broader room lifecycle modeling rather than move legality.
- **No automatic guest finish trigger** — if the host disconnects before calling `markFinished`,
  the guest's board stays in the active phase. The guest can call `markFinished` manually but
  nothing triggers it automatically.
- **Failed non-final snapshot has no auto-retry** — if `saveSnapshot` fails and no subsequent
  state change queues another save, that state version is never retried. The next move will produce
  a new save attempt. This is acceptable for now but is not "reliable eventual delivery."
- **In-room continue is boundary-safe but still lightweight** — `Continue In Room` now advances a
  `match_number` on the room and scopes event replay/history to that boundary, so old events no
  longer leak into the next game. It still does not have a ready-check handshake or richer rematch
  lifecycle.
- **Room control is still host-owned** — the host remains responsible for continuing the room and
  publishing the next board, even when the prior winner becomes the next match's `X`.
- **`New Online Room`** remains the clean escape hatch when you want a fresh invite code.

So the current feature should be treated as:

- playable
- reviewable in a preview deployment
- not yet fully hardened like the local-versus flow

## Future Same-Room Rematch

Online play now carries a lightweight room-level match boundary via `match_number` on both
`versus_rooms` and `versus_events`, and history fetches are scoped to the current match. That fixes
the worst replay/hydration leak from the earlier "clear events and reuse the room" approach.

There is still room to harden the rematch model further if the product should support richer
multi-game sessions under one invite code.

Recommended shape:

- keep `versus_rooms` as the stable invite/lobby identity
- keep the current `match_number` boundary, or later move to a dedicated `versus_room_matches`
  table keyed by `room_id` plus `match_number`
- scope `puzzle_id`, `puzzle_data`, `state_data`, and event replay to the current match

Minimum lifecycle:

1. game ends
2. host requests rematch
3. guest confirms ready
4. server advances the match boundary (`match_number` or new match row)
5. server clears current puzzle/snapshot state for the next match
6. host publishes the next puzzle
7. both clients hydrate only the new match state

Until that exists, the current in-room continue path should be treated as a pragmatic reset flow,
not a fully modeled rematch lifecycle.
