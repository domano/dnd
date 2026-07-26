import type { DeathSavesState } from '../types/character';
import styles from './DeathSaves.module.css';

export interface DeathSavesProps {
  value: DeathSavesState;
  onChange: (next: DeathSavesState) => void;
}

function PipRow({
  label,
  count,
  kind,
  onToggle,
}: {
  label: string;
  count: number;
  kind: 'success' | 'fail';
  onToggle: (index: number) => void;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.pips} role="group" aria-label={label}>
        {[0, 1, 2].map((i) => {
          const on = i < count;
          return (
            <button
              key={i}
              type="button"
              className={[
                styles.pip,
                'touch-target',
                kind === 'success' ? styles.pipSuccess : styles.pipFail,
                on
                  ? kind === 'success'
                    ? styles.pipSuccessActive
                    : styles.pipFailActive
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={on}
              aria-label={`${label} ${i + 1}`}
              onClick={() => onToggle(i)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DeathSaves({ value, onChange }: DeathSavesProps) {
  return (
    <div className={styles.wrap}>
      <PipRow
        label="Successes"
        count={value.successes}
        kind="success"
        onToggle={(i) => {
          const next = i + 1 === value.successes ? i : i + 1;
          onChange({ ...value, successes: next });
        }}
      />
      <PipRow
        label="Failures"
        count={value.failures}
        kind="fail"
        onToggle={(i) => {
          const next = i + 1 === value.failures ? i : i + 1;
          onChange({ ...value, failures: next });
        }}
      />
      <button
        type="button"
        className={`btn btn-sm btn-ghost ${styles.reset}`}
        onClick={() => onChange({ successes: 0, failures: 0 })}
      >
        Reset
      </button>
    </div>
  );
}

export default DeathSaves;
