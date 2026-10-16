import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function MobileDrawer({ open, onClose, title = 'Navigation', children }: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    // Lock body scroll while drawer is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    // Focus inside drawer
    drawerRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="presentation">
      <div
        ref={drawerRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-panel__header">
          <span className="drawer-panel__title">{title}</span>
          <IconButton label="Close navigation menu" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="drawer-panel__content">{children}</div>
      </div>
    </div>
  );
}
