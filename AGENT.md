# AGENT.md — Persistent Instructions for Coding Agents (Cursor / Google Antigravity)

Project: **Digiverse** — a competitive, real-time game web application by **GDGoC IIIT Kota**.
This file is loaded as persistent context. Follow it for every task, without exception.

---

## 0. Terminology (read first — two different "phases" exist)

| Term | Meaning |
|---|---|
| **Build Phase 1–6** | The six stages of *building the software*, defined in `PHASED_EXECUTION_PLAN.md`. |
| **Game Phase A — Rapid Fire** | Gameplay stage where teams earn power-up cards (the official rulebook calls this "Phase 1: Rapid Fire"). |
| **Game Phase B — Main Game** | Gameplay stage with number picking and scoring (the rulebook calls this "Phase 2: The Main Game"). |

Always write "Build Phase N" or "Game Phase A/B" in code comments, commits, and docs. Never write a bare "Phase 1".

---

## 1. Mandatory reading — before ANY project work

Read these files **in full, in this order**, at the start of every session/task:

1. `MEMORY.md` — durable project context, conventions, design rules, security constraints.
2. `PROGRESS.md` — live status; tells you the active Build Phase.
3. `API_SURFACE_SUMMARY.md` — what API/events/types actually exist right now.
4. `PHASED_EXECUTION_PLAN.md` — scope, tasks, and acceptance criteria of every Build Phase.

Additionally:

- **Whenever a task touches gameplay rules, scoring, clashes, buckets, cards, statistics, tie-breaking, rounding, or the rapid-fire ranking → read `OPEN_RULE_DECISIONS.md` first.**
- Consult `README.md` for setup/run commands and `.env.example` for environment variables.
- Source documents (`Digiverse_Official_Rules.docx`, `consider.docx`) are the ultimate sources of truth for rules. Do not rely on memory of them; re-read the relevant section if in doubt.

If any mandatory file is missing, stop and tell the user. Do not recreate it from guesswork.

---

## 2. Execution protocol (strict cycle)

1. **Read** the four mandatory files (+ `OPEN_RULE_DECISIONS.md` if rules are involved).
2. **Inspect the real repository** (file tree, `package.json`/lockfiles, existing code, git status). Never assume planned work exists. Never trust `PROGRESS.md` over what the code actually shows — if they disagree, report the discrepancy and correct the docs.
3. **Identify the active Build Phase** from `PROGRESS.md` and `PHASED_EXECUTION_PLAN.md`.
4. **Select the smallest coherent task** inside the active Build Phase.
5. **Implement** it, preserving existing conventions and the Bauhaus design system.
6. **Verify**: run the available tests, linter, type-checker, and build. Add tests for new logic.
7. **Fix regressions** you caused.
8. **Update documentation**: `PROGRESS.md` (always, after each meaningful milestone); `MEMORY.md` (only when durable knowledge changes); `API_SURFACE_SUMMARY.md` (whenever API, DB contracts, shared types, or real-time events change); `README.md`/`.env.example` (when setup or env vars change).
9. **Report** to the user: what changed, what was tested (and results), what remains incomplete, and any blockers or newly found rule conflicts.
10. **Do not start the next Build Phase** while any acceptance criterion of the active phase is unmet, and never start it without the user's go-ahead after the phase is reported complete.

---

## 3. Phase-boundary rules

- Implement only work that belongs to the **active Build Phase**. Work from a later phase requires explicit user authorisation, recorded in `PROGRESS.md`.
- A phase is "complete" only when **every** acceptance criterion in `PHASED_EXECUTION_PLAN.md` is verified. Mark it in `PROGRESS.md` with evidence (commands run, results).
- **Build Phase 1 is the visual and structural foundation.** Later phases *extend* the shared shell, tokens, and components. They must not restyle, replace, or fork them. If a component truly needs to change, change it centrally and note it in `PROGRESS.md`.
- **Build Phase 5 is blocked** until every decision in `OPEN_RULE_DECISIONS.md` flagged "Blocks Build Phase 5" is either **Resolved by organisers** or implemented as a **validated, documented configuration option**. Do not pick an interpretation yourself.

---

## 4. Non-negotiable engineering rules

**Game logic and authority**
- The **server is authoritative** for timers, picks, clashes, targets, buckets, scoring, card use, and leaderboard. The client only displays state and sends intents.
- All scoring/statistics/clash/bucket logic lives in a **pure, framework-independent game-engine module** with unit tests. Never put scoring logic in React components or HTTP/WebSocket handlers.
- Game lifecycle uses **explicit state machines**; reject invalid transitions server-side.
- Use transactions (or equivalent atomic/locking mechanisms) for simultaneous picks, Reserve, card consumption, and score writes. Operations must be idempotent where clients may retry.
- **Never round intermediate statistical values.** Use arbitrary-precision decimal arithmetic (not binary floats) for statistics and scores; round **only for display** (leaderboard/scores: exactly 4 decimal places).
- Never hardcode a disputed rule value (X penalty, clash deduction formula, majority deduction formula, std-dev definition, etc.). Read it from validated configuration as described in `OPEN_RULE_DECISIONS.md`.

**Security**
- No public self-registration. Accounts are created only by an authenticated admin.
- Hash passwords with a modern algorithm (argon2id or bcrypt). Never log or return password hashes.
- **Never write real credentials into source, docs, tests, fixtures, or `.env.example`.** The source document `consider.docx` contains an initial admin ID and password; **do not copy that password anywhere in the repository.** Bootstrap the admin from environment variables (`ADMIN_BOOTSTRAP_*`), and recommend rotating the value.
- Enforce authorisation **server-side** on every route/event: team → own data only; admin → admin routes. Frontend hiding is not security.
- Validate all input on the server (schema validation). Rate-limit login and sensitive actions. Use secure, httpOnly cookies or equivalently safe token handling. Apply CORS allow-lists and security headers.
- Do not leak other teams' picks, cards, or palettes to team clients. Peek returns only a count.

**Frontend**
- Follow the Bauhaus design system in `MEMORY.md` §5. Use design tokens only — no ad-hoc hex values, font sizes, or spacings in components.
- Support responsive layouts, keyboard navigation, visible focus, sufficient contrast, and `prefers-reduced-motion`.
- Every data view needs loading, empty, error, disconnected, waiting, and completed states.
- Do not fabricate a GDGoC logo. Use the replaceable text-based identity unless an official asset is supplied.

**Honesty**
- No fake endpoints, fake data presented as real, or stubs that look production-ready. Mock data is allowed **only** in Build Phase 1 placeholders and must be clearly labelled (`MOCK`) and isolated in one location so it can be removed.
- Do not claim a feature, endpoint, or test exists unless you verified it in the repository.
- Do not add dependencies without a stated reason (record it in `MEMORY.md` if durable).
- Do not over-engineer. Prefer the simplest design that satisfies the acceptance criteria.

---

## 5. Handling conflicts and ambiguities

If you find a contradiction or gap in the rules or architecture:
1. Do **not** silently choose an interpretation.
2. Add or update an entry in `OPEN_RULE_DECISIONS.md` (source file, section, quoted/paraphrased statements, options, status).
3. Keep the code independent of the disputed value (configuration + validation), or stop and ask the user if it cannot be made configurable.
4. Mention it in your report.

---

## 6. Definition of a good change

- Smallest coherent task; matches the active Build Phase.
- Builds, lints, type-checks, and passes tests.
- Documentation updated in the same change set.
- No secrets committed; no unverified claims in docs.
- Report delivered in this format:

```
Changed:   <files / behaviour>
Tested:    <commands + results>
Incomplete:<what remains in this phase>
Blockers:  <or "none">
Docs:      <which docs were updated>
```
