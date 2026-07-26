import type { SpellSlotsState } from '../types/character';
import styles from './SpellSlots.module.css';

export interface SpellSlotsProps {
  slots: SpellSlotsState;
  onChange: (slots: SpellSlotsState) => void;
}

export function SpellSlots({ slots, onChange }: SpellSlotsProps) {
  const levels = Object.keys(slots)
    .map(Number)
    .filter((n) => n >= 1 && (slots[n]?.max ?? 0) > 0)
    .sort((a, b) => a - b);

  if (levels.length === 0) {
    return <p className={styles.empty}>No spell slots.</p>;
  }

  return (
    <div className={styles.wrap}>
      {levels.map((level) => {
        const track = slots[level] ?? { max: 0, used: 0 };
        const remaining = Math.max(0, track.max - track.used);
        return (
          <div key={level} className={styles.row}>
            <span className={styles.level}>L{level}</span>
            <div className={styles.pips} role="group" aria-label={`Level ${level} spell slots`}>
              {Array.from({ length: track.max }, (_, i) => {
                const used = i < track.used;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.pip} ${used ? styles.pipUsed : ''}`}
                    aria-pressed={used}
                    aria-label={`Slot ${i + 1}${used ? ' used' : ' available'}`}
                    onClick={() => {
                      const nextUsed = used ? i : i + 1;
                      onChange({
                        ...slots,
                        [level]: { ...track, used: nextUsed },
                      });
                    }}
                  />
                );
              })}
            </div>
            <span className={styles.meta}>
              {remaining}/{track.max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default SpellSlots;
