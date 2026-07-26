import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Spell } from '../types/dnd';
import { SPELL_CLASSES, SPELL_SCHOOLS, spells as defaultSpells } from '../data';
import { BrowserShell } from './BrowserShell';
import styles from './BrowserShell.module.css';

export interface SpellBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (spell: Spell) => void;
  spells?: Spell[];
  /** Already-known spell indexes to mark / optionally hide. */
  knownIndexes?: string[];
  excludeKnown?: boolean;
  /** Prefill the class filter (e.g. "Wizard"). */
  defaultClass?: string;
}

function levelLabel(level: number): string {
  return level === 0 ? 'Cantrip' : `Level ${level}`;
}

function resolveClassFilter(value?: string): string {
  if (!value) return 'any';
  const match = SPELL_CLASSES.find(
    (c) => c.toLowerCase() === value.toLowerCase(),
  );
  return match ?? 'any';
}

export function SpellBrowser({
  open,
  onClose,
  onSelect,
  spells = defaultSpells,
  knownIndexes = [],
  excludeKnown = false,
  defaultClass,
}: SpellBrowserProps) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<string>('any');
  const [school, setSchool] = useState('any');
  const [klass, setKlass] = useState(() => resolveClassFilter(defaultClass));
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const known = useMemo(() => new Set(knownIndexes), [knownIndexes]);

  useEffect(() => {
    if (!open) return;
    setKlass(resolveClassFilter(defaultClass));
  }, [open, defaultClass]);

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
          const offList =
            defaultClass != null &&
            !spell.classes.some(
              (c) => c.toLowerCase() === defaultClass.toLowerCase(),
            );
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
                <span className={styles.meta}>
                  {owned ? 'Known' : 'Add'}
                  {offList ? ' · Off-list' : ''}
                </span>
              </div>
              <div className={styles.meta}>
                {levelLabel(spell.level)} · {spell.school}
                {spell.ritual ? ' · Ritual' : ''} · {spell.classes.join(', ')}
                {offList ? ' · Not on class list' : ''}
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
