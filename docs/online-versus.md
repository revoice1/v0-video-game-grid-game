# Online Versus

These notes cover the current online-versus architecture, setup requirements, and the main limits
to keep in mind while the feature is still being hardened.

## Table Of Contents

- [Current Shape](#current-shape)
- [Supabase Setup](#supabase-setup)
- [How Sync Works](#how-sync-works)
- [Current Limits](#current-limits)
- [Future Same-Room Rematch](#future-same-room-rematch)

## Current Shape

Online versus currently uses:

- backend routes for room creation, join, finish, puzzle publish, event append, and snapshot saves
- Supabase Realtime subscriptions for live room and event updates
- a room snapshot (`versus_rooms.state_data`) for faster resume after refresh
- a host-driven in-room continue flow after game end that clears the prior match and reuses the
  invite code for the next board

The intended authority chain today is:

1. host drives gameplay forward locally
2. host writes the canonical snapshot
3. guest follows the room snapshot for state
4. events remain useful for history, replay, and some overlay/spectacle cues

That is safer than fully client-public writes, but it is not yet the final authoritative model.

## Supabase Setup

Run these migrations in order:

```text
scripts/008_create_versus_tables.sql
scripts/009_add_online_versus_room_state.sql
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

### Snapshots

`state_data` is the main resume/sync payload. It currently tracks:

- puzzle id
- guesses
- guesses remaining
- current player
- winner
- steal/final-steal state
- objections used
- turn deadline / duration

Reload and rejoin should prefer snapshot hydration over full event replay when the room already has
`state_data`.

## Current Limits

The online loop is real enough to play, but these caveats still matter:

- the server event route still does not fully enforce authoritative move legality
- reload/rejoin is much better than before, but still not as seamless as purely local versus
- post-game host-side `Continue In Room` resets the room in place, but it still clears old events
  and does not yet use a true match boundary or ready-check handshake
- `New Online Room` still exists as the clean escape hatch when you want a fresh invite code
- some remote-side spectacle paths are still more fragile than the underlying board sync

So the current feature should be treated as:

- playable
- reviewable in a preview deployment
- not yet fully hardened like the local-versus flow

## Future Same-Room Rematch

If online play should support multiple games under one invite code, the room needs a real match
boundary inside it. Reusing the same room without scoping events and snapshot state per match will
cause reload hydration and event replay to leak old games into new ones.

Recommended shape:

- keep `versus_rooms` as the stable invite/lobby identity
- add either a `versus_room_matches` table keyed by `room_id` plus `match_number`, or a
  `match_number` column on both `versus_rooms` and `versus_events`
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
