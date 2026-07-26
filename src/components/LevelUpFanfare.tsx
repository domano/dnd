import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import styles from './LevelUpFanfare.module.css';

export interface LevelUpFanfareProps {
  active: boolean;
  onDone?: () => void;
}

const PARTICLE_COUNT = 12;

export function LevelUpFanfare({ active, onDone }: LevelUpFanfareProps) {
  const [show, setShow] = useState(false);
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const radius = 90 + (i % 3) * 28;
        return {
          id: i,
          tx: `${Math.cos(angle) * radius}px`,
          ty: `${Math.sin(angle) * radius}px`,
          rot: `${(i % 2 === 0 ? 1 : -1) * (120 + i * 18)}deg`,
          delay: `${i * 28}ms`,
        };
      }),
    [],
  );

  useEffect(() => {
    if (!active) return;
    setShow(true);
    const t = window.setTimeout(() => {
      setShow(false);
      onDone?.();
    }, 1300);
    return () => window.clearTimeout(t);
  }, [active, onDone]);

  if (!show) return null;

  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.burst}>
        {particles.map((p) => (
          <span
            key={p.id}
            className={styles.particle}
            style={
              {
                '--tx': p.tx,
                '--ty': p.ty,
                '--rot': p.rot,
                animationDelay: p.delay,
              } as CSSProperties
            }
          >
            ❧
          </span>
        ))}
      </div>
      <p className={styles.label}>Level up!</p>
    </div>
  );
}

export default LevelUpFanfare;
