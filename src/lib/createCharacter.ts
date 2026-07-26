import { getBackground, getClass, getRace } from "../data";
import type {
  AbilityScores,
  Character,
  ClassLevel,
  CustomBackground,
  OtherChoices,
  Personality,
} from "../types/character";
import type { AbilityScore } from "../types/dnd";
import { ABILITY_SCORES } from "../types/dnd";
import {
  abilityModifier,
  getFinalAbilityScores,
  getHitPointsAverage,
  STANDARD_ARRAY,
  validatePointBuy,
  xpForLevel,
} from "./rules";

export type AbilityMethod = "standard" | "pointBuy" | "manual";

export interface CharacterDraft {
  name: string;
  playerName?: string;
  alignment?: string;
  raceId: string;
  subraceId?: string;
  backgroundId?: string;
  customBackground?: CustomBackground;
  classId: string;
  level?: number;
  subclassId?: string;
  abilities: AbilityScores;
  abilityMethod?: AbilityMethod;
  skillProficiencies: string[];
  expertise?: string[];
  toolProficiencies?: string[];
  languageChoices?: string[];
  otherChoices?: OtherChoices;
  knownSpells?: string[];
  preparedSpells?: string[];
  inventory?: Character["inventory"];
  armorEquipped?: string;
  shieldEquipped?: boolean;
  weapons?: string[];
  personality?: Partial<Personality>;
  notes?: string;
}

function emptyAbilities(fill = 8): AbilityScores {
  return {
    strength: fill,
    dexterity: fill,
    constitution: fill,
    intelligence: fill,
    wisdom: fill,
    charisma: fill,
  };
}

function mergeUnique(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function backgroundSkills(
  draft: CharacterDraft,
): string[] {
  if (draft.customBackground) return draft.customBackground.skills ?? [];
  if (draft.backgroundId) {
    return getBackground(draft.backgroundId)?.skills ?? [];
  }
  return [];
}

function backgroundTools(draft: CharacterDraft): string[] {
  if (draft.customBackground) return draft.customBackground.tools ?? [];
  if (draft.backgroundId) {
    return getBackground(draft.backgroundId)?.tools ?? [];
  }
  return [];
}

function backgroundInventory(
  draft: CharacterDraft,
): Character["inventory"] {
  if (draft.inventory) return draft.inventory;
  if (draft.customBackground) return [];
  if (!draft.backgroundId) return [];
  const bg = getBackground(draft.backgroundId);
  if (!bg) return [];
  return bg.equipment.map((e) => ({
    name: e.name,
    quantity: e.quantity,
  }));
}

export function createCharacter(draft: CharacterDraft): Character {
  const klass = getClass(draft.classId);
  if (!klass) {
    throw new Error(`Unknown class: ${draft.classId}`);
  }
  const race = getRace(draft.raceId);
  if (!race) {
    throw new Error(`Unknown race: ${draft.raceId}`);
  }
  if (draft.subraceId && !race.subraces.some((s) => s.id === draft.subraceId)) {
    throw new Error(
      `Unknown subrace ${draft.subraceId} for race ${draft.raceId}`,
    );
  }

  if (draft.abilityMethod === "pointBuy") {
    const check = validatePointBuy(draft.abilities);
    if (!check.valid) {
      throw new Error(`Invalid point buy: ${check.errors.join("; ")}`);
    }
  }

  if (draft.abilityMethod === "standard") {
    const values = ABILITY_SCORES.map((a) => draft.abilities[a]).sort(
      (a, b) => b - a,
    );
    const expected = [...STANDARD_ARRAY].sort((a, b) => b - a);
    if (values.some((v, i) => v !== expected[i])) {
      throw new Error(
        `Standard array must use scores ${STANDARD_ARRAY.join(", ")}`,
      );
    }
  }

  const level = Math.min(20, Math.max(1, draft.level ?? 1));
  const classLevels: ClassLevel[] = [
    {
      classId: draft.classId,
      level,
      subclassId:
        draft.subclassId && level >= klass.subclass_unlock_level
          ? draft.subclassId
          : undefined,
    },
  ];

  const skillProficiencies = mergeUnique(
    draft.skillProficiencies,
    backgroundSkills(draft),
  );

  const toolProficiencies = mergeUnique(
    draft.toolProficiencies,
    klass.proficiencies.tools,
    backgroundTools(draft),
  );

  const languageChoices = mergeUnique(
    race.languages,
    draft.languageChoices,
    draft.customBackground?.languages,
  );

  const now = new Date().toISOString();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `char-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const character: Character = {
    id,
    name: draft.name.trim() || "Unnamed Adventurer",
    playerName: draft.playerName?.trim() ?? "",
    alignment: draft.alignment ?? "",
    xp: xpForLevel(level),
    raceId: draft.raceId,
    subraceId: draft.subraceId,
    backgroundId: draft.customBackground ? undefined : draft.backgroundId,
    customBackground: draft.customBackground,
    classLevels,
    abilities: { ...emptyAbilities(), ...draft.abilities },
    skillProficiencies,
    expertise: draft.expertise ?? [],
    toolProficiencies,
    languageChoices,
    otherChoices: draft.otherChoices ?? {},
    feats: [],
    customFeats: [],
    hp: { max: 1, current: 1, temp: 0 },
    hitDiceUsed: 0,
    inspiration: false,
    deathSaves: { successes: 0, failures: 0 },
    armorEquipped: draft.armorEquipped,
    shieldEquipped: draft.shieldEquipped,
    weapons: draft.weapons ?? [],
    inventory: backgroundInventory(draft),
    spells: {
      known: draft.knownSpells ?? [],
      prepared: draft.preparedSpells ?? [],
      alwaysPrepared: [],
      slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    notes: draft.notes ?? "",
    personality: {
      traits: draft.personality?.traits ?? "",
      ideals: draft.personality?.ideals ?? "",
      bonds: draft.personality?.bonds ?? "",
      flaws: draft.personality?.flaws ?? "",
    },
    asiHistory: [],
    createdAt: now,
    updatedAt: now,
  };

  const scores = getFinalAbilityScores(character);
  const conMod = abilityModifier(scores.constitution);
  const hpMax = getHitPointsAverage(classLevels, conMod);
  character.hp = { max: hpMax, current: hpMax, temp: 0 };

  return character;
}

export function defaultAbilitiesForMethod(
  method: AbilityMethod,
): AbilityScores {
  if (method === "standard") {
    return {
      strength: 15,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 10,
      charisma: 8,
    };
  }
  return emptyAbilities(8);
}

export type { AbilityScore };
