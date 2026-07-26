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
        <div className={styles.heroPlane} aria-hidden="true" />
        <div className={styles.content}>
          <h1 className={styles.brand}>
            {lead}
            {trail ? <span className={styles.brandAccent}>{trail}</span> : null}
          </h1>
          <hr className={styles.rule} />
          <p className={styles.headline}>An expedition ledger for fifth-edition adventurers.</p>
          <p className={styles.lede}>
            Build, level, and play SRD 5.1 characters with spells, skills, and gear at hand.
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
