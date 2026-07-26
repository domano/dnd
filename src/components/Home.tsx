import styles from './Home.module.css';

export interface HomeProps {
  onCreateCharacter?: () => void;
  onOpenSaved?: () => void;
  onOpenCompendium?: () => void;
  brandName?: string;
}

export function Home({
  onCreateCharacter,
  onOpenSaved,
  onOpenCompendium,
  brandName = 'SRD LEDGER',
}: HomeProps) {
  const [lead, ...rest] = brandName.split(' ');
  const trail = rest.join(' ');

  return (
    <main className={`${styles.page} anim-fade-rise`}>
      <section className={styles.hero} aria-label="Welcome">
        <div className={`${styles.heroPlane} anim-mist-shimmer`} aria-hidden="true" />
        <div className={`${styles.heroGlow} anim-leaf-float`} aria-hidden="true" />
        <div className={styles.content}>
          <h1 className={styles.brand}>
            {lead}
            {trail ? <span className={styles.brandAccent}>{trail}</span> : null}
          </h1>
          <span className="flourish flourish-shimmer" aria-hidden="true" />
          <p className={styles.headline}>Ink your legend among the leaves.</p>
          <p className={styles.lede}>
            A playful expedition ledger for SRD 5.1 — brew heroes, peek rules without the
            handbook, and track loot, quests, and campfire tales all campaign long.
          </p>
          <div className={styles.ctaRow}>
            <button type="button" className="btn btn-primary" onClick={onCreateCharacter}>
              Create Character
            </button>
            <button type="button" className="btn btn-brass" onClick={onOpenSaved}>
              Open Saved
            </button>
            <button type="button" className="btn btn-ghost" onClick={onOpenCompendium}>
              Compendium
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
