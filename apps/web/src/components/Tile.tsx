import type { ButtonHTMLAttributes } from 'react';

export type TileState = 'default' | 'selected' | 'locked' | 'disabled' | 'reserved';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  value: number;
  state?: TileState;
};

const stateClass: Record<TileState, string> = {
  default: '',
  selected: 'tile--selected',
  locked: 'tile--locked',
  disabled: 'tile--disabled',
  reserved: 'tile--reserved',
};

const stateLabel: Record<TileState, string> = {
  default: '',
  selected: ', selected',
  locked: ', locked in',
  disabled: ', unavailable',
  reserved: ', reserved by another team',
};

export function Tile({ value, state = 'default', className = '', ...rest }: Props) {
  const interactive = state === 'default' || state === 'selected';
  const classes = ['tile', stateClass[state], className].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-label={`Number ${value}${stateLabel[state]}`}
      aria-pressed={state === 'selected' || state === 'locked' ? true : undefined}
      aria-disabled={!interactive || undefined}
      disabled={!interactive}
      {...rest}
    >
      {value}
    </button>
  );
}
