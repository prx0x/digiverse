# OPEN_RULE_DECISIONS.md — Rule Decisions, Conflicts, and Open Questions

**Purpose:** record every place where the sources conflicted or were silent, the organiser's decision, and what is still open. Agents must not guess. A decision here **overrides** both source documents (the rulebook footnotes give GDGoC final authority on interpretation).

**Sources:** **[R]** = `Digiverse_Official_Rules.docx` (original); **[R2]** = `Digiverse_Official_Rules_Updated.docx` (updated, reflects the decisions below — it is now the rulebook of record); **[C]** = `consider.docx`.
**Status values:** `RESOLVED` · `OPEN` (still needs an organiser answer) · `CONFIG` (resolved, but implemented as an admin setting).
**Last updated:** 2026-10-15 — decisions received from the organiser (Q1–Q30).

**Build Phase 5 gate:** only items marked **Blocks Build Phase 5 = Yes** and still `OPEN` stop work. Currently these are **OPEN-020, OPEN-021, OPEN-022, OPEN-023, OPEN-024** (new, listed at the bottom). Everything from OPEN-001 to OPEN-019 is resolved.

---

## Summary of resolved rules (what the engine must implement)

| Topic | Decision |
|---|---|
| Clash penalty | Each clashing team loses **(2/3) × its own pick**. Clashing picks are discarded from all calculations. |
| Majority deduction | **\|Target − pick\| / 2**, applied as a deduction (positive magnitude). |
| Penalty "X" | Not used by the above formulas. Retained as an optional admin value that organisers may change per round (see OPEN-020). |
| Standard deviation | **Population** (divide by N). |
| Equal To | **Exact equality only** (no rounding of the target). |
| All teams clash | No target. Every clashing team receives the clash penalty. No other scoring. |
| Empty bucket | The empty bucket is the minority; the other bucket is majority and is penalised; nobody gains from minority. Equal-To teams still get 2×. |
| No pick | Team loses **1/10 of its current points**; excluded from calculations. |
| Pick is final | A selected number **cannot be changed** for that round. |
| Round control | Admin starts each round **manually** and sets that round's **selection length**. |
| Cards | Totals set by admin (Reserve fixed at **1**). Teams may **hold several** of one kind. Each card is **single use**. **Max 1 card played per team per round.** Unused cards **carry over**. |
| Shield | Covers **all three**: clash penalty, majority deduction, reversed-minority deduction. Consumed on play even if not needed. |
| Reserve | Chosen in Lobby; becomes the holder's pick; **greyed out (unselectable)** for all other teams. |
| Peek | Strictly **< 50** (50 excluded), **excludes own pick**, **snapshot** at the moment of play. Returns a count only. |
| Reverse | Global effect for all teams; **odd** count ⇒ flipped, **even** ⇒ normal; flipped majority **wins its pick**; flipped minority **pays \|Target − pick\| / 2**; playable until the selection timer ends. |
| Rapid fire | MCQ, single correct answer. Winners = first N correct by **server time**. Retries up to an **admin-set attempts limit**. Timestamp ties: **admin setting**. |
| Scores | May go **negative**, no floor. Stored at full precision; **displayed** to 4 dp, **round half up**. |
| Leaderboard ties | 1) more **rounds in which the team gained points**; 2) more **power-up cards** (see OPEN-023 for meaning). |
| Branding | Use the **official GDG logo** once the file is supplied (see OPEN-025). |

---

## OPEN-001 — Clash deduction amount — **RESOLVED**
- **Conflict:** [R] fixed X vs [C] (2/3)×pick. **Decision:** (2/3) × the team's own selected number. 
- **Config:** `clashPenalty = TWO_THIRDS_OF_PICK` (fixed mode; no X). **Status:** RESOLVED (Q1b). Shield cancels it (OPEN-004).

## OPEN-002 — Majority deduction amount and sign — **RESOLVED**
- **Conflict:** [R] fixed X vs [C] `(StatisticalValue − pick)/2` (sign problem).
- **Decision:** deduction = `|Target − pick| / 2`, always a positive magnitude subtracted from the score. **Status:** RESOLVED (Q2b).
- Ledger convention: store as a negative delta with component `MAJORITY_DEDUCTION`.

## OPEN-003 — Reverse card — **RESOLVED**
- Global effect (Q6); even count ⇒ normal, odd ⇒ flipped (Q7); flipped majority wins points equal to its pick (Q8); flipped minority pays the same deduction as OPEN-002 (Q9); playable until selection timer ends (Q10).
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
- One bucket empty (Q18 yes): empty bucket = minority (fewest), non-empty = majority and is penalised; nobody gains from minority. Equal-To teams still score 2×.
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
- Cards: pre-round cards (Shield, Reserve) are played in the Lobby; during-round cards (Peek, Reverse) while selection is open.
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
1. Under Reverse, the **Equal-To bucket** still gets 2× (proposed: yes, Reverse only flips the `>`/`<` buckets).
2. Under Reverse, the **tie rule** (equal `>`/`<` counts ⇒ both score 0) still applies (proposed: yes).
3. Under Reverse with **one empty bucket**: the empty bucket is the minority, so the non-empty one is the majority and, being flipped, **wins points equal to its picks**, while the empty minority pays nothing. (Derived from your answers — confirm.)
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
1. Rapid fire gives **no points**, only cards? (Assumed yes — [R] only describes cards.)
2. If **fewer than N teams** answer correctly, only those get the card; if nobody answers correctly, the card is **not awarded** and stays unspent. (Proposed — confirm.)
3. When a question is mapped to a card whose **supply is already used up**, the admin panel warns and blocks starting that question.
- **Status:** OPEN (low risk).

### OPEN-025 — Official GDG logo asset  (Blocks Build Phase 5: No)
- You said the official GDG logo may be used. I cannot download or redraw it. **Action for you:** place the official logo file(s) (SVG preferred, plus a light/dark variant if you have one) in `apps/web/src/assets/brand/` (or tell the agent where they are). Until then the app shows the text wordmark; the `Wordmark` component is built so the file drops in without any other change. Agents must not recreate the logo from memory.
- **Status:** OPEN (waiting on file).

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
| Scoring Rules | Majority deduction = \|Target − pick\|/2; new Empty Bucket, No Selection, and Points & Precision rules. |
| Power-Up Cards | Admin-set supply; multiples allowed; single use; one per round; carry-over. Shield covers three cases; Reserve greyed out for others; Peek definition; Reverse parity and global effect. |
| Winning the Game | Added tiebreakers. |
| Footnote 1 | "X points" → "penalty values" may be determined by organisers during the game. |

## Decision log

| ID | Decision | Decided by | Date | Config / notes |
|----|----------|-----------|------|----------------|
| 001 | Clash = 2/3 × pick | Organiser | 2026-10-15 | `clashPenalty=TWO_THIRDS_OF_PICK` |
| 002 | Majority = \|Target−pick\|/2 | Organiser | 2026-10-15 | `majorityPenalty=HALF_ABS_DISTANCE` |
| 003 | Reverse global, parity, flipped majority wins pick, flipped minority pays 002 | Organiser | 2026-10-15 | `reverse.parity=true`, `reversedMajorityReward=PICK` |
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

When a new answer arrives: update the entry, add a log row, set the config, add/adjust engine tests, and note it in `PROGRESS.md`.
