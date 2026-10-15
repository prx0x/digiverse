import { useState } from 'react';
import { POWER_UP_CARDS, type PowerUpCard } from '@digiverse/shared';
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
  Table,
} from '@/components';
import { patchQuestionApi, putCardSupplyApi } from '@/api/event';
import { formatApiError, useEventConfig } from '@/hooks/useEventConfig';

export function AdminCardMappingPage() {
  const { bundle, setBundle, loading, error, locked, refresh } = useEventConfig();
  const [formError, setFormError] = useState<string | null>(null);

  if (loading) return <LoadingState title="Loading card mapping" />;
  if (error || !bundle) {
    return (
      <ErrorState
        title="Could not load mapping"
        description={error ?? undefined}
        actionLabel="Retry"
        onAction={() => void refresh()}
      />
    );
  }

  const questions = bundle.questionSets.flatMap((set) =>
    set.questions.map((q) => ({ ...q, setName: set.name })),
  );

  async function saveSupply() {
    if (!bundle) return;
    setFormError(null);
    try {
      const next = await putCardSupplyApi(bundle.cardSupply);
      setBundle(next);
    } catch (err) {
      setFormError(formatApiError(err));
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="blue">LIVE</Badge>
          <h1 className="page-header__title">Card Mapping</h1>
          <p className="page-header__meta">
            Map power-ups to questions and cap supply. Reserve is fixed at 1 for the whole event.
          </p>
        </div>
      </header>
      {formError ? (
        <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {formError}
        </p>
      ) : null}

      <Panel title="Card supply" accent="yellow">
        <div className="form-grid">
          {bundle.cardSupply.map((item) => (
            <Input
              key={item.cardType}
              id={`supply-${item.cardType}`}
              label={`${item.cardType} max supply`}
              type="number"
              min={item.cardType === 'RESERVE' ? 1 : 0}
              max={item.cardType === 'RESERVE' ? 1 : undefined}
              value={item.maxSupply}
              disabled={locked || item.cardType === 'RESERVE'}
              onChange={(e) => {
                const maxSupply = Number(e.target.value);
                setBundle({
                  ...bundle,
                  cardSupply: bundle.cardSupply.map((row) =>
                    row.cardType === item.cardType ? { ...row, maxSupply } : row,
                  ),
                });
              }}
            />
          ))}
        </div>
        <div className="row" style={{ marginTop: 'var(--space-3)' }}>
          <Button disabled={locked} onClick={() => void saveSupply()}>
            Save supply
          </Button>
        </div>
      </Panel>

      <Panel title="Question → card">
        <Table headers={['Set', 'Question', 'Card', 'Top-N']} caption="Mappings">
          {questions.map((q) => (
            <tr key={q.id}>
              <td>{q.setName}</td>
              <td>{q.prompt}</td>
              <td>
                <Select
                  id={`map-${q.id}`}
                  label="Card"
                  value={q.mappedCard ?? ''}
                  disabled={locked}
                  onChange={(e) => {
                    const mappedCard = (e.target.value || null) as PowerUpCard | null;
                    void patchQuestionApi(q.id, { mappedCard })
                      .then(setBundle)
                      .catch((err) => setFormError(formatApiError(err)));
                  }}
                >
                  <option value="">None</option>
                  {POWER_UP_CARDS.map((card) => (
                    <option key={card} value={card}>
                      {card}
                    </option>
                  ))}
                </Select>
              </td>
              <td>
                <Input
                  id={`topn-${q.id}`}
                  label="Top-N"
                  type="number"
                  min={1}
                  value={q.topN}
                  disabled={locked}
                  onChange={(e) => {
                    const topN = Number(e.target.value);
                    void patchQuestionApi(q.id, { topN })
                      .then(setBundle)
                      .catch((err) => setFormError(formatApiError(err)));
                  }}
                />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
