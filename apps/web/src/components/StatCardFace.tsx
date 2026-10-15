import type { MockStatCard } from '@/mocks';

type Props = {
  title: string;
  formula: string;
  description: string;
  variant?: MockStatCard;
  className?: string;
};

const shapeFor: Record<MockStatCard, string> = {
  MEAN: 'stat-card__shape--circle',
  TWO_THIRDS: 'stat-card__shape--square',
  MIDRANGE: 'stat-card__shape--rect',
  MEAN_PLUS_SIGMA: 'stat-card__shape--circle',
  GEOMETRIC_MEAN: 'stat-card__shape--square',
};

export function StatCardFace({
  title,
  formula,
  description,
  variant = 'MEAN',
  className = '',
}: Props) {
  return (
    <article className={['stat-card', className].filter(Boolean).join(' ')}>
      <span className="stat-card__eyebrow">Statistical card</span>
      <h2 className="stat-card__title">{title}</h2>
      <p className="stat-card__formula">{formula}</p>
      <p>{description}</p>
      <span className={['stat-card__shape', shapeFor[variant]].join(' ')} aria-hidden="true" />
    </article>
  );
}
