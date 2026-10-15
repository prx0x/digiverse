import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  confirmLabel?: string;
  onConfirm?: () => void;
};

export function Modal({
  open,
  title,
  children,
  onClose,
  confirmLabel = 'Confirm',
  onConfirm,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <div>{children}</div>
        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {onConfirm ? (
            <Button ref={closeRef} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : (
            <Button ref={closeRef} onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
