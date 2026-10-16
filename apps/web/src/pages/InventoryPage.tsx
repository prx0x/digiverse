import { useEffect, useState } from 'react';
import { POWER_UP_CARDS, type PowerUpCard as PowerUpCardType, type TeamCardItem } from '@digiverse/shared';
import { Badge, EmptyState, ErrorState, LoadingState, Panel, PowerUpCard } from '@/components';
import { getTeamCardsApi } from '@/api/rapidFire';

const CARD_NOTES: Record<PowerUpCardType, string> = {
  SHIELD: 'Play before round opens: nullifies point deductions.',
  RESERVE: 'Play before round opens: reserves your pick (max 1 in event).',
  PEEK: 'Play during selection: snapshot count of picks < 50.',
  REVERSE: 'Play during selection: flips majority/minority scoring.',
};

export function InventoryPage() {
  const [cards, setCards] = useState<TeamCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCards() {
    try {
      const res = await getTeamCardsApi();
      setCards(res.cards);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCards();
  }, []);

  if (loading) return <LoadingState title="Loading power-up inventory" />;
  if (error) {
    return (
      <ErrorState
        title="Could not load inventory"
        description={error}
        actionLabel="Retry"
        onAction={() => {
          setLoading(true);
          void loadCards();
        }}
      />
    );
  }

  // Count unused cards by type
  const counts: Record<PowerUpCardType, number> = {
    SHIELD: 0,
    RESERVE: 0,
    PEEK: 0,
    REVERSE: 0,
  };

  for (const c of cards) {
    if (!c.usedInRoundId) {
      counts[c.cardType] = (counts[c.cardType] ?? 0) + 1;
    }
  }

  const totalCards = cards.filter((c) => !c.usedInRoundId).length;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone={totalCards > 0 ? 'yellow' : 'blue'}>
            {totalCards} CARD{totalCards === 1 ? '' : 'S'} AVAILABLE
          </Badge>
          <h1 className="page-header__title">Power-up Inventory</h1>
          <p className="page-header__meta">Cards earned in Rapid Fire (Game Phase A)</p>
        </div>
      </header>

      {totalCards === 0 ? (
        <EmptyState
          title="No Power-Up Cards Yet"
          description="Your team has not earned any power-up cards yet. Answer correctly and quickly in Rapid Fire to win cards!"
        />
      ) : (
        <div className="grid-12">
          {POWER_UP_CARDS.map((cardType) => (
            <div key={cardType} className="grid-span-3">
              <PowerUpCard
                card={cardType}
                count={counts[cardType]}
                note={CARD_NOTES[cardType]}
              />
            </div>
          ))}
        </div>
      )}

      <Panel title="How cards work" accent="blue">
        <ul className="stack" style={{ gap: 'var(--space-2)' }}>
          <li>
            <strong>Shield:</strong> Played before a round opens. Nullifies clash penalty, majority deduction, and reversed-minority deduction.
          </li>
          <li>
            <strong>Reserve:</strong> Played before a round opens. Your pick is locked and greyed out for all other teams. Exactly 1 exists in the entire game.
          </li>
          <li>
            <strong>Peek:</strong> Played during selection. Reveals the count of other picks strictly under 50 submitted at that moment.
          </li>
          <li>
            <strong>Reverse:</strong> Played during selection. Flips majority and minority scoring rules for all teams (odd activations flip, even normalise).
          </li>
        </ul>
      </Panel>
    </div>
  );
}
