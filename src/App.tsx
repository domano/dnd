import { useEffect, useState } from "react";
import { Home, CharacterSheet } from "./components";
import { useCharacterStore } from "./store/characterStore";

type View = "home" | "sheet";

function App() {
  const [view, setView] = useState<View>("home");
  const create = useCharacterStore((s) => s.createCharacter);
  const setActive = useCharacterStore((s) => s.setActive);
  const activeId = useCharacterStore((s) => s.activeId);
  const characters = useCharacterStore((s) => s.characters);

  useEffect(() => {
    if (characters.length === 0) {
      create({
        name: "Mira Ashveil",
        alignment: "Neutral Good",
        raceId: "human",
        backgroundId: "acolyte",
        classId: "wizard",
        level: 3,
        abilities: {
          strength: 8,
          dexterity: 14,
          constitution: 12,
          intelligence: 16,
          wisdom: 13,
          charisma: 10,
        },
        abilityMethod: "manual",
        skillProficiencies: ["Arcana", "Investigation"],
        languageChoices: ["Elvish"],
        knownSpells: ["mage-armor", "magic-missile", "shield", "fire-bolt"],
        preparedSpells: ["mage-armor", "magic-missile", "shield"],
        weapons: ["dagger"],
        inventory: [
          { index: "dagger", name: "Dagger", quantity: 1, equipped: true },
          {
            index: "component-pouch",
            name: "Component pouch",
            quantity: 1,
            equipped: true,
          },
        ],
        notes: "Keeps a brass-bound field ledger for expedition notes.",
        personality: {
          traits: "Measures every risk twice before casting.",
          ideals:
            "Knowledge should be shared with those who protect the road.",
          bonds: "The ruined observatory outside town still calls to her.",
          flaws: "Will spend the last coin on a rare scroll.",
        },
      });
    }
  }, [characters.length, create]);

  if (view === "sheet") {
    return (
      <CharacterSheet
        onHome={() => setView("home")}
        onEdit={() => setView("home")}
      />
    );
  }

  return (
    <Home
      onCreateCharacter={() => {
        create({
          name: "New Adventurer",
          raceId: "human",
          backgroundId: "acolyte",
          classId: "fighter",
          abilities: {
            strength: 15,
            dexterity: 14,
            constitution: 13,
            intelligence: 12,
            wisdom: 10,
            charisma: 8,
          },
          abilityMethod: "standard",
          skillProficiencies: ["Athletics", "Perception"],
        });
        setView("sheet");
      }}
      onOpenSaved={() => {
        if (!activeId && characters[0]) setActive(characters[0].id);
        setView("sheet");
      }}
    />
  );
}

export default App;
