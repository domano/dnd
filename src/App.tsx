import { useMemo, useRef, useState } from "react";
import {
  CharacterSheet,
  Compendium,
  CreateWizard,
  Home,
  LevelUpWizard,
} from "./components";
import { getClass, getRace } from "./data";
import { totalLevel } from "./lib/rules";
import type { Character } from "./types/character";
import { useCharacterStore } from "./store/characterStore";

type View = "home" | "create" | "sheet" | "compendium";

function App() {
  const [view, setView] = useState<View>("home");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setActive = useCharacterStore((s) => s.setActive);
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const importCharacters = useCharacterStore((s) => s.importCharacters);
  const activeId = useCharacterStore((s) => s.activeId);
  const characters = useCharacterStore((s) => s.characters);

  const active = useMemo(
    () => characters.find((c) => c.id === activeId),
    [characters, activeId],
  );

  function exportAll() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      characters,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `srd-ledger-characters-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { characters?: Character[] } | Character[];
      const list = Array.isArray(data) ? data : (data.characters ?? []);
      if (!Array.isArray(list) || list.length === 0) {
        window.alert("No characters found in that file.");
        return;
      }
      importCharacters(list, "merge");
      setPickerOpen(true);
    } catch {
      window.alert("Could not import that file. Expect JSON from Export.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (view === "create") {
    return (
      <CreateWizard
        onCancel={() => setView("home")}
        onCreated={(id) => {
          setActive(id);
          setView("sheet");
        }}
      />
    );
  }

  if (view === "compendium") {
    return <Compendium onBack={() => setView("home")} />;
  }

  if (view === "sheet") {
    return (
      <>
        <CharacterSheet
          onHome={() => {
            setLevelUpOpen(false);
            setView("home");
          }}
          onEdit={() => setView("home")}
          onLevelUp={() => {
            if (active) setLevelUpOpen(true);
          }}
        />
        {active ? (
          <LevelUpWizard
            open={levelUpOpen}
            character={active}
            onClose={() => setLevelUpOpen(false)}
            onComplete={() => setLevelUpOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Home
        brandName="SRD LEDGER"
        onCreateCharacter={() => setView("create")}
        onOpenSaved={() => setPickerOpen(true)}
        onOpenCompendium={() => setView("compendium")}
      />

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
      />

      {pickerOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0.75rem",
            background: "color-mix(in srgb, var(--ink) 48%, transparent)",
            backdropFilter: "blur(2px)",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div
            className="panel anim-drawer-in"
            role="dialog"
            aria-modal="true"
            aria-label="Open saved character"
            style={{
              width: "min(32rem, 100%)",
              maxHeight: "min(80svh, 640px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div className="panel-header">
              <h2>Open saved</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPickerOpen(false)}
              >
                Close
              </button>
            </div>
            <div
              className="panel-body"
              style={{ overflow: "auto", display: "grid", gap: "0.55rem" }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                <button type="button" className="btn btn-sm" onClick={exportAll}>
                  Export JSON
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-brass"
                  onClick={() => fileRef.current?.click()}
                >
                  Import JSON
                </button>
              </div>

              {characters.length === 0 ? (
                <p style={{ color: "var(--ink-soft)" }}>
                  No saved adventurers yet. Create one to begin the ledger.
                </p>
              ) : (
                characters.map((c) => {
                  const race = getRace(c.raceId);
                  const klass = getClass(c.classLevels[0]?.classId ?? "");
                  const level = totalLevel(c);
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "0.5rem",
                        alignItems: "center",
                        padding: "0.75rem 0.85rem",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-sm)",
                        background:
                          "color-mix(in srgb, var(--paper-lift) 94%, white)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActive(c.id);
                          setPickerOpen(false);
                          setView("sheet");
                        }}
                        style={{
                          textAlign: "left",
                          border: "none",
                          background: "transparent",
                          padding: 0,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 600,
                            fontSize: "1.05rem",
                          }}
                        >
                          {c.name}
                        </div>
                        <div
                          style={{
                            color: "var(--ink-soft)",
                            fontSize: "0.85rem",
                          }}
                        >
                          {[race?.name, klass?.name, `Level ${level}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteCharacter(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default App;
