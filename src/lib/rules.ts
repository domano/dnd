import { getClass, getEquipment, getRace, getSubrace, reference } from "../data";
import type { AbilityKey, Character } from "../types/character";
import {
  ABILITY_KEY_TO_SCORE,
  ABILITY_SCORE_TO_KEY,
} from "../types/character";
import type {
  AbilityScore,
  CasterType,
  DnDClass,
  EquipmentItem,
  FeatureSummary,
  Skill,
} from "../types/dnd";
import { ABILITY_INDEX_TO_SCORE, ABILITY_SCORES } from "../types/dnd";

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  const clamped = Math.min(20, Math.max(1, Math.floor(level)));
  return reference.proficiency_bonus_by_level[String(clamped)] ?? 2;
}

export function totalLevel(character: Character): number {
  return character.classLevels.reduce((sum, cl) => sum + cl.level, 0);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Racial ability bonuses from race + subrace (fixed only; options via otherChoices). */
export function getRaceBonuses(
  raceId: string,
  subraceId?: string,
): Partial<Record<AbilityScore, number>> {
  const race = getRace(raceId);
  if (!race) return {};

  const bonuses: Partial<Record<AbilityScore, number>> = {};
  for (const b of race.ability_bonuses) {
    bonuses[b.ability] = (bonuses[b.ability] ?? 0) + b.bonus;
  }

  if (subraceId) {
    const sub = getSubrace(raceId, subraceId);
    if (sub) {
      for (const b of sub.ability_bonuses) {
        bonuses[b.ability] = (bonuses[b.ability] ?? 0) + b.bonus;
      }
    }
  }

  return bonuses;
}

function getAsiIncreases(
  character: Character,
): Partial<Record<AbilityScore, number>> {
  const totals: Partial<Record<AbilityScore, number>> = {};
  for (const entry of character.asiHistory) {
    if (entry.mode !== "asi" || !entry.increases) continue;
    for (const ability of ABILITY_SCORES) {
      const n = entry.increases[ability];
      if (n) totals[ability] = (totals[ability] ?? 0) + n;
    }
  }
  return totals;
}

export function getFinalAbilityScores(
  character: Character,
): Record<AbilityScore, number> {
  const racial = getRaceBonuses(character.raceId, character.subraceId);
  const asi = getAsiIncreases(character);
  const optionBonuses = character.otherChoices.racialAbilityBonuses ?? [];

  const result = {} as Record<AbilityScore, number>;
  for (const ability of ABILITY_SCORES) {
    let score = character.abilities[ability] ?? 10;
    score += racial[ability] ?? 0;
    score += asi[ability] ?? 0;
    score += optionBonuses.filter((a) => a === ability).length;
    result[ability] = score;
  }
  return result;
}

export interface SkillBonusRow {
  index: string;
  name: string;
  ability: AbilityScore;
  proficient: boolean;
  expertise: boolean;
  modifier: number;
}

function skillNamesMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function getSkillsWithBonuses(
  character: Character,
  skillsData: Skill[],
): SkillBonusRow[] {
  const scores = getFinalAbilityScores(character);
  const level = totalLevel(character);
  const pb = proficiencyBonus(level);

  return skillsData.map((skill) => {
    const abilityKey =
      ABILITY_INDEX_TO_SCORE[skill.ability as keyof typeof ABILITY_INDEX_TO_SCORE] ??
      (skill.ability_name
        ? ABILITY_INDEX_TO_SCORE[
            skill.ability_name as keyof typeof ABILITY_INDEX_TO_SCORE
          ]
        : undefined) ??
      "dexterity";

    const proficient = character.skillProficiencies.some(
      (s) => skillNamesMatch(s, skill.name) || skillNamesMatch(s, skill.index),
    );
    const hasExpertise = character.expertise.some(
      (s) => skillNamesMatch(s, skill.name) || skillNamesMatch(s, skill.index),
    );

    let mod = abilityModifier(scores[abilityKey]);
    if (proficient) mod += pb;
    if (hasExpertise) mod += pb;

    return {
      index: skill.index,
      name: skill.name,
      ability: abilityKey,
      proficient,
      expertise: hasExpertise,
      modifier: mod,
    };
  });
}

export interface SavingThrowRow {
  ability: AbilityScore;
  proficient: boolean;
  modifier: number;
}

export function getSavingThrows(character: Character): SavingThrowRow[] {
  const scores = getFinalAbilityScores(character);
  const pb = proficiencyBonus(totalLevel(character));
  const proficient = new Set<AbilityScore>();

  for (const cl of character.classLevels) {
    const klass = getClass(cl.classId);
    if (!klass) continue;
    for (const save of klass.saving_throws) {
      proficient.add(save);
    }
  }

  return ABILITY_SCORES.map((ability) => {
    const isProficient = proficient.has(ability);
    return {
      ability,
      proficient: isProficient,
      modifier:
        abilityModifier(scores[ability]) + (isProficient ? pb : 0),
    };
  });
}

function hasUnarmoredDefense(
  character: Character,
  kind: "barbarian" | "monk",
): boolean {
  return character.classLevels.some((cl) => {
    if (cl.classId !== kind || cl.level < 1) return false;
    const klass = getClass(cl.classId);
    const features = klass?.features_by_level["1"] ?? [];
    return features.some((f) => f.name === "Unarmored Defense");
  });
}

export function computeAC(
  character: Character,
  equipmentData: EquipmentItem[] = [],
): number {
  const scores = getFinalAbilityScores(character);
  const dexMod = abilityModifier(scores.dexterity);
  const conMod = abilityModifier(scores.constitution);
  const wisMod = abilityModifier(scores.wisdom);

  const findItem = (index: string) =>
    equipmentData.find((e) => e.index === index) ?? getEquipment(index);

  const armor = character.armorEquipped
    ? findItem(character.armorEquipped)
    : undefined;

  const wearingArmor =
    !!armor &&
    armor.kind === "armor" &&
    armor.armor_category !== "Shield";

  let ac: number;

  if (wearingArmor && armor?.armor_class) {
    const base = armor.armor_class.base ?? 10;
    if (armor.armor_class.dex_bonus) {
      const maxBonus = armor.armor_class.max_bonus;
      const dex =
        maxBonus == null ? dexMod : Math.min(dexMod, maxBonus);
      ac = base + dex;
    } else {
      ac = base;
    }
  } else if (
    !wearingArmor &&
    hasUnarmoredDefense(character, "barbarian")
  ) {
    ac = 10 + dexMod + conMod;
  } else if (
    !wearingArmor &&
    !character.shieldEquipped &&
    hasUnarmoredDefense(character, "monk")
  ) {
    ac = 10 + dexMod + wisMod;
  } else {
    ac = 10 + dexMod;
  }

  if (character.shieldEquipped) {
    // Barbarian unarmored allows shield; monk does not (already gated above).
    if (!(hasUnarmoredDefense(character, "monk") && !wearingArmor)) {
      ac += 2;
    }
  }

  return ac;
}

export function computeInitiative(character: Character): number {
  const scores = getFinalAbilityScores(character);
  return abilityModifier(scores.dexterity);
}

/** Alias used by sheet UI */
export function getInitiative(character: Character): number {
  return computeInitiative(character);
}

/** Proficiency bonus from a character (or raw level). */
export function getProficiencyBonus(characterOrLevel: Character | number): number {
  if (typeof characterOrLevel === "number") {
    return proficiencyBonus(characterOrLevel);
  }
  return proficiencyBonus(totalLevel(characterOrLevel));
}

export function computeSpeed(character: Character): number {
  const race = getRace(character.raceId);
  let speed = race?.speed ?? 30;

  const wearingArmor = !!character.armorEquipped;
  const monkLevel = character.classLevels.find((c) => c.classId === "monk");
  if (monkLevel && !wearingArmor && !character.shieldEquipped) {
    const klass = getClass("monk");
    const row = klass?.resources_by_level.find(
      (r) => r.level === monkLevel.level,
    );
    const bonus = row?.unarmored_movement;
    if (typeof bonus === "number") speed += bonus;
  }

  return speed;
}

export interface SpellSlotsResult {
  /** Available slots per level; index 0 = 1st level. Always length 9. */
  slots: number[];
  /** Warlock pact magic (separate from multiclass slot table). */
  pact?: { slotLevel: number; slotCount: number };
  casterLevel: number;
  casterType: CasterType | null;
}

function padSlots(raw: number[]): number[] {
  const slots = Array.from({ length: 9 }, (_, i) => raw[i] ?? 0);
  return slots;
}

function multiclassCasterLevel(character: Character): {
  casterLevel: number;
  hasPact: boolean;
  pactLevel: number;
  primaryType: CasterType | null;
} {
  let casterLevel = 0;
  let hasPact = false;
  let pactLevel = 0;
  let primaryType: CasterType | null = null;

  for (const cl of character.classLevels) {
    const klass = getClass(cl.classId);
    if (!klass?.spellcasting) {
      // Third-caster subclasses (not in SRD data, but supported structurally)
      continue;
    }
    const { caster_type, starts_at_level } = klass.spellcasting;
    if (cl.level < starts_at_level) continue;

    if (caster_type === "pact") {
      hasPact = true;
      pactLevel += cl.level;
      if (!primaryType) primaryType = "pact";
      continue;
    }

    if (caster_type === "full") {
      casterLevel += cl.level;
      primaryType = primaryType ?? "full";
    } else if (caster_type === "half") {
      casterLevel += Math.floor(cl.level / 2);
      if (!primaryType || primaryType === "pact") primaryType = "half";
    } else if (caster_type === "third") {
      casterLevel += Math.floor(cl.level / 3);
      if (!primaryType || primaryType === "pact") primaryType = "third";
    }
  }

  return { casterLevel, hasPact, pactLevel, primaryType };
}

export function getSpellSlots(character: Character): SpellSlotsResult {
  const empty: SpellSlotsResult = {
    slots: padSlots([]),
    casterLevel: 0,
    casterType: null,
  };

  if (character.classLevels.length === 0) return empty;

  // Single-class fast path using class spellcasting type
  if (character.classLevels.length === 1) {
    const cl = character.classLevels[0]!;
    const klass = getClass(cl.classId);
    if (!klass?.spellcasting) return empty;

    const type = klass.spellcasting.caster_type;
    if (cl.level < klass.spellcasting.starts_at_level) {
      return { ...empty, casterType: type };
    }

    if (type === "pact") {
      const pact =
        reference.spell_slots.warlock_pact_magic.by_level[String(cl.level)];
      if (!pact) return { ...empty, casterType: "pact" };
      const slots = padSlots([]);
      slots[pact.slot_level - 1] = pact.pact_slots;
      return {
        slots,
        pact: { slotLevel: pact.slot_level, slotCount: pact.pact_slots },
        casterLevel: cl.level,
        casterType: "pact",
      };
    }

    const table =
      type === "full"
        ? reference.spell_slots.full_caster
        : type === "half"
          ? reference.spell_slots.half_caster
          : reference.spell_slots.third_caster;

    const raw = table.slots_by_level[String(cl.level)] ?? [];
    return {
      slots: padSlots(raw),
      casterLevel: cl.level,
      casterType: type,
    };
  }

  // Multiclass: combine caster levels → full caster table; pact stays separate
  const { casterLevel, hasPact, pactLevel, primaryType } =
    multiclassCasterLevel(character);

  let slots = padSlots([]);
  if (casterLevel > 0) {
    const raw =
      reference.spell_slots.full_caster.slots_by_level[String(casterLevel)] ??
      [];
    slots = padSlots(raw);
  }

  let pact: SpellSlotsResult["pact"];
  if (hasPact && pactLevel > 0) {
    const pactRow =
      reference.spell_slots.warlock_pact_magic.by_level[String(pactLevel)];
    if (pactRow) {
      pact = {
        slotLevel: pactRow.slot_level,
        slotCount: pactRow.pact_slots,
      };
      // If no other caster slots, surface pact slots in the slots array too
      if (casterLevel === 0) {
        slots = padSlots([]);
        slots[pactRow.slot_level - 1] = pactRow.pact_slots;
      }
    }
  }

  return {
    slots,
    pact,
    casterLevel: casterLevel || pactLevel,
    casterType: primaryType,
  };
}

function getPrimarySpellcastingAbility(
  character: Character,
): AbilityScore | null {
  for (const cl of character.classLevels) {
    const klass = getClass(cl.classId);
    if (klass?.spellcasting?.ability) return klass.spellcasting.ability;
  }
  return null;
}

export function getSpellAttackBonus(character: Character): number | null {
  const ability = getPrimarySpellcastingAbility(character);
  if (!ability) return null;
  const scores = getFinalAbilityScores(character);
  return (
    proficiencyBonus(totalLevel(character)) +
    abilityModifier(scores[ability])
  );
}

export function getSpellSaveDC(character: Character): number | null {
  const ability = getPrimarySpellcastingAbility(character);
  if (!ability) return null;
  const scores = getFinalAbilityScores(character);
  return (
    8 +
    proficiencyBonus(totalLevel(character)) +
    abilityModifier(scores[ability])
  );
}

export interface CharacterFeature {
  name: string;
  summary: string;
  source: string;
  level: number;
}

function featuresUpToLevel(
  byLevel: Record<string, FeatureSummary[]>,
  level: number,
  source: string,
): CharacterFeature[] {
  const out: CharacterFeature[] = [];
  for (let lvl = 1; lvl <= level; lvl++) {
    const list = byLevel[String(lvl)] ?? [];
    for (const f of list) {
      out.push({
        name: f.name,
        summary: f.summary,
        source,
        level: lvl,
      });
    }
  }
  return out;
}

export function getFeaturesForCharacter(
  character: Character,
): CharacterFeature[] {
  const features: CharacterFeature[] = [];

  const race = getRace(character.raceId);
  if (race) {
    for (const t of race.traits) {
      features.push({
        name: t.name,
        summary: t.summary,
        source: race.name,
        level: 1,
      });
    }
    if (character.subraceId) {
      const sub = getSubrace(character.raceId, character.subraceId);
      if (sub) {
        for (const t of sub.traits) {
          features.push({
            name: t.name,
            summary: t.summary,
            source: sub.name,
            level: 1,
          });
        }
      }
    }
    if (
      character.otherChoices.draconicAncestry &&
      race.draconic_ancestry_options
    ) {
      const ancestry = race.draconic_ancestry_options.find(
        (o) =>
          o.id === character.otherChoices.draconicAncestry ||
          o.name === character.otherChoices.draconicAncestry,
      );
      if (ancestry) {
        features.push({
          name: `Draconic Ancestry (${ancestry.name})`,
          summary: ancestry.summary,
          source: race.name,
          level: 1,
        });
      }
    }
  }

  for (const cl of character.classLevels) {
    const klass = getClass(cl.classId);
    if (!klass) continue;
    features.push(
      ...featuresUpToLevel(
        klass.features_by_level,
        cl.level,
        klass.name,
      ),
    );
    if (cl.subclassId) {
      const sub = klass.subclasses.find((s) => s.id === cl.subclassId);
      if (sub) {
        features.push(
          ...featuresUpToLevel(
            sub.features_by_level,
            cl.level,
            `${klass.name}: ${sub.name}`,
          ),
        );
      }
    }
  }

  return features;
}

/**
 * Average HP for new characters:
 * 1st level = hit_die + CON
 * each additional level = (hit_die/2 + 1) + CON
 */
export function getHitPointsAverage(
  classLevels: { classId: string; level: number }[],
  conMod: number,
): number {
  if (classLevels.length === 0) return 0;

  let hp = 0;
  let isFirstLevel = true;

  for (const cl of classLevels) {
    const klass = getClass(cl.classId);
    if (!klass) continue;
    const die = klass.hit_die;
    const avgPerLevel = Math.floor(die / 2) + 1;

    for (let i = 0; i < cl.level; i++) {
      if (isFirstLevel) {
        hp += die + conMod;
        isFirstLevel = false;
      } else {
        hp += avgPerLevel + conMod;
      }
    }
  }

  return Math.max(1, hp);
}

export function pointBuyCost(score: number): number {
  if (!(score in POINT_BUY_COST)) {
    throw new Error(`Point-buy score must be 8–15, got ${score}`);
  }
  return POINT_BUY_COST[score]!;
}

export function validatePointBuy(
  scores: Partial<Record<AbilityScore, number>> | number[],
): { valid: boolean; total: number; remaining: number; errors: string[] } {
  const values = Array.isArray(scores)
    ? scores
    : ABILITY_SCORES.map((a) => scores[a] ?? 8);

  const errors: string[] = [];
  let total = 0;

  for (const score of values) {
    if (score < 8 || score > 15) {
      errors.push(`Score ${score} out of range 8–15`);
      continue;
    }
    total += pointBuyCost(score);
  }

  if (values.length !== 6) {
    errors.push(`Expected 6 ability scores, got ${values.length}`);
  }
  if (total > 27) {
    errors.push(`Spent ${total} points (max 27)`);
  }

  return {
    valid: errors.length === 0 && total <= 27,
    total,
    remaining: 27 - total,
    errors,
  };
}

export function xpForLevel(level: number): number {
  return reference.xp_by_level[String(Math.min(20, Math.max(1, level)))] ?? 0;
}

export function getClassHitDie(classId: string): number {
  return getClass(classId)?.hit_die ?? 8;
}

export function primaryClass(character: Character): DnDClass | undefined {
  const first = character.classLevels[0];
  return first ? getClass(first.classId) : undefined;
}

/** Resolve a skill's governing ability (full name). */
export function skillAbilityKey(skill: Skill): AbilityScore {
  const fromAbility =
    ABILITY_INDEX_TO_SCORE[skill.ability as keyof typeof ABILITY_INDEX_TO_SCORE];
  if (fromAbility) return fromAbility;
  const fromName =
    ABILITY_INDEX_TO_SCORE[
      skill.ability_name as keyof typeof ABILITY_INDEX_TO_SCORE
    ];
  return fromName ?? "dexterity";
}

/** Skill bonus for a character using skill index or display name. */
export function skillBonus(character: Character, skill: Skill): number {
  const rows = getSkillsWithBonuses(character, [skill]);
  return rows[0]?.modifier ?? 0;
}

/** Saving throw bonus; accepts short UI keys or full ability names. */
export function savingThrowBonus(
  character: Character,
  ability: AbilityKey | AbilityScore,
): number {
  const full: AbilityScore =
    ability in ABILITY_KEY_TO_SCORE
      ? ABILITY_KEY_TO_SCORE[ability as AbilityKey]
      : (ability as AbilityScore);
  const row = getSavingThrows(character).find((r) => r.ability === full);
  return row?.modifier ?? 0;
}

export function abilityKeyToScore(key: AbilityKey): AbilityScore {
  return ABILITY_KEY_TO_SCORE[key];
}

export function abilityScoreToKey(score: AbilityScore): AbilityKey {
  return ABILITY_SCORE_TO_KEY[score];
}
