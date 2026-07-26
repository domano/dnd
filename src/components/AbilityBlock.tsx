import { useEffect, useRef, useState } from 'react';
import type { AbilityScore } from '../types/dnd';
import { ABILITY_SCORE_SHORT } from '../types/character';
import { abilityModifier, formatModifier } from '../lib/rules';
import styles from './AbilityBlock.module.css';

export interface AbilityBlockProps {
  ability: AbilityScore;
  /** Final (display) score after racial/ASI bonuses */
  score: number;
  onChange?: (score: number) => void;
  readOnly?: boolean;
}

export function AbilityBlock({ ability, score, onChange, readOnly }: AbilityBlockProps) {
  const mod = abilityModifier(score);
  const [pulse, setPulse] = useState(false);
  const prev = useRef(score);

  useEffect(() => {
    if (prev.current !== score) {
      prev.current = score;
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 420);
      return () => window.clearTimeout(t);
    }
  }, [score]);

  return (
    <div className={`${styles.block} ${pulse ? 'anim-score-pulse' : ''}`}>
      <span className={styles.label}>{ABILITY_SCORE_SHORT[ability]}</span>
      <span className={styles.mod} aria-label={`${ABILITY_SCORE_SHORT[ability]} modifier`}>
        {formatModifier(mod)}
      </span>
      {readOnly || !onChange ? (
        <span className={styles.scoreReadonly}>{score}</span>
      ) : (
        <input
          className={styles.scoreInput}
          type="number"
          min={1}
          max={30}
          value={score}
          aria-label={`${ABILITY_SCORE_SHORT[ability]} score`}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(Math.min(30, Math.max(1, next)));
          }}
        />
      )}
    </div>
  );
}

export default AbilityBlock;
