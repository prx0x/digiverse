# Scoring formula update (|S−n|/n)

## Confirmed formula changes

| Case | Current | New |
|---|---|---|
| Minority award | `+n` | `+|S − n| / n` |
| Majority penalty (default) | `−|S − n| / 2` | `−|S − n| / n` |
| Exact match | `+2n` | `+n` |

`n` = team pick (always 1–100), `S` = statistical target.

## Reverse (default chosen)

Keep Reverse parity and who wins/loses. Only the magnitudes change to match the new award/penalty formulas:

- Flipped majority (winning side): `+|S − n| / n` (was `+n`)
- Flipped minority (losing side): `−|S − n| / n` (was `−|S − n| / 2`)

Clash, no-pick, ties, Shield coverage, empty-bucket, Equal-To bucketing, and `FIXED_X` majority mode stay as they are.

## Code changes

Primary file: [`packages/game-engine/src/scoring.ts`](packages/game-engine/src/scoring.ts)

1. **Exact match** (~line 159): `new Decimal(item.pick)` instead of `.times(2)`; update comment/reason strings from `2x` to `+n`.
2. **Minority award** (~line 223) and **reversed majority award** (~line 267): award = `targetDecimal.minus(item.pick).abs().dividedBy(item.pick)`.
3. **Majority deduction** `calcDeduction` (~lines 212–218): for non-`FIXED_X` modes (including default `HALF_ABS_DISTANCE`), return `|S − n| / n` instead of `/ 2`. Leave `FIXED_X` branch unchanged.

## Tests

Update expected deltas in:

- [`packages/game-engine/src/engine.test.ts`](packages/game-engine/src/engine.test.ts) — normal, exact-match, and Reverse cases
- [`apps/server/src/gameEngine.test.ts`](apps/server/src/gameEngine.test.ts) — same scenario numbers if asserted

Example with mean target `S=40`, picks 10 / 20 / 90:

- Minority (90): `+|40−90|/90 = 50/90`
- Majority (10): `−|40−10|/10 = −3`
- Majority (20): `−|40−20|/20 = −1`
- Exact match pick `n`: `+n` (was `+2n`)

## Docs / admin labels (same rule text only)

Update formula wording where the old rules are stated; do not invent new game rules:

- [`OPEN_RULE_DECISIONS.md`](OPEN_RULE_DECISIONS.md) — summary table, OPEN-002, OPEN-003, Equal-To `2×` mentions
- [`MEMORY.md`](MEMORY.md) — scoring bullet
- [`apps/web/src/pages/AdminSettingsPage.tsx`](apps/web/src/pages/AdminSettingsPage.tsx) — `HALF_ABS_DISTANCE` label from `|StatValue - Pick| / 2` to `|StatValue - Pick| / Pick`
- [`README.md`](README.md) only if it states the old numeric formulas

Keep enum key `HALF_ABS_DISTANCE` (no DB migration); change its implemented formula and UI/docs text only.

## Out of scope

No changes to clash `(2/3)n`, no-pick `1/10`, ties, Shield, Peek/Reserve, bucketing, or other admin modes beyond the default majority formula above.
