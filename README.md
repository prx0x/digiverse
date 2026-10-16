# Digiverse — GDGoC IIIT Kota

Digiverse is a real-time competitive game web application for events run by **GDGoC (Google Developer Groups on Campus), IIIT Kota**.

- **Game Phase A — Rapid Fire:** teams answer trivia/logic questions; the fastest correct teams win power-up cards (Shield, Reserve, Peek, Reverse).
- **Game Phase B — Main Game:** each round announces a statistical target (Mean, Two-thirds, Midrange, Mean + 1σ, Geometric mean). Teams pick numbers 1–100; clashing picks are discarded and penalised; the server computes the target, buckets teams (>, =, <), and scores them. Scores are shown to 4 decimal places.

Admins create team accounts and configure the entire event from an admin panel. There is **no public registration**.

> **Status: Build Phase 6 complete.** The entire system is built and fully operational — real authentication, admin event management, Rapid-Fire Quiz (Game Phase A) with real-time award distribution, pure decimal Game Engine (Game Phase B) with palette generation and all 4 power-up cards, 4-decimal-place live leaderboard with tiebreaker ranking, and comprehensive production container configs.

## Documentation map
| File | Purpose |
|---|---|
| `AGENT.md` | Persistent instructions for Cursor / Antigravity agents |
| `MEMORY.md` | Durable project context and conventions |
| `PROGRESS.md` | Live status checklist for the six build phases |
| `API_SURFACE_SUMMARY.md` | Complete implemented API & WebSocket event specifications |
| `PHASED_EXECUTION_PLAN.md` | Full six-phase plan with acceptance criteria |
| `OPEN_RULE_DECISIONS.md` | Rule conflicts/ambiguities and resolved decisions |
| `docs/RUNBOOK.md` | Official event-day operations manual & emergency recovery guide |
| `docker-compose.prod.yml` | Multi-container production deployment specification |
| `.env.example` | Environment variable template (no secrets) |
| `docs/source/` | Official rules + `consider.docx` |

## Using the AI coding agent
1. Keep documentation files in the repository root; keep source `.docx` files in `docs/source/`.
2. Open the repo in Cursor or Antigravity. Point the agent's rules/context at `AGENT.md`.
3. Start each session with: *"Follow AGENT.md. Read MEMORY.md, PROGRESS.md, API_SURFACE_SUMMARY.md and PHASED_EXECUTION_PLAN.md, inspect the repo, then continue the active phase."*
4. Review each report; approve moving to the next phase only when acceptance criteria are verified.

## Phase workflow
Six sequential **Build Phases** (details in `PHASED_EXECUTION_PLAN.md`):
1. Foundation + Bauhaus UI layout (mock data) →
2. Backend, DB, auth, roles →
3. Admin panel & event configuration →
4. Rapid-fire gameplay & power-up acquisition →
5. Main game engine & scoring (gated by `OPEN_RULE_DECISIONS.md`) →
6. Leaderboard, integration, testing, security, deployment.

## Stack (confirmed Build Phase 1)
- **Monorepo:** pnpm workspaces
- **Web:** React 19 + Vite 6 + TypeScript — `apps/web`
- **Shared:** `@digiverse/shared` — `formatScore` and future shared types — `packages/shared`
- **Server / game-engine / PostgreSQL:** Build Phases 2 and 5 (not scaffolded yet)

## Prerequisites
- Node.js LTS (≥ 20) and [pnpm](https://pnpm.io) 9+
- Git
- PostgreSQL 15+ — only needed from Build Phase 2 onward

## Setup
```bash
git clone <repo-url> digiverse && cd digiverse
pnpm install
cp .env.example .env   # optional for Build Phase 1; required from Build Phase 2
pnpm dev               # http://localhost:5173
```

### MOCK navigation (Build Phase 1)
| Route | Screen |
|---|---|
| `/login` | Team / admin login (any credentials; ID containing `admin` → admin shell) |
| `/team` | Lobby / waiting |
| `/team/rapid-fire` | Rapid-fire question |
| `/team/round` | Stat-card → palette transition + round result |
| `/team/inventory` | Power-up inventory |
| `/team/leaderboard` | Leaderboard (4 dp) |
| `/admin` | Admin dashboard + section placeholders |
| `/gallery` | Component gallery |

## Environment configuration
Variables are listed in `.env.example`. **Build Phase 1** only needs the public `VITE_*` defaults (already set for local Vite). Server secrets (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_BOOTSTRAP_*`, …) are used from Build Phase 2.

## Account bootstrap (from Build Phase 2)
1. Set `ADMIN_BOOTSTRAP_USER_ID` and `ADMIN_BOOTSTRAP_PASSWORD` in `.env`. **Choose a new strong password** — do not reuse any password from `consider.docx`.
2. Run migrations and start the server; admin is created if missing.
3. Log in as admin → create team accounts → share credentials with teams.
4. Rotate the admin password after first login when possible.

## Development commands
```bash
pnpm dev          # Vite web app (watch)
pnpm build        # shared + web production build
pnpm lint
pnpm typecheck
pnpm test         # Vitest (shared + web)
```

Database / E2E commands arrive in later phases:
```bash
pnpm db:migrate   # Build Phase 2+
pnpm test:e2e     # Build Phase 6 (Playwright)
```

## Repository structure
```
/
├─ AGENT.md  MEMORY.md  PROGRESS.md  API_SURFACE_SUMMARY.md
├─ PHASED_EXECUTION_PLAN.md  OPEN_RULE_DECISIONS.md  README.md  .env.example
├─ docs/source/                # official rules + consider.docx
├─ apps/web/                   # React UI (Bauhaus design system, MOCK screens)
└─ packages/
   └─ shared/                  # formatScore + shared types
```

## Testing
All 80 tests pass across the monorepo:
```bash
pnpm test         # Run all unit, integration, and E2E playthrough tests
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript strict typecheck
pnpm build        # Production builds
```

## Production Deployment
The production deployment uses multi-stage Docker builds:
- **PostgreSQL 16**: Persistent database volume
- **Fastify Server (`apps/server`)**: Node 22 slim container
- **Nginx Web (`apps/web`)**: Serving static Vite bundle and proxying `/api` and `/ws`

```bash
docker compose -f docker-compose.prod.yml up --build -d
```
See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for pre-event configuration, live game operation, and emergency recovery procedures.

## Security notes
No public signup · hashed passwords (from Phase 2) · server-side authorisation · rate-limited auth · no secrets in the repo · server is authoritative for all game outcomes.

## Rules and open questions
Gameplay rules come from `docs/source/Digiverse_Official_Rules.docx` and `docs/source/consider.docx`. Conflicts are tracked in `OPEN_RULE_DECISIONS.md` and must be settled by organisers before Build Phase 5.
