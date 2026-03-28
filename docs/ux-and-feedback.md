# UX And Feedback

## Table Of Contents

- [General Principle](#general-principle)
- [Loading](#loading)
- [Search](#search)
- [Versus](#versus)
- [Results](#results)
- [Achievements](#achievements)
- [Social / SEO Imagery](#social--seo-imagery)

## General Principle

- The board is the product.
- Supporting feedback should help the player read state, not compete with the board.

## Loading

- Puzzle generation should communicate attempt progress and per-cell validation.
- Long metadata/counting phases should feel like "finalizing" rather than a freeze.

## Search

- Search should stay legible even when metadata is scrubbed.
- Duplicate-title disambiguation should reduce bad fast-click mistakes without turning into clutter.
- Representative results can hint when hidden same-name ports exist behind the selected family.

## Versus

- Turn state needs to be obvious, but not loud enough to destabilize the header layout.
- The turn pill can show the active player's remaining objection economy when objections are enabled.
- Final steal should feel focused and dramatic.
- Alarm-driven motion should respect the versus alarm setting.
- Heartbeat and future sound cues should respect the separate `Audio` toggle.
- Custom rules like steals, objections, draws, and timer should be explained in setup and feel predictable at match end.
- The custom setup modal now groups `Rules` and `Categories` into collapsible sections and surfaces subtle `Custom` indicators when defaults change.

## Results

- Daily results can include copy/share and playerbase-oriented stats.
- Practice results should stay local and lighter.
- Versus end-state UI should allow players to keep inspecting the board after the match ends.

## Objections

- Rejected guesses can surface an `Objection!` action in the details modal.
- The sequence should feel theatrical:
  - `Objection!`
  - `Judge Gemini Reviews`
  - `Sustained` or `Overruled`
- The judgment explanation should remain attached to that square after the verdict, even if the objection is sustained and the square flips to correct.
- Sustained objections use an orange reviewed-success treatment, but only on the category the review actually rescued.
- Players only get one objection per square, so the button should lock after use.
- Versus objections should use a reduced-information review modal so live players do not get the full metadata panel for a disputed guess.

## Achievements

- Locked achievements can use simple initials or abstract tiles.
- Unlocked achievements can reveal more personality or custom art.
- Surprise matters, but readability still wins once something is earned.
- `Real Stinker` now has its own gross little falling celebration instead of only the unlock toast.

## Social / SEO Imagery

- For GameGrid, a curated static screenshot-style image is preferred over an elaborate synthetic OG card.
- Social cards should look like the real product, not a generic promo panel.
