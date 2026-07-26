import { getClass, getSpellsForClass } from "../data";
import type { AbilityScores } from "../types/character";
import type { AbilityScore, DnDClass, Spell } from "../types/dnd";
import { abilityModifier, getRaceBonuses } from "./rules";

/** Wizard starts with 6 spells in the spellbook, then +2 per level. */
export function wizardSpellbookCount(level: number): number {
  if (level < 1) return 0;
  return 6 + (level - 1) * 2;
}

export function cantripsKnownAtLevel(
  klass: DnDClass,
  level: number,
): number {
  if (!klass.cantrips_known || level < 1) return 0;
  return klass.cantrips_known[level - 1] ?? 0;
}

export function spellsKnownAtLevel(
  klass: DnDClass,
  level: number,
): number | null {
  if (!klass.spellcasting || level < klass.spellcasting.starts_at_level) {
    return null;
  }
  if (klass.spells_known) {
    return klass.spells_known[level - 1] ?? 0;
  }
  if (klass.spellcasting.spellbook) {
    return wizardSpellbookCount(level);
  }
  return null;
}

export function isCasterAtLevel(klass: DnDClass, level: number): boolean {
  return Boolean(
    klass.spellcasting && level >= klass.spellcasting.starts_at_level,
  );
}

export function preparedSpellCapacity(
  klass: DnDClass,
  level: number,
  abilityScore: number,
): number {
  if (!klass.spellcasting || klass.spellcasting.preparation !== "prepared") {
    return 0;
  }
  if (level < klass.spellcasting.starts_at_level) return 0;
  return Math.max(1, level + abilityModifier(abilityScore));
}

export function castingAbilityScore(
  klass: DnDClass,
  base: AbilityScores,
  raceId: string,
  subraceId?: string,
  racialAbilityBonuses?: AbilityScore[],
): number {
  const ability = klass.spellcasting?.ability;
  if (!ability) return 10;
  const racial = getRaceBonuses(raceId, subraceId);
  let score = (base[ability] ?? 10) + (racial[ability] ?? 0);
  if (racialAbilityBonuses) {
    score += racialAbilityBonuses.filter((a) => a === ability).length;
  }
  return score;
}

export function classSpellList(klass: DnDClass): Spell[] {
  const listName = klass.spellcasting?.spell_list ?? klass.name;
  return getSpellsForClass(listName);
}

export function maxSpellLevelForClassLevel(
  klass: DnDClass,
  level: number,
): number {
  if (!klass.spellcasting || level < klass.spellcasting.starts_at_level) {
    return 0;
  }
  // Rough SRD slot unlock by caster type
  const type = klass.spellcasting.caster_type;
  let casterLevel = level;
  if (type === "half") casterLevel = Math.floor(level / 2);
  if (type === "third") casterLevel = Math.floor(level / 3);
  if (type === "pact") {
    if (level >= 17) return 5;
    if (level >= 11) return 5;
    if (level >= 9) return 5;
    if (level >= 7) return 4;
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  }
  if (casterLevel >= 17) return 9;
  if (casterLevel >= 15) return 8;
  if (casterLevel >= 13) return 7;
  if (casterLevel >= 11) return 6;
  if (casterLevel >= 9) return 5;
  if (casterLevel >= 7) return 4;
  if (casterLevel >= 5) return 3;
  if (casterLevel >= 3) return 2;
  return 1;
}

export function spellsUpToLevel(
  klass: DnDClass,
  maxLevel: number,
  includeCantrips = false,
): Spell[] {
  return classSpellList(klass).filter((s) =>
    includeCantrips ? s.level <= maxLevel : s.level >= 1 && s.level <= maxLevel,
  );
}

export function getClassById(classId: string): DnDClass | undefined {
  return getClass(classId);
}
