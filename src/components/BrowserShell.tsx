import { useEffect, useId, type ReactNode } from 'react';
import styles from './BrowserShell.module.css';

export interface BrowserShellProps {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function BrowserShell({
  title,
  subtitle,
  open,
  onClose,
  filters,
  footer,
  children,
}: BrowserShellProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.drawer} anim-drawer-in`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        {filters ? <div className={styles.filters}>{filters}</div> : null}
        <div className={styles.list}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

export default BrowserShell;
