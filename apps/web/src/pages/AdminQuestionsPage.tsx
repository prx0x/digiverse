import { useState, type FormEvent } from 'react';
import {
  MATCHING_MODES,
  POWER_UP_CARDS,
  type MatchingMode,
  type PowerUpCard,
} from '@digiverse/shared';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
  Table,
  Textarea,
} from '@/components';
import {
  createQuestionApi,
  createQuestionSetApi,
  deleteQuestionApi,
  deleteQuestionSetApi,
} from '@/api/event';
import { formatApiError, useEventConfig } from '@/hooks/useEventConfig';

export function AdminQuestionsPage() {
  const { bundle, setBundle, loading, error, locked, refresh } = useEventConfig();
  const [setName, setSetName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [matchingMode, setMatchingMode] = useState<MatchingMode>('NORMALIZED');
  const [timeLimit, setTimeLimit] = useState(30);
  const [mappedCard, setMappedCard] = useState<PowerUpCard | ''>('');
  const [topN, setTopN] = useState(1);
  const [activeSetId, setActiveSetId] = useState<string>('');

  if (loading) return <LoadingState title="Loading questions" />;
  if (error || !bundle) {
    return <ErrorState title="Could not load questions" description={error ?? undefined} actionLabel="Retry" onAction={() => void refresh()} />;
  }

  const sets = bundle.questionSets;
  const currentSetId = activeSetId || sets[0]?.id;
  const currentSet = sets.find((s) => s.id === currentSetId);

  async function onCreateSet(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const next = await createQuestionSetApi(setName);
      setBundle(next);
      setSetName('');
      const created = next.questionSets[next.questionSets.length - 1];
      if (created) setActiveSetId(created.id);
      setNotice('Question set created.');
    } catch (err) {
      setFormError(formatApiError(err));
    }
  }

  async function onCreateQuestion(e: FormEvent) {
    e.preventDefault();
    if (!currentSetId) return;
    setFormError(null);
    try {
      const next = await createQuestionApi(currentSetId, {
        prompt,
        answerDefinition: answer,
        matchingMode,
        timeLimitSeconds: timeLimit,
        mappedCard: mappedCard || null,
        topN,
      });
      setBundle(next);
      setPrompt('');
      setAnswer('');
      setMappedCard('');
      setTopN(1);
      setNotice('Question saved.');
    } catch (err) {
      setFormError(formatApiError(err));
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="blue">LIVE</Badge>
          <h1 className="page-header__title">Questions & Sets</h1>
          <p className="page-header__meta">Rapid-fire prompts, answers, timers, and per-question awards.</p>
        </div>
      </header>
      {locked ? <p role="status">Configuration is locked at {bundle.event.status}.</p> : null}
      {formError ? (
        <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {formError}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}

      <Panel title="Question sets" accent="blue">
        <form className="row" onSubmit={onCreateSet}>
          <Input
            id="set-name"
            label="New set name"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            required
            disabled={locked}
          />
          <Button type="submit" disabled={locked}>
            Add set
          </Button>
        </form>
        {sets.length === 0 ? (
          <EmptyState title="No sets" description="Create a set before adding questions." />
        ) : (
          <div className="row" style={{ marginTop: 'var(--space-4)' }}>
            {sets.map((set) => (
              <Button
                key={set.id}
                variant={set.id === currentSetId ? 'primary' : 'secondary'}
                onClick={() => setActiveSetId(set.id)}
              >
                {set.name} ({set.questions.length})
              </Button>
            ))}
            {currentSet ? (
              <Button
                variant="danger"
                disabled={locked}
                onClick={() => {
                  void deleteQuestionSetApi(currentSet.id)
                    .then((next) => {
                      setBundle(next);
                      setActiveSetId('');
                    })
                    .catch((err) => setFormError(formatApiError(err)));
                }}
              >
                Delete set
              </Button>
            ) : null}
          </div>
        )}
      </Panel>

      {currentSet ? (
        <>
          <Panel title={`Add question — ${currentSet.name}`}>
            <form className="stack" onSubmit={onCreateQuestion}>
              <Textarea
                id="q-prompt"
                label="Question text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                disabled={locked}
              />
              <Input
                id="q-answer"
                label="Answer definition (never shown to teams)"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                disabled={locked}
              />
              <div className="form-grid--3 form-grid">
                <Select
                  id="q-match"
                  label="Matching mode"
                  value={matchingMode}
                  onChange={(e) => setMatchingMode(e.target.value as MatchingMode)}
                  disabled={locked}
                >
                  {MATCHING_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </Select>
                <Input
                  id="q-time"
                  label="Time limit (seconds)"
                  type="number"
                  min={1}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  disabled={locked}
                />
                <Input
                  id="q-topn"
                  label="Top-N awardees"
                  type="number"
                  min={1}
                  value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                  disabled={locked}
                />
                <Select
                  id="q-card"
                  label="Mapped power-up"
                  value={mappedCard}
                  onChange={(e) => setMappedCard(e.target.value as PowerUpCard | '')}
                  disabled={locked}
                >
                  <option value="">None</option>
                  {POWER_UP_CARDS.map((card) => (
                    <option key={card} value={card}>
                      {card}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={locked}>
                Save question
              </Button>
            </form>
          </Panel>

          <Panel title="Questions in set">
            {currentSet.questions.length === 0 ? (
              <EmptyState title="Empty set" description="Add a question above." />
            ) : (
              <Table
                headers={['#', 'Prompt', 'Match', 'Time', 'Card', 'Top-N', '']}
                caption="Questions"
              >
                {currentSet.questions.map((q) => (
                  <tr key={q.id}>
                    <td>{q.orderIndex}</td>
                    <td>{q.prompt}</td>
                    <td>{q.matchingMode}</td>
                    <td>{q.timeLimitSeconds}s</td>
                    <td>{q.mappedCard ?? '—'}</td>
                    <td>{q.topN}</td>
                    <td>
                      <Button
                        variant="danger"
                        disabled={locked}
                        onClick={() => {
                          void deleteQuestionApi(q.id)
                            .then(setBundle)
                            .catch((err) => setFormError(formatApiError(err)));
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
