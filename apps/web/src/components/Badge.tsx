import type { ReactNode } from 'react';

type Tone = 'default' | 'blue' | 'red' | 'yellow' | 'black';

type Props = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

const toneClass: Record<Tone, string> = {
  default: '',
  blue: 'badge--blue',
  red: 'badge--red',
  yellow: 'badge--yellow',
  black: 'badge--black',
};

export function Badge({ children, tone = 'default', className = '' }: Props) {
  return <span className={['badge', toneClass[tone], className].filter(Boolean).join(' ')}>{children}</span>;
}
