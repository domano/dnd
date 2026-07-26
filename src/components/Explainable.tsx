import { useId, useState, type ReactNode } from 'react';
import styles from './Explainable.module.css';

export interface ExplainableProps {
  /** Primary label shown in the compact header. */
  name: ReactNode;
  /** Optional badge rendered beside the name (e.g. source, ritual). */
  badge?: ReactNode;
  /** Handbook text; arrays become separate paragraphs. */
  explanation?: string | string[] | null;
  defaultOpen?: boolean;
  /** Always-visible controls beside the toggle (prepare, remove, etc.). */
  actions?: ReactNode;
  /** Extra content inside the expanded panel after explanation. */
  children?: ReactNode;
  className?: string;
  /** Tighter header for dense lists (skills, inventory). */
  dense?: boolean;
}

function toParagraphs(input: string | string[]): string[] {
  const chunks = Array.isArray(input) ? input : [input];
  return chunks
    .flatMap((chunk) => String(chunk).split(/\n\s*\n/))
    .map((p) => p.replace(/\n+/g, ' ').trim())
    .filter(Boolean);
}

export function Explainable({
  name,
  badge,
  explanation,
  defaultOpen = false,
  actions,
  children,
  className,
  dense = false,
}: ExplainableProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const paragraphs =
    explanation == null || explanation === ''
      ? []
      : toParagraphs(explanation);
  const hasBody = paragraphs.length > 0 || Boolean(children);

  return (
    <div
      className={[
        styles.root,
        dense ? styles.dense : '',
        open ? styles.open : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-dense={dense || undefined}
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={hasBody ? panelId : undefined}
          disabled={!hasBody}
          onClick={() => {
            if (!hasBody) return;
            setOpen((v) => !v);
          }}
        >
          <span className={styles.name}>{name}</span>
          {badge ? <span className={styles.badge}>{badge}</span> : null}
          {hasBody ? (
            <span
              className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
              aria-hidden="true"
            >
              ▸
            </span>
          ) : null}
        </button>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {open && hasBody ? (
        <div id={panelId} className={styles.body} role="region">
          {paragraphs.map((p, i) => (
            <p key={i} className={styles.paragraph}>
              {p}
            </p>
          ))}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default Explainable;
