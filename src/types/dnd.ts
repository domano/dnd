/** D&D 5e 2014 SRD types for character sheet data files. */

export type AbilityScore =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export type AbilityIndex = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export const ABILITY_SCORES: readonly AbilityScore[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

export const ABILITY_INDEX_TO_SCORE: Record<AbilityIndex, AbilityScore> = {
  STR: "strength",
  DEX: "dexterity",
  CON: "constitution",
  INT: "intelligence",
  WIS: "wisdom",
  CHA: "charisma",
};

export type CasterType = "full" | "half" | "third" | "pact";
export type SpellPreparation = "known" | "prepared";
export type CreatureSize =
  | "Tiny"
  | "Small"
  | "Medium"
  | "Large"
  | "Huge"
  | "Gargantuan";

// --- Spells ---

export interface SpellComponents {
  v: boolean;
  s: boolean;
  m: boolean;
  material?: string | null;
}

export interface SpellDamage {
  type?: string | null;
  at_slot_level?: Record<string, string>;
  at_character_level?: Record<string, string>;
}

export interface Spell {
  index: string;
  name: string;
  /** 0 = cantrip */
  level: number;
  school: string;
  casting_time: string;
  range: string;
  components: SpellComponents;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higher_level?: string | null;
  classes: string[];
  damage?: SpellDamage | null;
  dc?: { ability?: string; success?: string };
  area_of_effect?: { type: string; size: number };
  attack_type?: string;
}

// --- Feats / skills / conditions ---

export interface Feat {
  index: string;
  name: string;
  description: string;
  prerequisites: string[];
}

export interface Skill {
  index: string;
  name: string;
  ability: AbilityIndex | string;
  ability_name: string;
  description: string;
}

export interface Condition {
  index: string;
  name: string;
  description: string[];
}

// --- Equipment ---

export interface EquipmentDamage {
  dice?: string;
  type?: string;
}

export interface ArmorClassInfo {
  base?: number;
  dex_bonus?: boolean;
  max_bonus?: number | null;
  formula: string;
}

export interface EquipmentItem {
  index: string;
  name: string;
  category: string;
  kind: "weapon" | "armor" | "pack" | "gear";
  cost?: string | null;
  weight?: number | null;
  weapon_category?: string;
  weapon_range?: string;
  damage?: EquipmentDamage;
  two_handed_damage?: EquipmentDamage;
  range?: { normal?: number; long?: number };
  throw_range?: { normal?: number; long?: number };
  properties?: string[];
  special?: string;
  armor_category?: string;
  armor_class?: ArmorClassInfo;
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  contents?: { index: string; name: string; quantity: number }[];
  gear_category?: string;
  description?: string;
  bundle_quantity?: number;
}

// --- Shared choice / feature shapes ---

export interface FeatureSummary {
  name: string;
  summary: string;
  proficiencies?: string[];
}

export interface SkillChoice {
  choose: number;
  options: string[];
  desc?: string;
}

export interface NestedToolOption {
  label: string;
  choose?: number;
  options?: string[] | null;
  from_category?: string | null;
}

export interface ToolChoice {
  choose: number;
  desc?: string;
  options: Array<string | NestedToolOption>;
}

export interface AbilityBonus {
  ability: AbilityScore;
  bonus: number;
}

export interface AbilityBonusOptions {
  choose: number;
  options: AbilityBonus[];
}

export interface LanguageOptions {
  choose: number;
  options: string[] | "any";
}

export interface CantripOptions {
  choose: number;
  spell_list: string;
  level: number;
}

export interface StringChoiceList {
  choose: number;
  options: string[];
}

// --- Classes ---

export interface ClassProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  skills: SkillChoice | null;
  tool_choices?: ToolChoice[];
  other_choices?: ToolChoice[];
}

export interface SpellcastingInfo {
  ability: AbilityScore | null;
  caster_type: CasterType;
  preparation: SpellPreparation;
  ritual: boolean;
  spell_list: string;
  starts_at_level: number;
  spellbook?: boolean;
  focus?: string;
}

/** Full/half/third: number[]; pact: { slot_level, slot_count }. Index 0 = level 1. */
export type SpellSlotsByLevel =
  | number[]
  | { slot_level: number; slot_count: number };

export interface Subclass {
  id: string;
  name: string;
  flavor?: string;
  summary: string;
  features_by_level: Record<string, FeatureSummary[]>;
}

export interface ClassResourceByLevel {
  level: number;
  [key: string]: unknown;
}

export interface DnDClass {
  id: string;
  name: string;
  hit_die: number;
  primary_abilities: AbilityScore[];
  saving_throws: AbilityScore[];
  proficiencies: ClassProficiencies;
  spellcasting: SpellcastingInfo | null;
  subclass_unlock_level: number;
  subclasses: Subclass[];
  asi_levels: number[];
  features_by_level: Record<string, FeatureSummary[]>;
  resources_by_level: ClassResourceByLevel[];
  spell_slots?: SpellSlotsByLevel[];
  cantrips_known?: number[];
  spells_known?: number[];
  sorcery_point_slot_costs?: Array<{
    spell_slot_level: number;
    sorcery_point_cost: number;
  }>;
  source: string;
}

// --- Races ---

export interface RacialTrait {
  id: string;
  name: string;
  summary: string;
  proficiencies?: string[];
  proficiency_choices?: SkillChoice;
}

export interface Subrace {
  id: string;
  name: string;
  summary: string;
  ability_bonuses: AbilityBonus[];
  traits: RacialTrait[];
  language_options?: LanguageOptions;
  cantrip_options?: CantripOptions;
  source: string;
}

export interface DnDRace {
  id: string;
  name: string;
  size: CreatureSize;
  speed: number;
  ability_bonuses: AbilityBonus[];
  ability_bonus_options?: AbilityBonusOptions;
  languages: string[];
  language_options?: LanguageOptions;
  darkvision?: number;
  traits: RacialTrait[];
  starting_proficiencies?: string[];
  skill_choices?: SkillChoice;
  age?: string;
  alignment?: string;
  size_description?: string;
  subraces: Subrace[];
  draconic_ancestry_options?: Array<{
    id: string;
    name: string;
    summary: string;
  }>;
  source: string;
}

// --- Backgrounds ---

export interface BackgroundFeature {
  name: string;
  summary: string;
}

export interface BackgroundEquipmentItem {
  name: string;
  quantity: number;
}

export interface BackgroundEquipmentChoice {
  choose: number;
  from_category?: string;
  options?: string[];
}

export interface DnDBackground {
  id: string;
  name: string;
  skills: string[];
  tools?: string[] | null;
  language_options?: LanguageOptions;
  feature: BackgroundFeature;
  equipment: BackgroundEquipmentItem[];
  equipment_choices?: BackgroundEquipmentChoice[] | null;
  starting_gold?: { quantity: number; unit: string } | number;
  personality_traits?: StringChoiceList | null;
  ideals?: StringChoiceList | null;
  bonds?: StringChoiceList | null;
  flaws?: StringChoiceList | null;
  source: string;
}

// --- Reference ---

export interface SpellSlotTable {
  classes: string[];
  slots_by_level: Record<string, number[]>;
  slot_levels: number[];
  notes?: string;
}

export interface WarlockPactLevel {
  pact_slots: number;
  slot_level: number;
  cantrips_known?: number;
  spells_known?: number;
  invocations_known?: number;
  mystic_arcanum?: Record<string, number>;
}

export interface ReferenceData {
  source: string;
  proficiency_bonus_by_level: Record<string, number>;
  ability_score_modifiers: Record<string, number>;
  xp_by_level: Record<string, number>;
  multiclass_prerequisites: Record<string, string>;
  spell_slots: {
    full_caster: SpellSlotTable;
    half_caster: SpellSlotTable;
    third_caster: SpellSlotTable;
    warlock_pact_magic: {
      classes: string[];
      by_level: Record<string, WarlockPactLevel>;
      notes?: string;
    };
    multiclass_caster_levels: Record<string, string>;
  };
}
