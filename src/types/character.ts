import type { AbilityIndex, AbilityScore } from "./dnd";

export type { AbilityScore };

export interface ClassLevel {
  classId: string;
  level: number;
  subclassId?: string;
}

export interface CustomBackground {
  name: string;
  skills: string[];
  tools?: string[];
  languages?: string[];
  feature?: { name: string; summary: string };
}

export interface CustomFeat {
  name: string;
  description: string;
}

/** Feat reference used by FeatBrowser UI */
export interface CharacterFeatRef {
  index: string;
  name: string;
  description: string;
  custom?: boolean;
  prerequisites?: string[];
}

/** Feature row used by FeatureList UI */
export interface CharacterFeature {
  id: string;
  name: string;
  summary: string;
  source?: string;
}

export interface HitPoints {
  max: number;
  current: number;
  temp: number;
}

/** @deprecated Prefer HitPoints — kept for sheet UI components */
export type HpState = HitPoints;

export interface DeathSaves {
  successes: number;
  failures: number;
}

/** @deprecated Prefer DeathSaves — kept for sheet UI components */
export type DeathSavesState = DeathSaves;

export interface HitDiceState {
  die: number;
  current: number;
  max: number;
}

export interface InventoryItem {
  index?: string;
  name: string;
  quantity: number;
  equipped?: boolean;
}

export interface CharacterSpells {
  known: string[];
  prepared: string[];
  alwaysPrepared?: string[];
  /** Index 0 = 1st-level slots used */
  slotsUsed: number[];
}

export interface SpellSlotTrack {
  max: number;
  used: number;
}

/** Spell level (1–9) → slot tracker. Used by SpellSlots UI. */
export type SpellSlotsState = Record<number, SpellSlotTrack>;

export interface Personality {
  traits: string;
  ideals: string;
  bonds: string;
  flaws: string;
}

export interface AsiHistoryEntry {
  level: number;
  classId: string;
  mode: "asi" | "feat";
  increases?: Partial<Record<AbilityScore, number>>;
  featIndex?: string;
  customFeat?: { name: string; desc: string };
}

export interface OtherChoices {
  draconicAncestry?: string;
  /** Half-elf (and similar) +1 choices beyond fixed racial bonuses */
  racialAbilityBonuses?: AbilityScore[];
  /** High Elf (and similar) racial cantrip spell index */
  racialCantrip?: string;
  [key: string]: unknown;
}

export type AbilityScores = Record<AbilityScore, number>;

export interface Character {
  id: string;
  name: string;
  playerName: string;
  alignment: string;
  xp: number;

  raceId: string;
  subraceId?: string;
  backgroundId?: string;
  customBackground?: CustomBackground;
  classLevels: ClassLevel[];

  /** Base scores before racial bonuses / ASI */
  abilities: AbilityScores;

  skillProficiencies: string[];
  expertise: string[];
  toolProficiencies: string[];
  weaponProficiencies: string[];
  languageChoices: string[];
  otherChoices: OtherChoices;

  feats: string[];
  customFeats: CustomFeat[];

  hp: HitPoints;
  hitDiceUsed: number;

  inspiration: boolean;
  deathSaves: DeathSaves;

  armorEquipped?: string;
  shieldEquipped?: boolean;
  weapons: string[];

  inventory: InventoryItem[];
  spells: CharacterSpells;

  notes: string;
  personality: Personality;

  asiHistory: AsiHistoryEntry[];

  createdAt: string;
  updatedAt: string;
}

export type CharacterUpdate =
  | Partial<Character>
  | ((prev: Character) => Character);

/** Short keys used by some UI controls */
export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITY_KEYS: AbilityKey[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

export const ABILITY_KEY_TO_SCORE: Record<AbilityKey, AbilityScore> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};

export const ABILITY_SCORE_TO_KEY: Record<AbilityScore, AbilityKey> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const ABILITY_SHORT: Record<AbilityKey, AbilityIndex> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export const ABILITY_SCORE_SHORT: Record<AbilityScore, AbilityIndex> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

export function emptyAbilityScores(fill = 10): AbilityScores {
  return {
    strength: fill,
    dexterity: fill,
    constitution: fill,
    intelligence: fill,
    wisdom: fill,
    charisma: fill,
  };
}

export function slotsUsedToState(
  slotsMax: number[],
  slotsUsed: number[],
): SpellSlotsState {
  const state: SpellSlotsState = {};
  for (let i = 0; i < 9; i++) {
    const max = slotsMax[i] ?? 0;
    if (max > 0) {
      state[i + 1] = { max, used: slotsUsed[i] ?? 0 };
    }
  }
  return state;
}

export function createEmptyCharacter(partial?: Partial<Character>): Character {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? crypto.randomUUID(),
    name: partial?.name ?? "Unnamed Adventurer",
    playerName: partial?.playerName ?? "",
    alignment: partial?.alignment ?? "",
    xp: partial?.xp ?? 0,
    raceId: partial?.raceId ?? "human",
    subraceId: partial?.subraceId,
    backgroundId: partial?.backgroundId ?? "acolyte",
    customBackground: partial?.customBackground,
    classLevels: partial?.classLevels ?? [{ classId: "fighter", level: 1 }],
    abilities: partial?.abilities ?? emptyAbilityScores(10),
    skillProficiencies: partial?.skillProficiencies ?? [],
    expertise: partial?.expertise ?? [],
    toolProficiencies: partial?.toolProficiencies ?? [],
    weaponProficiencies: partial?.weaponProficiencies ?? [],
    languageChoices: partial?.languageChoices ?? [],
    otherChoices: partial?.otherChoices ?? {},
    feats: partial?.feats ?? [],
    customFeats: partial?.customFeats ?? [],
    hp: partial?.hp ?? { current: 10, max: 10, temp: 0 },
    hitDiceUsed: partial?.hitDiceUsed ?? 0,
    inspiration: partial?.inspiration ?? false,
    deathSaves: partial?.deathSaves ?? { successes: 0, failures: 0 },
    armorEquipped: partial?.armorEquipped,
    shieldEquipped: partial?.shieldEquipped,
    weapons: partial?.weapons ?? [],
    inventory: partial?.inventory ?? [],
    spells: partial?.spells ?? {
      known: [],
      prepared: [],
      alwaysPrepared: [],
      slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    notes: partial?.notes ?? "",
    personality: partial?.personality ?? {
      traits: "",
      ideals: "",
      bonds: "",
      flaws: "",
    },
    asiHistory: partial?.asiHistory ?? [],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}
