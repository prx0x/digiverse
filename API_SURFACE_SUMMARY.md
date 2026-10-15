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

### 2.3 Implemented shared types / DB contracts
- `packages/shared/src/formatScore.ts`: `formatScore(value)` — rounds score to exactly 4 decimal places with no premature decimal truncation.
- `packages/shared/src/eventConfig.ts`:
  - Enums: `EVENT_STATUSES`, `POWER_UP_CARDS`, `STAT_CARDS`, `GAME_PHASES`, `MATCHING_MODES`, `CLASH_PENALTY_MODES`, `MAJORITY_PENALTY_MODES`, `REVERSED_MAJORITY_REWARDS`, `STD_DEV_MODES`, `SAMPLE_STDDEV_SINGLE_BEHAVIOURS`, `EQUALITY_MODES`, `DISPLAY_ROUNDING_MODES`, `NO_PICK_BEHAVIOURS`, `DEGENERATE_ROUND_MODES`, `RAPID_FIRE_TIE_BREAKS`, `LIVE_EDITABLE_RULE_FIELDS`, `REQUIRED_RULE_FIELDS_FOR_GAME_PHASE_B`.
  - Supply validators: `validateCardSupplyMap(supply)`, `validateAwardedVsSupply(awards, supply)`.
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

## 3. Planned surface (PROPOSAL — not implemented)

Base path suggestion: `/api/v1`. Real-time channel suggestion: WebSocket `/ws` (or SSE `/events`), authenticated by the same session.

### 3.1 Rapid fire — Build Phase 4
- Admin: `POST /admin/rapid-fire/start|close|advance`, `GET /admin/rapid-fire/submissions`.
- Team: `GET /rapid-fire/current` (question without answer), `POST /rapid-fire/answers` (`{ questionId, answer }`; server timestamp; idempotent).

### 3.2 Power-ups — Build Phase 4/5
- `GET /teams/me/cards` — TEAM — own inventory.
- `POST /rounds/:roundId/cards/play` — TEAM — `{ card: SHIELD|RESERVE|PEEK|REVERSE, params? }`; validated against lifecycle state/timing.
- Peek response: `{ count: number }` only.

### 3.3 Main game — Build Phase 5
- Admin: `POST /admin/rounds/:id/open-lobby|open-selection|close-selection|resolve|publish-result`, `POST /admin/rounds/:id/abort`, `GET /admin/rounds/:id/live` (all picks, card plays, statuses).
- Team: `GET /rounds/current` (stat card, state, timer, own palette order), `POST /rounds/:id/pick` (`{ number }`), `POST /rounds/:id/lock`, `GET /rounds/:id/result` (own outcome; target/bucket info as permitted).

### 3.4 Leaderboard — Build Phase 5/6
- `GET /leaderboard` — AUTH — ranked teams with totals (decimal strings; UI formats to 4 dp).
- `GET /admin/leaderboard` and `GET /admin/ledger?teamId=` — ADMIN — score ledger/audit.

### 3.5 Real-time events (PROPOSED names)
Server→client: `event.state`, `rapidfire.question.opened|closed`, `rapidfire.award`, `round.lobby`, `round.selection.opened`, `round.timer.sync`, `round.card.played` (public-safe), `round.selection.closed`, `round.result`, `leaderboard.updated`, `team.inventory.updated` (own only), `admin.live.pick` (admin only).
Client→server: `ping`, `resync.request` (returns full current state).
All events must carry `eventId`, `serverTime`, and be recoverable via a state-fetch endpoint after reconnect.

### 3.6 Proposed core data entities (for planning only)
`team_cards`, `rapid_fire_submissions`, `rapid_fire_awards`, `rounds`, `round_palettes`, `round_picks`, `round_card_plays`, `round_results`, `score_ledger`, `audit_log`. Final schema is decided in Build Phases 4–5 and recorded in §2 once migrations exist.
