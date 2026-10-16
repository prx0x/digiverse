# API_SURFACE_SUMMARY.md — API, Events, and Contracts

**Last updated:** 2026-10-15
**Implementation status:** Build Phase 2 and Build Phase 3 endpoints implemented and verified with tests.

## 1. Rules for maintaining this file
1. Update this file in the same change set whenever you add/change/remove: an HTTP endpoint, a real-time event, a shared type, a validation schema, a database table/column used by the API, or an error code.
2. Keep two clearly separated sections: **Implemented** (verified in code, with the build phase and date) and **Planned** (proposal only). Move an item from Planned to Implemented only after it works and is tested.
3. For each **implemented** endpoint record: method + path, purpose, auth/role requirement, request shape (with validation rules), success response shape, error responses (status + code), side effects (DB writes, events emitted, audit records), rate-limit class, and test file reference.
4. For each **implemented** real-time event record: name, direction (server→client / client→server), audience (which role/team), payload shape, trigger, and reconnect/replay behaviour.
5. Record shared types (location in `packages/shared`) and DB contract changes (migration name).
6. Never document secrets or real credentials. Never show another team's private data in examples.
7. Authorisation convention: `PUBLIC` (no auth), `AUTH` (any logged-in user), `TEAM` (team role, own data only), `ADMIN` (admin role).
8. Response convention: JSON; errors as `{ "error": { "code": "STRING", "message": "…", "details"?: … } }`; scores/statistics as **decimal strings** (e.g. `"12.3456789012"`) to preserve precision, formatted to 4 dp only in the UI.

## 2. Implemented surface

### 2.1 Auth & Team Administration (Build Phase 2)

| Method | Path | Purpose | Auth | Request | Response | Errors | Side effects | Phase | Tests |
|---|---|---|---|---|---|---|---|---|---|
| `GET` | `/health` | Server health and liveness check | PUBLIC | None | `{ status: "ok", app: "Digiverse" }` | — | None | 2 | `app.test.ts` |
| `GET` | `/api/v1/auth/csrf` | Issue or retrieve CSRF token | PUBLIC | None | `{ csrfToken: string }` | — | Sets `digiverse_csrf` cookie | 2 | `app.test.ts` |
| `POST` | `/api/v1/auth/login` | Authenticate admin or team credentials | PUBLIC (CSRF required) | `{ identifier: string, password: string }` | `{ user: AuthUser }` | `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 CSRF_FAILED`, `429 RATE_LIMITED` | Creates DB session; sets `digiverse_session` httpOnly cookie | 2 | `app.test.ts` |
| `POST` | `/api/v1/auth/logout` | Revoke active session | AUTH (CSRF required) | None | `{ ok: true }` | `401 UNAUTHORIZED`, `403 CSRF_FAILED` | Revokes DB session; clears `digiverse_session` cookie | 2 | `app.test.ts` |
| `GET` | `/api/v1/auth/me` | Fetch active authenticated profile | AUTH | None | `{ user: AuthUser }` | `401 UNAUTHORIZED` | Refreshes CSRF cookie | 2 | `app.test.ts` |
| `GET` | `/api/v1/teams/me` | Fetch authenticated team profile & inventory | TEAM | None | `{ team: TeamProfile, inventorySummary: { cards: [] } }` | `401 UNAUTHORIZED`, `403 FORBIDDEN` | None | 2 | `app.test.ts` |
| `GET` | `/api/v1/admin/teams` | List all registered teams | ADMIN | None | `{ teams: AdminTeamItem[] }` | `401 UNAUTHORIZED`, `403 FORBIDDEN` | None | 2 | `app.test.ts` |
| `POST` | `/api/v1/admin/teams` | Create a new team account | ADMIN (CSRF required) | `{ identifier: string, password: string (min 8), name: string, tag?: string }` | `{ team: AdminTeamItem }` | `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `409 CONFLICT` | Inserts `users` and `teams` rows | 2 | `app.test.ts` |
| `POST` | `/api/v1/admin/teams/:id/reset-password` | Reset a team account password | ADMIN (CSRF required) | `{ password: string (min 8) }` | `{ ok: true }` | `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND` | Updates `users.password_hash`, revokes team sessions | 2 | `app.test.ts` |
| `POST` | `/api/v1/admin/teams/:id/disable` | Disable a team account | ADMIN (CSRF required) | None | `{ team: AdminTeamItem }` | `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND` | Sets `users.enabled = false`, revokes active sessions | 2 | `app.test.ts` |
| `POST` | `/api/v1/admin/teams/:id/enable` | Re-enable a disabled team account | ADMIN (CSRF required) | None | `{ team: AdminTeamItem }` | `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND` | Sets `users.enabled = true` | 2 | `app.test.ts` |

### 2.2 Admin Event Configuration (Build Phase 3)

| Method | Path | Purpose | Auth | Request | Response | Errors | Side effects | Phase | Tests |
|---|---|---|---|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/event` | Fetch full event bundle (event, rules, supply, sets, rounds, readiness) | ADMIN | None | `EventBundle` | `401 UNAUTHORIZED`, `403 FORBIDDEN` | Auto-initialises DRAFT event if none exists | 3 | `eventConfig.test.ts` |
| `PUT` | `/api/v1/admin/event` | Update general event timers and round counts | ADMIN (CSRF required) | `Partial<EventRecord>` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Updates `events` record, generates round configs | 3 | `eventConfig.test.ts` |
| `POST` | `/api/v1/admin/event/lifecycle` | Transition lifecycle state (`DRAFT` → `READY` → `LIVE` → `FINISHED`) | ADMIN (CSRF required) | `{ status: EventStatus }` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFLICT` | Validates configuration readiness before locking | 3 | `eventConfig.test.ts` |
| `GET` | `/api/v1/admin/event/rules` | Fetch event rules and readiness | ADMIN | None | `{ rules, readiness }` | `401 UNAUTHORIZED`, `403 FORBIDDEN` | None | 3 | `eventConfig.test.ts` |
| `PUT` | `/api/v1/admin/event/rules` | Update disputed rule parameters (OPEN-001..014) | ADMIN (CSRF required) | `Partial<EventRulesRecord>` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Updates `event_rules`; permits penalty X edits during LIVE | 3 | `eventConfig.test.ts` |
| `GET` | `/api/v1/admin/card-supply` | Fetch card supply limits & readiness | ADMIN | None | `{ cardSupply, readiness }` | `401 UNAUTHORIZED`, `403 FORBIDDEN` | None | 3 | `eventConfig.test.ts` |
| `PUT` | `/api/v1/admin/card-supply` | Update power-up max supply caps | ADMIN (CSRF required) | `{ items: { cardType, maxSupply }[] }` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Enforces Reserve supply == 1 | 3 | `eventConfig.test.ts` |
| `PUT` | `/api/v1/admin/rounds` | Update Phase B round stat card assignments & timers | ADMIN (CSRF required) | `{ rounds: { roundNumber, statCard, timerSeconds }[] }` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Updates `round_configs` | 3 | `eventConfig.test.ts` |
| `POST` | `/api/v1/admin/question-sets` | Create question set | ADMIN (CSRF required) | `{ name: string }` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Inserts `question_sets` row | 3 | `eventConfig.test.ts` |
| `PATCH` | `/api/v1/admin/question-sets/:id` | Update question set name or order | ADMIN (CSRF required) | `{ name?: string, orderIndex?: number }` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Updates `question_sets` row | 3 | `eventConfig.test.ts` |
| `DELETE` | `/api/v1/admin/question-sets/:id` | Delete question set (cascade) | ADMIN (CSRF required) | None | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Deletes question set and questions | 3 | `eventConfig.test.ts` |
| `POST` | `/api/v1/admin/question-sets/:setId/questions` | Create question in set | ADMIN (CSRF required) | `{ prompt, answerDefinition, matchingMode, timeLimitSeconds, mappedCard, topN }` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Inserts `questions` row; validates supply | 3 | `eventConfig.test.ts` |
| `PATCH` | `/api/v1/admin/questions/:id` | Update question prompt, answer, topN, card mapping | ADMIN (CSRF required) | `Partial<QuestionRecord>` | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Updates `questions` row; validates supply | 3 | `eventConfig.test.ts` |
| `DELETE` | `/api/v1/admin/questions/:id` | Delete question | ADMIN (CSRF required) | None | `EventBundle` | `400 BAD_REQUEST`, `409 CONFIG_LOCKED` | Deletes `questions` row | 3 | `eventConfig.test.ts` |

### 2.3 Rapid Fire & Power-Up Acquisition (Build Phase 4)

| Method | Path | Purpose | Auth | Request | Response | Errors | Side effects | Phase | Tests |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/api/v1/admin/rapid-fire/start` | Launch a rapid fire question | ADMIN (CSRF required) | `{ questionId: string }` | `{ session, state }` | `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `409 CONFLICT` | Creates `rapid_fire_sessions` row, broadcasts `rapidfire:opened` | 4 | `rapidFire.test.ts` |
| `POST` | `/api/v1/admin/rapid-fire/close` | Close active question early | ADMIN (CSRF required) | `{ sessionId?: string }` | `{ session, state }` | `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND` | Sets status `CLOSED`, broadcasts `rapidfire:closed` | 4 | `rapidFire.test.ts` |
| `POST` | `/api/v1/admin/rapid-fire/award` | Evaluate submissions & award cards | ADMIN (CSRF required) | `{ sessionId?: string }` | `{ awards, state }` | `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND` | Inserts `rapid_fire_awards` & `team_cards`, broadcasts `rapidfire:awarded` | 4 | `rapidFire.test.ts` |
| `GET` | `/api/v1/admin/rapid-fire/state` | Fetch full admin rapid fire state | ADMIN | None | `RapidFireAdminState` | `401 UNAUTHORIZED`, `403 FORBIDDEN` | None | 4 | `rapidFire.test.ts` |
| `GET` | `/api/v1/rapid-fire/current` | Team view of active question & award | TEAM | None | `RapidFireTeamView` | `401 UNAUTHORIZED`, `403 FORBIDDEN` | Excludes answer definition & other teams' data | 4 | `rapidFire.test.ts` |
| `POST` | `/api/v1/rapid-fire/answers` | Submit team answer | TEAM (CSRF required) | `{ questionId: string, answer: string }` | `{ submitted, receivedAt, attemptNumber, isCorrect }` | `400 BAD_REQUEST` (`QUESTION_CLOSED`, `ATTEMPTS_EXCEEDED`), `401 UNAUTHORIZED`, `403 FORBIDDEN` | Inserts `rapid_fire_submissions` row, notifies admin | 4 | `rapidFire.test.ts` |
| `GET` | `/api/v1/teams/me/cards` | Fetch own team power-up card inventory | TEAM | None | `{ cards: TeamCardItem[] }` | `401 UNAUTHORIZED`, `403 FORBIDDEN` | None | 4 | `rapidFire.test.ts` |
| `WS` | `/ws` | Real-time WebSocket connection | AUTH (Session cookie) | `{ type: "ping" }` | `{ type: "pong", timestamp }` + server push events | `4401 Unauthorized` | Registers client for live broadcasts | 4 | `rapidFire.test.ts` |

### 2.4 Implemented shared types / DB contracts
- `packages/shared/src/formatScore.ts`: `formatScore(value)` — rounds score to exactly 4 decimal places with no premature decimal truncation.
- `packages/shared/src/eventConfig.ts`:
  - Enums: `EVENT_STATUSES`, `POWER_UP_CARDS`, `STAT_CARDS`, `GAME_PHASES`, `MATCHING_MODES`, `CLASH_PENALTY_MODES`, `MAJORITY_PENALTY_MODES`, `REVERSED_MAJORITY_REWARDS`, `STD_DEV_MODES`, `SAMPLE_STDDEV_SINGLE_BEHAVIOURS`, `EQUALITY_MODES`, `DISPLAY_ROUNDING_MODES`, `NO_PICK_BEHAVIOURS`, `DEGENERATE_ROUND_MODES`, `RAPID_FIRE_TIE_BREAKS`, `LIVE_EDITABLE_RULE_FIELDS`, `REQUIRED_RULE_FIELDS_FOR_GAME_PHASE_B`.
  - Supply validators: `validateCardSupplyMap(supply)`, `validateAwardedVsSupply(awards, supply)`.
- `packages/shared/src/rapidFire.ts`:
  - Enums & types: `RAPID_FIRE_STATUSES`, `RapidFireStatus`, `RapidFireSubmissionCandidate`, `RapidFireAwardAllocation`, `AllocateAwardsParams`, `RapidFireTeamView`, `RapidFireAdminState`, `TeamCardItem`.
  - Pure functions: `evaluateAnswer(rawAnswer, answerDefinition, mode)` (EXACT, NORMALIZED, NUMERIC), `normalizeAnswer(str)`, `allocateRapidFireAwards(params)`.
- Database migration `0000_empty_joseph.sql`:
  - `user_role` enum (`admin`, `team`)
  - `users` table: `id (uuid pk)`, `identifier (varchar unique)`, `password_hash (text)`, `role (user_role)`, `enabled (boolean)`, timestamps.
  - `teams` table: `id (uuid pk)`, `user_id (uuid fk users.id)`, `name (varchar)`, `tag (varchar nullable)`, timestamps.
  - `sessions` table: `id (uuid pk)`, `user_id (uuid fk users.id)`, `token_hash (text unique)`, `expires_at (timestamp)`, `revoked_at (timestamp nullable)`, `created_at`.
- Database migration `0001_many_preak.sql`:
  - Enums: `event_status`, `power_up_card`, `stat_card`, `game_phase`, `matching_mode`, `clash_penalty_mode`, `majority_penalty_mode`, `reversed_majority_reward`, `std_dev_mode`, `sample_stddev_single_behaviour`, `equality_mode`, `display_rounding_mode`, `no_pick_behaviour`, `degenerate_round_mode`, `rapid_fire_tie_break`.
  - `events` table: `id (uuid pk)`, `name (varchar)`, `status (event_status default 'DRAFT')`, `game_phase_a_round_count (int)`, `game_phase_b_round_count (int)`, `rapid_fire_default_time_limit_seconds (int)`, `round_selection_seconds (int)`, `stat_card_announcement_seconds (int)`, timestamps.
  - `event_rules` table: `id (uuid pk)`, `event_id (uuid fk events.id cascade unique)`, 23 rule configuration columns resolving OPEN-001..014.
  - `card_supply` table: `id (uuid pk)`, `event_id (uuid fk events.id cascade)`, `card_type (power_up_card)`, `max_supply (int)`, timestamps, unique (event_id, card_type).
  - `question_sets` table: `id (uuid pk)`, `event_id (uuid fk events.id cascade)`, `name (varchar)`, `order_index (int)`, timestamps.
  - `questions` table: `id (uuid pk)`, `set_id (uuid fk question_sets.id cascade)`, `prompt (text)`, `answer_definition (text)`, `matching_mode (matching_mode)`, `time_limit_seconds (int)`, `mapped_card (power_up_card nullable)`, `top_n (int default 1)`, `order_index (int)`, timestamps.
  - `round_configs` table: `id (uuid pk)`, `event_id (uuid fk events.id cascade)`, `game_phase (game_phase)`, `round_number (int)`, `stat_card (stat_card nullable)`, `timer_seconds (int)`, timestamps, unique (event_id, game_phase, round_number).
- Database migration `0002_neat_shen.sql`:
  - Enums: `rapid_fire_status` (`IDLE`, `QUESTION_OPEN`, `CLOSED`, `AWARDED`).
  - `rapid_fire_sessions` table: `id (uuid pk)`, `event_id (uuid fk events.id cascade)`, `question_id (uuid fk questions.id cascade)`, `status (rapid_fire_status default 'IDLE')`, `opened_at`, `closed_at`, `awarded_at`, `time_limit_seconds (int)`, timestamps.
  - `rapid_fire_submissions` table: `id (uuid pk)`, `session_id (uuid fk rapid_fire_sessions.id cascade)`, `team_id (uuid fk teams.id cascade)`, `raw_answer (text)`, `is_correct (boolean)`, `attempt_number (int default 1)`, `received_at`, timestamps, unique (session_id, team_id, attempt_number).
  - `team_cards` table: `id (uuid pk)`, `event_id (uuid fk events.id cascade)`, `team_id (uuid fk teams.id cascade)`, `card_type (power_up_card)`, `acquired_from (varchar 32 default 'RAPID_FIRE')`, `question_id (uuid fk questions.id nullable)`, `used_in_round_id (uuid nullable)`, `created_at`.
  - `rapid_fire_awards` table: `id (uuid pk)`, `session_id (uuid fk rapid_fire_sessions.id cascade)`, `team_id (uuid fk teams.id cascade)`, `card_type (power_up_card)`, `rank (int)`, `received_at`, `reason (text)`, `created_at`.

### 2.5 Main game (Game Phase B) — Build Phase 5

| Method | Path | Purpose | Auth | Request | Response | Errors | Side effects | Phase | Tests |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/api/v1/admin/rounds/start` | Start a new game round (generates per-team palettes) | ADMIN (CSRF required) | `{ roundConfigId?: string, isPractice?: boolean }` | `{ round }` | `400`, `401`, `403`, `409 CONFLICT` | Creates `game_rounds` + `round_palettes` rows, writes `STARTING_POINTS` ledger entries on round 1, broadcasts `round:lobby` | 5 | `gameEngine.test.ts` |
| `POST` | `/api/v1/admin/rounds/:id/open-selection` | Advance round from LOBBY to SELECTION | ADMIN (CSRF required) | None | `{ round }` | `400`, `401`, `403`, `404`, `409` | Updates status, broadcasts `round:selection_opened` | 5 | `gameEngine.test.ts` |
| `POST` | `/api/v1/admin/rounds/:id/resolve` | Score round: run engine, write ledger | ADMIN (CSRF required) | None | `{ round, results }` | `400`, `401`, `403`, `404`, `409` | Runs `scoreRound()`, inserts `score_ledger` entries in transaction, broadcasts `round:result` | 5 | `gameEngine.test.ts` |
| `POST` | `/api/v1/admin/rounds/:id/extend-timer` | Extend selection timer by N seconds | ADMIN (CSRF required) | `{ extraSeconds: number }` | `{ round }` | `400`, `401`, `403`, `404`, `409` | Updates `selection_seconds` | 5 | `gameEngine.test.ts` |
| `POST` | `/api/v1/admin/rounds/:id/void` | Void round and reverse all ledger entries | ADMIN (CSRF required) | None | `{ ok: true }` | `400`, `401`, `403`, `404`, `409` | Inserts `VOID_REVERSAL` ledger entries, marks round `ABORTED`, restores used cards | 5 | `gameEngine.test.ts` |
| `GET` | `/api/v1/admin/rounds/current` | Admin view of current active round | ADMIN | None | `AdminRoundState` (all teams' picks, cards) | `401`, `403` | None | 5 | — |
| `GET` | `/api/v1/admin/rounds/:id/state` | Admin full state snapshot for a round | ADMIN | None | `AdminRoundState` | `401`, `403`, `404` | None | 5 | — |
| `GET` | `/api/v1/admin/leaderboard` | Admin leaderboard with full tiebreaker data | ADMIN | None | `{ teams: LeaderboardEntry[] }` | `401`, `403` | None | 5 | `gameEngine.test.ts` |
| `GET` | `/api/v1/leaderboard` | Public leaderboard (AUTH) | AUTH | None | `{ teams: LeaderboardEntry[] }` | `401` | None | 5 | `gameEngine.test.ts` |
| `GET` | `/api/v1/rounds/current` | Team view of current active round | TEAM | None | `TeamRoundView` (own palette, pick, card, result) | `401`, `403` | None | 5 | — |
| `GET` | `/api/v1/rounds/:id` | Team view of a specific round | TEAM | None | `TeamRoundView` | `401`, `403`, `404` | None | 5 | — |
| `POST` | `/api/v1/rounds/current/pick` | Submit team's number pick | TEAM (CSRF required) | `{ pick: number }` | `{ ok: true }` | `400 PICK_LOCKED`, `400 NOT_IN_SELECTION`, `400 RESERVED`, `401`, `403` | Inserts or updates `round_picks` row (no-change once locked) | 5 | `gameEngine.test.ts` |
| `POST` | `/api/v1/rounds/current/cards/play` | Play a power-up card for current round | TEAM (CSRF required) | `{ card: 'SHIELD'\|'RESERVE'\|'PEEK'\|'REVERSE' }` | `{ ok: true, peekCount?: number }` | `400 INVALID_WINDOW`, `400 ALREADY_PLAYED`, `400 NO_CARD`, `401`, `403` | Marks `team_cards.used_in_round_id`, creates `round_card_plays` row; Shield/Reserve valid in LOBBY, Peek/Reverse valid in SELECTION | 5 | `gameEngine.test.ts` |

### 2.6 Implemented pure engine package (`packages/game-engine`)
- `@digiverse/game-engine` — pure TypeScript, no framework dependencies, `decimal.js@^10.4.3` (precision 60, ROUND_HALF_UP).
- Modules: `statistics.ts` (5 stat card computations), `clashes.ts` (deterministic clash resolution), `bucketing.ts` (EXACT/ROUND_TARGET_TO_INTEGER/EPSILON equality modes), `scoring.ts` (full Game Phase B scoring — Shield, Reverse parity, no-pick penalty, degenerate rounds), `palette.ts` (Mulberry32 PRNG + Fisher-Yates shuffle), `cards.ts` (card validation + Peek evaluation), `stateMachine.ts` (round state transition guards).
- Database migration `0003_hot_captain_stacy.sql`:
  - Enums: `round_status` (`LOBBY`, `SELECTION`, `CLASH_RESOLUTION`, `CALCULATION`, `BUCKETING`, `SCORING`, `RESULT`, `ABORTED`), `score_ledger_component` (`STARTING_POINTS`, `ROUND_SCORE`, `NO_PICK_PENALTY`, `VOID_REVERSAL`).
  - `game_rounds` table: id, event_id, round_number, stat_card, status, is_practice, lobby/selection/closed timestamps and durations, is_reversed, reverse_count, score_multiplier, timestamps.
  - `round_palettes` table: per-team shuffled palette (JSON array + seed), indexed by (round_id, team_id).
  - `round_picks` table: per-team pick record, is_locked flag, reserved_by_card flag, unique (round_id, team_id).
  - `round_card_plays` table: per-team card play log, play_phase, payload (JSON), timestamps.
  - `score_ledger` table: append-only per-team score deltas (decimal strings), component type, round reference.
  - `round_audit_logs` table: append-only state transition records with payload JSON.

## 3. Planned surface (PROPOSAL — not implemented)

Base path: `/api/v1`. Real-time channel: WebSocket `/ws` (authenticated by session cookie).

### 3.1 Real-time events — Build Phase 6
Server-side broadcasts already exist for Game Phase B; frontend currently polls. Phase 6 will wire frontend subscriptions:
- `round:lobby` — broadcast on round start (palette ready, stat card)
- `round:selection_opened` — broadcast when admin opens selection
- `round:timer_sync` — periodic timer heartbeat
- `round:card_played` — anonymous card play notification
- `round:result` — full result broadcast after scoring
- `leaderboard:updated` — after each resolved round

Implemented in Phase 4 (already wired end-to-end): `rapidfire:opened`, `rapidfire:closed`, `rapidfire:awarded`, `rapidfire:submission`, `ping`/`pong`.

### 3.2 Phase 6 surface
- E2E game audit trail (`GET /admin/audit?roundId=&teamId=`) — full pick, card, score ledger export.
- Admin live monitor (`GET /admin/live`) — real-time connection count, submission status board.

