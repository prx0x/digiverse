/**
 * Typed mirror of CSS design tokens for JS consumers (tests, inline styles
 * that must stay token-driven). Prefer CSS variables in components.
 */
export const tokens = {
  color: {
    red: 'var(--color-red)',
    yellow: 'var(--color-yellow)',
    blue: 'var(--color-blue)',
    black: 'var(--color-black)',
    offWhite: 'var(--color-off-white)',
    bg: 'var(--color-bg)',
    fg: 'var(--color-fg)',
    primary: 'var(--color-primary)',
    danger: 'var(--color-danger)',
    highlight: 'var(--color-highlight)',
    muted: 'var(--color-muted)',
    border: 'var(--color-border)',
    focusRing: 'var(--color-focus-ring)',
  },
  space: {
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    5: 'var(--space-5)',
    6: 'var(--space-6)',
    7: 'var(--space-7)',
    8: 'var(--space-8)',
  },
  font: {
    display: 'var(--font-display)',
    body: 'var(--font-body)',
    mono: 'var(--font-mono)',
  },
  duration: {
    fast: 'var(--duration-fast)',
    normal: 'var(--duration-normal)',
    slow: 'var(--duration-slow)',
  },
  radius: {
    none: 'var(--radius-none)',
    sm: 'var(--radius-sm)',
  },
  size: {
    touchMin: 'var(--size-touch-min)',
  },
} as const;

export type Tokens = typeof tokens;
