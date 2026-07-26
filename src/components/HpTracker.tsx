import type { HitDiceState, HpState } from '../types/character';
import styles from './HpTracker.module.css';

export interface HpTrackerProps {
  hp: HpState;
  hitDice: HitDiceState;
  onHpChange: (hp: HpState) => void;
  onHitDiceChange?: (hitDice: HitDiceState) => void;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function HpTracker({ hp, hitDice, onHpChange, onHitDiceChange }: HpTrackerProps) {
  const ratio = hp.max > 0 ? clamp(hp.current / hp.max, 0, 1) : 0;
  const low = ratio <= 0.25;

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Current</span>
          <input
            type="number"
            value={hp.current}
            onChange={(e) =>
              onHpChange({
                ...hp,
                current: Number(e.target.value) || 0,
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>Max</span>
          <input
            type="number"
            min={1}
            value={hp.max}
            onChange={(e) =>
              onHpChange({
                ...hp,
                max: Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>Temp</span>
          <input
            type="number"
            min={0}
            value={hp.temp}
            onChange={(e) =>
              onHpChange({
                ...hp,
                temp: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </label>
      </div>

      <div className={styles.barTrack} aria-hidden="true">
        <div
          className={`${styles.barFill} ${low ? styles.barFillLow : ''}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onHpChange({ ...hp, current: clamp(hp.current - 1, -999, hp.max + hp.temp) })}
        >
          −1
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onHpChange({ ...hp, current: clamp(hp.current + 1, -999, hp.max + hp.temp) })}
        >
          +1
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onHpChange({ ...hp, current: hp.max })}
        >
          Full
        </button>
      </div>

      <div className={styles.hitDice}>
        <span>
          Hit dice{' '}
          <strong>
            {hitDice.current}/{hitDice.max}
          </strong>{' '}
          (d{hitDice.die})
        </span>
        {onHitDiceChange ? (
          <span className={styles.actions}>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() =>
                onHitDiceChange({
                  ...hitDice,
                  current: clamp(hitDice.current - 1, 0, hitDice.max),
                })
              }
            >
              Spend
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => onHitDiceChange({ ...hitDice, current: hitDice.max })}
            >
              Reset
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default HpTracker;
