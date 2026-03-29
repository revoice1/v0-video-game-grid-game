# Online Versus

These notes cover the current online-versus architecture, setup requirements, and the main limits
to keep in mind while the feature is still being hardened.

## Table Of Contents

- [Current Shape](#current-shape)
- [Supabase Setup](#supabase-setup)
- [How Sync Works](#how-sync-works)
- [Current Limits](#current-limits)

## Current Shape

Online versus currently uses:

- backend routes for room creation, join, finish, puzzle publish, event append, and snapshot saves
- Supabase Realtime subscriptions for live room and event updates
- a room snapshot (`versus_rooms.state_data`) for faster resume after refresh
- a fresh-room lifecycle after game end rather than a same-room rematch flow

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
- post-game `New Online Room` creates and hosts a fresh room; it does not carry the existing room
  forward as a same-room rematch
- some remote-side spectacle paths are still more fragile than the underlying board sync

So the current feature should be treated as:

- playable
- reviewable in a preview deployment
- not yet fully hardened like the local-versus flow
