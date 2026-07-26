import { useMemo, useState } from 'react';
import {
  backgrounds,
  classes,
  conditions,
  equipment,
  feats,
  races,
  skills,
  spells,
} from '../data';
import styles from './Compendium.module.css';

type Tab =
  | 'classes'
  | 'races'
  | 'spells'
  | 'skills'
  | 'feats'
  | 'conditions'
  | 'equipment'
  | 'backgrounds';

const TABS: { id: Tab; label: string }[] = [
  { id: 'classes', label: 'Classes' },
  { id: 'races', label: 'Races' },
  { id: 'spells', label: 'Spells' },
  { id: 'skills', label: 'Skills' },
  { id: 'feats', label: 'Feats' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'backgrounds', label: 'Backgrounds' },
];

export interface CompendiumProps {
  onBack?: () => void;
}

export function Compendium({ onBack }: CompendiumProps) {
  const [tab, setTab] = useState<Tab>('classes');
  const [query, setQuery] = useState('');
  const [spellLevel, setSpellLevel] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    if (tab === 'classes') {
      return classes
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .map((c) => ({ id: c.id, title: c.name, subtitle: `d${c.hit_die} · ${c.primary_abilities.join(', ')}` }));
    }
    if (tab === 'races') {
      return races
        .filter((r) => !q || r.name.toLowerCase().includes(q))
        .map((r) => ({
          id: r.id,
          title: r.name,
          subtitle: `${r.size} · ${r.speed} ft.${r.subraces.length ? ` · ${r.subraces.length} subraces` : ''}`,
        }));
    }
    if (tab === 'spells') {
      return spells
        .filter((s) => {
          if (spellLevel !== 'all' && s.level !== Number(spellLevel)) return false;
          if (!q) return true;
          return (
            s.name.toLowerCase().includes(q) ||
            s.school.toLowerCase().includes(q) ||
            s.classes.some((c) => c.toLowerCase().includes(q))
          );
        })
        .map((s) => ({
          id: s.index,
          title: s.name,
          subtitle: `${s.level === 0 ? 'Cantrip' : `Level ${s.level}`} · ${s.school}`,
        }));
    }
    if (tab === 'skills') {
      return skills
        .filter((s) => !q || s.name.toLowerCase().includes(q))
        .map((s) => ({ id: s.index, title: s.name, subtitle: s.ability_name }));
    }
    if (tab === 'feats') {
      return feats
        .filter((f) => !q || f.name.toLowerCase().includes(q))
        .map((f) => ({ id: f.index, title: f.name, subtitle: f.prerequisites.join(', ') || 'No prerequisites' }));
    }
    if (tab === 'conditions') {
      return conditions
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .map((c) => ({ id: c.index, title: c.name, subtitle: `${c.description.length} rules` }));
    }
    if (tab === 'equipment') {
      return equipment
        .filter((e) => !q || e.name.toLowerCase().includes(q) || e.kind.includes(q))
        .map((e) => ({ id: e.index, title: e.name, subtitle: `${e.kind} · ${e.category}` }));
    }
    return backgrounds
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .map((b) => ({ id: b.id, title: b.name, subtitle: b.skills.join(', ') }));
  }, [tab, q, spellLevel]);

  const detail = useMemo(() => {
    if (!selectedId) return null;
    if (tab === 'classes') {
      const c = classes.find((x) => x.id === selectedId);
      if (!c) return null;
      const features = Object.entries(c.features_by_level)
        .sort(([a], [b]) => Number(a) - Number(b))
        .flatMap(([lvl, feats]) => feats.map((f) => `L${lvl}: ${f.name}`));
      return {
        title: c.name,
        body: [
          `Hit die: d${c.hit_die}`,
          `Saves: ${c.saving_throws.join(', ')}`,
          `Skills: choose ${c.proficiencies.skills?.choose ?? 0} from ${(c.proficiencies.skills?.options ?? []).join(', ')}`,
          `Armor: ${c.proficiencies.armor.join(', ') || 'None'}`,
          `Weapons: ${c.proficiencies.weapons.join(', ') || 'None'}`,
          c.spellcasting
            ? `Spellcasting: ${c.spellcasting.ability} (${c.spellcasting.caster_type}, ${c.spellcasting.preparation})`
            : 'No spellcasting',
          `Subclass at ${c.subclass_unlock_level}: ${c.subclasses.map((s) => s.name).join(', ')}`,
          `ASI levels: ${c.asi_levels.join(', ')}`,
          '',
          'Features:',
          ...features.slice(0, 40),
        ].join('\n'),
      };
    }
    if (tab === 'races') {
      const r = races.find((x) => x.id === selectedId);
      if (!r) return null;
      return {
        title: r.name,
        body: [
          `Size ${r.size}, speed ${r.speed} ft.`,
          `Ability bonuses: ${r.ability_bonuses.map((b) => `${b.ability} +${b.bonus}`).join(', ')}`,
          `Languages: ${r.languages.join(', ')}`,
          r.darkvision ? `Darkvision ${r.darkvision} ft.` : null,
          r.subraces.length
            ? `Subraces: ${r.subraces.map((s) => s.name).join(', ')}`
            : null,
          '',
          ...r.traits.map((t) => `${t.name}: ${t.summary}`),
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
    }
    if (tab === 'spells') {
      const s = spells.find((x) => x.index === selectedId);
      if (!s) return null;
      const comps = [
        s.components.v ? 'V' : null,
        s.components.s ? 'S' : null,
        s.components.m ? `M${s.components.material ? ` (${s.components.material})` : ''}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      return {
        title: s.name,
        body: [
          `${s.level === 0 ? 'Cantrip' : `Level ${s.level}`} ${s.school}`,
          `Casting time: ${s.casting_time}`,
          `Range: ${s.range}`,
          `Components: ${comps}`,
          `Duration: ${s.duration}${s.concentration ? ' (concentration)' : ''}${s.ritual ? ' (ritual)' : ''}`,
          `Classes: ${s.classes.join(', ')}`,
          '',
          s.description,
          s.higher_level ? `\nAt higher levels: ${s.higher_level}` : '',
        ].join('\n'),
      };
    }
    if (tab === 'skills') {
      const s = skills.find((x) => x.index === selectedId);
      if (!s) return null;
      return { title: s.name, body: `${s.ability_name}\n\n${s.description}` };
    }
    if (tab === 'feats') {
      const f = feats.find((x) => x.index === selectedId);
      if (!f) return null;
      return {
        title: f.name,
        body: `${f.prerequisites.length ? `Prerequisites: ${f.prerequisites.join('; ')}\n\n` : ''}${f.description}`,
      };
    }
    if (tab === 'conditions') {
      const c = conditions.find((x) => x.index === selectedId);
      if (!c) return null;
      return { title: c.name, body: c.description.join('\n\n') };
    }
    if (tab === 'equipment') {
      const e = equipment.find((x) => x.index === selectedId);
      if (!e) return null;
      const lines = [
        `${e.kind} · ${e.category}`,
        e.cost ? `Cost: ${e.cost}` : null,
        e.weight != null ? `Weight: ${e.weight} lb.` : null,
        e.damage ? `Damage: ${e.damage.dice} ${e.damage.type}` : null,
        e.armor_class ? `AC: ${e.armor_class.formula}` : null,
        e.properties?.length ? `Properties: ${e.properties.join(', ')}` : null,
        e.description || null,
      ];
      return { title: e.name, body: lines.filter(Boolean).join('\n') };
    }
    const b = backgrounds.find((x) => x.id === selectedId);
    if (!b) return null;
    return {
      title: b.name,
      body: [
        `Skills: ${b.skills.join(', ')}`,
        b.feature ? `${b.feature.name}: ${b.feature.summary}` : null,
        `Equipment: ${b.equipment.map((e) => `${e.quantity}× ${e.name}`).join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    };
  }, [tab, selectedId]);

  return (
    <main className={`${styles.page} anim-fade-rise`}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>SRD 5.1 reference</p>
          <h1 className={styles.title}>Compendium</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Compendium sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? styles.tabActive : styles.tab}
            onClick={() => {
              setTab(t.id);
              setSelectedId(null);
              setQuery('');
              setSpellLevel('all');
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <input
          className="input"
          type="search"
          placeholder={`Search ${tab}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${tab}`}
        />
        {tab === 'spells' ? (
          <select
            className="input"
            value={spellLevel}
            onChange={(e) => setSpellLevel(e.target.value)}
            aria-label="Filter by spell level"
          >
            <option value="all">All levels</option>
            <option value="0">Cantrips</option>
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                Level {i + 1}
              </option>
            ))}
          </select>
        ) : null}
        <span className={styles.count}>{items.length} entries</span>
      </div>

      <div className={styles.split}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={selectedId === item.id ? styles.itemActive : styles.item}
                onClick={() => setSelectedId(item.id)}
              >
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemSub}>{item.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
        <article className={`panel ${styles.detail}`}>
          {detail ? (
            <>
              <div className="panel-header">
                <h2>{detail.title}</h2>
              </div>
              <div className="panel-body">
                <pre className={styles.detailBody}>{detail.body}</pre>
              </div>
            </>
          ) : (
            <div className="panel-body">
              <p className={styles.placeholder}>Select an entry to read its details.</p>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}

export default Compendium;
