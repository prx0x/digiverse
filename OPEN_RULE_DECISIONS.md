# OPEN_RULE_DECISIONS.md — Rule Decisions, Conflicts, and Open Questions

**Purpose:** record every place where the sources conflicted or were silent, the organiser's decision, and what is still open. Agents must not guess. A decision here **overrides** both source documents (the rulebook footnotes give GDGoC final authority on interpretation).

**Sources:** **[R]** = `Digiverse_Official_Rules.docx` (original); **[R2]** = `Digiverse_Official_Rules_Updated.docx` (updated, reflects the decisions below — it is now the rulebook of record); **[C]** = `consider.docx`.
**Status values:** `RESOLVED` · `OPEN` (still needs an organiser answer) · `CONFIG` (resolved, but implemented as an admin setting).
**Last updated:** 2026-10-16 — Q1–Q30 recorded 2026-10-15; Round 2 answers (OPEN-026 to OPEN-040) recorded 2026-10-16.

**Build Phase 5 gate:** only items marked **Blocks Build Phase 5 = Yes** and still `OPEN` stop work. Currently these are **OPEN-020, OPEN-021, OPEN-022**. Everything else from OPEN-001 to OPEN-019 and OPEN-025 to OPEN-040 is resolved, except the non-blocking **OPEN-023, OPEN-024 and OPEN-031**.

---

## Summary of resolved rules (what the engine must implement)

| Topic | Decision |
|---|---|
| Clash penalty | Each clashing team loses **(2/3) × its own pick**. Clashing picks are discarded from all calculations. |
| Majority deduction | **\|Target − pick\| / pick**, applied as a deduction (positive magnitude). |
| Minority award | **\|Target − pick\| / pick**, applied as a positive award. |
| Equal-To award | **+ pick** (selected number). |
| Penalty "X" | Not used by the above formulas. Retained as an optional admin value that organisers may change per round (see OPEN-020). |
| Standard deviation | **Population** (divide by N). |
| Equal To | **Exact equality only** (no rounding of the target). |
| All teams clash | No target. Every clashing team receives the clash penalty. No other scoring. |
| Empty bucket | The empty bucket is the minority; the other bucket is majority and is penalised; nobody gains from minority. Equal-To teams still get +pick. |
| No pick | Team loses **1/10 of its current points**; excluded from calculations. |
| Pick is final | A selected number **cannot be changed** for that round. |
| Round control | Admin starts each round **manually** and sets that round's **selection length**. |
| Cards | Totals set by admin (Reserve fixed at **1**). Teams may **hold several** of one kind. Each card is **single use**. **Max 1 card played per team per round.** Unused cards **carry over**. |
| Shield | Covers **all three**: clash penalty, majority deduction, reversed-minority deduction. Consumed on play even if not needed. |
| Reserve | Chosen in Lobby; becomes the holder's pick; **greyed out (unselectable)** for all other teams. |
| Peek | Strictly **< 50** (50 excluded), **excludes own pick**, **snapshot** at the moment of play. Returns a count only. |
| Reverse | Global effect for all teams; **odd** count ⇒ flipped, **even** ⇒ normal; flipped majority **wins \|Target − pick\| / pick**; flipped minority **pays \|Target − pick\| / pick**; playable until the selection timer ends. |
| Rapid fire | MCQ, single correct answer. Winners = first N correct by **server time**. Retries up to an **admin-set attempts limit**. Timestamp ties: **admin setting**. |
| Scores | May go **negative**, no floor. Stored at full precision; **displayed** to 4 dp, **round half up**. |
| Leaderboard ties | 1) more **rounds in which the team gained points**; 2) more **power-up cards** (see OPEN-023 for meaning). |
| Starting points | Every team starts Phase 2 with **100 points**. Phase 1 gives cards only. |
| Card windows | **Shield, Reserve:** Lobby only. **Peek, Reverse:** during selection, any time while it is open (also after locking). Reverse does not change clash or no-pick penalties. |
| Lobby | Lobby lasts admin-set seconds; **no communication between teams**; no card trading. |
| Leaderboard | **Always visible** to teams. |
| Reveal | After each round: clashes → target → buckets → score changes → leaderboard; shows each team's name and pick after the round ends. |
| Admin powers | Void/re-run a round, manual points/cards adjustment (with reason, logged), extend timer. No picking on behalf of a team. |
| Connectivity | Team may reconnect and pick within the timer. Server time only. |
| Cards | Only Shield, Reserve, Peek, Reverse. No extra card sources, no auction, no new cards. |
| Disputes and ties | Handled by GDG organisers; software shows shared rank. |
| Audience | No spectator view. |
| Branding | Use the **official GDG logo** from `apps/web/public/assets/` (see OPEN-025). |

---

## OPEN-001 — Clash deduction amount — **RESOLVED**
- **Conflict:** [R] fixed X vs [C] (2/3)×pick. **Decision:** (2/3) × the team's own selected number. 
- **Config:** `clashPenalty = TWO_THIRDS_OF_PICK` (fixed mode; no X). **Status:** RESOLVED (Q1b). Shield cancels it (OPEN-004).

## OPEN-002 — Majority deduction amount and sign — **RESOLVED**
- **Conflict:** [R] fixed X vs [C] `(StatisticalValue − pick)/2` (sign problem).
- **Decision (updated):** deduction = `|Target − pick| / pick`, always a positive magnitude subtracted from the score. Minority award uses the same magnitude `|Target − pick| / pick`. Equal-To award = `+ pick` (was previously `2 × pick`). **Status:** RESOLVED (Q2b; formula refresh).
- Ledger convention: store as a negative delta with component `MAJORITY_DEDUCTION`.

## OPEN-003 — Reverse card — **RESOLVED**
- Global effect (Q6); even count ⇒ normal, odd ⇒ flipped (Q7); flipped majority wins `|Target − pick| / pick` (same magnitude as minority award) (Q8); flipped minority pays the same deduction as OPEN-002 (Q9); playable until selection timer ends (Q10).
- **Total Reverse cards** and per-team limits: supply set by admin (Q5); a team plays at most one card per round (Q25), so several Reverse activations in a round come from different teams.
- Not yet answered → **OPEN-021** (Equal-To bucket and tiebreaker under Reverse; one-empty-bucket under Reverse).
- **Status:** RESOLVED, with follow-ups in OPEN-021.

## OPEN-004 — Shield scope — **RESOLVED**
- Covers clash penalty, majority deduction, and reversed-minority deduction (Q11). Consumed on play regardless of need (Q12).
- Does **not** stop the clashing number being discarded (only points are nullified) — engineering reading of [R] "nullifies any potential point deduction".
- Whether Shield covers the **no-pick penalty** → **OPEN-022**. **Status:** RESOLVED (core), OPEN-022 for the extra case.

## OPEN-005 — Standard deviation — **RESOLVED**
- Population standard deviation, divide by N (Q4). N=1 ⇒ σ = 0 (so Mean + 1σ equals that single pick). N=0 ⇒ no target (OPEN-006). **Status:** RESOLVED.

## OPEN-006 — Degenerate rounds — **RESOLVED**
- **All teams clash:** no target; every clashing team gets the clash penalty; nothing else scores (Q17).
- **Nobody picks:** all teams are no-pick (OPEN-014); no target; nothing else scores. (Engineering consequence of Q17/Q19.)
- **Exactly one valid pick:** target is computed normally (Midrange = that pick; σ = 0); that team is Equal To for Mean, Midrange, Geometric mean; for Two-thirds, target < pick ⇒ team is alone in `>`. Engine handles via normal rules. **Status:** RESOLVED.

## OPEN-007 — Bucket edge cases and tiebreaker — **RESOLVED**
- One bucket empty (Q18 yes): empty bucket = minority (fewest), non-empty = majority and is penalised; nobody gains from minority. Equal-To teams still score +pick.
- Both `>` and `<` empty: only Equal-To scoring (and clash/no-pick penalties).
- Equal counts (both non-empty): 0 points for teams in both buckets; Equal-To unaffected ([R]).
- Clashing teams are not counted in bucket sizes. **Status:** RESOLVED.
- Follow-up under Reverse → OPEN-021.

## OPEN-008 — Equality, precision, and rounding — **RESOLVED**
- **Decision:** Equal-To uses **exact equality** (Q16a); display rounding **round half up** to 4 dp (Q27); stored values **never rounded**.
- **Engineering requirement (implementation detail):** do equality tests with exact arithmetic, not floats:
  - Mean, Two-thirds, Midrange are rational ⇒ compare using integer cross-multiplication (BigInt fractions).
  - Geometric mean equals integer *t* iff `∏xᵢ = t^N` (BigInt check).
  - Mean + 1σ equals *t* iff `t ≥ mean` and `(t − mean)² = σ²` using exact rationals.
  - Non-integer targets can never equal an integer pick; arbitrary-precision decimals (≥ 50 digits) are used only for the non-equality calculations (displayed target, scoring magnitudes).
- Note for organisers: with exact equality, Geometric mean and Mean + 1σ rounds will almost never produce an Equal-To team; Mean/Two-thirds/Midrange occasionally will. **Status:** RESOLVED (Q16a, Q27).

## OPEN-009 — Score sign, floors, ledger — **RESOLVED**
- Totals may be negative; no floor (Q26). Deductions stored as negative deltas with component labels. Fractional values accumulated unrounded. **Status:** RESOLVED.

## OPEN-010 — Rapid-fire ranking and awards — **RESOLVED**
- Questions are **MCQ with a single correct answer** (Q24) ⇒ no text normalisation needed.
- Winners = **first N correct submissions by server time**; N set per question by admin (Q22).
- **Retries** allowed up to an admin-set `maxAttempts` (Q22). *Engineering recommendation:* default `maxAttempts = 1`, because with MCQ a retry lets a team brute-force options; the admin may raise it.
- **Timestamp ties:** admin setting (Q23): `tieBreak = SHARE_CARD | EARLIEST_RECEIVED_THEN_TEAM_ID` (default recommended: earliest received).
- Rank time is the server receive time of the team's **correct** submission. **Status:** RESOLVED (CONFIG).

## OPEN-011 — Card supply, usage limits — **RESOLVED**
- Supply per card set in the admin panel; Reserve fixed at 1 (Q5, Q25). A team may hold multiples of a kind (Q25). Max **one card played per team per round** (Q25 — this means a team cannot combine, e.g., Shield + Peek in one round). Unused cards carry over (Q25). Each card single use (Q5).
- Validation: total awardable ≤ supply; card→question mapping cannot exceed supply. **Status:** RESOLVED (CONFIG).

## OPEN-012 — Reserve mechanics — **RESOLVED**
- Chosen during Lobby, becomes holder's pick (Q13); shown **greyed out/unselectable** to others (Q14). Only 1 exists.
- Engineering note: a greyed tile reveals that *someone* reserved it but not who; this is accepted by the organiser's choice. **Status:** RESOLVED.

## OPEN-013 — Peek mechanics — **RESOLVED**
- Strictly below 50; own pick excluded; snapshot at play time (Q15). Counts all picks already submitted at that instant, including the Reserve number. Returns a number only. **Status:** RESOLVED.

## OPEN-014 — Timing, locking, and no-pick behaviour — **RESOLVED** (with follow-ups)
- Admin starts each round manually and sets that round's selection length (Q21).
- A selected number is **final** — no changes (Q20). *UI recommendation (not a rule):* show a confirm step ("Lock in 47?") before submitting so a mis-tap isn't irreversible.
- **No pick:** team loses **1/10 of its current points** and is excluded from calculations (Q19).
- Follow-ups on the no-pick penalty (what "current points" means; negative totals) → **OPEN-020**. Shield and no-pick → **OPEN-022**.
- Cards: pre-round cards (Shield, Reserve) are played in the Lobby; during-round cards (Peek, Reverse) while selection is open (OPEN-027). The Lobby has an admin-set length (OPEN-033).
- Late submissions after the timer ends are rejected (ENGINEERING). **Status:** RESOLVED.

## OPEN-015 — Statistic definitions — **RESOLVED**
- All statistics use the unique non-clashing picks. Midrange uses the lowest and highest of those. Two-thirds = (2/3) × mean. Geometric mean = (∏xᵢ)^(1/N). No intermediate rounding. **Status:** RESOLVED (engineering confirmation of source wording).

## OPEN-016 — Terminology "Phase" — **RESOLVED** (documentation convention: Game Phase A/B and Build Phase 1–6).

## OPEN-017 — Final standings and ties — **RESOLVED** (with follow-ups)
- Sorted by total points descending. Tiebreakers in order: (1) more rounds in which the team **gained points**; (2) more **power-up cards** (Q28).
- If still tied, teams **share the rank** (ENGINEERING default).
- How many teams "win" is not stated; the leaderboard shows rank, the organisers declare the cut-off. Meaning of the two tiebreakers → **OPEN-023**.

## OPEN-018 — Admin credentials in source document — **RESOLVED** (handling)
- Never copy the password from [C] into the repo; bootstrap from env vars; organiser should set a fresh password. **Status:** RESOLVED.

## OPEN-019 — Admin live data visibility — **RESOLVED**
- Admin sees each team's pick and every detail live during selection ([C]); teams never see other teams' picks. **Status:** RESOLVED.

---

## Newly surfaced questions (your answers raised these) — please answer

### OPEN-020 — No-pick penalty details and the leftover "X"  (Blocks Build Phase 5: Yes)
1. **"1/10 of their current points"** — measured against the team's total **at the start of that round** (proposed), or after other deductions in the same round?
2. **If the total is negative or zero:** with a negative total, 1/10 × current would be a *gain* if applied literally. Proposed: penalty = `max(0, total) / 10` (no penalty at ≤ 0). Alternative: `|total| / 10` always deducted. Which?
3. **X:** since clash and majority penalties now use formulas, X is no longer used anywhere. You said X "can change per round". Should I (a) drop X entirely, or (b) keep an optional per-round X that does nothing unless you tell me which rule it feeds? *(Default if unanswered: (b), unused.)*
- **Status:** OPEN.

### OPEN-021 — Reverse interactions  (Blocks Build Phase 5: Yes)
1. Under Reverse, the **Equal-To bucket** still gets +pick (proposed: yes, Reverse only flips the `>`/`<` buckets).
2. Under Reverse, the **tie rule** (equal `>`/`<` counts ⇒ both score 0) still applies (proposed: yes).
3. Under Reverse with **one empty bucket**: the empty bucket is the minority, so the non-empty one is the majority and, being flipped, **wins \|Target − pick\| / pick**, while the empty minority pays nothing. (Derived from your answers — confirm.)
4. If **Shield** is played by a team in the *flipped* minority, it nullifies that deduction (covered by your Q11 "all three") — assumed yes.
- **Status:** OPEN (proposed answers in brackets).

### OPEN-022 — Does Shield cover the no-pick penalty?  (Blocks Build Phase 5: Yes)
- Shield is played in the Lobby (before picking). [R] says it nullifies "any potential point deduction". Proposed: **yes**, it also nullifies the no-pick penalty. Or limit Shield to the three cases you listed (Q11)?
- **Status:** OPEN.

### OPEN-023 — Meaning of the leaderboard tiebreakers  (Blocks Build Phase 5: No)
1. "Number of times the team gained points" — proposed: **number of main-game rounds in which the team's net score for the round was greater than 0**. (Alternative: count of positive scoring events, e.g. both a minority gain and an exact match in one round.)
2. "Number of powerup cards" — proposed: **cards the team still holds (unused) at the end of the game**. Alternative: total cards ever earned. Which?
- **Status:** OPEN.

### OPEN-024 — Rapid-fire scoring and no-answer cases  (Blocks Build Phase 5: No; blocks Build Phase 4 only for item 2)
1. Rapid fire gives **no points**, only cards? (Assumed yes — [R] only describes cards.) *(Settled with OPEN-026: cards only.)*
2. If **fewer than N teams** answer correctly, only those get the card; if nobody answers correctly, the card is **not awarded** and stays unspent. (Proposed — confirm.)
3. When a question is mapped to a card whose **supply is already used up**, the admin panel warns and blocks starting that question.
- **Status:** OPEN (low risk).

### OPEN-025 — Official GDG logo asset — **RESOLVED**
- The organiser supplied three logo files in **`digiverse/apps/web/public/assets/`** (the old path `apps/web/src/assets/brand/` is no longer used):
  - **GDG Brackets**
  - **GDG Centered**
  - **GDG Left aligned**
- **Instruction to agents:** list that folder first and use the **exact filenames found there** (do not guess or retype them). Use the files wherever the logo is needed: Brackets as the compact mark, Centered for centred layouts such as login/lobby, Left-aligned for headers. Do **not** redraw, recolour or recreate the logo. The `Wordmark` component should point at these files and keep the text wordmark only as a fallback if a file fails to load.
- **Status:** RESOLVED (Q40).

---

## Round 2 decisions — answered 2026-10-16

Items answered by the organiser on 2026-10-16. Where the answer did not cover every sub-point, the **proposed default** was used and is marked *(default)* so you can overrule it.

### OPEN-026 — Starting points and Phase 1 → Phase 2 handover — **RESOLVED**
- Every team starts Phase 2 with **100 points**. Config: `startingPoints = 100`.
- All teams start at the same score regardless of Phase 1 results; Phase 1 gives **cards only, no points** *(default)*. This also settles OPEN-024.1.
- Consequence: the no-pick penalty (OPEN-020) is meaningful from round 1 (1/10 of 100 = 10 on a first-round no-pick, if measured at the start of the round).
- **Status:** RESOLVED (Q26).

### OPEN-027 — Card play windows and Reverse side-effects — **RESOLVED**
- **Shield and Reserve:** playable **only in the Lobby**.
- **Peek and Reverse:** playable **only during selection**, and **at any moment while selection is open**, including after the team has already locked its own pick. *(Recorded reading of "at anytime during that round selection"; tell the agent if you meant otherwise.)*
- **Reverse does not change** the clash penalty or the no-pick penalty.
- Equal-To under Reverse stays in OPEN-021.1.
- Config: `cardWindow = { SHIELD: LOBBY, RESERVE: LOBBY, PEEK: SELECTION, REVERSE: SELECTION }`.
- **Status:** RESOLVED (Q27).

### OPEN-028 — Reserve edge cases — **RESOLVED**
- Playing Reserve uses the team's one card for that round. The reserved number is the team's pick, so a Reserve player **never** gets the no-pick penalty. An unplayed Reserve carries over. Any number 1–100 may be reserved.
- **Status:** RESOLVED (all four proposed answers accepted).

### OPEN-029 — Target display and reveal order — **RESOLVED**
- The target is shown to 4 dp (half up); scoring uses the exact value.
- Reveal order: clashes → target → buckets → score changes → leaderboard.
- After the round ends, the reveal shows **each team's name and pick** (never before the round ends).
- **Status:** RESOLVED. (See OPEN-040 for who sees this screen.)

### OPEN-030 — Teams, rounds, formula sequence, practice round — **RESOLVED (CONFIG)**
- Decided from the **admin panel**: number of rounds, the formula per round, the lobby time and selection time, and whether a practice round exists.
- Engineering requirement: the admin can create a round flagged `practice` that is not scored and uses no cards, and scores are unchanged afterwards. Team count and size are not limits in the software.
- **Status:** RESOLVED (CONFIG).

### OPEN-031 — Final round multiplier and twist rounds — **OPEN**  (Blocks Build Phase 5: No)
- *Plain-language version:* a "multiplier" makes one round count more. In a **2× round**, every point a team gains or loses in that round is **doubled**, including clash and no-pick penalties. It is used for the last round so that a team in the middle can still catch up, and the leader cannot simply relax.
- **Question:** do you want a multiplier at all?
  - **No** → nothing is built; every round counts the same.
  - **Optional (proposed)** → the admin panel gets a per-round `scoreMultiplier`, which is **1 by default**, so nothing changes unless you set it for a round.
- **Mystery formula round:** not built, because the rulebook says the formula is announced at the start of the round.
- **Status:** OPEN (low risk; default if unanswered = **Optional**, multiplier 1).

### OPEN-032 — Leaderboard visibility — **RESOLVED**
- The **leaderboard is always shown** to teams. No hiding in late rounds, no per-round toggle.
- **Status:** RESOLVED.

### OPEN-033 — Communication, alliances, collusion — **RESOLVED**
- The Lobby lasts **X seconds, set by the admin**. When it ends, selection opens.
- **No communication between teams** during the Lobby or the selection. There is no negotiation window.
- Card trading between teams is **not** allowed *(default)*.
- Any breach is judged by the GDGoC organisers under the final-authority clause. The software does not detect it.
- Config: `lobbySeconds` (per round).
- **Status:** RESOLVED.

### OPEN-034 — Extra card sources and new cards — **RESOLVED**
- **No** additional ways to earn cards, **no** auction, and **no** new cards (Spy, Double Down, Mirror, Jammer). Only Shield, Reserve, Peek and Reverse exist, earned in Phase 1.
- **Status:** RESOLVED.

### OPEN-035 — Phase 1 details — **RESOLVED (CONFIG)**
- Number of questions, time per question, attempts, the winners per question, and the card mapped to each question are all set from the **admin panel**.
- Questions go live for all teams at the same moment *(default)*. No wrong-attempt penalty *(default)*; `maxAttempts` per OPEN-010.
- **Status:** RESOLVED (CONFIG).

### OPEN-036 — Winners, prizes, rank display — **RESOLVED**
- The software ranks teams by points, then the two tiebreakers (OPEN-017/023). It does **not** decide how many teams win.
- If teams are still tied after both tiebreakers, the **GDG organisers decide on the spot**. The software just shows them with a shared rank.
- No special awards in software.
- **Status:** RESOLVED.

### OPEN-037 — Admin overrides and mistakes — **RESOLVED**
- The admin can **void or re-run a round**; the ledger keeps the voided entries as an audit trail.
- The admin can **manually adjust a team's points or cards**, with a required reason, and every change is logged (who, when, why).
- The admin can **extend the timer** after a round has started; it is logged and cannot shorten below the time already elapsed.
- The admin does **not** submit a pick on behalf of a team *(default; the organiser answered "yes" to the group, so tell the agent if you do want this)*. For a device failure the admin may void that team's participation for the round with no penalty.
- **Status:** RESOLVED (Q37).

### OPEN-038 — Connectivity and device problems — **RESOLVED**
- A team whose device disconnects **may reconnect and still pick within the timer**.
- No page loaded by the deadline = normal no-pick penalty, unless the admin voids that team's round (OPEN-037) *(default)*.
- Only **server time** counts *(default)*.
- **Status:** RESOLVED.

### OPEN-039 — Disputes and rulings — **RESOLVED**
- **Managed by the organisers** on the day; there is no dispute workflow in the software.
- Teams can see a per-round score breakdown *(default)* (clash, majority, minority, exact, no-pick).
- **Status:** RESOLVED.

### OPEN-040 — Audience and branding — **RESOLVED**
- **No spectator or audience view** and no audience poll.
- The reveal screen from OPEN-029 is the organisers' screen to project; nothing is built for audience login.
- Use the official **GDG logo** where required. See OPEN-025 for the file locations.
- **Status:** RESOLVED.

---

## Change summary: original rulebook → updated rulebook (`Digiverse_Official_Rules_Updated.docx`)

| Section | Change |
|---|---|
| Phase 1: Rapid Fire | MCQ single answer; attempts limit; top-N by server time; tie rule; question sets set by organisers. |
| Phase 2 intro | Organisers set rounds and each round's card; rounds started manually with set selection time. |
| New: Statistical Cards | Lists Mean, Two-thirds, Midrange, Mean + 1σ (population), Geometric mean on non-clashing picks, no rounding. |
| Round flow, step 2 | Palette randomised per team per round; pick is final; one card per round max. |
| Round flow, step 3 | Clash penalty = 2/3 × pick; all-clash ⇒ no target, no other scoring. |
| Round flow, step 5 | Equal To is exact equality. |
| Scoring Rules | Majority deduction = \|Target − pick\|/pick; minority award = \|Target − pick\|/pick; Equal-To = +pick; Empty Bucket, No Selection, and Points & Precision rules. |
| Power-Up Cards | Admin-set supply; multiples allowed; single use; one per round; carry-over. Shield covers three cases; Reserve greyed out for others; Peek definition; Reverse parity and global effect. |
| Winning the Game | Added tiebreakers. |
| Footnote 1 | "X points" → "penalty values" may be determined by organisers during the game. |

## Decision log

| ID | Decision | Decided by | Date | Config / notes |
|----|----------|-----------|------|----------------|
| 001 | Clash = 2/3 × pick | Organiser | 2026-10-15 | `clashPenalty=TWO_THIRDS_OF_PICK` |
| 002 | Majority = \|Target−pick\|/pick; minority = same; Equal-To = +pick | Organiser | 2026-10-15 (formula refresh) | `majorityPenalty=HALF_ABS_DISTANCE` |
| 003 | Reverse global, parity, flipped majority wins \|S−n\|/n, flipped minority pays 002 | Organiser | 2026-10-15 (formula refresh) | `reverse.parity=true`, `reversedMajorityReward=PICK` |
| 004 | Shield covers clash, majority, reversed-minority; consumed on play | Organiser | 2026-10-15 | `shieldCovers={clash,majority,reversedMinority}=true` |
| 005 | Population σ | Organiser | 2026-10-15 | `stdDevMode=POPULATION` |
| 006 | All-clash: all get clash penalty, no other scoring | Organiser | 2026-10-15 | `NO_TARGET` outcome |
| 007 | Empty bucket = minority; other = majority | Organiser | 2026-10-15 | — |
| 008 | Exact equality; display half-up 4dp | Organiser | 2026-10-15 | `equalityMode=EXACT`, `displayRounding=HALF_UP` |
| 009 | Negative totals allowed | Organiser | 2026-10-15 | — |
| 010 | MCQ; first N correct by server time; tie = admin setting; retries = admin setting | Organiser | 2026-10-15 | `maxAttempts` (default 1 recommended), `tieBreak` |
| 011 | Supply by admin; Reserve=1; multiples OK; 1 card/round; carry-over; single use | Organiser | 2026-10-15 | `cardSupply[]`, `maxCardsPerRound=1` |
| 012 | Reserve chosen in Lobby, greyed out for others | Organiser | 2026-10-15 | — |
| 013 | Peek <50, excl. own, snapshot | Organiser | 2026-10-15 | — |
| 014 | Admin starts rounds manually, sets length; pick final; no-pick = −1/10 current points | Organiser | 2026-10-15 | `noPickPenaltyFraction=1/10` (details in OPEN-020) |
| 017 | Tiebreakers: rounds with gain, then power-up cards; else share rank | Organiser | 2026-10-15 | meaning in OPEN-023 |
| 025 | Official GDG logo files supplied in `apps/web/public/assets/` | Organiser | 2026-10-16 | Brackets / Centered / Left aligned |
| 026 | Start Phase 2 with 100 points; Phase 1 gives cards only | Organiser | 2026-10-16 | `startingPoints=100` |
| 027 | Shield/Reserve Lobby only; Peek/Reverse during selection any time; Reverse does not affect clash/no-pick | Organiser | 2026-10-16 | `cardWindow` |
| 028 | Reserve counts as a pick; carries over if unplayed | Organiser | 2026-10-16 | — |
| 029 | Reveal order fixed; names and picks shown after round | Organiser | 2026-10-16 | — |
| 030 | Rounds, formulas, practice round set from admin panel | Organiser | 2026-10-16 | `practice` flag |
| 032 | Leaderboard always visible | Organiser | 2026-10-16 | — |
| 033 | Admin-set lobby seconds; no inter-team communication; no trading | Organiser | 2026-10-16 | `lobbySeconds` |
| 034 | No extra cards or card sources | Organiser | 2026-10-16 | — |
| 035 | Phase 1 settings from admin panel | Organiser | 2026-10-16 | — |
| 036 | Ties beyond tiebreakers decided by GDG organisers | Organiser | 2026-10-16 | shared rank |
| 037 | Admin can void/re-run rounds, adjust points/cards (logged), extend timer | Organiser | 2026-10-16 | audit log |
| 038 | Reconnect and pick within timer allowed | Organiser | 2026-10-16 | — |
| 039 | Disputes managed by organisers | Organiser | 2026-10-16 | — |
| 040 | No spectator view; use GDG logo | Organiser | 2026-10-16 | — |

When a new answer arrives: update the entry, add a log row, set the config, add/adjust engine tests, and note it in `PROGRESS.md`.
