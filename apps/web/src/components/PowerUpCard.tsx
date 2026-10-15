import type { MockPowerUp } from '@/mocks';

type Props = {
  card: MockPowerUp;
  count?: number;
  note?: string;
  className?: string;
};

const shapeClass: Record<MockPowerUp, string> = {
  SHIELD: 'power-up-card__shape--shield',
  RESERVE: 'power-up-card__shape--reserve',
  PEEK: 'power-up-card__shape--peek',
  REVERSE: 'power-up-card__shape--reverse',
};

const labels: Record<MockPowerUp, string> = {
  SHIELD: 'Shield',
  RESERVE: 'Reserve',
  PEEK: 'Peek',
  REVERSE: 'Reverse',
};

export function PowerUpCard({ card, count, note, className = '' }: Props) {
  return (
    <article className={['power-up-card', className].filter(Boolean).join(' ')}>
      <span className={['power-up-card__shape', shapeClass[card]].join(' ')} aria-hidden="true" />
      <h3 className="power-up-card__name">{labels[card]}</h3>
      {typeof count === 'number' ? (
        <p className="power-up-card__meta" aria-label={`Count ${count}`}>
          × {count}
        </p>
      ) : null}
      {note ? <p className="power-up-card__meta">{note}</p> : null}
    </article>
  );
}
