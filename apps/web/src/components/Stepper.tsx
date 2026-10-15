type Props = {
  total: number;
  current: number;
  label?: string;
  className?: string;
};

export function Stepper({ total, current, label = 'Round', className = '' }: Props) {
  return (
    <div
      className={`stepper ${className}`.trim()}
      role="list"
      aria-label={`${label} ${current} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'active' : 'upcoming';
        return (
          <span
            key={n}
            role="listitem"
            className={[
              'stepper__step',
              state === 'active' ? 'stepper__step--active' : '',
              state === 'done' ? 'stepper__step--done' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}
