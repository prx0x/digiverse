# OPEN_RULE_DECISIONS.md — Rule Conflicts, Ambiguities, and Decision Log

**Purpose:** track every place where the sources conflict, are silent, or are ambiguous. Agents must not guess. Before Build Phase 5 implements an affected calculation, each item marked **Blocks Build Phase 5 = Yes** must be *Resolved by organisers* or implemented as a *validated configuration option* (default must be explicit, never silently assumed).

**Sources:** **[R]** = `Digiverse_Official_Rules.docx`; **[C]** = `consider.docx` (no headings; cited by the topic line).
**Status values:** `OPEN` · `CONFIG-READY` (implemented as validated option, awaiting organiser choice) · `RESOLVED` (organiser decision recorded below).
**Last updated:** 2026-10-15 — all items currently `OPEN`.

Rulebook authority notes ([R] footnotes): X "may be subject to determination by the organisers during the game"; GDGoC has final authority on interpretation; rules may be amended and communicated before the respective game. Hence **organiser decisions override both documents** and must be recorded here.

**Phase 1 independence:** Build Phase 1 UI must not depend on any entry below.

---

## OPEN-001 — Clash deduction amount
- **[R]** Step 3 "Clash Resolution": clashing teams "immediately lose a set amount of penalty points (X points)"; numbers are instantly discarded from calculations.
- **[C]** "For Clash resolution, the conflicting teams will get the deduction (2/3)*(their pick)."
- **Conflict:** fixed/organiser-set X vs. pick-dependent 2/3 × pick. [C] does not say it replaces X; [R] says X may be set by organisers.
- **Options:** (a) flat X; (b) (2/3) × pick; (c) other organiser value.
- **Engineering plan:** `clashPenaltyMode = FIXED_X | TWO_THIRDS_OF_PICK` + `clashPenaltyX` (decimal ≥ 0). No default is assumed; the event cannot start a round without a chosen mode.
- **Related:** whether Shield nullifies this (OPEN-004); whether it is computed from the discarded pick.
- **Blocks Build Phase 5:** Yes. **Status:** OPEN.

## OPEN-002 — Majority-bucket deduction amount (and its sign)
- **[R]** Scoring Rules, "Majority Bucket": majority teams "suffer an X point deduction".
- **[C]** "For the majority's point deduction (or minority, when odd number of reverse cards used), formula will be = (StatisticalValue – their selected number)/2".
- **Conflict:** flat X vs. formula. **Sign ambiguity:** majority in `>` bucket has pick > value ⇒ formula negative; in `<` bucket ⇒ positive. Read literally, a majority team in `<` would *gain* points, or a deduction could be double-negated.
- **Options:** (a) flat X; (b) `|StatisticalValue − pick| / 2` applied as a deduction (absolute value); (c) signed literal formula added to score; (d) other.
- **Engineering plan:** `majorityPenaltyMode = FIXED_X | HALF_ABS_DISTANCE | HALF_SIGNED_DISTANCE` + `majorityPenaltyX`. Store raw deduction magnitudes and sign conventions in the score ledger.
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-003 — Reverse card: semantics and parity
- **[R]** Power-Up Cards, "Reverse": "Flips the scoring logic for the Buckets. If activated, the Majority bucket wins points, and the Minority bucket suffers the deduction."
- **[C]** "...(or minority, when odd number of reverse cards used)" ⇒ implies multiple Reverse cards can be active in one round and effects toggle by parity.
- **Gaps:**
  1. How many Reverse cards exist in the game and per team? Can one team play several in a round?
  2. Even count ⇒ presumably normal. Confirm.
  3. When reversed, how many points does the Majority win — their pick (as Minority normally does) or something else? [R] does not say.
  4. The deduction applied to the new Minority — flat X or the [C] formula (see OPEN-002)?
  5. Does Reverse affect the Equal-To bucket (assumed **no**) or the tiebreaker (OPEN-007)?
  6. Is the activation visible to other teams? Cutoff for activation (before timer ends / before own lock-in)? Does activation count if the playing team is clashing or Shielded?
  7. Is the effect global (all teams) or only for the playing team? [R]/[C] read as global ("flips the scoring logic for the Buckets").
- **Engineering plan:** `reverseCount` is recorded per round; `effectiveReversed = reverseCount % 2 === 1`; reward-for-reversed-majority is a config field (`reversedMajorityReward = PICK | OTHER`).
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-004 — Shield scope
- **[R]** "Nullifies any potential point deduction for the team in that round." **[C]** is silent.
- **Ambiguities:** Does "any deduction" include (a) the clash deduction, (b) the majority deduction, (c) the reversed-minority deduction? Is Shield consumed if no deduction occurs? Does it prevent the clash *discard* of the number (assumed **no** — only points)? Is Shield played before the round only (it is "Pre-Round") — can it still be played once the palette opens?
- **Engineering plan:** `shieldCovers = { clash: bool, majority: bool, reversedMinority: bool }`, defaulting to none until confirmed; consumption always on play (confirm).
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-005 — Standard deviation definition (Mean + 1σ)
- **[R]** has no Mean+1σ card. **[C]**: "mean plus one time the standard deviation (of non-conflicting picks)". Population vs sample not stated.
- **Options:** population σ (divide by N) or sample s (divide by N−1).
- **Edge cases:** N=1 (sample σ undefined; population σ = 0); N=0 (see OPEN-006).
- **Engineering plan:** `stdDevMode = POPULATION | SAMPLE`; `sampleStdDevForSingleValue` behaviour must be defined if SAMPLE is chosen. Do not round intermediates.
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-006 — Degenerate rounds (no/too few valid picks)
- Neither source covers: all teams clash; zero picks submitted; exactly one valid pick; Midrange with one pick (low = high).
- **Questions:** Is a target defined with 0 valid picks (likely: no scoring beyond clash penalties)? Are non-clash penalties still applied?
- **Engineering plan:** engine returns a typed `NO_TARGET` outcome; scoring behaviour configurable once decided.
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-007 — Bucket edge cases and tiebreaker
- **[R]** Tiebreaker: if `>` and `<` buckets have equal counts, all teams in them score 0; Equal-To teams "still" get 2×.
- **Gaps:**
  1. If one of `>`/`<` is empty and the other non-empty, the empty bucket has the *fewest* (0) and the other is Majority ⇒ the majority team(s) are deducted and nobody gains. Confirm this literal reading.
  2. If both are empty (everyone Equal-To or discarded) ⇒ nothing besides 2×.
  3. Does the tiebreaker (score 0) also nullify Shield/penalty? (Presumably no deductions occur in a tie.)
  4. Clashing teams: not counted in bucket sizes (EXPLICIT [R] "discarded"). Confirm they receive no bucket scoring.
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-008 — "Equal To" with non-integer targets, precision, and rounding
- Targets such as 2/3·mean, geometric mean, or mean+σ are rarely integers; picks are integers 1–100. Exact equality is only possible when the target is mathematically an integer.
- **[C]** requires leaderboard precision "upto 4 decimal points"; the master brief forbids rounding intermediates.
- **Questions:** Is equality *exact* or within a tolerance (e.g. rounding target to an integer or 4 dp first)? Is the displayed 4-dp score rounded half-up or truncated? Is the target itself shown to participants with some precision?
- **Engineering plan:** decimal arithmetic; `equalityMode = EXACT | ROUND_TARGET_TO_INTEGER | EPSILON` with `epsilon`; `displayRounding = HALF_UP | TRUNCATE` (display only). Irrational results (geometric mean, σ) make EXACT effectively unreachable — raise with organisers.
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-009 — Score sign, floors, and ledger
- **Questions:** Can a team's total go negative? Is there a floor? Are deductions stored as negative deltas (recommended)? Are fractional deductions (e.g. (value−pick)/2) accumulated unrounded (assumed yes)?
- **Blocks:** No for UI; Yes for ledger design (Build Phase 5). **Status:** OPEN.

## OPEN-010 — Rapid-fire ranking and award rules
- **[R]** Phase 1: "The fastest team(s) to answer correctly are awarded a specific Power-Up Card mapped to that question." Repeats "for a set number of rounds".
- **[C]** Admin decides "how many top X teams (sorted by time, then correct)" get the card, and "the number of sets of the questions".
- **Ambiguities:** "sorted by time, then correct" could mean rank all submissions by time then filter to correct (assumed) vs. different. Are wrong answers allowed to be retried, or penalised/locked? Timestamp ties? Answer matching (case, whitespace, numeric tolerance, MCQ vs free text)? Question timer and late submissions? Meaning and structure of "sets" (a set = a group of questions? rounds per set?). Note naming collision: "X" here is the top-teams count, distinct from rulebook penalty X.
- **Engineering plan:** server timestamp (monotonic receive time) is authoritative; award = first N correct submissions; ties → configurable (`tieBreak = EARLIEST_RECEIVED_THEN_ID | SHARE`); retries config `maxAttempts`.
- **Blocks Build Phase 5:** No. **Blocks Build Phase 4:** Partly (confirm before implementing). **Status:** OPEN.

## OPEN-011 — Card supply, economy, and usage limits
- **[R]:** "Only 1 [Reserve] in the game." Other card quantities unspecified. Cards are earned in Game Phase A.
- **Gaps:** total counts per card type; whether a team can hold multiple of a card; may a team play several cards in one round; are unused cards carried forward; may cards be transferred; is a card consumed on play even if it had no effect; is a card playable by a team that has not picked.
- **Engineering plan:** admin-configurable `maxSupply` per card type (Reserve fixed to 1, enforced), per-round play limits as config. Admin question→card mapping must validate supply.
- **Blocks:** Yes (for Build Phase 5), partly Build Phase 3/4. **Status:** OPEN.

## OPEN-012 — Reserve card mechanics
- **[R]:** "lock in a number before the palette opens, guaranteeing nobody else can clash with them, as the number will be unavailable for others to choose."
- **Ambiguities / interactions:** how the reserved number is chosen (before the palette opens — i.e. during Lobby) and whether it *is* the holder's pick (assumed yes). How "unavailable" is shown on others' randomised palettes without leaking a reservation (disabled tile vs. hidden tile; [C] requires randomised palettes and the master brief requires all 100 values). Whether two teams may play Reserve in the same moment (only one card exists). Does the reserved number count in calculations like any other valid pick (assumed yes).
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-013 — Peek card semantics
- **[R]:** "see how many of the currently locked-in picks are below 50."
- **Ambiguities:** strictly "< 50" (assumed; 50 excluded)? Does it include the requesting team's own lock-in? Includes picks that will later clash? Snapshot at activation time (assumed) vs. live? One-time reveal per card? Does the reserved number count?
- **Blocks:** Yes. **Status:** OPEN.

## OPEN-014 — Round timing and selection lock
- **[R]:** "Teams have a limited time to pick a number." Durations unspecified. "Currently locked-in picks" implies a lock-in action.
- **Gaps:** timer length (admin-configurable assumed); can a team change a pick before lock-in/time-out? What happens if a team does not pick (score 0? excluded? auto-random? penalised?); late submissions; reconnection grace; who triggers state changes (admin manual vs. auto); whether the stat card announcement has a fixed duration; whether pre-round cards may be played only during Lobby.
- **Blocks:** Yes (no-pick behaviour); timers themselves **No**. **Status:** OPEN.

## OPEN-015 — Statistic definitions: set of values used
- **[C]/[R]** specify "non-conflicting picks". Confirm: Midrange uses the lowest/highest of non-conflicting picks (assumed); Geometric mean = (Πxᵢ)^(1/N) computed via logs or exact arithmetic without rounding (picks ≥ 1, so well defined for N ≥ 1); Two-thirds = (2/3) × mean (exact rational, no early rounding). **Status:** OPEN (low risk; confirm). **Blocks:** No.

## OPEN-016 — Terminology: "Phase"
- [R] uses "Phase 1: Rapid Fire / Phase 2: The Main Game"; the project brief uses Phase A / Phase B; the build plan uses Build Phase 1–6. **Decision (ENGINEERING):** use "Game Phase A/B" and "Build Phase N" in code/docs; UI labels may use the rulebook wording. **Status:** RESOLVED (documentation convention only).

## OPEN-017 — Final standings and tie handling
- **[R]** "The top teams with the highest overall points win." Number of winners and tie-breaking on equal totals unspecified. **Engineering plan:** leaderboard sorts by total desc, then deterministic secondary key (config) — display ties explicitly. **Blocks:** No. **Status:** OPEN.

## OPEN-018 — Admin credentials in source document
- **[C]** "Admin login" lists a plaintext User ID and password. This is a security concern, not a rule conflict. **Decision (ENGINEERING):** never copy the password into the repository; provision via `ADMIN_BOOTSTRAP_USER_ID` / `ADMIN_BOOTSTRAP_PASSWORD` environment variables at first run; recommend organisers set a new password since the document may have been shared. **Status:** RESOLVED (handling), organiser action recommended.

## OPEN-019 — Admin visibility of live data
- **[C]** "Admin panel will show live data, that which user selected which number, every detail." Confirm whether this applies during the Selection window (assumed yes, admin only) and that it must never be exposed to teams. **Status:** OPEN (low risk). **Blocks:** No.

---

## Decision log (append organiser decisions here)

| ID | Decision | Decided by | Date | Notes / config values |
|----|----------|-----------|------|------------------------|
| — | *none yet* | — | — | — |

When a decision is made: update the entry's status, add a row above, set the configuration, add/adjust engine tests, and note it in `PROGRESS.md`.
