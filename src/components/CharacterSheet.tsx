import { useMemo, useState } from 'react';
import type {
  Character,
  CharacterFeatRef,
  CharacterFeature,
  CharacterUpdate,
} from '../types/character';
import { slotsUsedToState } from '../types/character';
import { ABILITY_SCORES } from '../types/dnd';
import {
  getBackground,
  getEquipment,
  getFeat,
  getRace,
  getSpell,
  getSubclass,
  skills,
} from '../data';
import {
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
  primaryClass,
  proficiencyBonus,
  totalLevel,
  xpForLevel,
} from '../lib/rules';
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
      slotState: slotsUsedToState(slotInfo.slots, character.spells.slotsUsed),
      spellAttack: getSpellAttackBonus(character),
      spellSaveDC: getSpellSaveDC(character),
      features,
      featRows,
      knownSpells,
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
    slotState,
    spellAttack,
    spellSaveDC,
    features,
    featRows,
    knownSpells,
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
              onToggleExpertise={handleToggleExpertise}
            />
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
            <h3 style={{ fontSize: '0.95rem', margin: '1rem 0 0.6rem' }}>Known / prepared</h3>
            {knownSpells.length === 0 ? (
              <p className={styles.empty}>No spells yet.</p>
            ) : (
              <div className={styles.list}>
                {knownSpells.map((spell) => {
                  const prepared =
                    character.spells.prepared.includes(spell.index) ||
                    (character.spells.alwaysPrepared ?? []).includes(spell.index);
                  return (
                    <div key={spell.index} className={styles.listItem}>
                      <div className={styles.listItemHeader}>
                        <span className={styles.listItemTitle}>{spell.name}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            if (controlled && onChange) {
                              onChange((prev) => ({
                                ...prev,
                                spells: {
                                  ...prev.spells,
                                  known: prev.spells.known.filter((s) => s !== spell.index),
                                  prepared: prev.spells.prepared.filter(
                                    (s) => s !== spell.index,
                                  ),
                                  alwaysPrepared: (prev.spells.alwaysPrepared ?? []).filter(
                                    (s) => s !== spell.index,
                                  ),
                                },
                              }));
                            } else {
                              removeSpellStore(spell.index);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div className={styles.listItemMeta}>
                        {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} · {spell.school}
                      </div>
                      {spell.level > 0 ? (
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={prepared}
                            onChange={(e) => {
                              if (controlled && onChange) {
                                const checked = e.target.checked;
                                onChange((prev) => {
                                  const isPrepared = prev.spells.prepared.includes(spell.index);
                                  let preparedList = prev.spells.prepared;
                                  if (checked && !isPrepared) {
                                    preparedList = [...prev.spells.prepared, spell.index];
                                  } else if (!checked && isPrepared) {
                                    preparedList = prev.spells.prepared.filter(
                                      (s) => s !== spell.index,
                                    );
                                  }
                                  return {
                                    ...prev,
                                    spells: { ...prev.spells, prepared: preparedList },
                                  };
                                });
                              } else {
                                prepareSpellStore(spell.index, e.target.checked);
                              }
                            }}
                          />
                          Prepared
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className={`panel anim-panel-slide ${styles.areaEquipment}`}>
          <div className="panel-header">
            <h2>Equipment</h2>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setEquipmentBrowserOpen(true)}
            >
              Add Item
            </button>
          </div>
          <div className="panel-body">
            {character.inventory.length === 0 ? (
              <p className={styles.empty}>Pack is empty.</p>
            ) : (
              <div className={styles.list}>
                {character.inventory.map((item, idx) => (
                  <div key={`${item.index ?? item.name}-${idx}`} className={styles.listItem}>
                    <div className={styles.listItemHeader}>
                      <span className={styles.listItemTitle}>
                        {item.name}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() =>
                          patch({
                            inventory: character.inventory.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(item.equipped)}
                        onChange={(ev) => {
                          const inventory = character.inventory.map((entry, i) =>
                            i === idx ? { ...entry, equipped: ev.target.checked } : entry,
                          );
                          const equippedArmor = inventory.find(
                            (e) =>
                              e.equipped &&
                              e.index &&
                              getEquipment(e.index)?.kind === 'armor' &&
                              getEquipment(e.index)?.armor_category !== 'Shield',
                          );
                          patch({
                            inventory,
                            armorEquipped: equippedArmor?.index,
                            shieldEquipped: inventory.some(
                              (e) =>
                                e.equipped &&
                                e.index &&
                                getEquipment(e.index)?.armor_category === 'Shield',
                            ),
                          });
                        }}
                      />
                      Equipped
                    </label>
                  </div>
                ))}
              </div>
            )}
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
                {featRows.map((feat) => (
                  <div key={feat.index} className={styles.listItem}>
                    <div className={styles.listItemHeader}>
                      <span className={styles.listItemTitle}>{feat.name}</span>
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
                              feats: character.feats.filter((f) => f !== feat.index),
                            });
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    {feat.prerequisites?.length ? (
                      <div className={styles.listItemMeta}>
                        Requires: {feat.prerequisites.join(', ')}
                      </div>
                    ) : null}
                    <p className={styles.listItemBody}>{feat.description}</p>
                  </div>
                ))}
              </div>
            )}
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
        ownedIndexes={character.inventory.map((e) => e.index).filter(Boolean) as string[]}
        onSelect={(item) => {
          patch((prev) => {
            const existingIdx = prev.inventory.findIndex((e) => e.index === item.index);
            if (existingIdx >= 0) {
              return {
                ...prev,
                inventory: prev.inventory.map((e, i) =>
                  i === existingIdx ? { ...e, quantity: e.quantity + 1 } : e,
                ),
              };
            }
            return {
              ...prev,
              inventory: [
                ...prev.inventory,
                {
                  index: item.index,
                  name: item.name,
                  quantity: item.bundle_quantity ?? 1,
                  equipped: false,
                },
              ],
            };
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
