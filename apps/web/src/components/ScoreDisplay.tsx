import { formatScore } from '@digiverse/shared';

type Props = {
  value: number | string;
  size?: 'md' | 'sm';
  className?: string;
  label?: string;
};

export function ScoreDisplay({ value, size = 'md', className = '', label }: Props) {
  const formatted = formatScore(value);
  return (
    <span
      className={[
        'score-display',
        size === 'sm' ? 'score-display--sm' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label ? `${label}: ${formatted}` : formatted}
    >
      {formatted}
    </span>
  );
}
