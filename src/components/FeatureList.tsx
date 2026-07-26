import type { CharacterFeature } from '../types/character';
import { Explainable } from './Explainable';
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
  const openDefaults = new Set(defaultOpenIds);

  if (features.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.list}>
      {features.map((feature) => (
        <Explainable
          key={feature.id}
          name={feature.name}
          badge={feature.source}
          explanation={feature.summary}
          defaultOpen={openDefaults.has(feature.id)}
        />
      ))}
    </div>
  );
}

export default FeatureList;
