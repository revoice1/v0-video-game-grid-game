# Adding Achievements

This guide covers adding a new easter egg achievement — the kind triggered by placing a specific
game as a correct answer, which fires a custom falling-particle celebration.

## How It All Connects

```
lib/easter-eggs.ts          — config: trigger game IDs, density, timing, piece kinds
        ↓
lib/achievements.ts         — auto-registers from EASTER_EGGS (no changes needed)
        ↓
components/game/
  easter-egg-celebrations.tsx — renderPiece: draws the actual falling particles
        ↓
  game-client.tsx             — triggers and displays the overlay (no changes needed)
```

You only ever touch the first and third files.

---

## Step 1 — Define piece kinds in `lib/easter-eggs.ts`

Piece kinds are the named shapes that fall during a celebration. Add any new ones to
`EasterEggPieceKind`:

```ts
export type EasterEggPieceKind =
  | 'chex'
  | 'goop'
  // ... existing kinds ...
  | 'your-new-kind' // ← add here
  | 'your-other-kind'
```

Then add a config entry to the `EASTER_EGGS` array:

```ts
{
  achievementId: 'your-achievement-id',   // kebab-case, must be unique
  achievementTitle: 'Display Title',
  achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
  triggerGameIds: [12345],                // IGDB game ID(s) — see note below
  durationMs: 5000,                       // how long the overlay lives (ms)
  density: 36,                            // particle count at full quality (≈30–42 is typical)
  pieceKinds: ['your-new-kind', 'your-other-kind'],
},
```

**Finding IGDB game IDs:** Search at igdb.com, open the game page, and grab the numeric ID from
the URL or API response. You can add multiple IDs to `triggerGameIds` to cover sequels or ports.

The achievement title and description auto-populate in `lib/achievements.ts` from this config —
no changes needed there.

---

## Step 2 — Add a renderer in `components/game/easter-egg-celebrations.tsx`

Add one entry to `EASTER_EGG_DEFINITIONS`. Each entry spreads the config and adds `renderPiece`:

```ts
{
  ...requireEasterEgg('your-achievement-id'),
  renderPiece: (particle) => {
    if (particle.kind === 'your-new-kind') {
      return <YourPrimaryShape particle={particle} />
    }

    // fallback for 'your-other-kind'
    return <YourSecondaryShape particle={particle} />
  },
},
```

### The `particle` object

| Field      | Type                 | Example    | Description                           |
| ---------- | -------------------- | ---------- | ------------------------------------- |
| `kind`     | `EasterEggPieceKind` | `'chex'`   | Which shape to render                 |
| `size`     | CSS string           | `'18px'`   | Use for width/height of the piece     |
| `id`       | string               | `'1234-7'` | Stable key — do not use for visuals   |
| `left`     | CSS string           | `'42%'`    | Horizontal start — handled by overlay |
| `delay`    | CSS string           | `'800ms'`  | Fall delay — handled by overlay       |
| `duration` | CSS string           | `'4200ms'` | Fall duration — handled by overlay    |
| `rotate`   | CSS string           | `'-24deg'` | Initial rotation — handled by overlay |
| `drift`    | CSS string           | `'12px'`   | Horizontal drift — handled by overlay |

You only need `kind` and `size` in your renderer. Everything else is managed by
`FallingParticlesOverlay`.

### Sizing patterns

All pieces use `particle.size` (e.g. `"18px"`) as the base unit. You can scale proportionally:

```tsx
// Square piece
style={{ width: particle.size, height: particle.size }}

// Taller than wide
style={{ width: particle.size, height: `calc(${particle.size} * 1.25)` }}

// Wider than tall
style={{ width: particle.size, height: `calc(${particle.size} * 0.7)` }}
```

### Shape techniques

Pieces are plain `div`s with Tailwind and inline styles — no SVG required, but SVG works fine too.

**Rounded shapes:**

```tsx
<div
  className="rounded-full bg-[#FF6B6B]"
  style={{ width: particle.size, height: particle.size }}
/>
```

**Polygon clip-paths** (stars, diamonds, etc.):

```tsx
<div
  className="bg-[#FDE047]"
  style={{
    width: particle.size,
    height: particle.size,
    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', // diamond
  }}
/>
```

**Composed shapes** (multiple divs positioned absolutely inside a `relative` container):

```tsx
<div className="relative" style={{ width: particle.size, height: `calc(${particle.size} * 1.1)` }}>
  <div className="absolute inset-x-[15%] top-[10%] h-[60%] rounded-full bg-[#60A5FA]" />
  <div className="absolute left-1/2 bottom-0 h-[20%] w-[30%] -translate-x-1/2 bg-[#3B82F6]" />
</div>
```

**Glow effects:**

```tsx
className = 'shadow-[0_6px_18px_rgba(246,195,91,0.35)]' // warm glow
className = 'shadow-[0_0_18px_rgba(99,224,196,0.5)]' // neon glow
```

---

## Step 3 — Verify

```bash
npm run typecheck   # catches missing kinds or broken renderPiece signatures
npm run dev         # trigger the easter egg in-game to see the celebration
```

While `npm run dev` is running, `/confetti` gives you a dev-only particle preview sheet for every
achievement piece at multiple sizes. It 404s in production, so it is safe to use as a local
authoring tool while polishing shapes.

There is no test required for the visual shape itself, but you should add the trigger game ID
to the existing easter egg achievement tests if they cover unlock behavior.

---

## Density and timing reference

| Field        | Typical range | Notes                                                     |
| ------------ | ------------- | --------------------------------------------------------- |
| `density`    | 30–42         | Scaled down automatically at medium/low animation quality |
| `durationMs` | 5000–5200     | Overlay lifetime; actual particle lifetime may be longer  |

The overlay auto-extends if any particle's `delay + duration` exceeds `durationMs`, so you
don't need to pad this manually.

---

## Non-easter-egg achievements

Achievements like **Perfect Grid** and **Real Stinker** are not triggered by a specific game ID —
they fire on game events. Their celebrations live directly in `game-client.tsx` as
`triggerPerfectCelebration` and `triggerRealStinkerCelebration`. If you add a new event-based
achievement, follow that same pattern: add the achievement to `lib/achievements.ts`, add a
trigger function in `game-client.tsx`, and call it from the relevant event handler.
