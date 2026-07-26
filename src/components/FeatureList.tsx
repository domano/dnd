import { useState } from 'react';
import type { CharacterFeature } from '../types/character';
import styles from './FeatureList.module.css';

export interface FeatureListProps {
  features: CharacterFeature[];
  /** When set, only these ids start expanded. Default: none. */
  defaultOpenIds?: string[];
  emptyMessage?: string;
}

export function FeatureList({
  features,
  defaultOpenIds = [],
  emptyMessage = 'No features yet.',
}: FeatureListProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpenIds));

  if (features.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.list}>
      {features.map((feature) => {
        const isOpen = open.has(feature.id);
        return (
          <div key={feature.id} className={styles.item}>
            <button
              type="button"
              className={styles.summary}
              aria-expanded={isOpen}
              onClick={() => {
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (next.has(feature.id)) next.delete(feature.id);
                  else next.add(feature.id);
                  return next;
                });
              }}
            >
              <span className={styles.titleWrap}>
                <span className={styles.title}>{feature.name}</span>
                {feature.source ? <span className={styles.source}>{feature.source}</span> : null}
              </span>
              <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true">
                ▸
              </span>
            </button>
            {isOpen ? <div className={styles.body}>{feature.summary}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export default FeatureList;
