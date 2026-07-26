import { useMemo, useState } from 'react';
import type {
  Character,
  CharacterFeatRef,
  CharacterFeature,
  CharacterUpdate,
  Currency,
  InventoryItem,
  JournalEntry,
  QuestEntry,
} from '../types/character';
import { emptyCurrency, slotsUsedToState } from '../types/character';
import { ABILITY_SCORES } from '../types/dnd';
import type { EquipmentItem, Spell } from '../types/dnd';
import {
  conditions,
  getBackground,
  getCondition,
  getEquipment,
  getFeat,
  getRace,
  getSpell,
  getSubclass,
  skills,
} from '../data';
import {
  abilityModifier,
  characterHasExpertise,
  computeAC,
  computeInitiative,
  computeSpeed,
  formatModifier,
  getClassHitDie,
  getFeaturesForCharacter,
  getFinalAbilityScores,
  getSpellAttackBonus,
  getSpellSaveDC,
  getSpellSlots,
  passivePerception,
  primaryClass,
  proficiencyBonus,
  totalLevel,
  xpForLevel,
} from '../lib/rules';
import {
  classSpellList,
  preparedSpellCapacity,
} from '../lib/spellcasting';
import { useCharacterStore } from '../store/characterStore';
import { AbilityBlock } from './AbilityBlock';
import { StatChip } from './StatChip';
import { SkillList } from './SkillList';
import { HpTracker } from './HpTracker';
import { SpellSlots } from './SpellSlots';
import { DeathSaves } from './DeathSaves';
import { FeatureList } from './FeatureList';
import { SpellBrowser } from './SpellBrowser';
import { EquipmentBrowser } from './EquipmentBrowser';
import { FeatBrowser } from './FeatBrowser';
import { Explainable } from './Explainable';
import styles from './CharacterSheet.module.css';

export interface CharacterSheetProps {
  /** When provided with onChange, sheet is controlled. Otherwise uses the store. */
  character?: Character;
  onChange?: (update: CharacterUpdate) => void;
  onHome?: () => void;
  onEdit?: () => void;
  onLevelUp?: () => void;
  onShortRest?: () => void;
  onLongRest?: () => void;
}

function applyUpdate(character: Character, update: CharacterUpdate): Character {
  return typeof update === 'function'
    ? update(character)
    : { ...character, ...update, updatedAt: new Date().toISOString() };
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatWeight(lb: number): string {
  if (!Number.isFinite(lb) || lb <= 0) return '0 lb';
  return `${Number(lb.toFixed(1))} lb`;
}

function formatSpellComponents(spell: Spell): string {
  const parts = [
    spell.components.v ? 'V' : null,
    spell.components.s ? 'S' : null,
    spell.components.m
      ? `M${spell.components.material ? ` (${spell.components.material})` : ''}`
      : null,
  ].filter(Boolean);
  return parts.join(', ') || '—';
}

function spellExplanation(spell: Spell): string[] {
  const lines = [
    `Casting time: ${spell.casting_time}`,
    `Range: ${spell.range}`,
    `Components: ${formatSpellComponents(spell)}`,
    `Duration: ${spell.duration}${spell.concentration ? ' (concentration)' : ''}${spell.ritual ? ' (ritual)' : ''}`,
    spell.description,
  ];
  if (spell.higher_level) {
    lines.push(`At higher levels: ${spell.higher_level}`);
  }
  return lines;
}

function equipmentExplanation(item: EquipmentItem): string[] {
  const lines: string[] = [];
  lines.push(`${item.kind} · ${item.category}`);
  if (item.cost) lines.push(`Cost: ${item.cost}`);
  if (item.weight != null) lines.push(`Weight: ${item.weight} lb.`);
  if (item.damage) {
    lines.push(`Damage: ${item.damage.dice} ${item.damage.type}`);
  }
  if (item.two_handed_damage) {
    lines.push(
      `Two-handed: ${item.two_handed_damage.dice} ${item.two_handed_damage.type}`,
    );
  }
  if (item.armor_class) lines.push(`AC: ${item.armor_class.formula}`);
  if (item.properties?.length) {
    lines.push(`Properties: ${item.properties.join(', ')}`);
  }
  if (item.stealth_disadvantage) lines.push('Stealth: disadvantage');
  if (item.str_minimum) lines.push(`Strength requirement: ${item.str_minimum}`);
  if (item.special) lines.push(item.special);
  if (item.description) lines.push(item.description);
  if (item.contents?.length) {
    lines.push(
      `Contains: ${item.contents
        .map((c) => `${c.quantity}× ${c.name}`)
        .join(', ')}`,
    );
  }
  return lines;
}

function syncArmorFromInventory(inventory: InventoryItem[]): {
  armorEquipped?: string;
  shieldEquipped: boolean;
} {
  const equippedArmor = inventory.find(
    (e) =>
      e.equipped &&
      e.index &&
      getEquipment(e.index)?.kind === 'armor' &&
      getEquipment(e.index)?.armor_category !== 'Shield',
  );
  return {
    armorEquipped: equippedArmor?.index,
    shieldEquipped: inventory.some(
      (e) =>
        e.equipped &&
        e.index &&
        getEquipment(e.index)?.armor_category === 'Shield',
    ),
  };
}

export function CharacterSheet({
  character: characterProp,
  onChange,
  onHome,
  onEdit,
  onLevelUp,
  onShortRest,
  onLongRest,
}: CharacterSheetProps) {
  const storeCharacter = useCharacterStore((s) =>
    s.characters.find((c) => c.id === s.activeId),
  );
  const setAbility = useCharacterStore((s) => s.setAbility);
  const toggleSkill = useCharacterStore((s) => s.toggleSkill);
  const toggleExpertise = useCharacterStore((s) => s.toggleExpertise);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const addSpellStore = useCharacterStore((s) => s.addSpell);
  const removeSpellStore = useCharacterStore((s) => s.removeSpell);
  const prepareSpellStore = useCharacterStore((s) => s.prepareSpell);
  const restStore = useCharacterStore((s) => s.rest);
  const levelUpStore = useCharacterStore((s) => s.levelUp);

  const controlled = Boolean(characterProp && onChange);
  const character = characterProp ?? storeCharacter;

  const [spellBrowserOpen, setSpellBrowserOpen] = useState(false);
  const [equipmentBrowserOpen, setEquipmentBrowserOpen] = useState(false);
  const [featBrowserOpen, setFeatBrowserOpen] = useState(false);
  const [expandedItemNotes, setExpandedItemNotes] = useState<string | null>(null);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [journalDraft, setJournalDraft] = useState({
    title: '',
    body: '',
    sessionLabel: '',
    xpGained: '',
  });
  const [questDraft, setQuestDraft] = useState({
    title: '',
    notes: '',
    status: 'active' as QuestEntry['status'],
  });

  const derived = useMemo(() => {
    if (!character) return null;
    const level = totalLevel(character);
    const scores = getFinalAbilityScores(character);
    const race = getRace(character.raceId);
    const klass = primaryClass(character);
    const primary = character.classLevels[0];
    const subclass =
      primary?.subclassId && klass
        ? getSubclass(klass.id, primary.subclassId)
        : undefined;
    const slotInfo = getSpellSlots(character);
    const features: CharacterFeature[] = getFeaturesForCharacter(character).map(
      (f, i) => ({
        id: `${f.source}-${f.name}-${f.level}-${i}`,
        name: f.name,
        summary: f.summary,
        source: `${f.source} · L${f.level}`,
      }),
    );
    const featRows: CharacterFeatRef[] = [
      ...character.feats.map((index) => {
        const feat = getFeat(index);
        return {
          index,
          name: feat?.name ?? index,
          description: feat?.description ?? '',
          prerequisites: feat?.prerequisites,
          custom: false,
        };
      }),
      ...character.customFeats.map((f, i) => ({
        index: `custom-${i}-${f.name}`,
        name: f.name,
        description: f.description,
        custom: true as const,
      })),
    ];
    const knownSpells = character.spells.known
      .map((index) => getSpell(index))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

    const hitDie = primary ? getClassHitDie(primary.classId) : 8;
    const hitDiceMax = level;
    const hitDiceCurrent = Math.max(0, hitDiceMax - character.hitDiceUsed);

    const castingAbility = klass?.spellcasting?.ability;
    const castingScore = castingAbility ? scores[castingAbility] : 10;
    const classLevel = primary?.level ?? level;
    const prepareMax =
      klass?.spellcasting?.preparation === 'prepared'
        ? preparedSpellCapacity(klass, classLevel, castingScore)
        : 0;
    const preparedCount = character.spells.prepared.filter((index) => {
      const spell = getSpell(index);
      return spell != null && spell.level > 0;
    }).length;
    const classListIndexes = new Set(
      klass ? classSpellList(klass).map((s) => s.index) : [],
    );
    const cantrips = knownSpells.filter((s) => s.level === 0);
    const leveledKnown = knownSpells.filter((s) => s.level > 0);
    const preparedSpells = character.spells.prepared
      .map((index) => getSpell(index))
      .filter((s): s is NonNullable<typeof s> => s != null && s.level > 0)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

    return {
      level,
      scores,
      race,
      klass,
      subclass,
      pb: proficiencyBonus(level),
      ac: computeAC(character),
      initiative: computeInitiative(character),
      speed: computeSpeed(character),
      passivePerception: passivePerception(character),
      hasExpertise: characterHasExpertise(character),
      slotState: slotsUsedToState(slotInfo.slots, character.spells.slotsUsed),
      spellAttack: getSpellAttackBonus(character),
      spellSaveDC: getSpellSaveDC(character),
      features,
      featRows,
      knownSpells,
      cantrips,
      leveledKnown,
      preparedSpells,
      prepareMax,
      preparedCount,
      classListIndexes,
      hasSpellbook: Boolean(klass?.spellcasting?.spellbook),
      isPreparedCaster: klass?.spellcasting?.preparation === 'prepared',
      castingMod: castingAbility ? abilityModifier(castingScore) : null,
      hitDice: { die: hitDie, current: hitDiceCurrent, max: hitDiceMax },
      nextLevelXp: level < 20 ? xpForLevel(level + 1) : null,
      backgroundName:
        character.customBackground?.name ??
        (character.backgroundId
          ? getBackground(character.backgroundId)?.name
          : undefined),
    };
  }, [character]);

  if (!character || !derived) {
    return (
      <div className={`${styles.page} anim-fade-rise`}>
        <header className={styles.header}>
          <div className={styles.identity}>
            <h1 className={styles.name}>No character selected</h1>
            <p className={styles.meta}>Open a saved adventurer or create a new one.</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onHome}>
              Home
            </button>
          </div>
        </header>
      </div>
    );
  }

  const active = character;

  const {
    level,
    scores,
    race,
    klass,
    subclass,
    pb,
    ac,
    initiative,
    speed,
    passivePerception: pp,
    hasExpertise,
    slotState,
    spellAttack,
    spellSaveDC,
    features,
    featRows,
    cantrips,
    leveledKnown,
    preparedSpells,
    prepareMax,
    preparedCount,
    classListIndexes,
    hasSpellbook,
    isPreparedCaster,
    castingMod,
    hitDice,
    nextLevelXp,
    backgroundName,
  } = derived;

  const raceLine = [race?.name ?? active.raceId, active.subraceId]
    .filter(Boolean)
    .join(' · ');
  const classLine = [
    klass?.name ?? active.classLevels[0]?.classId,
    subclass?.name,
    `Level ${level}`,
  ]
    .filter(Boolean)
    .join(' · ');

  function patch(update: CharacterUpdate) {
    if (controlled && onChange) {
      onChange(update);
      return;
    }
    const next = applyUpdate(active, update);
    updateCharacter(active.id, next);
  }

  function handleLevelUp() {
    if (onLevelUp) {
      onLevelUp();
      return;
    }
    levelUpStore();
  }

  function handleShortRest() {
    if (onShortRest) {
      onShortRest();
      return;
    }
    restStore('short');
  }

  function handleLongRest() {
    if (onLongRest) {
      onLongRest();
      return;
    }
    restStore('long');
  }

  function handleAbilityChange(ability: (typeof ABILITY_SCORES)[number], nextFinal: number) {
    const delta = nextFinal - scores[ability];
    const nextBase = active.abilities[ability] + delta;
    if (controlled && onChange) {
      onChange({
        abilities: { ...active.abilities, [ability]: nextBase },
      });
      return;
    }
    setAbility(ability, nextBase);
  }

  function handleToggleSkill(skillName: string) {
    if (controlled && onChange) {
      onChange((prev) => {
        const has = prev.skillProficiencies.some(
          (s) => s.toLowerCase() === skillName.toLowerCase(),
        );
        return {
          ...prev,
          skillProficiencies: has
            ? prev.skillProficiencies.filter(
                (s) => s.toLowerCase() !== skillName.toLowerCase(),
              )
            : [...prev.skillProficiencies, skillName],
          expertise: has
            ? prev.expertise.filter((s) => s.toLowerCase() !== skillName.toLowerCase())
            : prev.expertise,
        };
      });
      return;
    }
    toggleSkill(skillName);
  }

  function handleToggleExpertise(skillName: string) {
    if (controlled && onChange) {
      onChange((prev) => {
        const proficient = prev.skillProficiencies.some(
          (s) => s.toLowerCase() === skillName.toLowerCase(),
        );
        if (!proficient) return prev;
        const has = prev.expertise.some(
          (s) => s.toLowerCase() === skillName.toLowerCase(),
        );
        return {
          ...prev,
          expertise: has
            ? prev.expertise.filter((s) => s.toLowerCase() !== skillName.toLowerCase())
            : [...prev.expertise, skillName],
        };
      });
      return;
    }
    toggleExpertise(skillName);
  }

  function removeSpell(index: string) {
    if (controlled && onChange) {
      onChange((prev) => ({
        ...prev,
        spells: {
          ...prev.spells,
          known: prev.spells.known.filter((s) => s !== index),
          prepared: prev.spells.prepared.filter((s) => s !== index),
          alwaysPrepared: (prev.spells.alwaysPrepared ?? []).filter(
            (s) => s !== index,
          ),
        },
      }));
    } else {
      removeSpellStore(index);
    }
  }

  function setPrepared(index: string, checked: boolean) {
    if (controlled && onChange) {
      onChange((prev) => {
        const isPrepared = prev.spells.prepared.includes(index);
        let preparedList = prev.spells.prepared;
        if (checked && !isPrepared) {
          preparedList = [...prev.spells.prepared, index];
        } else if (!checked && isPrepared) {
          preparedList = prev.spells.prepared.filter((s) => s !== index);
        }
        return {
          ...prev,
          spells: { ...prev.spells, prepared: preparedList },
        };
      });
    } else {
      prepareSpellStore(index, checked);
    }
  }

  function renderSpellGroup(
    title: string,
    list: NonNullable<ReturnType<typeof getSpell>>[],
    opts: { showPrepare: boolean; prepareOnlyIfKnown?: boolean },
  ) {
    if (list.length === 0) return null;
    const atBudget = preparedCount >= prepareMax && prepareMax > 0;
    return (
      <div className={styles.spellSection}>
        <h3>{title}</h3>
        <div className={styles.list}>
          {list.map((spell) => {
            const alwaysOn = (active.spells.alwaysPrepared ?? []).includes(
              spell.index,
            );
            const prepared =
              active.spells.prepared.includes(spell.index) || alwaysOn;
            const inBook = active.spells.known.includes(spell.index);
            const offList = !classListIndexes.has(spell.index);
            const canPrepare =
              opts.showPrepare &&
              spell.level > 0 &&
              (!opts.prepareOnlyIfKnown || inBook);
            const prepareDisabled =
              alwaysOn || (!prepared && atBudget);

            const badgeParts = [
              spell.ritual ? 'Ritual' : null,
              offList ? 'Off-list' : null,
            ].filter(Boolean);

            return (
              <div key={`${title}-${spell.index}`} className={styles.listItem}>
                <Explainable
                  name={spell.name}
                  badge={badgeParts.length ? badgeParts.join(' · ') : undefined}
                  explanation={spellExplanation(spell)}
                  actions={
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => removeSpell(spell.index)}
                    >
                      Remove
                    </button>
                  }
                />
                <div className={styles.listItemMeta}>
                  {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} ·{' '}
                  {spell.school}
                </div>
                {canPrepare ? (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={prepared}
                      disabled={prepareDisabled}
                      title={
                        !prepared && atBudget
                          ? `Prepare budget full (${prepareMax})`
                          : alwaysOn
                            ? 'Always prepared'
                            : undefined
                      }
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setPrepared(spell.index, false);
                          return;
                        }
                        if (atBudget) return;
                        setPrepared(spell.index, true);
                      }}
                    />
                    Prepared
                    {!prepared && atBudget ? ' (budget full)' : ''}
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} anim-fade-rise`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 className={styles.name}>{character.name}</h1>
          <p className={styles.meta}>
            {raceLine}
            {raceLine && classLine ? ' — ' : ''}
            {classLine}
          </p>
          <div className={styles.xpRow}>
            <span>
              XP <strong>{character.xp}</strong>
              {nextLevelXp != null ? ` / ${nextLevelXp}` : ' (max)'}
            </span>
            {backgroundName ? <span>· {backgroundName}</span> : null}
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn btn-brass btn-sm" onClick={handleLevelUp}>
            Level Up
          </button>
          <button type="button" className="btn btn-sm" onClick={handleShortRest}>
            Short Rest
          </button>
          <button type="button" className="btn btn-sm" onClick={handleLongRest}>
            Long Rest
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onHome}>
            Home
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={`panel anim-panel-slide ${styles.areaAbilities} ${styles.panelDelay1}`}>
          <div className="panel-header">
            <h2>Ability scores</h2>
          </div>
          <div className="panel-body">
            <div className={styles.abilities}>
              {ABILITY_SCORES.map((ability) => (
                <AbilityBlock
                  key={ability}
                  ability={ability}
                  score={scores[ability]}
                  onChange={(nextFinal) => handleAbilityChange(ability, nextFinal)}
                />
              ))}
            </div>
            <div className={styles.inspireRow}>
              <StatChip label="Proficiency" value={formatModifier(pb)} accent />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={character.inspiration}
                  onChange={(e) => patch({ inspiration: e.target.checked })}
                />
                Inspiration
              </label>
            </div>
          </div>
        </aside>

        <section className={`panel anim-panel-slide ${styles.areaCombat} ${styles.panelDelay2}`}>
          <div className="panel-header">
            <h2>Combat</h2>
          </div>
          <div className="panel-body">
            <div className={styles.statsGrid}>
              <StatChip label="Armor class" value={ac} accent />
              <StatChip label="Initiative" value={formatModifier(initiative)} accent />
              <StatChip label="Speed" value={`${speed} ft.`} />
              <StatChip label="Passive Perception" value={pp} />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.6rem' }}>Hit points</h3>
              <HpTracker
                hp={character.hp}
                hitDice={hitDice}
                onHpChange={(hp) => patch({ hp })}
                onHitDiceChange={(next) => {
                  const used = Math.max(0, next.max - next.current);
                  patch({ hitDiceUsed: used });
                }}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.6rem' }}>Death saves</h3>
              <DeathSaves
                value={character.deathSaves}
                onChange={(deathSaves) => patch({ deathSaves })}
              />
            </div>
          </div>
        </section>

        <section className={`panel anim-panel-slide ${styles.areaSkills} ${styles.panelDelay3}`}>
          <div className="panel-header">
            <h2>Saves & skills</h2>
          </div>
          <div className="panel-body">
            <SkillList
              character={character}
              skills={skills}
              onToggleSkill={handleToggleSkill}
              onToggleExpertise={
                hasExpertise ? handleToggleExpertise : undefined
              }
            />
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                Languages
              </h3>
              {character.languageChoices.length === 0 ? (
                <p className={styles.empty}>No languages recorded.</p>
              ) : (
                <ul className={styles.languages}>
                  {character.languageChoices.map((lang) => (
                    <li key={lang} className={styles.langChip}>
                      {lang}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className={`panel anim-panel-slide ${styles.areaFeatures} ${styles.panelDelay4}`}>
          <div className="panel-header">
            <h2>Features & traits</h2>
          </div>
          <div className="panel-body">
            <FeatureList features={features} />
          </div>
        </section>

        <section className={`panel anim-panel-slide ${styles.areaSpells} ${styles.panelDelay5}`}>
          <div className="panel-header">
            <h2>Spells</h2>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setSpellBrowserOpen(true)}
            >
              Add Spell
            </button>
          </div>
          <div className="panel-body">
            {spellAttack != null || spellSaveDC != null ? (
              <div className={styles.statsGrid} style={{ marginBottom: '0.85rem' }}>
                {spellAttack != null ? (
                  <StatChip label="Spell attack" value={formatModifier(spellAttack)} accent />
                ) : null}
                {spellSaveDC != null ? (
                  <StatChip label="Save DC" value={spellSaveDC} accent />
                ) : null}
              </div>
            ) : null}
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.6rem' }}>Slots</h3>
            <SpellSlots
              slots={slotState}
              onChange={(next) => {
                const slotsUsed = Array.from({ length: 9 }, (_, i) => next[i + 1]?.used ?? 0);
                patch({
                  spells: { ...character.spells, slotsUsed },
                });
              }}
            />

            {isPreparedCaster && prepareMax > 0 ? (
              <p
                className={styles.prepareBudget}
                data-over={preparedCount > prepareMax}
              >
                Prepared {preparedCount} / {prepareMax}
                {castingMod != null
                  ? ` (${klass?.name ?? 'Caster'} level + ${klass?.spellcasting?.ability?.slice(0, 3).toUpperCase()} mod)`
                  : ''}
                {preparedCount > prepareMax
                  ? ' — over prepare budget; unprepare spells before resting.'
                  : ''}
              </p>
            ) : null}

            {renderSpellGroup('Cantrips', cantrips, { showPrepare: false })}
            {hasSpellbook
              ? renderSpellGroup('Spellbook', leveledKnown, {
                  showPrepare: isPreparedCaster,
                  prepareOnlyIfKnown: true,
                })
              : isPreparedCaster
                ? renderSpellGroup(
                    'Prepared',
                    leveledKnown.length > 0 ? leveledKnown : preparedSpells,
                    { showPrepare: true },
                  )
                : renderSpellGroup('Known', leveledKnown, {
                    showPrepare: false,
                  })}
            {cantrips.length === 0 && leveledKnown.length === 0 ? (
              <p className={styles.empty}>No spells yet.</p>
            ) : null}
          </div>
        </section>

        <section className={`panel anim-panel-slide ${styles.areaEquipment}`}>
          <div className="panel-header">
            <h2>Inventory</h2>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setEquipmentBrowserOpen(true)}
            >
              Add Item
            </button>
          </div>
          <div className="panel-body">
            {(() => {
              const char = active;
              const currency = char.currency ?? emptyCurrency();
              const inventory = char.inventory ?? [];
              const carriedWeight = inventory.reduce((sum, item) => {
                if (typeof item.weight !== 'number') return sum;
                return sum + item.weight * item.quantity;
              }, 0);

              function setCurrencyField(key: keyof Currency, value: string) {
                const n = Math.max(0, Math.floor(Number(value) || 0));
                patch({ currency: { ...currency, [key]: n } });
              }

              function updateItem(id: string, next: Partial<InventoryItem>) {
                const updated = inventory.map((entry) =>
                  entry.id === id ? { ...entry, ...next } : entry,
                );
                patch({ inventory: updated, ...syncArmorFromInventory(updated) });
              }

              function removeItem(id: string) {
                const updated = inventory.filter((entry) => entry.id !== id);
                patch({ inventory: updated, ...syncArmorFromInventory(updated) });
              }

              function addCustomItem() {
                const name = customItemName.trim();
                if (!name) return;
                const qty = Math.max(1, Math.floor(customItemQty) || 1);
                const item: InventoryItem = {
                  id: newId(),
                  name,
                  quantity: qty,
                  equipped: false,
                };
                patch({ inventory: [...inventory, item] });
                setCustomItemName('');
                setCustomItemQty(1);
              }

              return (
                <>
                  <div className={styles.currencyRow}>
                    {(
                      [
                        ['cp', 'CP'],
                        ['sp', 'SP'],
                        ['ep', 'EP'],
                        ['gp', 'GP'],
                        ['pp', 'PP'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className={`field ${styles.currencyField}`}>
                        <span>{label}</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step={1}
                          value={currency[key]}
                          onChange={(e) => setCurrencyField(key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                  <p className={styles.weightLine}>
                    Carried weight: <strong>{formatWeight(carriedWeight)}</strong>
                    <span className={styles.listItemMeta}>
                      {' '}
                      (items without weight are omitted)
                    </span>
                  </p>

                  <div className={styles.quickAdd}>
                    <label className="field">
                      <span>Custom item</span>
                      <input
                        className="input"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        placeholder="Rope, potion…"
                      />
                    </label>
                    <label className="field">
                      <span>Qty</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={customItemQty}
                        onChange={(e) =>
                          setCustomItemQty(Math.max(1, Number(e.target.value) || 1))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={addCustomItem}
                      disabled={!customItemName.trim()}
                    >
                      Quick add
                    </button>
                  </div>

                  {inventory.length === 0 ? (
                    <p className={styles.empty}>Pack is empty.</p>
                  ) : (
                    <div className={styles.list}>
                      {inventory.map((item) => {
                        const notesOpen = expandedItemNotes === item.id;
                        const catalog = item.index ? getEquipment(item.index) : undefined;
                        const unitWeight =
                          typeof item.weight === 'number' ? item.weight : null;
                        return (
                          <div key={item.id} className={styles.listItem}>
                            {catalog ? (
                              <Explainable
                                name={item.name}
                                badge={item.quantity > 1 ? `×${item.quantity}` : undefined}
                                explanation={equipmentExplanation(catalog)}
                                actions={
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => removeItem(item.id)}
                                  >
                                    Remove
                                  </button>
                                }
                              />
                            ) : (
                              <div className={styles.listItemHeader}>
                                <span className={styles.listItemTitle}>
                                  {item.name}
                                  {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => removeItem(item.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                            <div className={styles.listItemMeta}>
                              {[
                                item.category,
                                item.cost,
                                unitWeight != null ? `${unitWeight} lb each` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Custom gear'}
                            </div>
                            <div className={styles.itemControls}>
                              <div className={styles.qtyControls}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost"
                                  aria-label="Decrease quantity"
                                  onClick={() =>
                                    updateItem(item.id, {
                                      quantity: Math.max(0, item.quantity - 1),
                                    })
                                  }
                                >
                                  −
                                </button>
                                <input
                                  className={`input ${styles.qtyInput}`}
                                  type="number"
                                  min={0}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      quantity: Math.max(
                                        0,
                                        Math.floor(Number(e.target.value) || 0),
                                      ),
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost"
                                  aria-label="Increase quantity"
                                  onClick={() =>
                                    updateItem(item.id, {
                                      quantity: item.quantity + 1,
                                    })
                                  }
                                >
                                  +
                                </button>
                              </div>
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.equipped)}
                                  onChange={(ev) =>
                                    updateItem(item.id, {
                                      equipped: ev.target.checked,
                                    })
                                  }
                                />
                                Equipped
                              </label>
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() =>
                                  setExpandedItemNotes((prev) =>
                                    prev === item.id ? null : item.id,
                                  )
                                }
                              >
                                {notesOpen ? 'Hide notes' : 'Notes'}
                              </button>
                            </div>
                            {notesOpen ? (
                              <div style={{ marginTop: '0.4rem' }}>
                                {catalog ? (
                                  <div className={styles.listItemBody}>
                                    {equipmentExplanation(catalog).map((line) => (
                                      <p key={line} style={{ margin: '0 0 0.35rem' }}>
                                        {line}
                                      </p>
                                    ))}
                                  </div>
                                ) : null}
                                <label className="field">
                                  <span>Item notes</span>
                                  <textarea
                                    className="textarea"
                                    rows={2}
                                    value={item.notes ?? ''}
                                    onChange={(e) =>
                                      updateItem(item.id, { notes: e.target.value })
                                    }
                                  />
                                </label>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </section>

        <section className={`panel anim-panel-slide ${styles.areaFeats}`}>
          <div className="panel-header">
            <h2>Feats</h2>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setFeatBrowserOpen(true)}
            >
              Add Feat
            </button>
          </div>
          <div className="panel-body">
            {featRows.length === 0 ? (
              <p className={styles.empty}>No feats.</p>
            ) : (
              <div className={styles.list}>
                {featRows.map((feat) => {
                  const explanation = [
                    feat.prerequisites?.length
                      ? `Prerequisites: ${feat.prerequisites.join('; ')}`
                      : null,
                    feat.description,
                  ].filter((line): line is string => Boolean(line));
                  return (
                    <Explainable
                      key={feat.index}
                      name={feat.name}
                      badge={feat.custom ? 'Custom' : undefined}
                      explanation={explanation}
                      defaultOpen
                      actions={
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            if (feat.custom) {
                              patch({
                                customFeats: character.customFeats.filter(
                                  (f) => f.name !== feat.name,
                                ),
                              });
                            } else {
                              patch({
                                feats: character.feats.filter(
                                  (f) => f !== feat.index,
                                ),
                              });
                            }
                          }}
                        >
                          Remove
                        </button>
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className={`panel anim-panel-slide ${styles.areaCampaign}`}>
          <div className="panel-header">
            <h2>Campaign</h2>
          </div>
          <div className="panel-body">
            {(() => {
              const char = active;
              const journal = [...(char.journal ?? [])].sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              const quests = char.quests ?? [];
              const activeConditions = char.activeConditions ?? [];

              function addJournalEntry() {
                const title = journalDraft.title.trim();
                const body = journalDraft.body.trim();
                if (!title && !body) return;
                const xpRaw = journalDraft.xpGained.trim();
                const xpGained =
                  xpRaw === ''
                    ? undefined
                    : Math.max(0, Math.floor(Number(xpRaw) || 0));
                const entry: JournalEntry = {
                  id: newId(),
                  createdAt: new Date().toISOString(),
                  title: title || 'Session note',
                  body,
                  sessionLabel: journalDraft.sessionLabel.trim() || undefined,
                  xpGained: xpGained && xpGained > 0 ? xpGained : undefined,
                };
                patch({
                  journal: [entry, ...(char.journal ?? [])],
                  xp:
                    entry.xpGained != null
                      ? char.xp + entry.xpGained
                      : char.xp,
                });
                setJournalDraft({
                  title: '',
                  body: '',
                  sessionLabel: '',
                  xpGained: '',
                });
              }

              function deleteJournalEntry(id: string) {
                patch({
                  journal: (char.journal ?? []).filter((e) => e.id !== id),
                });
              }

              function addQuest() {
                const title = questDraft.title.trim();
                if (!title) return;
                const entry: QuestEntry = {
                  id: newId(),
                  title,
                  status: questDraft.status,
                  notes: questDraft.notes.trim(),
                  updatedAt: new Date().toISOString(),
                };
                patch({ quests: [entry, ...(char.quests ?? [])] });
                setQuestDraft({ title: '', notes: '', status: 'active' });
              }

              function updateQuest(
                id: string,
                next: Partial<Pick<QuestEntry, 'status' | 'notes' | 'title'>>,
              ) {
                patch({
                  quests: (char.quests ?? []).map((q) =>
                    q.id === id
                      ? {
                          ...q,
                          ...next,
                          updatedAt: new Date().toISOString(),
                        }
                      : q,
                  ),
                });
              }

              function removeQuest(id: string) {
                patch({
                  quests: (char.quests ?? []).filter((q) => q.id !== id),
                });
              }

              function toggleCondition(index: string) {
                const has = activeConditions.includes(index);
                patch({
                  activeConditions: has
                    ? activeConditions.filter((c) => c !== index)
                    : [...activeConditions, index],
                });
              }

              return (
                <>
                  <div className={styles.campaignBlock}>
                    <h3>Journal</h3>
                    <p className={styles.listItemMeta}>
                      Session log — XP entered here is added to the character.
                    </p>
                    <div className={styles.journalForm}>
                      <label className="field">
                        <span>Title</span>
                        <input
                          className="input"
                          value={journalDraft.title}
                          onChange={(e) =>
                            setJournalDraft((d) => ({ ...d, title: e.target.value }))
                          }
                          placeholder="Ambush at the ford"
                        />
                      </label>
                      <label className="field">
                        <span>Session</span>
                        <input
                          className="input"
                          value={journalDraft.sessionLabel}
                          onChange={(e) =>
                            setJournalDraft((d) => ({
                              ...d,
                              sessionLabel: e.target.value,
                            }))
                          }
                          placeholder="Session 3"
                        />
                      </label>
                      <label className="field">
                        <span>XP gained</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={journalDraft.xpGained}
                          onChange={(e) =>
                            setJournalDraft((d) => ({
                              ...d,
                              xpGained: e.target.value,
                            }))
                          }
                          placeholder="0"
                        />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>Body</span>
                        <textarea
                          className="textarea"
                          rows={3}
                          value={journalDraft.body}
                          onChange={(e) =>
                            setJournalDraft((d) => ({ ...d, body: e.target.value }))
                          }
                          placeholder="What happened…"
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={addJournalEntry}
                        disabled={
                          !journalDraft.title.trim() && !journalDraft.body.trim()
                        }
                      >
                        Add entry
                      </button>
                    </div>
                    {journal.length === 0 ? (
                      <p className={styles.empty}>No journal entries yet.</p>
                    ) : (
                      <div className={styles.list}>
                        {journal.map((entry) => (
                          <div key={entry.id} className={styles.listItem}>
                            <div className={styles.listItemHeader}>
                              <span className={styles.listItemTitle}>
                                {entry.title}
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => deleteJournalEntry(entry.id)}
                              >
                                Delete
                              </button>
                            </div>
                            <div className={styles.listItemMeta}>
                              {new Date(entry.createdAt).toLocaleString()}
                              {entry.sessionLabel
                                ? ` · ${entry.sessionLabel}`
                                : ''}
                              {entry.xpGained
                                ? ` · +${entry.xpGained} XP`
                                : ''}
                            </div>
                            {entry.body ? (
                              <p className={styles.listItemBody}>{entry.body}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.campaignBlock}>
                    <h3>Quests</h3>
                    <div className={styles.journalForm}>
                      <label className="field">
                        <span>Title</span>
                        <input
                          className="input"
                          value={questDraft.title}
                          onChange={(e) =>
                            setQuestDraft((d) => ({ ...d, title: e.target.value }))
                          }
                          placeholder="Find the lost relic"
                        />
                      </label>
                      <label className="field">
                        <span>Status</span>
                        <select
                          className="select"
                          value={questDraft.status}
                          onChange={(e) =>
                            setQuestDraft((d) => ({
                              ...d,
                              status: e.target.value as QuestEntry['status'],
                            }))
                          }
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="failed">Failed</option>
                        </select>
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>Notes</span>
                        <textarea
                          className="textarea"
                          rows={2}
                          value={questDraft.notes}
                          onChange={(e) =>
                            setQuestDraft((d) => ({ ...d, notes: e.target.value }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={addQuest}
                        disabled={!questDraft.title.trim()}
                      >
                        Add quest
                      </button>
                    </div>
                    {quests.length === 0 ? (
                      <p className={styles.empty}>No quests tracked.</p>
                    ) : (
                      <div className={styles.list}>
                        {quests.map((quest) => (
                          <div key={quest.id} className={styles.listItem}>
                            <div className={styles.listItemHeader}>
                              <span className={styles.listItemTitle}>
                                {quest.title}
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => removeQuest(quest.id)}
                              >
                                Remove
                              </button>
                            </div>
                            <div className={styles.itemControls}>
                              <label className="field" style={{ flex: 1 }}>
                                <span>Status</span>
                                <select
                                  className="select"
                                  value={quest.status}
                                  onChange={(e) =>
                                    updateQuest(quest.id, {
                                      status: e.target
                                        .value as QuestEntry['status'],
                                    })
                                  }
                                >
                                  <option value="active">Active</option>
                                  <option value="completed">Completed</option>
                                  <option value="failed">Failed</option>
                                </select>
                              </label>
                            </div>
                            <label className="field" style={{ marginTop: '0.35rem' }}>
                              <span>Notes</span>
                              <textarea
                                className="textarea"
                                rows={2}
                                value={quest.notes}
                                onChange={(e) =>
                                  updateQuest(quest.id, { notes: e.target.value })
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.campaignBlock}>
                    <h3>Active conditions</h3>
                    <p className={styles.listItemMeta}>
                      Toggle conditions that currently apply. Expand a name for SRD rules.
                    </p>
                    <div className={styles.conditionList}>
                      {conditions.map((cond) => {
                        const on = activeConditions.includes(cond.index);
                        return (
                          <div key={cond.index} className={styles.conditionItem}>
                            <label className="checkbox" style={{ marginBottom: '0.35rem' }}>
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleCondition(cond.index)}
                              />
                              Active
                            </label>
                            <Explainable
                              name={cond.name}
                              badge={on ? 'On' : undefined}
                              explanation={
                                getCondition(cond.index)?.description ??
                                cond.description
                              }
                              dense
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </section>

        <section className={`panel anim-panel-slide ${styles.areaNotes}`}>
          <div className="panel-header">
            <h2>Notes & personality</h2>
          </div>
          <div className="panel-body">
            <div className={styles.notesGrid}>
              <label className="field">
                <span>Traits</span>
                <textarea
                  className="textarea"
                  value={character.personality.traits}
                  onChange={(e) =>
                    patch({
                      personality: { ...character.personality, traits: e.target.value },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Ideals</span>
                <textarea
                  className="textarea"
                  value={character.personality.ideals}
                  onChange={(e) =>
                    patch({
                      personality: { ...character.personality, ideals: e.target.value },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Bonds</span>
                <textarea
                  className="textarea"
                  value={character.personality.bonds}
                  onChange={(e) =>
                    patch({
                      personality: { ...character.personality, bonds: e.target.value },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Flaws</span>
                <textarea
                  className="textarea"
                  value={character.personality.flaws}
                  onChange={(e) =>
                    patch({
                      personality: { ...character.personality, flaws: e.target.value },
                    })
                  }
                />
              </label>
            </div>
            <label className="field" style={{ marginTop: '1rem' }}>
              <span>Campaign notes</span>
              <textarea
                className="textarea"
                value={character.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={5}
              />
            </label>
          </div>
        </section>
      </div>

      <div className={styles.combatBar} aria-label="Combat quick stats">
        <div className={styles.combatStat}>
          <span className={styles.combatLabel}>AC</span>
          <span className={styles.combatValue}>{ac}</span>
        </div>
        <div className={styles.combatStat}>
          <span className={styles.combatLabel}>HP</span>
          <span className={styles.combatValue}>
            {character.hp.current}/{character.hp.max}
          </span>
        </div>
        <div className={styles.combatStat}>
          <span className={styles.combatLabel}>Init</span>
          <span className={styles.combatValue}>{formatModifier(initiative)}</span>
        </div>
        <div className={styles.combatStat}>
          <span className={styles.combatLabel}>Speed</span>
          <span className={styles.combatValue}>{speed}</span>
        </div>
      </div>

      <SpellBrowser
        open={spellBrowserOpen}
        onClose={() => setSpellBrowserOpen(false)}
        knownIndexes={character.spells.known}
        defaultClass={klass?.name}
        onSelect={(spell) => {
          if (controlled && onChange) {
            onChange((prev) => {
              if (prev.spells.known.includes(spell.index)) return prev;
              return {
                ...prev,
                spells: {
                  ...prev.spells,
                  known: [...prev.spells.known, spell.index],
                },
              };
            });
          } else {
            addSpellStore(spell.index);
          }
        }}
      />
      <EquipmentBrowser
        open={equipmentBrowserOpen}
        onClose={() => setEquipmentBrowserOpen(false)}
        ownedIndexes={
          (character.inventory ?? [])
            .map((e) => e.index)
            .filter(Boolean) as string[]
        }
        onSelect={(item) => {
          patch((prev) => {
            const inventory = prev.inventory ?? [];
            const existingIdx = inventory.findIndex((e) => e.index === item.index);
            if (existingIdx >= 0) {
              const next = inventory.map((e, i) =>
                i === existingIdx ? { ...e, quantity: e.quantity + 1 } : e,
              );
              return { ...prev, inventory: next };
            }
            const entry: InventoryItem = {
              id: newId(),
              index: item.index,
              name: item.name,
              quantity: item.bundle_quantity ?? 1,
              equipped: false,
              weight: item.weight ?? null,
              cost: item.cost ?? null,
              category: item.category,
            };
            return { ...prev, inventory: [...inventory, entry] };
          });
        }}
      />
      <FeatBrowser
        open={featBrowserOpen}
        onClose={() => setFeatBrowserOpen(false)}
        ownedIndexes={character.feats}
        onSelect={(feat) => {
          if (feat.custom) {
            patch({
              customFeats: [
                ...character.customFeats,
                { name: feat.name, description: feat.description },
              ],
            });
          } else if (!character.feats.includes(feat.index)) {
            patch({ feats: [...character.feats, feat.index] });
          }
        }}
      />
    </div>
  );
}

export default CharacterSheet;
