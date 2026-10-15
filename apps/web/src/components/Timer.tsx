type Props = {
  seconds: number;
  label?: string;
  urgentBelow?: number;
  className?: string;
};

function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function Timer({ seconds, label = 'Time left', urgentBelow = 10, className = '' }: Props) {
  const urgent = seconds <= urgentBelow;
  return (
    <div
      className={['timer', urgent ? 'timer--urgent' : '', className].filter(Boolean).join(' ')}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${label}: ${formatSeconds(seconds)}`}
    >
      <span className="timer__value">{formatSeconds(seconds)}</span>
      <span className="timer__label">{label}</span>
    </div>
  );
}
