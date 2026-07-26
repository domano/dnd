import { create } from "zustand";
import type { Character } from "../types/character";
import type { AbilityScore } from "../types/dnd";
import { createCharacter, type CharacterDraft } from "../lib/createCharacter";
import {
  abilityModifier,
  getFinalAbilityScores,
  getHitPointsAverage,
  getSpellSlots,
  racialHitPointBonusPerLevel,
  totalLevel,
  xpForLevel,
} from "../lib/rules";
import { hydrateCharacter, loadSheetState, saveSheetState } from "../lib/storage";
import { getClass } from "../data";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function touch(character: Character, patch: Partial<Character>): Character {
  return {
    ...character,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

function persist(
  characters: Character[],
  activeId: string | null,
): void {
  saveSheetState({ characters, activeId });
}

function mapActive(
  characters: Character[],
  activeId: string | null,
  fn: (c: Character) => Character,
): Character[] {
  if (!activeId) return characters;
  return characters.map((c) => (c.id === activeId ? fn(c) : c));
}

export interface CharacterStore {
  characters: Character[];
  activeId: string | null;
  hydrated: boolean;

  hydrate: () => void;
  createCharacter: (draft: CharacterDraft) => Character;
  updateCharacter: (id: string, patch: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  setActive: (id: string | null) => void;

  setAbility: (ability: AbilityScore, score: number) => void;
  toggleSkill: (skillName: string) => void;
  toggleExpertise: (skillName: string) => void;
  importCharacters: (incoming: Character[], mode?: "merge" | "replace") => void;
  addSpell: (spellIndex: string) => void;
  removeSpell: (spellIndex: string) => void;
  prepareSpell: (spellIndex: string, prepared?: boolean) => void;
  useSlot: (level: number, delta?: number) => void;
  rest: (kind: "short" | "long") => void;
  levelUp: (patch?: {
    subclassId?: string;
    asi?: {
      mode: "asi" | "feat";
      increases?: Partial<Record<AbilityScore, number>>;
      featIndex?: string;
      customFeat?: { name: string; desc: string };
    };
    hpRoll?: number;
  }) => void;

  getActive: () => Character | undefined;
}

const initial = loadSheetState();

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: initial.characters,
  activeId: initial.activeId,
  hydrated: true,

  hydrate: () => {
    const state = loadSheetState();
    set({
      characters: state.characters.map((c) => hydrateCharacter(c)),
      activeId: state.activeId,
      hydrated: true,
    });
  },

  createCharacter: (draft) => {
    const character = hydrateCharacter(createCharacter(draft));
    set((state) => {
      const characters = [...state.characters, character];
      const activeId = character.id;
      persist(characters, activeId);
      return { characters, activeId };
    });
    return character;
  },

  updateCharacter: (id, patch) => {
    set((state) => {
      const characters = state.characters.map((c) =>
        c.id === id ? touch(c, patch) : c,
      );
      persist(characters, state.activeId);
      return { characters };
    });
  },

  deleteCharacter: (id) => {
    set((state) => {
      const characters = state.characters.filter((c) => c.id !== id);
      const activeId =
        state.activeId === id
          ? (characters[0]?.id ?? null)
          : state.activeId;
      persist(characters, activeId);
      return { characters, activeId };
    });
  },

  setActive: (id) => {
    set((state) => {
      persist(state.characters, id);
      return { activeId: id };
    });
  },

  setAbility: (ability, score) => {
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) =>
        touch(c, {
          abilities: { ...c.abilities, [ability]: score },
        }),
      );
      persist(characters, state.activeId);
      return { characters };
    });
  },

  toggleSkill: (skillName) => {
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) => {
        const has = c.skillProficiencies.some(
          (s) => s.toLowerCase() === skillName.toLowerCase(),
        );
        const skillProficiencies = has
          ? c.skillProficiencies.filter(
              (s) => s.toLowerCase() !== skillName.toLowerCase(),
            )
          : [...c.skillProficiencies, skillName];
        const expertise = has
          ? c.expertise.filter(
              (s) => s.toLowerCase() !== skillName.toLowerCase(),
            )
          : c.expertise;
        return touch(c, { skillProficiencies, expertise });
      });
      persist(characters, state.activeId);
      return { characters };
    });
  },

  toggleExpertise: (skillName) => {
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) => {
        const proficient = c.skillProficiencies.some(
          (s) => s.toLowerCase() === skillName.toLowerCase(),
        );
        if (!proficient) return c;
        const has = c.expertise.some(
          (s) => s.toLowerCase() === skillName.toLowerCase(),
        );
        const expertise = has
          ? c.expertise.filter(
              (s) => s.toLowerCase() !== skillName.toLowerCase(),
            )
          : [...c.expertise, skillName];
        return touch(c, { expertise });
      });
      persist(characters, state.activeId);
      return { characters };
    });
  },

  importCharacters: (incoming, mode = "merge") => {
    set((state) => {
      const cleaned = incoming
        .filter((c) => c && typeof c.id === "string")
        .map((c) => hydrateCharacter(c));
      let characters: Character[];
      if (mode === "replace") {
        characters = cleaned;
      } else {
        const byId = new Map(state.characters.map((c) => [c.id, c]));
        for (const c of cleaned) byId.set(c.id, c);
        characters = [...byId.values()];
      }
      const activeId =
        state.activeId && characters.some((c) => c.id === state.activeId)
          ? state.activeId
          : (characters[0]?.id ?? null);
      persist(characters, activeId);
      return { characters, activeId };
    });
  },

  addSpell: (spellIndex) => {
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) => {
        if (c.spells.known.includes(spellIndex)) return c;
        return touch(c, {
          spells: {
            ...c.spells,
            known: [...c.spells.known, spellIndex],
          },
        });
      });
      persist(characters, state.activeId);
      return { characters };
    });
  },

  removeSpell: (spellIndex) => {
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) =>
        touch(c, {
          spells: {
            ...c.spells,
            known: c.spells.known.filter((s) => s !== spellIndex),
            prepared: c.spells.prepared.filter((s) => s !== spellIndex),
            alwaysPrepared: (c.spells.alwaysPrepared ?? []).filter(
              (s) => s !== spellIndex,
            ),
          },
        }),
      );
      persist(characters, state.activeId);
      return { characters };
    });
  },

  prepareSpell: (spellIndex, prepared = true) => {
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) => {
        const isPrepared = c.spells.prepared.includes(spellIndex);
        let nextPrepared = c.spells.prepared;
        if (prepared && !isPrepared) {
          nextPrepared = [...c.spells.prepared, spellIndex];
        } else if (!prepared && isPrepared) {
          nextPrepared = c.spells.prepared.filter((s) => s !== spellIndex);
        }
        // Ensure known includes prepared
        const known = c.spells.known.includes(spellIndex)
          ? c.spells.known
          : [...c.spells.known, spellIndex];
        return touch(c, {
          spells: { ...c.spells, known, prepared: nextPrepared },
        });
      });
      persist(characters, state.activeId);
      return { characters };
    });
  },

  useSlot: (level, delta = 1) => {
    if (level < 1 || level > 9) return;
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) => {
        const slotsUsed = [...c.spells.slotsUsed];
        while (slotsUsed.length < 9) slotsUsed.push(0);
        const idx = level - 1;
        const available = getSpellSlots(c).slots[idx] ?? 0;
        const next = Math.max(
          0,
          Math.min(available, (slotsUsed[idx] ?? 0) + delta),
        );
        slotsUsed[idx] = next;
        return touch(c, {
          spells: { ...c.spells, slotsUsed },
        });
      });
      persist(characters, state.activeId);
      return { characters };
    });
  },

  rest: (kind) => {
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) => {
        if (kind === "long") {
          const hitDiceTotal = totalLevel(c);
          const recovered = Math.max(1, Math.floor(hitDiceTotal / 2));
          return touch(c, {
            hp: { ...c.hp, current: c.hp.max, temp: 0 },
            hitDiceUsed: Math.max(0, c.hitDiceUsed - recovered),
            deathSaves: { successes: 0, failures: 0 },
            spells: {
              ...c.spells,
              slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          });
        }

        // Short rest: warlock pact slots recover
        const slotInfo = getSpellSlots(c);
        const slotsUsed = [...c.spells.slotsUsed];
        while (slotsUsed.length < 9) slotsUsed.push(0);
        if (slotInfo.pact) {
          slotsUsed[slotInfo.pact.slotLevel - 1] = 0;
        } else if (slotInfo.casterType === "pact") {
          for (let i = 0; i < slotsUsed.length; i++) slotsUsed[i] = 0;
        }

        return touch(c, {
          spells: { ...c.spells, slotsUsed },
        });
      });
      persist(characters, state.activeId);
      return { characters };
    });
  },

  levelUp: (patch) => {
    set((state) => {
      const characters = mapActive(state.characters, state.activeId, (c) => {
        if (c.classLevels.length === 0) return c;
        const primary = { ...c.classLevels[0]! };
        if (primary.level >= 20) return c;

        const newLevel = primary.level + 1;
        const klass = getClass(primary.classId);
        primary.level = newLevel;
        if (patch?.subclassId) {
          primary.subclassId = patch.subclassId;
        } else if (
          klass &&
          newLevel < klass.subclass_unlock_level
        ) {
          // keep as-is
        }

        const classLevels = [primary, ...c.classLevels.slice(1)];
        const scores = getFinalAbilityScores({ ...c, classLevels });
        const conMod = abilityModifier(scores.constitution);

        const racialHp = racialHitPointBonusPerLevel(c);
        let hpMax = c.hp.max;
        if (typeof patch?.hpRoll === "number") {
          hpMax += patch.hpRoll + conMod + racialHp;
        } else if (klass) {
          const avg = Math.floor(klass.hit_die / 2) + 1;
          hpMax += avg + conMod + racialHp;
        } else {
          hpMax = getHitPointsAverage(classLevels, conMod, racialHp);
        }

        let asiHistory = c.asiHistory;
        let feats = c.feats;
        let customFeats = c.customFeats;

        if (patch?.asi && klass?.asi_levels.includes(newLevel)) {
          const entry = {
            level: newLevel,
            classId: primary.classId,
            mode: patch.asi.mode,
            increases: patch.asi.increases,
            featIndex: patch.asi.featIndex,
            customFeat: patch.asi.customFeat,
          };
          asiHistory = [...asiHistory, entry];

          if (patch.asi.mode === "feat") {
            if (patch.asi.featIndex) {
              feats = [...feats, patch.asi.featIndex];
            }
            if (patch.asi.customFeat) {
              customFeats = [
                ...customFeats,
                {
                  name: patch.asi.customFeat.name,
                  description: patch.asi.customFeat.desc,
                },
              ];
            }
          }
        }

        const journalEntry = {
          id: newId(),
          createdAt: new Date().toISOString(),
          title: `Reached level ${newLevel}`,
          body: `Advanced to level ${newLevel}.`,
          tags: ["level-up"],
        };

        return touch(c, {
          classLevels,
          xp: Math.max(c.xp, xpForLevel(totalLevel({ ...c, classLevels }))),
          hp: {
            max: hpMax,
            current: c.hp.current + (hpMax - c.hp.max),
            temp: c.hp.temp,
          },
          asiHistory,
          feats,
          customFeats,
          journal: [journalEntry, ...(c.journal ?? [])],
        });
      });
      persist(characters, state.activeId);
      return { characters };
    });
  },

  getActive: () => {
    const { characters, activeId } = get();
    return characters.find((c) => c.id === activeId);
  },
}));
