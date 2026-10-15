import type { ReactNode } from 'react';

type Accent = 'none' | 'blue' | 'red' | 'yellow';

type Props = {
  title?: string;
  children: ReactNode;
  accent?: Accent;
  inverse?: boolean;
  className?: string;
};

const accentClass: Record<Accent, string> = {
  none: '',
  blue: 'panel--accent-blue',
  red: 'panel--accent-red',
  yellow: 'panel--accent-yellow',
};

export function Panel({
  title,
  children,
  accent = 'none',
  inverse = false,
  className = '',
}: Props) {
  const classes = [
    'panel',
    inverse ? 'panel--inverse' : '',
    accentClass[accent],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      {title ? <h2 className="panel__title">{title}</h2> : null}
      <div className="panel__body">{children}</div>
    </section>
  );
}
