# Category Model

## Table Of Contents

- [Philosophy](#philosophy)
- [Standard Families](#standard-families)
- [Custom / Versus Families](#custom--versus-families)
- [Company](#company)
- [Company Alias Buckets](#company-alias-buckets)
- [Platform Amalgams](#platform-amalgams)
- [Banned Pair Philosophy](#banned-pair-philosophy)
- [Regenerating Pair Bans](#regenerating-pair-bans)
- [Tag Status](#tag-status)

## Philosophy

- Standard generation should be curated and reliable.
- Custom generation can be broader, but should still start from sensible defaults.
- Categories should feel understandable to players before they feel clever to implement.

## Standard Families

Standard generation currently uses these curated families:

- Platform
- Genre
- Decade
- Company
- Game Mode
- Theme
- Perspective

## Custom / Versus Families

- Practice and versus setup reuse the same curated base.
- A few thinner categories stay available as opt-in custom-only choices rather than standard defaults.
- Custom setup should never silently widen untouched families beyond their modal defaults.

## Company

- `Company` is one player-facing family.
- A company match means `developer OR publisher`.
- Backend company role data stays split so validation can remain truthful.
- Standard company list is intentionally tighter than the custom-only pool.

Current standard-facing company pool:

- Nintendo
- Sega
- Electronic Arts
- Konami
- Activision
- Capcom
- Square Enix
- Ubisoft
- THQ
- Microsoft
- Sony

Custom-only thinner additions:

- Bandai Namco
- Atlus
- Taito
- SNK
- Koei Tecmo

## Company Alias Buckets

Some player-facing labels intentionally merge multiple backend identities.

Examples:

- `Microsoft`
  - Microsoft
  - Microsoft Game Studios
  - Microsoft Studios
  - Xbox Game Studios
- `Sony`
  - Sony Interactive Entertainment
  - Sony Computer Entertainment
  - regional Sony Computer Entertainment variants
- `Square Enix`
  - Square Enix
  - Square
  - Enix

## Platform Amalgams

Merged platform buckets should use native IGDB IDs where possible so counting and validation are fast and trustworthy.

Examples:

- `NES`
  - NES
  - Famicom
  - Famicom Disk System
- `SNES`
  - SNES
  - Super Famicom
- `PC (Windows/DOS)`
  - Windows
  - DOS

## Banned Pair Philosophy

- Standard generation uses symmetric inter-family pair bans.
- Left/right order should never matter for a banned pair.
- There are two kinds of bans:
  - intrinsic structural impossibilities
  - observed zero-result curated pairs
- The ban table should be regenerated from live counts when the curated families change.

## Regenerating Pair Bans

- Regenerate the checked-in standard ban table with `npm run regen:pair-bans`.
- The command writes:
  - [curated-standard-pair-bans.ts](../lib/curated-standard-pair-bans.ts)
  - [curated-standard-pair-ban-report.json](../scripts/generated/curated-standard-pair-ban-report.json)
- The script uses:
  - curated standard families from [versus-category-options.ts](../lib/versus-category-options.ts)
  - intrinsic rejection rules from [igdb-validation.ts](../lib/igdb-validation.ts)
  - live count checks from [igdb.ts](../lib/igdb.ts)
- Intrinsic bans and observed zero-result bans stay layered separately in the generated output.

## Tag Status

- Tag-style categories were removed from active generation and custom setup.
- The remaining tag-related backend logic is compatibility ballast for now, not an active product surface.
