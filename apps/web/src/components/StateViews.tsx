import type { ReactNode } from 'react';
import { Button } from './Button';

type BaseProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
};

function StateShell({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: BaseProps & { kind: string }) {
  return (
    <div className={`state-view state-view--${kind}`} role="status">
      <span className="state-view__mark" aria-hidden="true" />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState(props: BaseProps) {
  return <StateShell kind="empty" {...props} />;
}
export function LoadingState(props: BaseProps) {
  return <StateShell kind="loading" {...props} />;
}
export function ErrorState(props: BaseProps) {
  return <StateShell kind="error" {...props} />;
}
export function DisconnectedState(props: BaseProps) {
  return <StateShell kind="disconnected" {...props} />;
}
export function WaitingState(props: BaseProps) {
  return <StateShell kind="waiting" {...props} />;
}
export function CompletedState(props: BaseProps) {
  return <StateShell kind="completed" {...props} />;
}
