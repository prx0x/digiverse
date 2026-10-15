type Status = 'waiting' | 'live' | 'ok' | 'error' | 'done';

type Props = {
  status: Status;
  label: string;
  className?: string;
};

export function StatusPill({ status, label, className = '' }: Props) {
  return (
    <span
      className={['status-pill', `status-pill--${status}`, className].filter(Boolean).join(' ')}
      role="status"
    >
      <span className="status-pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
