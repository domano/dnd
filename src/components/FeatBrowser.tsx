import { useDeferredValue, useMemo, useState, type FormEvent } from 'react';
import type { Feat } from '../types/dnd';
import type { CharacterFeatRef } from '../types/character';
import { feats as defaultFeats } from '../data';
import { BrowserShell, browserStyles as styles } from './BrowserShell';

export interface FeatBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (feat: CharacterFeatRef) => void;
  feats?: Feat[];
  ownedIndexes?: string[];
}

export function FeatBrowser({
  open,
  onClose,
  onSelect,
  feats = defaultFeats,
  ownedIndexes = [],
}: FeatBrowserProps) {
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const owned = useMemo(() => new Set(ownedIndexes), [ownedIndexes]);

  const filtered = useMemo(() => {
    return feats.filter((feat) => {
      if (!deferredQuery) return true;
      return (
        feat.name.toLowerCase().includes(deferredQuery) ||
        feat.description.toLowerCase().includes(deferredQuery)
      );
    });
  }, [feats, deferredQuery]);

  function submitCustom(e: FormEvent) {
    e.preventDefault();
    const name = customName.trim();
    if (!name) return;
    onSelect({
      index: `custom-${crypto.randomUUID()}`,
      name,
      description: customDesc.trim() || 'Custom feat.',
      custom: true,
      prerequisites: [],
    });
    setCustomName('');
    setCustomDesc('');
    onClose();
  }

  return (
    <BrowserShell
      open={open}
      onClose={onClose}
      title="Feats"
      subtitle="Pick an SRD feat or record a custom one."
      filters={
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Search</span>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Grappler…"
            autoFocus
          />
        </label>
      }
      footer={
        <form className={styles.form} onSubmit={submitCustom} style={{ width: '100%' }}>
          <div className={styles.formTitle}>Custom feat</div>
          <label className="field">
            <span>Name</span>
            <input
              className="input"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Homebrew feat name"
              required
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              className="textarea"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="Benefits and prerequisites…"
            />
          </label>
          <button type="submit" className="btn btn-brass btn-sm">
            Add custom feat
          </button>
        </form>
      }
    >
      {filtered.length === 0 ? (
        <p className={styles.empty}>No SRD feats match. Add a custom feat below.</p>
      ) : (
        filtered.map((feat) => {
          const has = owned.has(feat.index);
          return (
            <button
              key={feat.index}
              type="button"
              className={styles.card}
              onClick={() => {
                onSelect({
                  index: feat.index,
                  name: feat.name,
                  description: feat.description,
                  prerequisites: feat.prerequisites,
                  custom: false,
                });
                onClose();
              }}
            >
              <div className={styles.cardTitle}>
                <span>{feat.name}</span>
                <span className={styles.meta}>{has ? 'Owned' : 'Add'}</span>
              </div>
              {feat.prerequisites?.length ? (
                <div className={styles.meta}>Requires: {feat.prerequisites.join(', ')}</div>
              ) : null}
              <p className={styles.desc}>{feat.description}</p>
            </button>
          );
        })
      )}
    </BrowserShell>
  );
}

export default FeatBrowser;
