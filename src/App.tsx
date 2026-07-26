import { useMemo, useRef, useState } from "react";
import {
  CharacterSheet,
  Compendium,
  CreateWizard,
  Home,
  LevelUpWizard,
} from "./components";
import { CharacterPicker } from "./components/CharacterPicker";
import { LevelUpFanfare } from "./components/LevelUpFanfare";
import { ToastProvider, useToast } from "./components/Toast";
import type { Character } from "./types/character";
import { useCharacterStore } from "./store/characterStore";

type View = "home" | "create" | "sheet" | "compendium";

function AppShell() {
  const [view, setView] = useState<View>("home");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [fanfare, setFanfare] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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
    toast.success("Ledger exported");
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { characters?: Character[] } | Character[];
      const list = Array.isArray(data) ? data : (data.characters ?? []);
      if (!Array.isArray(list) || list.length === 0) {
        toast.warn("No characters found in that file.");
        return;
      }
      importCharacters(list, "merge");
      setPickerOpen(true);
      toast.success(
        list.length === 1
          ? "Imported 1 character"
          : `Imported ${list.length} characters`,
      );
    } catch {
      toast.warn("Could not import that file. Expect JSON from Export.");
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
          toast.success("Adventurer inked into the ledger");
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
          onLevelUp={() => {
            if (active) setLevelUpOpen(true);
          }}
        />
        {active ? (
          <LevelUpWizard
            open={levelUpOpen}
            character={active}
            onClose={() => setLevelUpOpen(false)}
            onComplete={() => {
              setLevelUpOpen(false);
              setFanfare(true);
              toast.success("Level up complete — new power unlocked");
            }}
          />
        ) : null}
        <LevelUpFanfare active={fanfare} onDone={() => setFanfare(false)} />
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

      <CharacterPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        characters={characters}
        onOpen={(id) => {
          setActive(id);
          setView("sheet");
        }}
        onDelete={deleteCharacter}
        onExport={exportAll}
        onImportClick={() => fileRef.current?.click()}
      />
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

export default App;
