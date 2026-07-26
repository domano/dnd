import { useEffect, useMemo, useState } from "react";
import {
  classes,
  equipment,
  getBackground,
  getClass,
  getRace,
  getSkill,
  getSpellsForClass,
  races,
  skills,
} from "../data";
import {
  abilitiesForClass,
  type AbilityMethod,
  type CharacterDraft,
} from "../lib/createCharacter";
import {
  abilityModifier,
  formatModifier,
  getRaceBonuses,
  STANDARD_ARRAY,
  validatePointBuy,
} from "../lib/rules";
import {
  cantripsKnownAtLevel,
  castingAbilityScore,
  classSpellList,
  isCasterAtLevel,
  preparedSpellCapacity,
  spellsKnownAtLevel,
} from "../lib/spellcasting";
import { useCharacterStore } from "../store/characterStore";
import type { AbilityScores, CustomBackground } from "../types/character";
import type {
  AbilityScore,
  DnDClass,
  DnDRace,
  LanguageOptions,
  Spell,
} from "../types/dnd";
import { ABILITY_SCORES } from "../types/dnd";
import styles from "./CreateWizard.module.css";

const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
] as const;

const COMMON_LANGUAGES = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
] as const;

const FIGHTING_STYLES: { id: string; name: string; summary: string }[] = [
  {
    id: "archery",
    name: "Archery",
    summary: "You gain a +2 bonus to attack rolls you make with ranged weapons.",
  },
  {
    id: "defense",
    name: "Defense",
    summary: "While you are wearing armor, you gain a +1 bonus to AC.",
  },
  {
    id: "dueling",
    name: "Dueling",
    summary:
      "When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
  },
  {
    id: "great-weapon-fighting",
    name: "Great Weapon Fighting",
    summary:
      "When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll.",
  },
  {
    id: "protection",
    name: "Protection",
    summary:
      "When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.",
  },
  {
    id: "two-weapon-fighting",
    name: "Two-Weapon Fighting",
    summary:
      "When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.",
  },
];

const FIGHTING_STYLE_CLASSES = new Set(["fighter", "paladin", "ranger"]);

const STEP_IDS = [
  "identity",
  "race",
  "class",
  "background",
  "abilities",
  "details",
  "spells",
  "review",
] as const;

const STEP_LABELS = [
  "Identity",
  "Race",
  "Class",
  "Background",
  "Abilities",
  "Details",
  "Spells",
  "Review",
] as const;

type StepId = (typeof STEP_IDS)[number];

export interface CreateWizardProps {
  onCancel?: () => void;
  onCreated: (id: string) => void;
}

function toggleInList(list: string[], value: string, max?: number): string[] {
  const has = list.some((x) => x.toLowerCase() === value.toLowerCase());
  if (has) return list.filter((x) => x.toLowerCase() !== value.toLowerCase());
  if (max != null && list.length >= max) return list;
  return [...list, value];
}

function abilityLabel(ability: AbilityScore): string {
  return ability.charAt(0).toUpperCase() + ability.slice(1);
}

function formatBonuses(
  bonuses: Partial<Record<AbilityScore, number>>,
): string {
  return ABILITY_SCORES.filter((a) => bonuses[a])
    .map((a) => `${abilityLabel(a).slice(0, 3)} +${bonuses[a]}`)
    .join(", ");
}

function classRelevantGear(klass: DnDClass) {
  const armorProf = klass.proficiencies.armor.map((a) => a.toLowerCase());
  const hasMartial = klass.proficiencies.weapons.some((w) =>
    /martial/i.test(w),
  );
  const hasSimple = klass.proficiencies.weapons.some((w) => /simple/i.test(w));

  const packs = equipment.filter((e) => e.kind === "pack");
  const armor = equipment.filter((e) => {
    if (e.kind !== "armor") return false;
    const cat = (e.armor_category ?? "").toLowerCase();
    if (cat === "shield") return armorProf.some((a) => a.includes("shield"));
    if (cat.includes("light")) return armorProf.some((a) => a.includes("light"));
    if (cat.includes("medium"))
      return armorProf.some((a) => a.includes("medium"));
    if (cat.includes("heavy")) return armorProf.some((a) => a.includes("heavy"));
    return false;
  });
  const weapons = equipment.filter((e) => {
    if (e.kind !== "weapon") return false;
    if (e.weapon_category === "Martial") return hasMartial;
    if (e.weapon_category === "Simple") return hasSimple;
    return false;
  });

  return [...packs, ...armor.slice(0, 8), ...weapons.slice(0, 14)];
}

function defaultGearForClass(classId: string): string[] {
  const picks: Record<string, string[]> = {
    wizard: ["dagger", "component-pouch", "scholars-pack"],
    fighter: ["chain-mail", "shield", "longsword", "explorers-pack"],
  };
  return (picks[classId] ?? []).filter((index) =>
    equipment.some((e) => e.index === index),
  );
}

function combinedLanguageOptions(
  race: DnDRace | undefined,
  subraceId?: string,
): LanguageOptions | null {
  if (!race) return null;
  const subrace = subraceId
    ? race.subraces.find((s) => s.id === subraceId)
    : undefined;
  const parts = [race.language_options, subrace?.language_options].filter(
    (p): p is LanguageOptions => Boolean(p),
  );
  if (parts.length === 0) return null;
  const choose = parts.reduce((sum, p) => sum + p.choose, 0);
  if (parts.some((p) => p.options === "any")) {
    return { choose, options: "any" };
  }
  const options = Array.from(
    new Set(parts.flatMap((p) => (p.options === "any" ? [] : p.options))),
  );
  return { choose, options };
}

function racialTraitSkillNames(
  race: DnDRace | undefined,
  subraceId?: string,
): string[] {
  if (!race) return [];
  const traits = [
    ...race.traits,
    ...(subraceId
      ? (race.subraces.find((s) => s.id === subraceId)?.traits ?? [])
      : []),
  ];
  const out: string[] = [];
  for (const trait of traits) {
    for (const prof of trait.proficiencies ?? []) {
      const skill = getSkill(prof);
      if (skill && !out.some((n) => n.toLowerCase() === skill.name.toLowerCase())) {
        out.push(skill.name);
      }
    }
  }
  return out;
}

export function CreateWizard({ onCancel, onCreated }: CreateWizardProps) {
  const create = useCharacterStore((s) => s.createCharacter);

  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Identity
  const [name, setName] = useState("");
  const [alignment, setAlignment] = useState("");

  // Race
  const [raceId, setRaceId] = useState(races[0]?.id ?? "human");
  const [subraceId, setSubraceId] = useState<string | undefined>();
  const [draconicAncestry, setDraconicAncestry] = useState<string | undefined>();
  const [racialAbilityBonuses, setRacialAbilityBonuses] = useState<
    AbilityScore[]
  >([]);
  const [racialSkills, setRacialSkills] = useState<string[]>([]);
  const [racialLanguages, setRacialLanguages] = useState<string[]>([]);
  const [racialCantrip, setRacialCantrip] = useState<string | undefined>();

  // Class
  const [classId, setClassId] = useState(classes[0]?.id ?? "fighter");
  const [subclassId, setSubclassId] = useState<string | undefined>();
  const [classSkills, setClassSkills] = useState<string[]>([]);
  const [fightingStyle, setFightingStyle] = useState<string | undefined>();

  // Background
  const [backgroundMode, setBackgroundMode] = useState<"acolyte" | "custom">(
    "acolyte",
  );
  const [customBg, setCustomBg] = useState<CustomBackground>({
    name: "",
    skills: [],
    languages: [],
    feature: { name: "", summary: "" },
  });
  const [bgLanguages, setBgLanguages] = useState<string[]>([]);

  // Abilities
  const [abilityMethod, setAbilityMethod] = useState<AbilityMethod>("standard");
  const [abilities, setAbilities] = useState<AbilityScores>(() =>
    abilitiesForClass(classes[0]?.id ?? "fighter", "standard"),
  );

  // Details
  const [personality, setPersonality] = useState({
    traits: "",
    ideals: "",
    bonds: "",
    flaws: "",
  });
  const [selectedGear, setSelectedGear] = useState<string[]>([]);

  // Spells
  const [cantrips, setCantrips] = useState<string[]>([]);
  const [levelSpells, setLevelSpells] = useState<string[]>([]);
  const [preparedSpells, setPreparedSpells] = useState<string[]>([]);

  const race = getRace(raceId);
  const klass = getClass(classId);
  const background = getBackground("acolyte");
  const selectedSubrace = race?.subraces.find((s) => s.id === subraceId);
  const languageOptions = useMemo(
    () => combinedLanguageOptions(race, subraceId),
    [race, subraceId],
  );
  const traitSkills = useMemo(
    () => racialTraitSkillNames(race, subraceId),
    [race, subraceId],
  );
  const knownRaceLanguages = useMemo(() => {
    const set = new Set(
      [...(race?.languages ?? []), ...racialLanguages].map((l) =>
        l.toLowerCase(),
      ),
    );
    return set;
  }, [race, racialLanguages]);

  const racialCantripSpellOptions = useMemo(() => {
    const opts = selectedSubrace?.cantrip_options;
    if (!opts) return [] as Spell[];
    return getSpellsForClass(opts.spell_list).filter(
      (s) => s.level === opts.level,
    );
  }, [selectedSubrace]);

  const racialBonuses = useMemo(
    () => getRaceBonuses(raceId, subraceId),
    [raceId, subraceId],
  );

  const finalScores = useMemo(() => {
    const out = {} as Record<AbilityScore, number>;
    for (const a of ABILITY_SCORES) {
      out[a] =
        (abilities[a] ?? 8) +
        (racialBonuses[a] ?? 0) +
        racialAbilityBonuses.filter((x) => x === a).length;
    }
    return out;
  }, [abilities, racialBonuses, racialAbilityBonuses]);

  const casterAtOne = Boolean(klass && isCasterAtLevel(klass, 1));

  const visibleSteps = useMemo((): StepId[] => {
    return casterAtOne
      ? [...STEP_IDS]
      : STEP_IDS.filter((s): s is StepId => s !== "spells");
  }, [casterAtOne]);

  const currentStep = visibleSteps[stepIndex] ?? "identity";

  useEffect(() => {
    if (currentStep !== "details") return;
    setSelectedGear((prev) =>
      prev.length > 0 ? prev : defaultGearForClass(classId),
    );
  }, [currentStep, classId]);

  const spellLimits = useMemo(() => {
    if (!klass || !casterAtOne) {
      return { cantrips: 0, known: 0, prepared: 0, mode: "none" as const };
    }
    const sc = klass.spellcasting!;
    const cantripCount = cantripsKnownAtLevel(klass, 1);
    const known = spellsKnownAtLevel(klass, 1) ?? 0;
    const castingScore = castingAbilityScore(
      klass,
      abilities,
      raceId,
      subraceId,
      racialAbilityBonuses,
    );
    if (sc.spellbook) {
      return {
        cantrips: cantripCount,
        known,
        prepared: preparedSpellCapacity(klass, 1, castingScore),
        mode: "spellbook" as const,
      };
    }
    if (sc.preparation === "known") {
      return {
        cantrips: cantripCount,
        known,
        prepared: 0,
        mode: "known" as const,
      };
    }
    return {
      cantrips: cantripCount,
      known: 0,
      prepared: preparedSpellCapacity(klass, 1, castingScore),
      mode: "prepared" as const,
    };
  }, [
    klass,
    casterAtOne,
    abilities,
    raceId,
    subraceId,
    racialAbilityBonuses,
  ]);

  const classSpells = useMemo(
    () => (klass ? classSpellList(klass) : []),
    [klass],
  );
  // Racial cantrips (e.g. High Elf) are granted in addition to class cantrips.
  const cantripOptions = classSpells.filter(
    (s) => s.level === 0 && s.index !== racialCantrip,
  );
  const firstLevelOptions = classSpells.filter((s) => s.level === 1);

  function resetRaceExtras(nextRaceId: string) {
    const next = getRace(nextRaceId);
    setSubraceId(next?.subraces[0]?.id);
    setDraconicAncestry(undefined);
    setRacialAbilityBonuses([]);
    setRacialSkills([]);
    setRacialLanguages([]);
    setRacialCantrip(undefined);
  }

  function resetClassExtras(nextClassId: string) {
    const next = getClass(nextClassId);
    setSubclassId(
      next && next.subclass_unlock_level <= 1
        ? next.subclasses[0]?.id
        : undefined,
    );
    setClassSkills([]);
    setFightingStyle(undefined);
    setSelectedGear([]);
    setCantrips([]);
    setLevelSpells([]);
    setPreparedSpells([]);
    if (abilityMethod === "standard" || abilityMethod === "pointBuy") {
      setAbilities(abilitiesForClass(nextClassId, abilityMethod));
    }
  }

  function setMethod(method: AbilityMethod) {
    setAbilityMethod(method);
    setAbilities(abilitiesForClass(classId, method));
  }

  function setAbility(ability: AbilityScore, value: number) {
    setAbilities((prev) => ({ ...prev, [ability]: value }));
  }

  function assignStandardScore(ability: AbilityScore, score: number) {
    setAbilities((prev) => {
      const next = { ...prev };
      const current = next[ability];
      const donor = ABILITY_SCORES.find(
        (a) => a !== ability && next[a] === score,
      );
      if (donor) {
        next[donor] = current;
      }
      next[ability] = score;
      return next;
    });
  }

  function bumpPointBuy(ability: AbilityScore, delta: number) {
    const current = abilities[ability];
    const next = current + delta;
    if (next < 8 || next > 15) return;
    const trial = { ...abilities, [ability]: next };
    const check = validatePointBuy(trial);
    if (delta > 0 && check.total > 27) return;
    setAbilities(trial);
  }

  function validateStep(step: StepId): string | null {
    if (step === "identity") {
      if (!name.trim()) return "Enter a character name.";
      return null;
    }
    if (step === "race") {
      if (!race) return "Choose a race.";
      if (race.subraces.length > 0 && !subraceId) return "Choose a subrace.";
      if (race.draconic_ancestry_options?.length && !draconicAncestry) {
        return "Choose a draconic ancestry.";
      }
      if (race.ability_bonus_options) {
        if (racialAbilityBonuses.length !== race.ability_bonus_options.choose) {
          return `Choose ${race.ability_bonus_options.choose} ability bonuses.`;
        }
      }
      if (race.skill_choices) {
        if (racialSkills.length !== race.skill_choices.choose) {
          return `Choose ${race.skill_choices.choose} racial skills.`;
        }
      }
      if (languageOptions) {
        const n = languageOptions.choose;
        if (racialLanguages.length !== n) {
          return `Choose ${n} additional language${n === 1 ? "" : "s"}.`;
        }
      }
      if (selectedSubrace?.cantrip_options) {
        const n = selectedSubrace.cantrip_options.choose;
        if (!racialCantrip) {
          return `Choose ${n} racial cantrip${n === 1 ? "" : "s"}.`;
        }
      }
      return null;
    }
    if (step === "class") {
      if (!klass) return "Choose a class.";
      const need = klass.proficiencies.skills?.choose ?? 0;
      if (need > 0 && classSkills.length !== need) {
        return `Choose ${need} class skills.`;
      }
      if (klass.subclass_unlock_level <= 1 && !subclassId) {
        return "Choose a subclass.";
      }
      if (FIGHTING_STYLE_CLASSES.has(klass.id) && !fightingStyle) {
        return "Choose a Fighting Style.";
      }
      return null;
    }
    if (step === "background") {
      if (backgroundMode === "custom") {
        if (!customBg.name.trim()) return "Name your custom background.";
        if (customBg.skills.length !== 2) return "Pick 2 background skills.";
        if ((customBg.languages?.length ?? 0) < 1) {
          return "Pick at least 1 language for a custom background.";
        }
        if (!customBg.feature?.name.trim() || !customBg.feature.summary.trim()) {
          return "Add a feature name and description.";
        }
      } else if (background?.language_options) {
        const n = background.language_options.choose;
        if (bgLanguages.length !== n) {
          return `Acolyte chooses ${n} languages.`;
        }
      }
      return null;
    }
    if (step === "abilities") {
      if (abilityMethod === "standard") {
        const values = ABILITY_SCORES.map((a) => abilities[a]).sort(
          (a, b) => b - a,
        );
        const expected = [...STANDARD_ARRAY].sort((a, b) => b - a);
        if (values.some((v, i) => v !== expected[i])) {
          return `Assign each standard array score once (${STANDARD_ARRAY.join(", ")}).`;
        }
      }
      if (abilityMethod === "pointBuy") {
        const check = validatePointBuy(abilities);
        if (!check.valid) return check.errors[0] ?? "Invalid point buy.";
      }
      if (abilityMethod === "manual") {
        for (const a of ABILITY_SCORES) {
          if (abilities[a] < 1 || abilities[a] > 20) {
            return "Manual scores must be between 1 and 20.";
          }
        }
      }
      return null;
    }
    if (step === "spells" && klass && casterAtOne) {
      const classCantrips = cantrips.filter((c) => c !== racialCantrip);
      if (classCantrips.length !== spellLimits.cantrips) {
        return racialCantrip
          ? `Choose ${spellLimits.cantrips} class cantrips (racial cantrip is separate).`
          : `Choose ${spellLimits.cantrips} cantrips.`;
      }
      if (spellLimits.mode === "known" || spellLimits.mode === "spellbook") {
        if (levelSpells.length !== spellLimits.known) {
          return spellLimits.mode === "spellbook"
            ? `Add ${spellLimits.known} spells to your spellbook.`
            : `Choose ${spellLimits.known} spells known.`;
        }
      }
      if (spellLimits.mode === "prepared") {
        if (preparedSpells.length !== spellLimits.prepared) {
          return `Prepare ${spellLimits.prepared} spells (Wis mod + level, min 1).`;
        }
      }
      return null;
    }
    return null;
  }

  function goNext() {
    const err = validateStep(currentStep);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStepIndex((i) => Math.min(visibleSteps.length - 1, i + 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function buildDraft(): CharacterDraft {
    const languageChoices = [
      ...racialLanguages,
      ...(backgroundMode === "acolyte" ? bgLanguages : []),
    ];

    const gearInventory = selectedGear.map((index) => {
      const item = equipment.find((e) => e.index === index)!;
      return {
        index: item.index,
        name: item.name,
        quantity: item.bundle_quantity ?? 1,
        equipped: item.kind === "armor" || item.kind === "weapon",
      };
    });
    const bgKit =
      backgroundMode === "acolyte"
        ? (background?.equipment ?? []).map((e) => ({
            name: e.name,
            quantity: e.quantity,
          }))
        : [];
    const inventory = [...bgKit, ...gearInventory];

    const armorEquipped = selectedGear.find((index) => {
      const item = equipment.find((e) => e.index === index);
      return (
        item?.kind === "armor" && item.armor_category !== "Shield"
      );
    });
    const shieldEquipped = selectedGear.some((index) => {
      const item = equipment.find((e) => e.index === index);
      return item?.armor_category === "Shield";
    });
    const weapons = selectedGear.filter((index) => {
      const item = equipment.find((e) => e.index === index);
      return item?.kind === "weapon";
    });

    let knownSpells: string[] = [];
    let prepared: string[] = [];
    if (klass && casterAtOne) {
      if (spellLimits.mode === "known" || spellLimits.mode === "spellbook") {
        knownSpells = [...cantrips, ...levelSpells];
        if (spellLimits.mode === "spellbook" && preparedSpells.length) {
          prepared = [...preparedSpells];
        }
      } else if (spellLimits.mode === "prepared") {
        knownSpells = [...cantrips, ...preparedSpells];
        prepared = [...preparedSpells];
      }
    }

    return {
      name: name.trim(),
      alignment: alignment || undefined,
      raceId,
      subraceId:
        race && race.subraces.length > 0 ? subraceId : undefined,
      backgroundId: backgroundMode === "acolyte" ? "acolyte" : undefined,
      customBackground:
        backgroundMode === "custom"
          ? {
              ...customBg,
              name: customBg.name.trim(),
              feature: {
                name: customBg.feature?.name.trim() ?? "",
                summary: customBg.feature?.summary.trim() ?? "",
              },
            }
          : undefined,
      classId,
      subclassId:
        klass && klass.subclass_unlock_level <= 1 ? subclassId : undefined,
      abilities,
      abilityMethod,
      skillProficiencies: [...classSkills, ...racialSkills],
      languageChoices,
      otherChoices: {
        ...(draconicAncestry ? { draconicAncestry } : {}),
        ...(racialAbilityBonuses.length
          ? { racialAbilityBonuses }
          : {}),
        ...(racialCantrip ? { racialCantrip } : {}),
        ...(fightingStyle ? { fightingStyle } : {}),
      },
      knownSpells: racialCantrip
        ? Array.from(new Set([...knownSpells, racialCantrip]))
        : knownSpells,
      preparedSpells: prepared,
      inventory,
      armorEquipped,
      shieldEquipped,
      weapons,
      personality,
    };
  }

  function handleCreate() {
    for (const step of visibleSteps) {
      const err = validateStep(step);
      if (err) {
        setError(err);
        setStepIndex(visibleSteps.indexOf(step));
        return;
      }
    }
    try {
      const character = create(buildDraft());
      onCreated(character.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create character.");
    }
  }

  const pointBuy = validatePointBuy(abilities);
  const gearOptions = klass ? classRelevantGear(klass) : [];

  function renderSpellPicker(
    options: Spell[],
    selected: string[],
    onToggle: (index: string) => void,
    max: number,
    title: string,
  ) {
    return (
      <div>
        <div className={styles.chipRow} style={{ marginBottom: "0.55rem" }}>
          <span className={`${styles.chip} ${styles.chipAccent}`}>
            {title}: {selected.length}/{max}
          </span>
        </div>
        <div className={styles.spellList}>
          {options.map((spell) => {
            const on = selected.includes(spell.index);
            return (
              <label
                key={spell.index}
                className={styles.spellItem}
                data-selected={on}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && selected.length >= max}
                  onChange={() => onToggle(spell.index)}
                />
                <span>
                  <span className={styles.spellName}>{spell.name}</span>
                  <div className={styles.spellMeta}>
                    {spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} ·{" "}
                    {spell.school}
                  </div>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main className={`${styles.page} anim-fade-rise`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.brand}>
              SRD <span>Ledger</span>
            </h1>
            <p className={styles.subtitle}>Character creation · 5e 2014 SRD</p>
          </div>
          {onCancel ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </header>

        <ol className={styles.progress} aria-label="Creation progress">
          {visibleSteps.map((id, i) => (
            <li
              key={id}
              className={styles.progressItem}
              data-done={i < stepIndex}
              data-current={i === stepIndex}
            >
              <div className={styles.progressBar}>
                <div className={styles.progressBarFill} />
              </div>
              <span className={styles.progressLabel}>
                {STEP_LABELS[STEP_IDS.indexOf(id)]}
              </span>
            </li>
          ))}
        </ol>

        <section className={`panel ${styles.panel}`}>
          <div className={`panel-body ${styles.panelBody}`}>
            {currentStep === "identity" && (
              <>
                <div>
                  <h2 className={styles.stepTitle}>Identity</h2>
                  <p className={styles.stepLede}>
                    Name your adventurer. Alignment is optional flavor for the table.
                  </p>
                </div>
                <div className={styles.grid2}>
                  <label className="field">
                    <span>Character name</span>
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Mira Ashveil"
                      autoFocus
                    />
                  </label>
                  <label className="field">
                    <span>Alignment (optional)</span>
                    <select
                      className="select"
                      value={alignment}
                      onChange={(e) => setAlignment(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {ALIGNMENTS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            {currentStep === "race" && race && (
              <>
                <div>
                  <h2 className={styles.stepTitle}>Race</h2>
                  <p className={styles.stepLede}>
                    Pick a race (and subrace if any). Ability bonuses and traits are shown below.
                  </p>
                </div>
                <div className={styles.optionGrid}>
                  {races.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={styles.option}
                      data-selected={raceId === r.id}
                      onClick={() => {
                        setRaceId(r.id);
                        resetRaceExtras(r.id);
                      }}
                    >
                      <span className={styles.optionTitle}>{r.name}</span>
                      <span className={styles.optionMeta}>
                        Speed {r.speed} ft.
                        {r.darkvision ? ` · Darkvision ${r.darkvision}` : ""}
                      </span>
                    </button>
                  ))}
                </div>

                {race.subraces.length > 0 && (
                  <div>
                    <h3>Subrace</h3>
                    <div className={styles.optionGrid} style={{ marginTop: "0.55rem" }}>
                      {race.subraces.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={styles.option}
                          data-selected={subraceId === s.id}
                          onClick={() => {
                            setSubraceId(s.id);
                            setRacialLanguages([]);
                            setRacialCantrip(undefined);
                          }}
                        >
                          <span className={styles.optionTitle}>{s.name}</span>
                          <span className={styles.optionDesc}>{s.summary}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {race.draconic_ancestry_options && (
                  <div>
                    <h3>Draconic ancestry</h3>
                    <div className={styles.optionGrid} style={{ marginTop: "0.55rem" }}>
                      {race.draconic_ancestry_options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={styles.option}
                          data-selected={draconicAncestry === o.id}
                          onClick={() => setDraconicAncestry(o.id)}
                        >
                          <span className={styles.optionTitle}>{o.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {race.ability_bonus_options && (
                  <div>
                    <h3>
                      Ability bonuses (+1) — choose{" "}
                      {race.ability_bonus_options.choose}
                    </h3>
                    <div className={styles.checkGrid} style={{ marginTop: "0.55rem" }}>
                      {race.ability_bonus_options.options.map((opt) => {
                        const on = racialAbilityBonuses.includes(opt.ability);
                        return (
                          <label key={opt.ability} className="checkbox">
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={
                                !on &&
                                racialAbilityBonuses.length >=
                                  race.ability_bonus_options!.choose
                              }
                              onChange={() =>
                                setRacialAbilityBonuses((prev) =>
                                  toggleInList(
                                    prev,
                                    opt.ability,
                                    race.ability_bonus_options!.choose,
                                  ) as AbilityScore[],
                                )
                              }
                            />
                            {abilityLabel(opt.ability)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {race.skill_choices && (
                  <div>
                    <h3>
                      Racial skills — choose {race.skill_choices.choose}
                    </h3>
                    <div className={styles.checkGrid} style={{ marginTop: "0.55rem" }}>
                      {race.skill_choices.options.map((skill) => {
                        const on = racialSkills.includes(skill);
                        return (
                          <label key={skill} className="checkbox">
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={
                                !on &&
                                racialSkills.length >= race.skill_choices!.choose
                              }
                              onChange={() =>
                                setRacialSkills((prev) =>
                                  toggleInList(
                                    prev,
                                    skill,
                                    race.skill_choices!.choose,
                                  ),
                                )
                              }
                            />
                            {skill}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {languageOptions && (
                  <div>
                    <h3>
                      Extra languages — choose {languageOptions.choose}
                    </h3>
                    <div className={styles.checkGrid} style={{ marginTop: "0.55rem" }}>
                      {(languageOptions.options === "any"
                        ? COMMON_LANGUAGES
                        : languageOptions.options
                      )
                        .filter(
                          (lang) =>
                            !(race.languages ?? []).some(
                              (known) =>
                                known.toLowerCase() === lang.toLowerCase(),
                            ),
                        )
                        .map((lang) => {
                          const on = racialLanguages.includes(lang);
                          return (
                            <label key={lang} className="checkbox">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={
                                  !on &&
                                  racialLanguages.length >=
                                    languageOptions.choose
                                }
                                onChange={() =>
                                  setRacialLanguages((prev) =>
                                    toggleInList(
                                      prev,
                                      lang,
                                      languageOptions.choose,
                                    ),
                                  )
                                }
                              />
                              {lang}
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}

                {selectedSubrace?.cantrip_options && (
                  <div>
                    <h3>
                      Racial cantrip — choose{" "}
                      {selectedSubrace.cantrip_options.choose}
                    </h3>
                    <p className={styles.hint} style={{ margin: "0.35rem 0 0.55rem" }}>
                      From the {selectedSubrace.cantrip_options.spell_list}{" "}
                      spell list. Intelligence is your spellcasting ability.
                    </p>
                    <div className={styles.spellList}>
                      {racialCantripSpellOptions.map((spell) => {
                        const on = racialCantrip === spell.index;
                        return (
                          <label
                            key={spell.index}
                            className={styles.spellItem}
                            data-selected={on}
                          >
                            <input
                              type="radio"
                              name="racial-cantrip"
                              checked={on}
                              onChange={() => setRacialCantrip(spell.index)}
                            />
                            <span>
                              <span className={styles.spellName}>
                                {spell.name}
                              </span>
                              <div className={styles.spellMeta}>
                                Cantrip · {spell.school}
                              </div>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className={styles.chipRow}>
                    <span className={`${styles.chip} ${styles.chipAccent}`}>
                      Bonuses: {formatBonuses(racialBonuses) || "None fixed"}
                      {racialAbilityBonuses.length
                        ? ` · +1 ${racialAbilityBonuses.map((a) => abilityLabel(a).slice(0, 3)).join(", ")}`
                        : ""}
                    </span>
                  </div>
                  <div className={styles.traitList} style={{ marginTop: "0.75rem" }}>
                    {race.traits.map((t) => (
                      <div key={t.id} className={styles.trait}>
                        <div className={styles.traitName}>{t.name}</div>
                        <p className={styles.traitSummary}>{t.summary}</p>
                      </div>
                    ))}
                    {subraceId &&
                      race.subraces
                        .find((s) => s.id === subraceId)
                        ?.traits.map((t) => (
                          <div key={t.id} className={styles.trait}>
                            <div className={styles.traitName}>{t.name}</div>
                            <p className={styles.traitSummary}>{t.summary}</p>
                          </div>
                        ))}
                  </div>
                </div>
              </>
            )}

            {currentStep === "class" && klass && (
              <>
                <div>
                  <h2 className={styles.stepTitle}>Class</h2>
                  <p className={styles.stepLede}>
                    Choose a class, review hit die and saves, then pick starting skills.
                  </p>
                </div>
                <div className={styles.optionGrid}>
                  {classes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={styles.option}
                      data-selected={classId === c.id}
                      onClick={() => {
                        setClassId(c.id);
                        resetClassExtras(c.id);
                      }}
                    >
                      <span className={styles.optionTitle}>{c.name}</span>
                      <span className={styles.optionMeta}>
                        d{c.hit_die}
                        {c.spellcasting ? " · Caster" : ""}
                      </span>
                    </button>
                  ))}
                </div>

                <div className={styles.chipRow}>
                  <span className={styles.chip}>Hit die d{klass.hit_die}</span>
                  <span className={styles.chip}>
                    Saves{" "}
                    {klass.saving_throws
                      .map((s) => abilityLabel(s).slice(0, 3))
                      .join(", ")}
                  </span>
                  {klass.spellcasting ? (
                    <span className={`${styles.chip} ${styles.chipAccent}`}>
                      {klass.spellcasting.caster_type} caster ·{" "}
                      {klass.spellcasting.ability
                        ? abilityLabel(klass.spellcasting.ability)
                        : "—"}
                    </span>
                  ) : null}
                </div>

                {klass.subclass_unlock_level <= 1 && (
                  <div>
                    <h3>Subclass</h3>
                    <div className={styles.optionGrid} style={{ marginTop: "0.55rem" }}>
                      {klass.subclasses.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          className={styles.option}
                          data-selected={subclassId === sub.id}
                          onClick={() => setSubclassId(sub.id)}
                        >
                          <span className={styles.optionTitle}>
                            {sub.flavor ? `${sub.flavor}: ` : ""}
                            {sub.name}
                          </span>
                          <span className={styles.optionDesc}>{sub.summary}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {klass.proficiencies.skills && (
                  <div>
                    <h3>
                      Starting skills — choose{" "}
                      {klass.proficiencies.skills.choose}
                    </h3>
                    <p className={styles.hint} style={{ margin: "0.35rem 0 0.55rem" }}>
                      {klass.proficiencies.skills.desc}
                    </p>
                    <div className={styles.checkGrid}>
                      {klass.proficiencies.skills.options.map((skill) => {
                        const on = classSkills.includes(skill);
                        return (
                          <label key={skill} className="checkbox">
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={
                                !on &&
                                classSkills.length >=
                                  klass.proficiencies.skills!.choose
                              }
                              onChange={() =>
                                setClassSkills((prev) =>
                                  toggleInList(
                                    prev,
                                    skill,
                                    klass.proficiencies.skills!.choose,
                                  ),
                                )
                              }
                            />
                            {skill}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {FIGHTING_STYLE_CLASSES.has(klass.id) && (
                  <div>
                    <h3>Fighting Style — choose 1</h3>
                    <div className={styles.optionGrid} style={{ marginTop: "0.55rem" }}>
                      {FIGHTING_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          className={styles.option}
                          data-selected={fightingStyle === style.name}
                          onClick={() => setFightingStyle(style.name)}
                        >
                          <span className={styles.optionTitle}>{style.name}</span>
                          <span className={styles.optionDesc}>{style.summary}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(klass.features_by_level["1"] ?? []).length > 0 && (
                  <div className={styles.traitList}>
                    {(klass.features_by_level["1"] ?? []).map((f) => (
                      <div key={f.name} className={styles.trait}>
                        <div className={styles.traitName}>{f.name}</div>
                        <p className={styles.traitSummary}>{f.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {currentStep === "background" && (
              <>
                <div>
                  <h2 className={styles.stepTitle}>Background</h2>
                  <p className={styles.stepLede}>
                    SRD 5.1 includes Acolyte. You can also define a custom background.
                  </p>
                </div>
                <div className={styles.methodToggle}>
                  <button
                    type="button"
                    className={styles.methodBtn}
                    data-active={backgroundMode === "acolyte"}
                    onClick={() => setBackgroundMode("acolyte")}
                  >
                    Acolyte
                  </button>
                  <button
                    type="button"
                    className={styles.methodBtn}
                    data-active={backgroundMode === "custom"}
                    onClick={() => setBackgroundMode("custom")}
                  >
                    Custom
                  </button>
                </div>

                {backgroundMode === "acolyte" && background && (
                  <>
                    <div className={styles.chipRow}>
                      {background.skills.map((s) => (
                        <span key={s} className={`${styles.chip} ${styles.chipAccent}`}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className={styles.trait}>
                      <div className={styles.traitName}>
                        {background.feature.name}
                      </div>
                      <p className={styles.traitSummary}>
                        {background.feature.summary}
                      </p>
                    </div>
                    <div>
                      <h3>
                        Languages — choose{" "}
                        {background.language_options?.choose ?? 2}
                      </h3>
                      <div className={styles.checkGrid} style={{ marginTop: "0.55rem" }}>
                        {COMMON_LANGUAGES.filter(
                          (l) =>
                            l !== "Common" &&
                            !knownRaceLanguages.has(l.toLowerCase()),
                        ).map((lang) => {
                          const on = bgLanguages.includes(lang);
                          const max = background.language_options?.choose ?? 2;
                          return (
                            <label key={lang} className="checkbox">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={!on && bgLanguages.length >= max}
                                onChange={() =>
                                  setBgLanguages((prev) =>
                                    toggleInList(prev, lang, max),
                                  )
                                }
                              />
                              {lang}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {backgroundMode === "custom" && (
                  <div className={styles.grid2}>
                    <label className="field">
                      <span>Background name</span>
                      <input
                        className="input"
                        value={customBg.name}
                        onChange={(e) =>
                          setCustomBg((p) => ({ ...p, name: e.target.value }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Feature name</span>
                      <input
                        className="input"
                        value={customBg.feature?.name ?? ""}
                        onChange={(e) =>
                          setCustomBg((p) => ({
                            ...p,
                            feature: {
                              name: e.target.value,
                              summary: p.feature?.summary ?? "",
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="field" style={{ gridColumn: "1 / -1" }}>
                      <span>Feature description</span>
                      <textarea
                        className="textarea"
                        value={customBg.feature?.summary ?? ""}
                        onChange={(e) =>
                          setCustomBg((p) => ({
                            ...p,
                            feature: {
                              name: p.feature?.name ?? "",
                              summary: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <h3>Skills — choose 2</h3>
                      <div className={styles.checkGrid} style={{ marginTop: "0.55rem" }}>
                        {skills.map((skill) => {
                          const on = customBg.skills.includes(skill.name);
                          return (
                            <label key={skill.index} className="checkbox">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={!on && customBg.skills.length >= 2}
                                onChange={() =>
                                  setCustomBg((p) => ({
                                    ...p,
                                    skills: toggleInList(p.skills, skill.name, 2),
                                  }))
                                }
                              />
                              {skill.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <h3>Languages</h3>
                      <div className={styles.checkGrid} style={{ marginTop: "0.55rem" }}>
                        {COMMON_LANGUAGES.map((lang) => {
                          const on = (customBg.languages ?? []).includes(lang);
                          return (
                            <label key={lang} className="checkbox">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() =>
                                  setCustomBg((p) => ({
                                    ...p,
                                    languages: toggleInList(
                                      p.languages ?? [],
                                      lang,
                                    ),
                                  }))
                                }
                              />
                              {lang}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {currentStep === "abilities" && (
              <>
                <div>
                  <h2 className={styles.stepTitle}>Abilities</h2>
                  <p className={styles.stepLede}>
                    Assign base scores, then preview racial bonuses and final modifiers.
                  </p>
                </div>
                <div className={styles.methodToggle}>
                  {(
                    [
                      ["standard", "Standard Array"],
                      ["pointBuy", "Point Buy (27)"],
                      ["manual", "Manual"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={styles.methodBtn}
                      data-active={abilityMethod === id}
                      onClick={() => setMethod(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {abilityMethod === "pointBuy" && (
                  <p className={styles.hint}>
                    Points remaining:{" "}
                    <strong>{pointBuy.remaining}</strong> / 27 (spent{" "}
                    {pointBuy.total})
                  </p>
                )}

                <div className={styles.abilityRow}>
                  {ABILITY_SCORES.map((ability) => {
                    const base = abilities[ability];
                    const racial =
                      (racialBonuses[ability] ?? 0) +
                      racialAbilityBonuses.filter((a) => a === ability).length;
                    const final = finalScores[ability];
                    const mod = abilityModifier(final);
                    return (
                      <div key={ability} className={styles.abilityCard}>
                        <div>
                          <div className={styles.abilityName}>
                            {abilityLabel(ability)}
                          </div>
                          <div className={styles.abilityMeta}>
                            Base {base}
                            {racial ? ` · Racial +${racial}` : ""}
                          </div>
                        </div>
                        <div className={styles.abilityControls}>
                          {abilityMethod === "standard" && (
                            <select
                              className="select"
                              value={base}
                              onChange={(e) =>
                                assignStandardScore(ability, Number(e.target.value))
                              }
                              style={{ minWidth: "5rem" }}
                            >
                              {STANDARD_ARRAY.map((score) => (
                                <option key={score} value={score}>
                                  {score}
                                </option>
                              ))}
                            </select>
                          )}
                          {abilityMethod === "pointBuy" && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => bumpPointBuy(ability, -1)}
                                disabled={base <= 8}
                              >
                                −
                              </button>
                              <span className={styles.abilityValue}>{base}</span>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => bumpPointBuy(ability, 1)}
                                disabled={base >= 15 || pointBuy.remaining <= 0}
                              >
                                +
                              </button>
                            </>
                          )}
                          {abilityMethod === "manual" && (
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={20}
                              value={base}
                              onChange={(e) =>
                                setAbility(
                                  ability,
                                  Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                                )
                              }
                              style={{ width: "5rem" }}
                            />
                          )}
                        </div>
                        <div className={styles.finalScore}>
                          {final} ({formatModifier(mod)})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {currentStep === "details" && (
              <>
                <div>
                  <h2 className={styles.stepTitle}>Details</h2>
                  <p className={styles.stepLede}>
                    Optional personality notes, plus a quick pack of starting gear.
                  </p>
                </div>
                <div className={styles.grid2}>
                  {(
                    [
                      ["traits", "Traits"],
                      ["ideals", "Ideals"],
                      ["bonds", "Bonds"],
                      ["flaws", "Flaws"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="field">
                      <span>{label}</span>
                      <textarea
                        className="textarea"
                        value={personality[key]}
                        onChange={(e) =>
                          setPersonality((p) => ({ ...p, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                {klass && (
                  <div>
                    <h3>Starting equipment (quick-add)</h3>
                    <p className={styles.hint} style={{ margin: "0.35rem 0 0.55rem" }}>
                      Multi-select class-relevant weapons, armor, and packs.
                    </p>
                    <div className={styles.checkGrid}>
                      {gearOptions.map((item) => {
                        const on = selectedGear.includes(item.index);
                        return (
                          <label key={item.index} className="checkbox">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setSelectedGear((prev) =>
                                  toggleInList(prev, item.index),
                                )
                              }
                            />
                            {item.name}
                            <span className={styles.optionMeta}>
                              {" "}
                              · {item.kind}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {currentStep === "spells" && klass && casterAtOne && (
              <>
                <div>
                  <h2 className={styles.stepTitle}>Spells</h2>
                  <p className={styles.stepLede}>
                    {spellLimits.mode === "known" &&
                      "Pick cantrips and spells known from your class list."}
                    {spellLimits.mode === "spellbook" &&
                      "Pick cantrips and spellbook entries. You may also mark prepared spells (Int mod + level)."}
                    {spellLimits.mode === "prepared" &&
                      "Pick cantrips, then prepare spells from your full class list (ability mod + level, min 1)."}
                  </p>
                </div>

                {racialCantrip ? (
                  <p className={styles.hint}>
                    Racial cantrip already granted:{" "}
                    <strong>
                      {racialCantripSpellOptions.find(
                        (s) => s.index === racialCantrip,
                      )?.name ?? racialCantrip}
                    </strong>
                    . Pick {spellLimits.cantrips} additional class cantrips below.
                  </p>
                ) : null}

                {spellLimits.cantrips > 0 &&
                  renderSpellPicker(
                    cantripOptions,
                    cantrips.filter((c) => c !== racialCantrip),
                    (index) =>
                      setCantrips((prev) =>
                        toggleInList(
                          prev.filter((c) => c !== racialCantrip),
                          index,
                          spellLimits.cantrips,
                        ),
                      ),
                    spellLimits.cantrips,
                    racialCantrip ? "Class cantrips" : "Cantrips",
                  )}

                {(spellLimits.mode === "known" ||
                  spellLimits.mode === "spellbook") &&
                  spellLimits.known > 0 &&
                  renderSpellPicker(
                    firstLevelOptions,
                    levelSpells,
                    (index) =>
                      setLevelSpells((prev) =>
                        toggleInList(prev, index, spellLimits.known),
                      ),
                    spellLimits.known,
                    spellLimits.mode === "spellbook"
                      ? "Spellbook"
                      : "Spells known",
                  )}

                {spellLimits.mode === "spellbook" && (
                  <>
                    <p className={styles.hint}>
                      Prepared guidance: you can prepare up to{" "}
                      {spellLimits.prepared} spells after a long rest. Optionally
                      mark them now from your spellbook.
                    </p>
                    {renderSpellPicker(
                      firstLevelOptions.filter((s) =>
                        levelSpells.includes(s.index),
                      ),
                      preparedSpells,
                      (index) =>
                        setPreparedSpells((prev) =>
                          toggleInList(prev, index, spellLimits.prepared),
                        ),
                      spellLimits.prepared,
                      "Prepared (optional)",
                    )}
                  </>
                )}

                {spellLimits.mode === "prepared" &&
                  spellLimits.prepared > 0 &&
                  renderSpellPicker(
                    firstLevelOptions,
                    preparedSpells,
                    (index) =>
                      setPreparedSpells((prev) =>
                        toggleInList(prev, index, spellLimits.prepared),
                      ),
                    spellLimits.prepared,
                    "Prepared spells",
                  )}
              </>
            )}

            {currentStep === "review" && (
              <>
                <div>
                  <h2 className={styles.stepTitle}>Review</h2>
                  <p className={styles.stepLede}>
                    Confirm the ledger entry, then create your character.
                  </p>
                </div>
                <div className={styles.summary}>
                  <div className={styles.summaryBlock}>
                    <h3>{name.trim() || "Unnamed Adventurer"}</h3>
                    <p>
                      {[
                        race?.name,
                        subraceId &&
                          race?.subraces.find((s) => s.id === subraceId)?.name,
                        klass?.name,
                        "Level 1",
                        alignment || null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className={styles.summaryBlock}>
                    <h3>Background</h3>
                    <p>
                      {backgroundMode === "acolyte"
                        ? `Acolyte · ${(background?.skills ?? []).join(", ")}`
                        : `${customBg.name || "Custom"} · ${customBg.skills.join(", ")}`}
                    </p>
                  </div>
                  <div className={styles.summaryBlock}>
                    <h3>Abilities ({abilityMethod})</h3>
                    <p>
                      {ABILITY_SCORES.map(
                        (a) =>
                          `${abilityLabel(a).slice(0, 3)} ${finalScores[a]} (${formatModifier(abilityModifier(finalScores[a]))})`,
                      ).join(" · ")}
                    </p>
                  </div>
                  <div className={styles.summaryBlock}>
                    <h3>Skills</h3>
                    <p>
                      {[
                        ...classSkills,
                        ...racialSkills,
                        ...traitSkills,
                        ...(backgroundMode === "acolyte"
                          ? (background?.skills ?? [])
                          : customBg.skills),
                      ].join(", ") || "—"}
                    </p>
                  </div>
                  {fightingStyle ? (
                    <div className={styles.summaryBlock}>
                      <h3>Fighting Style</h3>
                      <p>{fightingStyle}</p>
                    </div>
                  ) : null}
                  <div className={styles.summaryBlock}>
                    <h3>Languages</h3>
                    <p>{languageChoices.join(", ") || "—"}</p>
                  </div>
                  {(casterAtOne || racialCantrip) && (
                    <div className={styles.summaryBlock}>
                      <h3>Spells</h3>
                      <p>
                        {casterAtOne
                          ? `Cantrips: ${cantrips.length}`
                          : null}
                        {racialCantrip
                          ? `${casterAtOne ? " · " : ""}Racial: ${
                              racialCantripSpellOptions.find(
                                (s) => s.index === racialCantrip,
                              )?.name ?? racialCantrip
                            }`
                          : ""}
                        {levelSpells.length
                          ? ` · Known/book: ${levelSpells.length}`
                          : ""}
                        {preparedSpells.length
                          ? ` · Prepared: ${preparedSpells.length}`
                          : ""}
                      </p>
                    </div>
                  )}
                  <div className={styles.summaryBlock}>
                    <h3>Gear</h3>
                    <p>
                      {selectedGear.length
                        ? selectedGear
                            .map(
                              (i) =>
                                equipment.find((e) => e.index === i)?.name ?? i,
                            )
                            .join(", ")
                        : "None selected (background kit still applies for Acolyte)."}
                    </p>
                  </div>
                </div>
              </>
            )}

            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </section>

        <footer className={styles.footer}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={goBack}
            disabled={stepIndex === 0}
          >
            Back
          </button>
          <div className={styles.footerRight}>
            {currentStep !== "review" ? (
              <button type="button" className="btn btn-primary" onClick={goNext}>
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-brass"
                onClick={handleCreate}
              >
                Create Character
              </button>
            )}
          </div>
        </footer>
      </div>
    </main>
  );
}

export default CreateWizard;
