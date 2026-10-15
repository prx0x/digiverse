# MEMORY.md — Durable Project Context

> Enduring knowledge only. Live status belongs in `PROGRESS.md`. Do not record guesses as facts: anything unconfirmed is tagged **[PROVISIONAL]** until verified in the repository or confirmed by the user.

## 1. Purpose
**Digiverse** is a competitive strategy game web app run by **GDGoC (Google Developer Groups on Campus), IIIT Kota**. Teams first win power-up cards in a rapid-fire quiz (Game Phase A), then play a number-picking game theory game (Game Phase B) scored against statistical targets. Admins configure and run the event; teams play from their own accounts.

## 2. Sources of truth
| File | Role | Citation tag |
|---|---|---|
| `docs/source/Digiverse_Official_Rules.docx` | Published gameplay rules | **[R]** |
| `docs/source/consider.docx` | Additional implementation requirements/specs from the organisers | **[C]** |

Both must be kept in the repository under `docs/source/` for reference. Where they conflict, see `OPEN_RULE_DECISIONS.md`. Rulebook footnotes: the value **X** may be set by organisers during the game; GDGoC has final authority on interpretation; organisers may amend rules (communicated before the respective game).

Information classes used in all docs:
- **EXPLICIT** — stated in a source document.
- **ENGINEERING** — implementation decision needed to build it, not a gameplay rule.
- **OPEN** — ambiguous/conflicting; tracked in `OPEN_RULE_DECISIONS.md`.

## 3. Terminology
- **Build Phase 1–6**: software delivery stages. **Game Phase A (Rapid Fire)** / **Game Phase B (Main Game)**: gameplay stages ([R] calls them Phase 1/Phase 2).
- **Team**: the playing unit; one login account per team (admin-created).
- **Stat Card / Statistical Card / Formula**: the round's target rule, chosen by admin per round, shown before the palette. Types (EXPLICIT [C],[R]): Mean; Two-thirds (2/3 of the mean); Midrange ((lowest+highest)/2); Mean + 1σ; Geometric mean — all over **non-conflicting picks**.
- **Palette**: the 1–100 number selection screen; layout is randomised per team, per round (EXPLICIT [C]); all 100 values retained (ENGINEERING per master brief).
- **Pick**: a team's selected number for a round. **Locked-in**: a pick that has been committed.
- **Clash**: two or more teams pick the exact same number; those picks are discarded from calculations and the teams are penalised.
- **Target / Statistical Value**: the computed number from the Stat Card.
- **Buckets**: Greater Than (> Target), Equal To (= Target), Less Than (< Target).
- **Majority / Minority bucket**: among > and <, the one with most / fewest teams.
- **Power-up cards** (EXPLICIT [R]): **Shield** (pre-round), **Reserve** (pre-round, only 1 in the game), **Peek** (during-round), **Reverse** (during-round).
- **X**: the penalty-points parameter in [R]; organiser-determined. Conflicts with [C] formulas (see OPEN-001/002).
- **Round lifecycle** ([R]): Lobby (formula announced, pre-round cards) → Selection (palette opens, timed, during-round cards) → Clash Resolution → Statistical Calculation → Bucketing → Scoring.

## 4. Confirmed requirements snapshot (EXPLICIT)
- No self-registration; admin-managed credentials ([C] "Userlogin").
- Leaderboard precise to 4 decimal places ([C]).
- Animated transition from stat card to palette ([C]).
- Admin panel: map power-up card to question; top-X teams (sorted by time, then correctness) get the card; number of question sets; number of rounds in **both** game phases; which round has which stat card; live view of who picked what, "every detail" ([C]).
- Rapid-fire questions are decided later via admin panel — never hardcoded ([C]).
- Scoring ([R]): Equal-To = 2× selected number; Minority bucket = + selected number; Majority bucket = deduction; tie between > and < bucket sizes ⇒ all teams in those two buckets score 0 (equal-To teams still get 2×). Reverse flips Majority/Minority win/lose.
- Winning ([R]): highest overall points after all rounds.

## 5. Design system rules (Bauhaus) — established in Build Phase 1
- Palette: **red, yellow, blue, black, off-white** only, via CSS custom properties in `apps/web/src/styles/tokens.css` (+ typed mirror `tokens.ts`). Semantic mapping: blue = primary/info, red = danger/penalty/clash, yellow = highlight/selection/cards, black = text/structure, off-white = background.
- Geometry: circles, squares, rectangles, bold rules/lines, modular grid panels; asymmetric yet balanced; **square or minimally-rounded corners** (`--radius-sm: 2px`); no glassmorphism, no decorative gradients, hard offset shadow token only (`--shadow-hard`).
- Typography: **Archivo Black** (display) + **IBM Plex Sans** (body) + **IBM Plex Mono** (tabular scores/timers).
- Tokens required for: colour, type scale, spacing, borders, shapes, motion durations/easings, component states, z-index — all present in `tokens.css`.
- Accessibility: WCAG AA contrast targets, keyboard navigation, visible `:focus-visible` ring, ≥44px touch targets (`--size-touch-min`), `prefers-reduced-motion` alternatives (cross-fade/instant; loading spinner disabled), colour never the sole state signal (shape/text on tiles, pills, cards).
- Required distinct screens: team login, team lobby/home, rapid-fire question, stat-card announcement, number palette, power-up inventory, round result, leaderboard, admin dashboard + admin subsections — all present as MOCK routes under `apps/web`.
- Identity: text-based `Wordmark` component ("DIGIVERSE · GDGoC IIIT Kota") until an official logo asset is supplied. Never fabricate a logo.
- Build Phase 1 owns the shell, nav, tokens, and component library. Later phases extend; they do not redesign.
- ESLint rule in `apps/web` bans hardcoded hex colour literals in TS/TSX; colours live in `tokens.css` only.

## 6. Security constraints
- Admin is bootstrapped from env vars; password hashed; no credentials in repo, docs, frontend bundle, or tests. The source `consider.docx` contains a plaintext initial admin credential — treat it as **compromised-by-distribution**; organisers should set a fresh value in the deployment environment.
- Role-based access control enforced server-side (roles: `admin`, `team`).
- Rate limit auth + sensitive actions; validate all input; secure session/token; CORS allow-list; no secrets in logs.
- Team clients never receive other teams' picks, palettes, or inventories. Admin may see live picks (EXPLICIT [C]).
- Server timestamps are authoritative for rapid-fire ranking and round timers.

## 7. Architecture decisions
**Confirmed in Build Phase 1 (2026-10-15)** after inspecting an empty docs-only repository:

| Layer | Choice | Location |
|---|---|---|
| Package manager | pnpm workspaces (`pnpm@9`) | root `pnpm-workspace.yaml` |
| Web | React 19 + Vite 6 + TypeScript (strict) | `apps/web` |
| Shared utils/types | TypeScript package | `packages/shared` (`formatScore` live) |
| Server | Node.js + Fastify 5 + TypeScript + Drizzle ORM | `apps/server` (implemented in Build Phase 2) |
| Game engine | Pure TS + `decimal.js` | **deferred to Build Phase 5** (`packages/game-engine` not created yet) |
| Database | PostgreSQL 16 + Drizzle ORM | `docker-compose.yml`, `apps/server/src/db/schema.ts` |
| Real-time | WebSocket (or SSE) | Build Phase 4+ |
| Unit tests | Vitest | `apps/web`, `apps/server`, `packages/shared` |
| E2E | Playwright | Build Phase 6 |

Rationale unchanged: one language end-to-end, shared types, pure testable engine later, low hosting cost. Server runs Fastify with Drizzle ORM, argon2 password hashing, and session-based auth with CSRF double-cookie protection.

### Build Phase 1 conventions
- Mock data: only in `apps/web/src/mocks/`, labelled **MOCK** in UI banners.
- Score display: always via `formatScore()` / `<ScoreDisplay />` — exactly 4 decimal places; never round before storage (storage not yet implemented).
- Path alias: `@/*` → `apps/web/src/*`.
- Scripts (root): `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## 8. Implementation conventions (ENGINEERING)
- TypeScript strict mode; schema validation (zod) at every boundary once the server exists; shared types in `packages/shared`.
- Game logic only in `packages/game-engine` (future); handlers call it. Engine functions are pure and deterministic (inject RNG and clock).
- Money-like precision: all stats/scores as decimals; format with a single `formatScore()` (4 dp) utility; never round before storing.
- Config-driven rules: disputed rules are read from an `event_rules` configuration record validated at write time.
- Audit trail: append-only records for picks, card plays, answer submissions (server timestamps), power-up awards, target calculations, and score changes.
- Conventional commits; one small coherent task per commit; docs updated in the same change set.
