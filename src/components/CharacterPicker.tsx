import { useEffect, useRef, useState } from 'react';
import { getClass, getRace } from '../data';
import { totalLevel } from '../lib/rules';
import type { Character } from '../types/character';
import { BrowserShell } from './BrowserShell';
import styles from './CharacterPicker.module.css';

export interface CharacterPickerProps {
  open: boolean;
  onClose: () => void;
  characters: Character[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImportClick: () => void;
}

export function CharacterPicker({
  open,
  onClose,
  characters,
  onOpen,
  onDelete,
  onExport,
  onImportClick,
}: CharacterPickerProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const pendingTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!pendingDelete) return;
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
    pendingTimer.current = window.setTimeout(() => setPendingDelete(null), 4000);
    return () => {
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
    };
  }, [pendingDelete]);

  useEffect(() => {
    if (!open) setPendingDelete(null);
  }, [open]);

  return (
    <BrowserShell
      open={open}
      onClose={onClose}
      title="Open saved"
      subtitle="Pick an adventurer, or back up the whole ledger."
      filters={
        <div className={styles.toolbar}>
          <button type="button" className="btn btn-sm" onClick={onExport}>
            Export JSON
          </button>
          <button type="button" className="btn btn-sm btn-brass" onClick={onImportClick}>
            Import JSON
          </button>
        </div>
      }
    >
      {characters.length === 0 ? (
        <p className={styles.empty}>
          No saved adventurers yet. Create one to begin the ledger.
        </p>
      ) : (
        characters.map((c) => {
          const race = getRace(c.raceId);
          const klass = getClass(c.classLevels[0]?.classId ?? '');
          const level = totalLevel(c);
          const confirming = pendingDelete === c.id;
          return (
            <div key={c.id} className={styles.row}>
              <button
                type="button"
                className={styles.openBtn}
                onClick={() => {
                  onOpen(c.id);
                  onClose();
                }}
              >
                <span className={styles.name}>{c.name}</span>
                <span className={styles.meta}>
                  {[race?.name, klass?.name, `Level ${level}`].filter(Boolean).join(' · ')}
                </span>
              </button>
              {confirming ? (
                <span className={styles.confirmGroup}>
                  <button
                    type="button"
                    className={`btn btn-sm btn-danger anim-pending-pulse`}
                    onClick={() => {
                      onDelete(c.id);
                      setPendingDelete(null);
                    }}
                  >
                    Sure?
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setPendingDelete(null)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setPendingDelete(c.id)}
                >
                  Delete
                </button>
              )}
            </div>
          );
        })
      )}
    </BrowserShell>
  );
}

export default CharacterPicker;
