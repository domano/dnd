import type { Skill } from '../types/dnd';
import type { Character } from '../types/character';
import { ABILITY_SCORE_SHORT } from '../types/character';
import {
  formatModifier,
  getSavingThrows,
  getSkillsWithBonuses,
} from '../lib/rules';
import styles from './SkillList.module.css';

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

  return (
    <div className={styles.wrap}>
      {showSaves ? (
        <>
          <div className={styles.sectionTitle}>Saving throws</div>
          {saves.map((row) => (
            <div key={row.ability} className={styles.row}>
              <input
                type="checkbox"
                checked={row.proficient}
                readOnly
                disabled
                aria-label={`${ABILITY_SCORE_SHORT[row.ability]} save proficiency`}
              />
              <span className={styles.ability}>{ABILITY_SCORE_SHORT[row.ability]}</span>
              <span className={styles.name}>Saving throw</span>
              <span />
              <span className={styles.bonus}>{formatModifier(row.modifier)}</span>
            </div>
          ))}
          <div className={styles.sectionTitle}>Skills</div>
        </>
      ) : null}

      {rows.map((row) => (
        <div key={row.index} className={styles.row}>
          <input
            type="checkbox"
            checked={row.proficient}
            disabled={!onToggleSkill}
            onChange={() => onToggleSkill?.(row.name)}
            aria-label={`${row.name} proficiency`}
          />
          <span className={styles.ability}>{ABILITY_SCORE_SHORT[row.ability]}</span>
          <span className={styles.name}>{row.name}</span>
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
          ) : null}
          <span className={styles.bonus}>{formatModifier(row.modifier)}</span>
        </div>
      ))}
    </div>
  );
}

export default SkillList;
