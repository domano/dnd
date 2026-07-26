import {
  getBackground,
  getClass,
  getEquipment,
  getRace,
  getSkill,
} from "../data";
import type {
  AbilityScores,
  Character,
  ClassLevel,
  CustomBackground,
  InventoryItem,
  OtherChoices,
  Personality,
} from "../types/character";
import { emptyCurrency } from "../types/character";
import type { AbilityScore, DnDRace, RacialTrait } from "../types/dnd";
import { ABILITY_SCORES } from "../types/dnd";
import {
  abilityModifier,
  getFinalAbilityScores,
  getHitPointsAverage,
  racialHitPointBonusPerLevel,
  STANDARD_ARRAY,
  validatePointBuy,
  xpForLevel,
} from "./rules";

function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function enrichInventoryItem(
  item: Partial<InventoryItem> & { name: string; quantity: number },
): InventoryItem {
  const catalog = item.index ? getEquipment(item.index) : undefined;
  return {
    id: item.id && item.id.length > 0 ? item.id : newItemId(),
    index: item.index ?? catalog?.index,
    name: item.name || catalog?.name || "Unknown item",
    quantity: item.quantity,
    equipped: item.equipped,
    notes: item.notes,
    weight: item.weight ?? catalog?.weight ?? null,
    cost: item.cost ?? catalog?.cost ?? null,
    category: item.category ?? catalog?.category,
  };
}

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
  weaponProficiencies?: string[];
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

function isToolProficiency(name: string): boolean {
  return /tools?|supplies|kit|instruments?/i.test(name);
}

function collectTraitProficiencies(
  race: DnDRace,
  subraceId?: string,
): { skills: string[]; weapons: string[]; tools: string[] } {
  const traits: RacialTrait[] = [...race.traits];
  const subrace = subraceId
    ? race.subraces.find((s) => s.id === subraceId)
    : undefined;
  if (subrace) traits.push(...subrace.traits);

  const skills: string[] = [];
  const weapons: string[] = [];
  const tools: string[] = [];

  for (const trait of traits) {
    for (const prof of trait.proficiencies ?? []) {
      const skill = getSkill(prof);
      if (skill) {
        skills.push(skill.name);
      } else if (isToolProficiency(prof)) {
        tools.push(prof);
      } else {
        weapons.push(prof);
      }
    }
  }

  return { skills, weapons, tools };
}

function backgroundSkills(draft: CharacterDraft): string[] {
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

function backgroundEquipmentItems(draft: CharacterDraft): InventoryItem[] {
  if (draft.customBackground) return [];
  if (!draft.backgroundId) return [];
  const bg = getBackground(draft.backgroundId);
  if (!bg) return [];
  return bg.equipment.map((e) =>
    enrichInventoryItem({
      name: e.name,
      quantity: e.quantity,
    }),
  );
}

function mergeInventoryByName(...lists: InventoryItem[][]): InventoryItem[] {
  const seen = new Set<string>();
  const out: InventoryItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = (item.index ?? item.name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(enrichInventoryItem(item));
    }
  }
  return out;
}

function backgroundStartingGold(draft: CharacterDraft): number {
  if (draft.customBackground) return 0;
  if (!draft.backgroundId) return 0;
  const bg = getBackground(draft.backgroundId);
  if (!bg?.starting_gold) return 0;
  if (typeof bg.starting_gold === "number") return bg.starting_gold;
  if (
    typeof bg.starting_gold === "object" &&
    "quantity" in bg.starting_gold
  ) {
    return Number(bg.starting_gold.quantity) || 0;
  }
  return 0;
}

/** Assign standard-array (or equivalent point-buy baseline) with class primaries highest. */
export function abilitiesForClass(
  classId: string,
  method: AbilityMethod,
): AbilityScores {
  if (method === "manual") {
    return emptyAbilities(8);
  }

  const klass = getClass(classId);
  const scores = [...STANDARD_ARRAY].sort((a, b) => b - a);
  const result = emptyAbilities(8);
  if (!klass) {
    ABILITY_SCORES.forEach((ability, i) => {
      result[ability] = scores[i]!;
    });
    return result;
  }

  const assigned = new Set<AbilityScore>();
  const priority: AbilityScore[] = [];
  for (const primary of klass.primary_abilities) {
    if (!assigned.has(primary)) {
      priority.push(primary);
      assigned.add(primary);
    }
  }
  if (!assigned.has("constitution")) {
    priority.push("constitution");
    assigned.add("constitution");
  }
  for (const ability of ABILITY_SCORES) {
    if (!assigned.has(ability)) {
      priority.push(ability);
      assigned.add(ability);
    }
  }
  priority.forEach((ability, i) => {
    result[ability] = scores[i]!;
  });
  return result;
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

  const racialTraits = collectTraitProficiencies(race, draft.subraceId);

  const skillProficiencies = mergeUnique(
    draft.skillProficiencies,
    backgroundSkills(draft),
    racialTraits.skills,
  );

  const toolProficiencies = mergeUnique(
    draft.toolProficiencies,
    klass.proficiencies.tools,
    backgroundTools(draft),
    racialTraits.tools,
  );

  const weaponProficiencies = mergeUnique(
    draft.weaponProficiencies,
    klass.proficiencies.weapons,
    racialTraits.weapons,
  );

  const languageChoices = mergeUnique(
    race.languages,
    draft.languageChoices,
    draft.customBackground?.languages,
  );

  const racialCantrip =
    typeof draft.otherChoices?.racialCantrip === "string"
      ? draft.otherChoices.racialCantrip
      : undefined;
  const knownSpells = mergeUnique(draft.knownSpells, racialCantrip ? [racialCantrip] : []);

  const extras: InventoryItem[] = [];
  if (draft.classId === "wizard") {
    extras.push(enrichInventoryItem({ name: "Spellbook", quantity: 1 }));
  }

  const inventory = mergeInventoryByName(
    backgroundEquipmentItems(draft),
    (draft.inventory ?? []).map((item) => enrichInventoryItem(item)),
    extras,
  );

  const currency = {
    ...emptyCurrency(),
    gp: backgroundStartingGold(draft),
  };

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
    weaponProficiencies,
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
    inventory,
    currency,
    spells: {
      known: knownSpells,
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
    journal: [],
    quests: [],
    activeConditions: [],
    asiHistory: [],
    createdAt: now,
    updatedAt: now,
  };

  const scores = getFinalAbilityScores(character);
  const conMod = abilityModifier(scores.constitution);
  const hpMax = getHitPointsAverage(
    classLevels,
    conMod,
    racialHitPointBonusPerLevel({
      raceId: draft.raceId,
      subraceId: draft.subraceId,
    }),
  );
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
