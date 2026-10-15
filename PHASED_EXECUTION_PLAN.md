# PHASED_EXECUTION_PLAN.md — Six Build Phases

Conventions: **[R]** official rulebook · **[C]** `consider.docx` · **(OPEN-nnn)** see `OPEN_RULE_DECISIONS.md`. "Build Phase" ≠ "Game Phase" (see `AGENT.md` §0). Phases are sequential; each starts only when the previous phase's acceptance criteria are verified and the user approves.

Stack is **[PROVISIONAL]** (see `MEMORY.md` §7): React + Vite + TS (`apps/web`), Node + Fastify + TS (`apps/server`), pure `packages/game-engine`, `packages/shared`, PostgreSQL, Vitest, Playwright. If the repository already contains a working stack, keep it and adapt names accordingly.

## Cross-cutting requirements (apply to every phase)
- Keep the Bauhaus design system consistent; extend, never restart.
- Server is authoritative; validate all input; protect secrets; no fake APIs.
- Tests accompany logic; lint/type-check/build must pass before a phase closes.
- Update `PROGRESS.md`, `API_SURFACE_SUMMARY.md`, `MEMORY.md`, `README.md`, `.env.example` as relevant.

---

## Build Phase 1 — Project Foundation and Basic UI Layout
**Objective:** a coherent, navigable, responsive Bauhaus visual foundation on which all later phases build.
**Dependencies:** none (repository inspection first).
**Out of scope:** real auth, database, API, scoring, real-time, real game rules. No dependency on OPEN items.

### Tasks
1. **Inspect & scaffold:** inspect repo; confirm stack; set up workspace, TypeScript strict, ESLint/Prettier, test runner, scripts (`dev`, `build`, `lint`, `typecheck`, `test`).
2. **Design tokens:** colour (red/yellow/blue/black/off-white + semantic roles), typography scale and fonts (tabular numerals), spacing, border widths, shapes (circle/square/rect, minimal radius), motion durations/easings, z-index, component states. Single source (CSS variables + typed export).
3. **Layout system:** 12-column grid, asymmetric panel compositions, page shells for Team, Admin, and Auth layouts; breakpoints for phone/tablet/laptop/desktop.
4. **Shell & navigation:** header with replaceable `Wordmark` ("DIGIVERSE · GDGoC IIIT Kota"), team nav, admin sidebar/nav, route structure, 404, role-aware nav placeholders (UI only).
5. **Component library:** Button, IconButton, Panel, Tile (palette number), Badge, StatusPill, Timer, StatCardFace, PowerUpCard (Shield/Reserve/Peek/Reverse, using shapes + labels), Input, Select, Table, Modal, Toast, Tabs, Stepper/RoundIndicator, ScoreDisplay (4-dp formatter), and Empty/Loading/Error/Disconnected/Waiting/Completed state components.
6. **Static screens (mock data, labelled `MOCK`, isolated in one directory):**
   - Team login
   - Team home/lobby (waiting state, current round info)
   - Rapid-fire question screen (question, timer, answer input, submitted state)
   - Stat-card announcement screen (all five card types as variants)
   - Number palette 1–100 with a **client-side mock shuffle** to demonstrate randomised layout; selected/locked/disabled/reserved tile states
   - Round result screen
   - Power-up inventory
   - Leaderboard (4-decimal formatting)
   - Admin dashboard + placeholder sections: Teams, Questions & Sets, Card Mapping, Rounds & Stat Cards, Event Settings, Live Monitor, Leaderboard
7. **Transition:** animated stat-card → palette transition (geometric reveal/shape morph), with `prefers-reduced-motion` fallback.
8. **Accessibility & responsive pass:** keyboard order, focus ring, AA contrast, ≥44px targets, aria labels for tiles/timers/live regions.
9. **Docs:** record stack and conventions in `MEMORY.md`; update README/.env.example to reflect the real scaffold.

### Deliverables
Running app with navigable screens; token files; component library (with a simple gallery/route listing components and states); documentation updates.

### Acceptance criteria (all must be verified)
- [ ] `install`, `dev`, `build`, `lint`, `typecheck`, `test` scripts work from a clean clone.
- [ ] All listed screens reachable by navigation; no dead links.
- [ ] No hardcoded colours/sizes in components (token-only), verified by search/lint.
- [ ] Layouts verified at ~360px, ~768px, ~1280px, ~1920px with no horizontal overflow or clipped controls.
- [ ] Stat-card→palette transition works and has a reduced-motion alternative.
- [ ] Palette shows all 100 numbers; arrangement differs between reloads/"new round" (mock).
- [ ] Score formatter outputs exactly 4 decimals and has unit tests (including no premature rounding of inputs).
- [ ] Keyboard-only navigation through login, palette, and admin nav works with visible focus.
- [ ] Mock data isolated and labelled; no fake API calls; no secrets in repo.
- [ ] `PROGRESS.md` updated with evidence.

### Tests
Unit tests for formatters/utilities; component render tests for states; optional visual/a11y smoke checks (axe) on key screens.

---

## Build Phase 2 — Backend Foundation, Database, Authentication, and Roles
**Objective:** real backend, persistent database, secure auth, and RBAC; replace Phase 1 login mock with real authentication.
**Dependencies:** Build Phase 1 complete.

### Tasks
1. Backend scaffold, typed config loader with env validation (fail fast), structured logging, error handler, `/health`.
2. DB setup + migrations. Initial schema (final names decided by agent): `users` (role `admin|team`), `teams`, `sessions`, plus placeholder-free tables only for what this phase needs; later phases add the rest.
3. Password hashing (argon2id/bcrypt); constant-time compare; no hash leakage in responses.
4. **Admin bootstrap** from `ADMIN_BOOTSTRAP_USER_ID` / `ADMIN_BOOTSTRAP_PASSWORD` env vars (create-if-absent, idempotent; never log the password). Do not use the password from `consider.docx` anywhere in the repository.
5. Login/logout/session endpoints; secure httpOnly cookie (or equivalent); session expiry/revocation; CSRF protection appropriate to the chosen approach.
6. RBAC middleware: `requireAuth`, `requireRole('admin'|'team')`, ownership checks.
7. Admin-managed team accounts: create, list, reset password, enable/disable. No public registration endpoint exists.
8. Rate limiting (login + sensitive routes); schema validation; security headers; CORS allow-list.
9. Frontend: real login, auth state, route guards, logout, session-expired state.
10. Update `API_SURFACE_SUMMARY.md` with every implemented endpoint.

### Deliverables
Running backend + DB; authenticated app; documented API; migration + seed/bootstrap instructions in README.

### Acceptance criteria
- [ ] Admin can log in using env-bootstrapped credentials; no credentials in repo, bundle, or logs.
- [ ] Admin can create a team account; team can log in; disabled team cannot.
- [ ] Team token cannot access admin routes (403) nor another team's data; unauthenticated requests get 401.
- [ ] No self-registration route exists.
- [ ] Rate limiting demonstrably triggers on repeated bad logins.
- [ ] Passwords stored hashed (verified in DB).
- [ ] Access-control, auth, and config-validation tests pass; migrations apply from empty DB.
- [ ] Docs updated.

---

## Build Phase 3 — Admin Panel and Event Configuration
**Objective:** the organiser can configure the entire event from the UI without code changes ([C] admin requirements).
**Dependencies:** Build Phase 2.

### Tasks
1. Schema + CRUD API + UI for: **questions** (text, answer definition, time limit, correctness-matching mode), **question sets**, ordering; **card ↔ question mapping**; **top-N** awardees per question (the "X" of [C], distinct from penalty X); number of sets.
2. **Card supply** configuration/validation (Reserve ≤ 1 total per [R]; others per OPEN-011).
3. **Rounds:** number of rounds for **each Game Phase** (A and B); per-round stat card assignment (Mean, Two-thirds, Midrange, Mean+1σ, Geometric mean) for Game Phase B; round timer settings.
4. **Event rule configuration record** with validated fields for every disputed rule (see OPEN-001…008, 011, 014). Unset required fields block starting Build Phase 5 gameplay but do not block saving other config. Include organiser-editable **X** value.
5. Team management UI connected to Phase 2 endpoints.
6. Event lifecycle skeleton: `DRAFT → READY → LIVE → FINISHED` (config locked/validated at `READY`; edits restricted when `LIVE`).
7. Replace Phase 1 admin mocks with real data; keep placeholders only for sections not yet buildable (clearly marked).

### Deliverables
Fully working admin configuration UI + API; persisted config; validation messages.

### Acceptance criteria
- [ ] Every item in [C]'s admin list (cards→questions, top-N, sets, rounds per phase, stat card per round, team credentials) is configurable and persists across restarts.
- [ ] Invalid configs rejected server-side (e.g. second Reserve, unknown stat card, top-N < 1, round count < 1) with clear errors.
- [ ] Teams cannot call any admin config endpoint (tests).
- [ ] Config cannot be silently edited while an event is `LIVE` except explicitly permitted fields.
- [ ] Tests for validation, persistence, and authorisation pass; API doc updated.

---

## Build Phase 4 — Rapid-Fire Gameplay and Power-Up Acquisition
**Objective:** playable Game Phase A: questions → answers → ranked awards → inventory.
**Dependencies:** Build Phase 3. Confirm OPEN-010/011 choices (or implement as configurable) before coding ranking.

### Tasks
1. Rapid-fire **state machine** (e.g. `IDLE → QUESTION_OPEN → CLOSED → AWARDED`), admin controls to start/close/advance.
2. Question delivery to teams (answers never sent to clients); real-time push (WebSocket/SSE) with reconnect-safe state fetch.
3. Answer submission with **server-side timestamps**, idempotency, attempt limits, validation, rate limiting.
4. Correctness evaluation (configurable matching).
5. Ranking: correct submissions ordered by server time ([C] "sorted by time, then correct"; [R] "fastest team(s)"); award the mapped card to the top N; deterministic tie handling (configured, OPEN-010).
6. **Inventory:** team card inventory, supply enforcement (Reserve ≤ 1), transactional award allocation.
7. **Audit trail:** submissions (raw answer, received time, correctness), awards (who/what/why/when).
8. UI: replace mocks on rapid-fire screen, inventory, award notification; admin live view of submissions.

### Deliverables
End-to-end Game Phase A for multiple teams with real-time updates.

### Acceptance criteria
- [ ] N simulated teams submit concurrently; exactly top-N correct earliest teams receive the card; Reserve never over-awarded (concurrency test).
- [ ] Late/duplicate/invalid submissions rejected correctly.
- [ ] Clients never receive correct answers or other teams' answers.
- [ ] Reconnecting client recovers current state.
- [ ] Audit records exist and are admin-readable.
- [ ] Tests (ranking, ties, supply limits, state transitions, authorisation) pass; docs updated.

---

## Build Phase 5 — Main Game Engine and Scoring
**Objective:** playable Game Phase B with a central, independently tested server-side engine.
**Dependencies:** Build Phase 4 **and** the gate: all "Blocks Build Phase 5 = Yes" items in `OPEN_RULE_DECISIONS.md` are RESOLVED or CONFIG-READY with explicit event values.

### Tasks
1. **`packages/game-engine`** (pure, deterministic, injected RNG/clock, `decimal.js`):
   - `computeStatistic(card, validPicks, config)` for Mean, Two-thirds, Midrange, Mean+1σ (population/sample per config), Geometric mean — **no intermediate rounding**.
   - `resolveClashes(picks)` → valid vs. clashing; clashing teams symmetric.
   - `bucketize(validPicks, target, equalityMode)`.
   - `scoreRound(...)` implementing [R] scoring with config for deduction modes, Shield coverage, Reverse parity, tiebreaker, degenerate cases.
   - Typed `NO_TARGET` outcome.
2. **Round state machine:** `LOBBY → SELECTION → CLASH_RESOLUTION → CALCULATION → BUCKETING → SCORING → RESULT` (+ `ABORTED`), server timers, admin controls, invalid transitions rejected.
3. **Palettes:** per-team, per-round shuffled arrangement of all 100 numbers (stored for audit/reconnection, never sent to other teams).
4. **Picks:** server-timestamped, idempotent lock-in, change/no-pick rules per OPEN-014; transactional handling for simultaneous picks.
5. **Cards:** Shield (pre-round), Reserve (pre-round; number becomes unavailable to others without leaking identity), Peek (count of locked-in picks <50 per OPEN-013), Reverse (during round; parity effect). Atomic consumption + audit.
6. **Score ledger:** append-only score deltas per team per round with component breakdown (exact-match, minority, majority, clash, tie-zero), full-precision decimals.
7. **UI:** wire stat-card announcement, transition, palette, card play, results; admin round controller and live pick view.

### Deliverables
Complete Game Phase B loop with ledger and audit trail.

### Acceptance criteria
- [ ] Engine unit tests cover: each statistic (with hand-computed expected values), clashes (2-way, 3-way, multiple groups), bucketing, tiebreaker, empty-bucket cases, Reverse parity (0/1/2/3), Shield per config, Reserve, Peek, degenerate rounds, and decimal precision (no rounding drift).
- [ ] Engine has no imports from HTTP/DB/UI layers.
- [ ] Concurrent picks/clash tests pass; double card play rejected.
- [ ] Palette contains exactly values 1–100, differently arranged per team/round (statistical test across teams).
- [ ] Teams cannot see others' picks/palettes/inventories; Peek exposes only a count.
- [ ] Every score change is traceable in the ledger to a round and cause.
- [ ] Config values used match recorded organiser decisions.
- [ ] Docs updated (API, events, MEMORY decisions).

---

## Build Phase 6 — Leaderboard, Integration, Testing, Security, and Deployment
**Objective:** production-ready, verified, deployable system.
**Dependencies:** Build Phase 5.

### Tasks
1. **Leaderboard:** team view and admin view; 4-dp display via the shared formatter; ranking and tie display (OPEN-017); real-time updates; completed/final state.
2. **Live admin monitor:** per-team pick, round status, cards, connection state, timers.
3. **Real-time hardening:** reconnect/resync, missed-event recovery, clock-skew-safe timers (server time offsets), disconnect states in UI.
4. **E2E tests (Playwright):** admin creates teams/config → rapid fire → main game rounds (each stat card) → final leaderboard.
5. **Security hardening:** dependency audit, headers, cookie flags, rate limits review, input validation review, authorisation matrix tests, secret scanning, log redaction, backups/restore note.
6. **Accessibility/responsive audit** across all screens.
7. **Load check:** simulate expected team count (assume ≤ 100 teams unless told otherwise) on selection and rapid-fire bursts.
8. **Deployment:** production config, migrations, health checks, runbook (event-day checklist, admin password rotation, failure recovery, manual override procedures), README finalisation.

### Acceptance criteria
- [ ] Full scripted playthrough from account creation to final leaderboard passes automatically.
- [ ] Leaderboard shows exactly 4 decimals everywhere; stored values unrounded.
- [ ] Reconnect mid-round restores correct state; server restart mid-event recovers from DB.
- [ ] Authorisation matrix tests pass; no secrets in repo history/bundle; dependency audit has no unaddressed high/critical issues.
- [ ] Accessibility checks pass on key screens; responsive verified.
- [ ] Deployed instance (or documented deploy procedure verified in staging) works with env-based admin bootstrap.
- [ ] Runbook and docs complete; `PROGRESS.md` shows all phases complete with evidence.
