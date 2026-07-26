import { useDeferredValue, useMemo, useState } from 'react';
import type { EquipmentItem } from '../types/dnd';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_KINDS,
  equipment as defaultEquipment,
} from '../data';
import { BrowserShell } from './BrowserShell';
import styles from './BrowserShell.module.css';

export interface EquipmentBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: EquipmentItem) => void;
  equipment?: EquipmentItem[];
  ownedIndexes?: string[];
}

export function EquipmentBrowser({
  open,
  onClose,
  onSelect,
  equipment = defaultEquipment,
  ownedIndexes = [],
}: EquipmentBrowserProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('any');
  const [kind, setKind] = useState('any');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const owned = useMemo(() => new Set(ownedIndexes), [ownedIndexes]);

  const filtered = useMemo(() => {
    return equipment.filter((item) => {
      if (category !== 'any' && item.category !== category) return false;
      if (kind !== 'any' && item.kind !== kind) return false;
      if (!deferredQuery) return true;
      const hay = `${item.name} ${item.description ?? ''} ${item.properties?.join(' ') ?? ''}`.toLowerCase();
      return hay.includes(deferredQuery);
    });
  }, [equipment, category, kind, deferredQuery]);

  return (
    <BrowserShell
      open={open}
      onClose={onClose}
      title="Equipment catalog"
      subtitle="Add gear, weapons, armor, and packs from the SRD."
      filters={
        <>
          <label className="field">
            <span>Search</span>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Longsword, pack…"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="any">Any</option>
              {EQUIPMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Kind</span>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="any">Any</option>
              {EQUIPMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <div />
        </>
      }
    >
      {filtered.length === 0 ? (
        <p className={styles.empty}>No equipment matches these filters.</p>
      ) : (
        filtered.map((item) => {
          const has = owned.has(item.index);
          const detailBits = [
            item.cost,
            item.weight != null ? `${item.weight} lb` : null,
            item.damage ? `${item.damage.dice} ${item.damage.type}` : null,
            item.two_handed_damage
              ? `2H ${item.two_handed_damage.dice} ${item.two_handed_damage.type}`
              : null,
            item.armor_class ? `AC ${item.armor_class.formula}` : null,
            item.properties?.length ? item.properties.join(', ') : null,
          ].filter(Boolean);

          return (
            <button
              key={item.index}
              type="button"
              className={styles.card}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
            >
              <div className={styles.cardTitle}>
                <span>{item.name}</span>
                <span className={styles.meta}>{has ? 'Owned' : 'Add'}</span>
              </div>
              <div className={styles.meta}>
                {item.kind} · {item.category}
                {detailBits.length ? ` · ${detailBits.join(' · ')}` : ''}
              </div>
              {item.description ? <p className={styles.desc}>{item.description}</p> : null}
              {item.special && !item.description ? (
                <p className={styles.desc}>{item.special}</p>
              ) : null}
            </button>
          );
        })
      )}
    </BrowserShell>
  );
}

export default EquipmentBrowser;
