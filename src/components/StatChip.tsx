import styles from './StatChip.module.css';

export interface StatChipProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  className?: string;
}

export function StatChip({ label, value, hint, accent, className }: StatChipProps) {
  return (
    <div className={`${styles.chip} ${className ?? ''}`.trim()}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${accent ? styles.valueAccent : ''}`}>{value}</span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

export default StatChip;
