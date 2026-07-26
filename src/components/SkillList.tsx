import { useState } from 'react';
import type { AbilityScore, Skill } from '../types/dnd';
import type { Character } from '../types/character';
import { ABILITY_SCORE_SHORT } from '../types/character';
import {
  formatModifier,
  getSavingThrows,
  getSkillsWithBonuses,
} from '../lib/rules';
import styles from './SkillList.module.css';

/** Short educational blurbs for typical saving-throw uses (generic SRD guidance). */
const SAVE_BLURBS: Record<AbilityScore, string> = {
  strength:
    'Strength saves resist forced movement, grapples, and effects that overpower you physically.',
  dexterity:
    'Dexterity saves help you dodge area effects, traps, and other threats you can leap or duck away from.',
  constitution:
    'Constitution saves resist poison, disease, exhaustion, and many effects that tax your endurance.',
  intelligence:
    'Intelligence saves resist mental assaults that target reason, memory, or your grasp of reality.',
  wisdom:
    'Wisdom saves resist charms, fear, and other effects that prey on awareness or willpower.',
  charisma:
    'Charisma saves resist effects that seize control of your sense of self or force you to act against your nature.',
};

export interface SkillListProps {
  character: Character;
  skills: Skill[];
  onToggleSkill?: (skillName: string) => void;
  onToggleExpertise?: (skillName: string) => void;
  showSaves?: boolean;
}

export function SkillList({
  character,
  skills,
  onToggleSkill,
  onToggleExpertise,
  showSaves = true,
}: SkillListProps) {
  const saves = getSavingThrows(character);
  const rows = getSkillsWithBonuses(character, skills).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const skillByIndex = new Map(skills.map((s) => [s.index, s]));

  function toggle(key: string) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className={styles.wrap}>
      {showSaves ? (
        <>
          <div className={styles.sectionTitle}>Saving throws</div>
          {saves.map((row) => {
            const key = `save-${row.ability}`;
            const isOpen = openKey === key;
            return (
              <div key={row.ability} className={styles.block}>
                <div className={styles.row}>
                  <input
                    type="checkbox"
                    checked={row.proficient}
                    readOnly
                    disabled
                    aria-label={`${ABILITY_SCORE_SHORT[row.ability]} save proficiency`}
                  />
                  <span className={styles.ability}>
                    {ABILITY_SCORE_SHORT[row.ability]}
                  </span>
                  <button
                    type="button"
                    className={styles.nameBtn}
                    aria-expanded={isOpen}
                    onClick={() => toggle(key)}
                  >
                    Saving throw
                    <span
                      className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                  </button>
                  <span />
                  <button
                    type="button"
                    className={`${styles.infoBtn} touch-target`}
                    aria-label={`Explain ${ABILITY_SCORE_SHORT[row.ability]} saving throw`}
                    aria-expanded={isOpen}
                    onClick={() => toggle(key)}
                    title="Show rules"
                  >
                    ?
                  </button>
                  <span className={styles.bonus}>{formatModifier(row.modifier)}</span>
                </div>
                {isOpen ? (
                  <div className={styles.explain}>{SAVE_BLURBS[row.ability]}</div>
                ) : null}
              </div>
            );
          })}
          <div className={styles.sectionTitle}>Skills</div>
        </>
      ) : null}

      {rows.map((row) => {
        const key = `skill-${row.index}`;
        const isOpen = openKey === key;
        const description = skillByIndex.get(row.index)?.description ?? '';
        return (
          <div key={row.index} className={styles.block}>
            <div className={styles.row}>
              <input
                type="checkbox"
                checked={row.proficient}
                disabled={!onToggleSkill}
                onChange={() => onToggleSkill?.(row.name)}
                aria-label={`${row.name} proficiency`}
              />
              <span className={styles.ability}>
                {ABILITY_SCORE_SHORT[row.ability]}
              </span>
              <button
                type="button"
                className={styles.nameBtn}
                aria-expanded={isOpen}
                disabled={!description}
                onClick={() => {
                  if (description) toggle(key);
                }}
              >
                {row.name}
                {description ? (
                  <span
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                    aria-hidden="true"
                  >
                    ▸
                  </span>
                ) : null}
              </button>
              {onToggleExpertise ? (
                <button
                  type="button"
                  className={row.expertise ? styles.expOn : styles.expOff}
                  disabled={!row.proficient}
                  onClick={() => onToggleExpertise(row.name)}
                  title="Toggle expertise"
                  aria-pressed={row.expertise}
                >
                  Exp
                </button>
              ) : row.expertise ? (
                <span className={styles.expOn}>Exp</span>
              ) : (
                <span />
              )}
              {description ? (
                <button
                  type="button"
                  className={`${styles.infoBtn} touch-target`}
                  aria-label={`Explain ${row.name}`}
                  aria-expanded={isOpen}
                  onClick={() => toggle(key)}
                  title="Show rules"
                >
                  ?
                </button>
              ) : (
                <span />
              )}
              <span className={styles.bonus}>{formatModifier(row.modifier)}</span>
            </div>
            {isOpen && description ? (
              <div className={styles.explain}>{description}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default SkillList;
