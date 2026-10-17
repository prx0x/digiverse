import { useState, type FormEvent } from 'react';
import {
  CLASH_PENALTY_MODES,
  DEGENERATE_ROUND_MODES,
  DISPLAY_ROUNDING_MODES,
  EQUALITY_MODES,
  MAJORITY_PENALTY_MODES,
  NO_PICK_BEHAVIOURS,
  RAPID_FIRE_TIE_BREAKS,
  REVERSED_MAJORITY_REWARDS,
  SAMPLE_STDDEV_SINGLE_BEHAVIOURS,
  STD_DEV_MODES,
  type ClashPenaltyMode,
  type DegenerateRoundMode,
  type DisplayRoundingMode,
  type EqualityMode,
  type EventStatus,
  type MajorityPenaltyMode,
  type NoPickBehaviour,
  type RapidFireTieBreak,
  type ReversedMajorityReward,
  type SampleStdDevSingleBehaviour,
  type StdDevMode,
} from '@digiverse/shared';
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
} from '@/components';
import {
  postEventLifecycleApi,
  putAdminEventApi,
  putEventRulesApi,
  type EventRulesRecord,
} from '@/api/event';
import { formatApiError, useEventConfig } from '@/hooks/useEventConfig';

export function AdminSettingsPage() {
  const { bundle, setBundle, loading, error, refresh } = useEventConfig();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [updatingLifecycle, setUpdatingLifecycle] = useState(false);

  if (loading) return <LoadingState title="Loading event settings" />;
  if (error || !bundle) {
    return (
      <ErrorState
        title="Could not load event settings"
        description={error ?? undefined}
        actionLabel="Retry"
        onAction={() => void refresh()}
      />
    );
  }

  const { event, rules, readiness } = bundle;
  const isDraft = event.status === 'DRAFT';
  const isLive = event.status === 'LIVE';
  const isReady = event.status === 'READY';
  const isFinished = event.status === 'FINISHED';

  // In LIVE mode, rulebook X values are explicitly editable by organisers.
  // In DRAFT mode, all fields are editable.
  // In READY or FINISHED mode, configuration is locked.
  const generalLocked = !isDraft;
  const rulesLocked = !isDraft && !isLive;

  async function handleLifecycleTransition(nextStatus: EventStatus) {
    setFormError(null);
    setNotice(null);
    setUpdatingLifecycle(true);
    try {
      const next = await postEventLifecycleApi(nextStatus);
      setBundle(next);
      setNotice(`Event status transitioned to ${nextStatus}.`);
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setUpdatingLifecycle(false);
    }
  }

  async function handleSaveGeneral(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    setSavingSettings(true);
    try {
      const next = await putAdminEventApi({
        name: event.name,
        rapidFireDefaultTimeLimitSeconds: event.rapidFireDefaultTimeLimitSeconds,
        roundSelectionSeconds: event.roundSelectionSeconds,
        statCardAnnouncementSeconds: event.statCardAnnouncementSeconds,
      });
      setBundle(next);
      setNotice('General event settings saved.');
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveRules(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    setSavingRules(true);
    try {
      const next = await putEventRulesApi(rules);
      setBundle(next);
      setNotice('Event rules and formula decisions saved.');
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setSavingRules(false);
    }
  }

  function updateRuleField<K extends keyof EventRulesRecord>(key: K, value: EventRulesRecord[K]) {
    if (!bundle) return;
    setBundle({
      ...bundle,
      rules: {
        ...bundle.rules,
        [key]: value,
      },
    });
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone={isDraft ? 'yellow' : isLive ? 'red' : isReady ? 'blue' : 'black'}>
            {event.status}
          </Badge>
          <h1 className="page-header__title">Event Settings & Rule Decisions</h1>
          <p className="page-header__meta">
            Lifecycle state machine, timers, and organiser decisions for disputed game rules.
          </p>
        </div>
      </header>

      {formError ? (
        <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {formError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
          {notice}
        </p>
      ) : null}

      {/* Lifecycle management */}
      <Panel title="Event Lifecycle State" accent={isLive ? 'red' : 'blue'}>
        <div className="stack">
          <p>
            Current status: <strong>{event.status}</strong>.
            {isDraft && ' Configuration is fully editable.'}
            {isReady && ' Configuration is locked and validated. Ready for event day.'}
            {isLive && ' Event is in progress! Only organiser penalty X values can be modified.'}
            {isFinished && ' Event is concluded. You may reopen it as DRAFT to edit configuration and run another game.'}
          </p>

          {readiness.issues.length > 0 ? (
            <div
              style={{
                border: '2px solid var(--color-danger)',
                background: 'rgba(217, 38, 28, 0.08)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <h4 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--color-danger)' }}>
                Readiness Issues ({readiness.issues.length})
              </h4>
              <ul className="issue-list">
                {readiness.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div
              style={{
                border: '2px solid var(--color-success)',
                background: 'rgba(30, 130, 60, 0.08)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                color: 'var(--color-success)',
              }}
            >
              ✓ Event configuration is valid and ready to be locked.
            </div>
          )}

          <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            {isDraft && (
              <Button
                variant="primary"
                disabled={updatingLifecycle || !readiness.canMarkReady}
                onClick={() => void handleLifecycleTransition('READY')}
              >
                Mark as READY (Lock Config)
              </Button>
            )}
            {isReady && (
              <>
                <Button
                  variant="primary"
                  disabled={updatingLifecycle}
                  onClick={() => void handleLifecycleTransition('LIVE')}
                >
                  Start Event (Go LIVE)
                </Button>
                <Button
                  variant="secondary"
                  disabled={updatingLifecycle}
                  onClick={() => void handleLifecycleTransition('DRAFT')}
                >
                  Return to DRAFT (Unlock)
                </Button>
              </>
            )}
            {isLive && (
              <>
                <Button
                  variant="primary"
                  disabled={updatingLifecycle}
                  onClick={() => void handleLifecycleTransition('FINISHED')}
                >
                  Finish Event
                </Button>
                <Button
                  variant="secondary"
                  disabled={updatingLifecycle}
                  onClick={() => void handleLifecycleTransition('READY')}
                >
                  Pause (Return to READY)
                </Button>
              </>
            )}
            {isFinished && (
              <Button
                variant="danger"
                disabled={updatingLifecycle}
                onClick={() => void handleLifecycleTransition('DRAFT')}
              >
                Reopen as DRAFT (Restart Game)
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* General Settings */}
      <Panel title="General Event Configuration" accent="yellow">
        <form className="stack" onSubmit={handleSaveGeneral}>
          <div className="form-grid">
            <Input
              id="event-name"
              label="Event Name"
              disabled={generalLocked}
              value={event.name}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: { ...bundle.event, name: e.target.value },
                })
              }
            />
            <Input
              id="rf-time-limit"
              label="Rapid-Fire Default Time (seconds)"
              type="number"
              min={1}
              disabled={generalLocked}
              value={event.rapidFireDefaultTimeLimitSeconds}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: {
                    ...bundle.event,
                    rapidFireDefaultTimeLimitSeconds: Number(e.target.value),
                  },
                })
              }
            />
            <Input
              id="round-selection-time"
              label="Round Palette Selection Window (seconds)"
              type="number"
              min={1}
              disabled={generalLocked}
              value={event.roundSelectionSeconds}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: {
                    ...bundle.event,
                    roundSelectionSeconds: Number(e.target.value),
                  },
                })
              }
            />
            <Input
              id="stat-card-announce-time"
              label="Stat-Card Announcement Window (seconds)"
              type="number"
              min={0}
              disabled={generalLocked}
              value={event.statCardAnnouncementSeconds}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: {
                    ...bundle.event,
                    statCardAnnouncementSeconds: Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <Button type="submit" disabled={generalLocked || savingSettings}>
              {savingSettings ? 'Saving...' : 'Save General Settings'}
            </Button>
          </div>
        </form>
      </Panel>

      {/* Disputed Rule Decisions (OPEN-001 through OPEN-014) */}
      <Panel title="Disputed Rule Decisions & Formulas (OPEN_RULE_DECISIONS.md)" accent="red">
        <form className="stack" onSubmit={handleSaveRules}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}>
            These settings resolve ambiguities between the official rulebook [R] and the organiser considerations [C].
            All required fields must be configured before starting Game Phase B.
            {isLive && ' Note: Clash Penalty X and Majority Penalty X can be edited while LIVE.'}
          </p>

          {/* OPEN-001: Clash Deduction */}
          <fieldset style={{ border: '1px solid var(--color-line)', padding: 'var(--space-3)' }}>
            <legend style={{ fontWeight: 700, padding: '0 var(--space-2)' }}>
              OPEN-001: Clash Penalty
            </legend>
            <div className="form-grid">
              <Select
                id="clash-mode"
                label="Clash Penalty Calculation Mode"
                disabled={rulesLocked}
                value={rules.clashPenaltyMode ?? ''}
                onChange={(e) =>
                  updateRuleField('clashPenaltyMode', (e.target.value || null) as ClashPenaltyMode | null)
                }
              >
                <option value="">(Unset — Organiser choice needed)</option>
                {CLASH_PENALTY_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === 'FIXED_X'
                      ? 'Fixed penalty X points ([R] rulebook default)'
                      : '(2/3) × pick deduction ([C] consideration)'}
                  </option>
                ))}
              </Select>
              <Input
                id="clash-x"
                label="Clash Penalty X (points)"
                disabled={rulesLocked && !isLive}
                value={rules.clashPenaltyX ?? ''}
                placeholder="e.g. 10"
                onChange={(e) => updateRuleField('clashPenaltyX', e.target.value || null)}
              />
            </div>
          </fieldset>

          {/* OPEN-002: Majority Deduction */}
          <fieldset style={{ border: '1px solid var(--color-line)', padding: 'var(--space-3)' }}>
            <legend style={{ fontWeight: 700, padding: '0 var(--space-2)' }}>
              OPEN-002: Majority-Bucket Penalty
            </legend>
            <div className="form-grid">
              <Select
                id="majority-mode"
                label="Majority Penalty Calculation Mode"
                disabled={rulesLocked}
                value={rules.majorityPenaltyMode ?? ''}
                onChange={(e) =>
                  updateRuleField(
                    'majorityPenaltyMode',
                    (e.target.value || null) as MajorityPenaltyMode | null,
                  )
                }
              >
                <option value="">(Unset — Organiser choice needed)</option>
                {MAJORITY_PENALTY_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === 'FIXED_X'
                      ? 'Fixed penalty X points ([R] rulebook)'
                      : mode === 'HALF_ABS_DISTANCE'
                      ? '|StatValue - Pick| / Pick (relative absolute distance deduction)'
                      : '(StatValue - Pick) / Pick (literal signed relative distance)'}
                  </option>
                ))}
              </Select>
              <Input
                id="majority-x"
                label="Majority Penalty X (points)"
                disabled={rulesLocked && !isLive}
                value={rules.majorityPenaltyX ?? ''}
                placeholder="e.g. 10"
                onChange={(e) => updateRuleField('majorityPenaltyX', e.target.value || null)}
              />
            </div>
          </fieldset>

          {/* OPEN-003: Reverse Card Semantics */}
          <fieldset style={{ border: '1px solid var(--color-line)', padding: 'var(--space-3)' }}>
            <legend style={{ fontWeight: 700, padding: '0 var(--space-2)' }}>
              OPEN-003: Reverse Card Behaviour
            </legend>
            <div className="form-grid">
              <Select
                id="reversed-majority-reward"
                label="Reward Won by Reversed Majority"
                disabled={rulesLocked}
                value={rules.reversedMajorityReward ?? ''}
                onChange={(e) =>
                  updateRuleField(
                    'reversedMajorityReward',
                    (e.target.value || null) as ReversedMajorityReward | null,
                  )
                }
              >
                <option value="">(Unset)</option>
                {REVERSED_MAJORITY_REWARDS.map((r) => (
                  <option key={r} value={r}>
                    {r === 'PICK'
                      ? 'Award |StatValue - Pick| / Pick (symmetric to minority)'
                      : 'Other'}
                  </option>
                ))}
              </Select>
              <Select
                id="reverse-is-global"
                label="Reverse Effect Scope"
                disabled={rulesLocked}
                value={rules.reverseIsGlobal === null ? '' : rules.reverseIsGlobal ? 'true' : 'false'}
                onChange={(e) =>
                  updateRuleField('reverseIsGlobal', e.target.value === '' ? null : e.target.value === 'true')
                }
              >
                <option value="">(Unset)</option>
                <option value="true">Global (all teams in the round flipped)</option>
                <option value="false">Local (only the playing team)</option>
              </Select>
              <Select
                id="reverse-equal-to"
                label="Does Reverse Affect Equal-To Bucket?"
                disabled={rulesLocked}
                value={
                  rules.reverseAffectsEqualTo === null
                    ? ''
                    : rules.reverseAffectsEqualTo
                    ? 'true'
                    : 'false'
                }
                onChange={(e) =>
                  updateRuleField(
                    'reverseAffectsEqualTo',
                    e.target.value === '' ? null : e.target.value === 'true',
                  )
                }
              >
                <option value="">(Unset)</option>
                <option value="false">No (Equal-To always gets +pick)</option>
                <option value="true">Yes</option>
              </Select>
              <Select
                id="reverse-tiebreaker"
                label="Does Reverse Affect Tiebreaker?"
                disabled={rulesLocked}
                value={
                  rules.reverseAffectsTiebreaker === null
                    ? ''
                    : rules.reverseAffectsTiebreaker
                    ? 'true'
                    : 'false'
                }
                onChange={(e) =>
                  updateRuleField(
                    'reverseAffectsTiebreaker',
                    e.target.value === '' ? null : e.target.value === 'true',
                  )
                }
              >
                <option value="">(Unset)</option>
                <option value="false">No (Equal counts still score 0)</option>
                <option value="true">Yes</option>
              </Select>
            </div>
          </fieldset>

          {/* OPEN-004: Shield Scope */}
          <fieldset style={{ border: '1px solid var(--color-line)', padding: 'var(--space-3)' }}>
            <legend style={{ fontWeight: 700, padding: '0 var(--space-2)' }}>
              OPEN-004: Shield Scope & Consumption
            </legend>
            <div className="form-grid">
              <Select
                id="shield-clash"
                label="Shield Covers Clash Penalty?"
                disabled={rulesLocked}
                value={rules.shieldCoversClash === null ? '' : rules.shieldCoversClash ? 'true' : 'false'}
                onChange={(e) =>
                  updateRuleField('shieldCoversClash', e.target.value === '' ? null : e.target.value === 'true')
                }
              >
                <option value="">(Unset)</option>
                <option value="true">Yes (Zero clash penalty)</option>
                <option value="false">No (Clash penalty still applies)</option>
              </Select>
              <Select
                id="shield-majority"
                label="Shield Covers Majority Penalty?"
                disabled={rulesLocked}
                value={
                  rules.shieldCoversMajority === null
                    ? ''
                    : rules.shieldCoversMajority
                    ? 'true'
                    : 'false'
                }
                onChange={(e) =>
                  updateRuleField(
                    'shieldCoversMajority',
                    e.target.value === '' ? null : e.target.value === 'true',
                  )
                }
              >
                <option value="">(Unset)</option>
                <option value="true">Yes (Zero majority penalty)</option>
                <option value="false">No</option>
              </Select>
              <Select
                id="shield-rev-minority"
                label="Shield Covers Reversed-Minority Penalty?"
                disabled={rulesLocked}
                value={
                  rules.shieldCoversReversedMinority === null
                    ? ''
                    : rules.shieldCoversReversedMinority
                    ? 'true'
                    : 'false'
                }
                onChange={(e) =>
                  updateRuleField(
                    'shieldCoversReversedMinority',
                    e.target.value === '' ? null : e.target.value === 'true',
                  )
                }
              >
                <option value="">(Unset)</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
              <Select
                id="shield-consumed"
                label="Shield Consumed on Play Even If No Penalty Incurred?"
                disabled={rulesLocked}
                value={
                  rules.shieldConsumedOnPlay === null
                    ? ''
                    : rules.shieldConsumedOnPlay
                    ? 'true'
                    : 'false'
                }
                onChange={(e) =>
                  updateRuleField(
                    'shieldConsumedOnPlay',
                    e.target.value === '' ? null : e.target.value === 'true',
                  )
                }
              >
                <option value="">(Unset)</option>
                <option value="true">Yes (Card is always consumed)</option>
                <option value="false">No (Preserved if no penalty)</option>
              </Select>
            </div>
          </fieldset>

          {/* OPEN-005 & OPEN-006: Statistics & Degenerate Rounds */}
          <fieldset style={{ border: '1px solid var(--color-line)', padding: 'var(--space-3)' }}>
            <legend style={{ fontWeight: 700, padding: '0 var(--space-2)' }}>
              OPEN-005 & OPEN-006: Statistics & Degenerate Rounds
            </legend>
            <div className="form-grid">
              <Select
                id="stddev-mode"
                label="Standard Deviation Definition (Mean+1σ)"
                disabled={rulesLocked}
                value={rules.stdDevMode ?? ''}
                onChange={(e) =>
                  updateRuleField('stdDevMode', (e.target.value || null) as StdDevMode | null)
                }
              >
                <option value="">(Unset)</option>
                {STD_DEV_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m === 'POPULATION' ? 'Population σ (divide by N)' : 'Sample s (divide by N - 1)'}
                  </option>
                ))}
              </Select>
              <Select
                id="sample-single-mode"
                label="Sample Std Dev Single Value Behaviour"
                disabled={rulesLocked}
                value={rules.sampleStdDevForSingleValue ?? ''}
                onChange={(e) =>
                  updateRuleField(
                    'sampleStdDevForSingleValue',
                    (e.target.value || null) as SampleStdDevSingleBehaviour | null,
                  )
                }
              >
                <option value="">(Unset)</option>
                {SAMPLE_STDDEV_SINGLE_BEHAVIOURS.map((b) => (
                  <option key={b} value={b}>
                    {b === 'ZERO' ? 'Std dev = 0' : 'NO_TARGET outcome'}
                  </option>
                ))}
              </Select>
              <Select
                id="degenerate-mode"
                label="Degenerate Round Handling (All clash / no picks)"
                disabled={rulesLocked}
                value={rules.degenerateRoundMode ?? ''}
                onChange={(e) =>
                  updateRuleField(
                    'degenerateRoundMode',
                    (e.target.value || null) as DegenerateRoundMode | null,
                  )
                }
              >
                <option value="">(Unset)</option>
                {DEGENERATE_ROUND_MODES.map((d) => (
                  <option key={d} value={d}>
                    {d === 'NO_TARGET'
                      ? 'NO_TARGET outcome (no bucket scoring)'
                      : 'CLASH_PENALTIES_ONLY'}
                  </option>
                ))}
              </Select>
            </div>
          </fieldset>

          {/* OPEN-008: Equality & Precision */}
          <fieldset style={{ border: '1px solid var(--color-line)', padding: 'var(--space-3)' }}>
            <legend style={{ fontWeight: 700, padding: '0 var(--space-2)' }}>
              OPEN-008: Equal-To Bucket Matching & Precision
            </legend>
            <div className="form-grid">
              <Select
                id="equality-mode"
                label="Equal-To Matching Mode"
                disabled={rulesLocked}
                value={rules.equalityMode ?? ''}
                onChange={(e) =>
                  updateRuleField('equalityMode', (e.target.value || null) as EqualityMode | null)
                }
              >
                <option value="">(Unset)</option>
                {EQUALITY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m === 'EXACT'
                      ? 'Exact mathematical integer equality'
                      : m === 'ROUND_TARGET_TO_INTEGER'
                      ? 'Round statistical target to nearest integer'
                      : 'Epsilon tolerance'}
                  </option>
                ))}
              </Select>
              <Input
                id="equality-epsilon"
                label="Equality Epsilon (if mode is EPSILON)"
                disabled={rulesLocked}
                value={rules.equalityEpsilon ?? ''}
                placeholder="e.g. 0.0001"
                onChange={(e) => updateRuleField('equalityEpsilon', e.target.value || null)}
              />
              <Select
                id="display-rounding"
                label="Leaderboard 4-dp Display Rounding"
                disabled={rulesLocked}
                value={rules.displayRounding ?? ''}
                onChange={(e) =>
                  updateRuleField(
                    'displayRounding',
                    (e.target.value || null) as DisplayRoundingMode | null,
                  )
                }
              >
                <option value="">(Unset)</option>
                {DISPLAY_ROUNDING_MODES.map((r) => (
                  <option key={r} value={r}>
                    {r === 'HALF_UP' ? 'Round Half Up' : 'Truncate (floor)'}
                  </option>
                ))}
              </Select>
            </div>
          </fieldset>

          {/* OPEN-010 & OPEN-011: Card Economy & Rapid Fire */}
          <fieldset style={{ border: '1px solid var(--color-line)', padding: 'var(--space-3)' }}>
            <legend style={{ fontWeight: 700, padding: '0 var(--space-2)' }}>
              OPEN-010, OPEN-011 & OPEN-014: Economy, Picks & Rapid-Fire
            </legend>
            <div className="form-grid">
              <Select
                id="no-pick-behaviour"
                label="No-Pick In Round Behaviour"
                disabled={rulesLocked}
                value={rules.noPickBehaviour ?? ''}
                onChange={(e) =>
                  updateRuleField('noPickBehaviour', (e.target.value || null) as NoPickBehaviour | null)
                }
              >
                <option value="">(Unset)</option>
                {NO_PICK_BEHAVIOURS.map((b) => (
                  <option key={b} value={b}>
                    {b === 'SCORE_ZERO'
                      ? 'Score 0 for the round'
                      : b === 'EXCLUDE'
                      ? 'Exclude from calculations completely'
                      : 'Auto-pick random available number'}
                  </option>
                ))}
              </Select>
              <Select
                id="allow-pick-change"
                label="Allow Pick Changes Before Window Closes?"
                disabled={rulesLocked}
                value={
                  rules.allowPickChangeBeforeLock === null
                    ? ''
                    : rules.allowPickChangeBeforeLock
                    ? 'true'
                    : 'false'
                }
                onChange={(e) =>
                  updateRuleField(
                    'allowPickChangeBeforeLock',
                    e.target.value === '' ? null : e.target.value === 'true',
                  )
                }
              >
                <option value="">(Unset)</option>
                <option value="true">Yes (Can re-pick until timer ends)</option>
                <option value="false">No (First pick locks in)</option>
              </Select>
              <Select
                id="rf-tiebreak"
                label="Rapid-Fire Submission Tie-Break"
                disabled={rulesLocked}
                value={rules.rapidFireTieBreak ?? ''}
                onChange={(e) =>
                  updateRuleField(
                    'rapidFireTieBreak',
                    (e.target.value || null) as RapidFireTieBreak | null,
                  )
                }
              >
                <option value="">(Unset)</option>
                {RAPID_FIRE_TIE_BREAKS.map((t) => (
                  <option key={t} value={t}>
                    {t === 'EARLIEST_RECEIVED_THEN_ID'
                      ? 'Earliest server receive timestamp'
                      : 'Share award if exact same timestamp'}
                  </option>
                ))}
              </Select>
              <Input
                id="rf-max-attempts"
                label="Rapid-Fire Max Attempts Allowed"
                type="number"
                min={1}
                disabled={rulesLocked}
                value={rules.rapidFireMaxAttempts ?? ''}
                placeholder="1 (Leave blank for unlimited)"
                onChange={(e) =>
                  updateRuleField(
                    'rapidFireMaxAttempts',
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </div>
          </fieldset>

          <div>
            <Button
              type="submit"
              variant="primary"
              disabled={(rulesLocked && !isLive) || savingRules}
            >
              {savingRules ? 'Saving Decisions...' : 'Save Rule Decisions'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
