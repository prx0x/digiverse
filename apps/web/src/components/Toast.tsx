type Props = {
  message: string;
  tone?: 'default' | 'error' | 'success';
  className?: string;
};

export function Toast({ message, tone = 'default', className = '' }: Props) {
  const toneClass =
    tone === 'error' ? 'toast--error' : tone === 'success' ? 'toast--success' : '';
  return (
    <div
      className={['toast', toneClass, className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

export function ToastStack({ children }: { children: React.ReactNode }) {
  return <div className="toast-stack">{children}</div>;
}
