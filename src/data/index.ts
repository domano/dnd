import type {
  Condition,
  DnDBackground,
  DnDClass,
  DnDRace,
  EquipmentItem,
  Feat,
  ReferenceData,
  Skill,
  Spell,
  Subclass,
  Subrace,
} from "../types/dnd";

import backgroundsJson from "./backgrounds.json";
import classesJson from "./classes.json";
import conditionsJson from "./conditions.json";
import equipmentJson from "./equipment.json";
import featsJson from "./feats.json";
import racesJson from "./races.json";
import referenceJson from "./reference.json";
import skillsJson from "./skills.json";
import spellsJson from "./spells.json";

export const classes = classesJson as unknown as DnDClass[];
export const races = racesJson as unknown as DnDRace[];
export const backgrounds = backgroundsJson as unknown as DnDBackground[];
export const spells = spellsJson as unknown as Spell[];
export const feats = featsJson as unknown as Feat[];
export const skills = skillsJson as unknown as Skill[];
export const equipment = equipmentJson as unknown as EquipmentItem[];
export const conditions = conditionsJson as unknown as Condition[];
export const reference = referenceJson as unknown as ReferenceData;

export const EQUIPMENT_CATEGORIES: string[] = Array.from(
  new Set(equipment.map((e) => e.category).filter(Boolean)),
).sort((a, b) => a.localeCompare(b));

export const EQUIPMENT_KINDS: string[] = Array.from(
  new Set(equipment.map((e) => e.kind).filter(Boolean)),
).sort((a, b) => a.localeCompare(b));

export const SPELL_SCHOOLS: string[] = Array.from(
  new Set(spells.map((s) => s.school).filter(Boolean)),
).sort((a, b) => a.localeCompare(b));

export const SPELL_CLASSES: string[] = Array.from(
  new Set(spells.flatMap((s) => s.classes)),
).sort((a, b) => a.localeCompare(b));

export function getClass(id: string): DnDClass | undefined {
  return classes.find((c) => c.id === id);
}

export function getRace(id: string): DnDRace | undefined {
  return races.find((r) => r.id === id);
}

export function getSubrace(
  raceId: string,
  subraceId: string,
): Subrace | undefined {
  return getRace(raceId)?.subraces.find((s) => s.id === subraceId);
}

export function getBackground(id: string): DnDBackground | undefined {
  return backgrounds.find((b) => b.id === id);
}

export function getSpell(index: string): Spell | undefined {
  return spells.find((s) => s.index === index);
}

export function getFeat(index: string): Feat | undefined {
  return feats.find((f) => f.index === index);
}

export function getSkill(indexOrName: string): Skill | undefined {
  const key = indexOrName.toLowerCase();
  return skills.find(
    (s) =>
      s.index === key ||
      s.name.toLowerCase() === key ||
      s.index === indexOrName ||
      s.name === indexOrName,
  );
}

export function getEquipment(index: string): EquipmentItem | undefined {
  return equipment.find((e) => e.index === index);
}

export function getCondition(index: string): Condition | undefined {
  return conditions.find((c) => c.index === index);
}

export function getSubclass(
  classId: string,
  subclassId: string,
): Subclass | undefined {
  return getClass(classId)?.subclasses.find((s) => s.id === subclassId);
}

export function getSpellsForClass(className: string): Spell[] {
  const key = className.toLowerCase();
  return spells.filter((s) =>
    s.classes.some((c) => c.toLowerCase() === key),
  );
}
