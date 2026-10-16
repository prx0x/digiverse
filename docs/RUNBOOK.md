# Digiverse Event Day Runbook & Operations Manual

This runbook guides GDGoC IIIT Kota organisers through staging, configuring, and operating the Digiverse platform during the live event.

---

## 1. System Architecture & Prerequisites

### Architecture
- **Web App (`apps/web`)**: Single-page React 19 application with Bauhaus visual styling, served via Nginx reverse proxy.
- **Backend API (`apps/server`)**: Fastify 5 server with real-time WebSocket broadcasting (`/ws`), argon2id authentication, rate limiting, and RBAC (`admin` / `team`).
- **Game Engine (`packages/game-engine`)**: Pure TypeScript computation engine running arbitrary-precision arithmetic (`decimal.js`, precision 60) for all statistical metrics (Mean, Two-Thirds, Midrange, Mean+1σ, Geometric Mean), clashes, bucketing, and scoring.
- **Shared Types (`packages/shared`)**: Shared constants, tiebreakers, and 4-decimal place score formatters.
- **Database**: PostgreSQL 16 managed via Drizzle ORM.

### Hardware & Port Requirements
- Minimum 2 vCPUs, 4 GB RAM recommended for up to 100 concurrent teams.
- Exposed Port: `80` (HTTP) or `443` (HTTPS with SSL certificate termination).
- Internal Ports: `3000` (Fastify Server), `5432` (PostgreSQL).

---

## 2. Environment Configuration

Create a production `.env` file on the deployment host:

```bash
# Database
POSTGRES_USER=digiverse
POSTGRES_PASSWORD=your_super_secure_db_password
POSTGRES_DB=digiverse

# Server Core
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgres://digiverse:your_super_secure_db_password@postgres:5432/digiverse

# Security
SESSION_SECRET=a_very_long_random_alphanumeric_string_at_least_32_characters
ADMIN_BOOTSTRAP_USER_ID=admin
ADMIN_BOOTSTRAP_PASSWORD=RotateThisPasswordBeforeEvent!123

# Networking
CORS_ORIGINS=https://digiverse.yourdomain.com,http://localhost
COOKIE_SECURE=true
COOKIE_DOMAIN=digiverse.yourdomain.com
WEB_PORT=80
```

---

## 3. Production Deployment & Launch

### Step 1: Start Services with Docker Compose
```bash
# Build and start all services in detached mode
docker compose -f docker-compose.prod.yml up --build -d

# Verify container health
docker compose -f docker-compose.prod.yml ps
```

### Step 2: Run Database Migrations
Migrations run automatically on container startup or can be triggered manually:
```bash
docker compose -f docker-compose.prod.yml exec server pnpm db:migrate
```

### Step 3: Health Verification
Check API health:
```bash
curl -f http://localhost/api/v1/health
# Expected output: {"status":"ok","app":"Digiverse"}
```

---

## 4. Pre-Event Admin Checklist (T - 2 Hours)

1. **Log in as Admin**:
   - Navigate to `/login`.
   - Use `ADMIN_BOOTSTRAP_USER_ID` and `ADMIN_BOOTSTRAP_PASSWORD`.
   - Verify redirect to `/admin`.

2. **Team Provisioning (`/admin/teams`)**:
   - Create team accounts with Unique Team Name and Tag.
   - Record and securely distribute generated team passwords to respective team captains.
   - Verify that all teams are in the `Enabled` state.

3. **Rapid-Fire Configuration (`/admin/questions` & `/admin/card-mapping`)**:
   - Create question sets under Question Management.
   - Add rapid-fire questions with prompt, matching mode (`EXACT`, `NORMALIZED`, or `NUMERIC`), time limit, and answer definitions.
   - Map each question to its corresponding Power-Up Card (`SHIELD`, `RESERVE`, `PEEK`, `REVERSE`).
   - Validate card supplies: `RESERVE` must have a maximum supply of `1`.

4. **Main Game Rounds (`/admin/rounds`)**:
   - Configure total round count for Game Phase A and Game Phase B.
   - Assign the statistical target card for each Phase B round:
     - `MEAN`
     - `TWO_THIRDS`
     - `MIDRANGE`
     - `MEAN_PLUS_SIGMA`
     - `GEOMETRIC_MEAN`
   - Set lobby duration (default: 15s) and selection duration (default: 60s).

5. **Event Settings & Penalty X (`/admin/settings`)**:
   - Verify and tune organiser-editable rules (Penalty X, deduction mode, reverse parity).
   - Check readiness checklist on the Admin Dashboard (`/admin`).

6. **Lock Configuration**:
   - Advance event state from `DRAFT` to `READY` then `LIVE`.

---

## 5. Live Operations Guide (Game Time)

### Phase A: Rapid Fire Execution (`/admin/rapid-fire`)
1. Ensure all teams are logged in and in the Rapid Fire Lobby (`/rapid-fire`).
2. Select the scheduled Question from the controller dropdown.
3. Click **Start Question**:
   - Countdown begins simultaneously across all team screens via WebSocket broadcast.
   - Incoming submissions appear live on the Admin Submissions feed with millisecond server timestamps.
4. When timer expires (or when all teams have answered), click **Close Question**.
5. Click **Allocate Awards**:
   - System evaluates answers, ranks earliest correct submissions, and transactionally issues Power-Up Cards to team inventories.
   - Teams see award announcements instantly on their screens.
6. Repeat for subsequent rapid-fire questions.

### Phase B: Main Game Execution (`/admin/rounds` & `/admin/live-monitor`)
1. From `/admin/rounds`, launch the next round.
2. **LOBBY Phase**:
   - Stat card formula is announced to all teams.
   - Pre-round cards (`SHIELD`, `RESERVE`) may be played by teams holding them.
   - If a team plays `RESERVE`, their chosen number is auto-locked and anonymously announced so other teams' palette tiles grey out.
3. **SELECTION Phase**:
   - Click **Open Selection** (or wait for lobby timer to auto-transition).
   - Teams view their randomized 1–100 palettes and submit locked-in picks.
   - Teams may play during-round cards (`PEEK`, `REVERSE`).
   - Admin monitors live picks and connection states in real time on `/admin/live-monitor`.
4. **RESOLVE & SCORE**:
   - When selection closes, click **Resolve & Score Round**.
   - Server runs the Game Engine:
     1. Discards clashing picks (identical picks by 2+ teams).
     2. Computes the statistical target with zero rounding error.
     3. Buckets remaining teams into `Greater Than`, `Equal To`, or `Less Than`.
     4. Resolves Majority vs. Minority (applying `REVERSE` parity if played).
     5. Calculates scores, applies `SHIELD` protections, and deducts no-pick penalties.
     6. Appends irreversible delta records into `score_ledger`.
   - Results and updated standings are pushed instantly to all client leaderboards.

---

## 6. Emergency & Recovery Procedures

### Incident 1: Round Interruption or Accidental Bad Action
**Solution**: Click **Void Round** on `/admin/live-monitor` or `/admin/rounds`.
- Enter the reason for voiding in the prompt.
- The server atomically reverses all score ledger entries generated by that round and marks the round status as `ABORTED`.
- Leaderboards immediately recalculate back to the pre-round standings.
- The admin can then relaunch the round.

### Incident 2: Teams Request More Time During Selection
**Solution**: Use the **+30s** or **+60s** quick-extend buttons on `/admin/live-monitor`.
- The server updates `selectionSeconds` and broadcasts `round:timer_extended` via WebSocket to synchronize all team countdown clocks.

### Incident 3: Disconnected Team or Lost Internet Connection
- The client app features automatic WebSocket reconnection with exponential backoff and a 3-second fallback polling interval.
- When reconnected, the client immediately fetches the authoritative round view (`GET /api/v1/rounds/current`) and restores committed picks, card plays, and palette states.

### Incident 4: Server Restart Mid-Event
- All event configuration, question submissions, card inventories, round picks, and score balances are fully persisted in PostgreSQL.
- Simply restart the container:
  ```bash
  docker compose -f docker-compose.prod.yml restart server
  ```
- No game state or score history is lost.

---

## 7. Post-Event & Closing

1. Check the Official Event Leaderboard (`/admin/leaderboard`).
2. Verify tiebreakers: (1) Highest cumulative score, (2) Most rounds with net gain, (3) Power-up cards remaining.
3. Click **Export to CSV** to save the complete final score ledger and audit log for event archives.
4. Transition event lifecycle status to `FINISHED` on `/admin/dashboard`.
