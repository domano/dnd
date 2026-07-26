import { useDeferredValue, useMemo, useState } from 'react';
import type { Spell } from '../types/dnd';
import { SPELL_CLASSES, SPELL_SCHOOLS, spells as defaultSpells } from '../data';
import { BrowserShell, browserStyles as styles } from './BrowserShell';

export interface SpellBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (spell: Spell) => void;
  spells?: Spell[];
  /** Already-known spell indexes to mark / optionally hide. */
  knownIndexes?: string[];
  excludeKnown?: boolean;
}

function levelLabel(level: number): string {
  return level === 0 ? 'Cantrip' : `Level ${level}`;
}

export function SpellBrowser({
  open,
  onClose,
  onSelect,
  spells = defaultSpells,
  knownIndexes = [],
  excludeKnown = false,
}: SpellBrowserProps) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<string>('any');
  const [school, setSchool] = useState('any');
  const [klass, setKlass] = useState('any');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const known = useMemo(() => new Set(knownIndexes), [knownIndexes]);

  const filtered = useMemo(() => {
    return spells.filter((spell) => {
      if (excludeKnown && known.has(spell.index)) return false;
      if (level !== 'any' && spell.level !== Number(level)) return false;
      if (school !== 'any' && spell.school !== school) return false;
      if (klass !== 'any' && !spell.classes.includes(klass)) return false;
      if (!deferredQuery) return true;
      return (
        spell.name.toLowerCase().includes(deferredQuery) ||
        spell.description.toLowerCase().includes(deferredQuery)
      );
    });
  }, [spells, level, school, klass, deferredQuery, excludeKnown, known]);

  return (
    <BrowserShell
      open={open}
      onClose={onClose}
      title="Spell ledger"
      subtitle="Search the SRD and add a spell to this character."
      filters={
        <>
          <label className="field">
            <span>Search</span>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Fireball, shield…"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Level</span>
            <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="any">Any</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={String(i)}>
                  {levelLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>School</span>
            <select className="select" value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="any">Any</option>
              {SPELL_SCHOOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Class</span>
            <select className="select" value={klass} onChange={(e) => setKlass(e.target.value)}>
              <option value="any">Any</option>
              {SPELL_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {filtered.length === 0 ? (
        <p className={styles.empty}>No spells match these filters.</p>
      ) : (
        filtered.map((spell) => {
          const owned = known.has(spell.index);
          return (
            <button
              key={spell.index}
              type="button"
              className={styles.card}
              onClick={() => {
                onSelect(spell);
                onClose();
              }}
            >
              <div className={styles.cardTitle}>
                <span>{spell.name}</span>
                <span className={styles.meta}>{owned ? 'Known' : 'Add'}</span>
              </div>
              <div className={styles.meta}>
                {levelLabel(spell.level)} · {spell.school} · {spell.classes.join(', ')}
              </div>
              <p className={styles.desc}>{spell.description}</p>
            </button>
          );
        })
      )}
    </BrowserShell>
  );
}

export default SpellBrowser;
