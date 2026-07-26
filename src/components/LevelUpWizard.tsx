import { useEffect, useId, useMemo, useState } from "react";
import { getClass, getFeat } from "../data";
import {
  abilityModifier,
  getFinalAbilityScores,
  totalLevel,
} from "../lib/rules";
import {
  cantripsKnownAtLevel,
  classSpellList,
  isCasterAtLevel,
  maxSpellLevelForClassLevel,
  preparedSpellCapacity,
  spellsKnownAtLevel,
} from "../lib/spellcasting";
import { useCharacterStore } from "../store/characterStore";
import type { Character } from "../types/character";
import type { AbilityScore, FeatureSummary, Spell } from "../types/dnd";
import { ABILITY_SCORES } from "../types/dnd";
import styles from "./LevelUpWizard.module.css";

export interface LevelUpWizardProps {
  open: boolean;
  character: Character;
  onClose: () => void;
  onComplete?: (characterId: string) => void;
}

type AsiMode = "asi" | "feat";
type AsiSplit = "plus2" | "plus1plus1";
type HpMode = "average" | "roll";

type FlowStep = "confirm" | "subclass" | "asi" | "spells" | "hp";

function abilityLabel(ability: AbilityScore): string {
  return ability.charAt(0).toUpperCase() + ability.slice(1);
}

function toggleInList(list: string[], value: string, max?: number): string[] {
  const has = list.includes(value);
  if (has) return list.filter((x) => x !== value);
  if (max != null && list.length >= max) return list;
  return [...list, value];
}

function featuresAtLevel(
  byLevel: Record<string, FeatureSummary[]>,
  level: number,
): FeatureSummary[] {
  return byLevel[String(level)] ?? [];
}

function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * sides);
}

export function LevelUpWizard({
  open,
  character,
  onClose,
  onComplete,
}: LevelUpWizardProps) {
  const titleId = useId();
  const levelUp = useCharacterStore((s) => s.levelUp);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const setActive = useCharacterStore((s) => s.setActive);

  const primary = character.classLevels[0];
  const currentLevel = primary?.level ?? totalLevel(character);
  const newLevel = currentLevel + 1;
  const klass = primary ? getClass(primary.classId) : undefined;

  const needsSubclass = Boolean(
    klass &&
      newLevel >= klass.subclass_unlock_level &&
      !primary?.subclassId,
  );
  const isAsiLevel = Boolean(klass?.asi_levels.includes(newLevel));

  const spellDelta = useMemo(() => {
    if (!klass || !isCasterAtLevel(klass, newLevel)) {
      return { cantrips: 0, known: 0, preparedHint: 0, mode: "none" as const };
    }
    const prevCaster = isCasterAtLevel(klass, currentLevel);
    const cantripsNext = cantripsKnownAtLevel(klass, newLevel);
    const cantripsPrev = prevCaster
      ? cantripsKnownAtLevel(klass, currentLevel)
      : 0;
    const knownNext = spellsKnownAtLevel(klass, newLevel) ?? 0;
    const knownPrev = prevCaster
      ? (spellsKnownAtLevel(klass, currentLevel) ?? 0)
      : 0;

    const scores = getFinalAbilityScores(character);
    const ability = klass.spellcasting?.ability;
    const castingScore = ability ? scores[ability] : 10;
    const preparedHint = preparedSpellCapacity(klass, newLevel, castingScore);

    const sc = klass.spellcasting!;
    let mode: "known" | "spellbook" | "prepared" | "none" = "none";
    if (sc.spellbook) mode = "spellbook";
    else if (sc.preparation === "known") mode = "known";
    else if (sc.preparation === "prepared") mode = "prepared";

    // Wizard: +2 spellbook spells each level
    let knownGain = Math.max(0, knownNext - knownPrev);
    if (mode === "spellbook" && prevCaster) knownGain = 2;
    if (mode === "spellbook" && !prevCaster) knownGain = knownNext;

    // Prepared casters don't force new "known" picks; they prepare from full list.
    // Still offer optional prepared picks for the new capacity delta.
    if (mode === "prepared") {
      return {
        cantrips: Math.max(0, cantripsNext - cantripsPrev),
        known: 0,
        preparedHint,
        preparedGain: Math.max(
          0,
          preparedHint -
            preparedSpellCapacity(
              klass,
              currentLevel,
              castingScore,
            ),
        ),
        mode,
      };
    }

    return {
      cantrips: Math.max(0, cantripsNext - cantripsPrev),
      known: knownGain,
      preparedHint,
      preparedGain: 0,
      mode,
    };
  }, [klass, newLevel, currentLevel, character]);

  const needsSpells =
    spellDelta.mode !== "none" &&
    (spellDelta.cantrips > 0 ||
      spellDelta.known > 0 ||
      (spellDelta.mode === "prepared" && (spellDelta.preparedGain ?? 0) > 0));

  const flowSteps = useMemo(() => {
    const steps: FlowStep[] = ["confirm"];
    if (needsSubclass) steps.push("subclass");
    if (isAsiLevel) steps.push("asi");
    if (needsSpells) steps.push("spells");
    steps.push("hp");
    return steps;
  }, [needsSubclass, isAsiLevel, needsSpells]);

  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [subclassId, setSubclassId] = useState<string | undefined>(
    primary?.subclassId,
  );
  const [asiMode, setAsiMode] = useState<AsiMode>("asi");
  const [asiSplit, setAsiSplit] = useState<AsiSplit>("plus2");
  const [asiA, setAsiA] = useState<AbilityScore>("strength");
  const [asiB, setAsiB] = useState<AbilityScore>("dexterity");
  const [featChoice, setFeatChoice] = useState<"grappler" | "custom">(
    "grappler",
  );
  const [customFeat, setCustomFeat] = useState({ name: "", desc: "" });

  const [newCantrips, setNewCantrips] = useState<string[]>([]);
  const [newSpells, setNewSpells] = useState<string[]>([]);
  const [newPrepared, setNewPrepared] = useState<string[]>([]);

  const [hpMode, setHpMode] = useState<HpMode>("average");
  const [hpRoll, setHpRoll] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setError(null);
    let initialSubclass = primary?.subclassId;
    if (
      !initialSubclass &&
      klass &&
      needsSubclass &&
      klass.subclasses.length === 1
    ) {
      initialSubclass = klass.subclasses[0]?.id;
    }
    setSubclassId(initialSubclass);
    setAsiMode("asi");
    setAsiSplit("plus2");
    setAsiA("strength");
    setAsiB("dexterity");
    setFeatChoice("grappler");
    setCustomFeat({ name: "", desc: "" });
    setNewCantrips([]);
    setNewSpells([]);
    setNewPrepared([]);
    setHpMode("average");
    setHpRoll(null);
  }, [open, character.id, primary?.subclassId, klass, needsSubclass]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const step = flowSteps[stepIndex] ?? "confirm";

  useEffect(() => {
    if (!open || !klass || !needsSubclass) return;
    if (step !== "subclass") return;
    if (subclassId) return;
    if (klass.subclasses.length === 1) {
      setSubclassId(klass.subclasses[0]?.id);
    }
  }, [open, step, klass, needsSubclass, subclassId]);

  if (!open || !primary || !klass) return null;

  if (currentLevel >= 20) {
    return (
      <div
        className={styles.backdrop}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={`${styles.modal} anim-drawer-in`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className={styles.header}>
            <div>
              <h2 id={titleId}>Level up</h2>
              <p className={styles.subtitle}>{character.name} is already level 20.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </header>
          <div className={styles.body}>
            <p className={styles.lede}>No further class levels remain in the SRD ladder.</p>
          </div>
          <footer className={styles.footer}>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </footer>
        </div>
      </div>
    );
  }

  const classFeatures = featuresAtLevel(klass.features_by_level, newLevel);
  const subclass =
    subclassId != null
      ? klass.subclasses.find((s) => s.id === subclassId)
      : undefined;
  const subclassFeatures = subclass
    ? featuresAtLevel(subclass.features_by_level, newLevel)
    : [];

  function futureSubclassLevels(sub: {
    features_by_level: Record<string, FeatureSummary[]>;
  }): number[] {
    return Object.keys(sub.features_by_level)
      .map(Number)
      .filter((lvl) => lvl > newLevel)
      .sort((a, b) => a - b);
  }

  const scores = getFinalAbilityScores(character);
  const conMod = abilityModifier(scores.constitution);
  const avgHp = Math.floor(klass.hit_die / 2) + 1;
  const maxSpellLevel = maxSpellLevelForClassLevel(klass, newLevel);
  const spellOptions = classSpellList(klass);
  const cantripOptions = spellOptions.filter(
    (s) => s.level === 0 && !character.spells.known.includes(s.index),
  );
  const leveledOptions = spellOptions.filter(
    (s) =>
      s.level >= 1 &&
      s.level <= maxSpellLevel &&
      !character.spells.known.includes(s.index),
  );

  const grappler = getFeat("grappler");

  function validate(): string | null {
    if (step === "subclass" && needsSubclass && !subclassId) {
      return "Choose a subclass.";
    }
    if (step === "asi" && isAsiLevel) {
      if (asiMode === "asi") {
        if (asiSplit === "plus1plus1" && asiA === asiB) {
          return "Choose two different abilities for +1/+1.";
        }
      } else if (featChoice === "custom") {
        if (!customFeat.name.trim() || !customFeat.desc.trim()) {
          return "Enter a custom feat name and description.";
        }
      }
    }
    if (step === "spells" && needsSpells) {
      if (newCantrips.length !== spellDelta.cantrips) {
        return `Choose ${spellDelta.cantrips} new cantrip${spellDelta.cantrips === 1 ? "" : "s"}.`;
      }
      if (
        (spellDelta.mode === "known" || spellDelta.mode === "spellbook") &&
        newSpells.length !== spellDelta.known
      ) {
        return `Choose ${spellDelta.known} new spell${spellDelta.known === 1 ? "" : "s"}.`;
      }
    }
    if (step === "hp") {
      if (hpMode === "roll" && hpRoll == null) {
        return "Roll hit points before applying.";
      }
    }
    return null;
  }

  function goNext() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (stepIndex >= flowSteps.length - 1) {
      applyLevelUp();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function applyLevelUp() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setActive(character.id);

    const patch: Parameters<typeof levelUp>[0] = {
      subclassId: needsSubclass ? subclassId : undefined,
      hpRoll: hpMode === "roll" && hpRoll != null ? hpRoll : undefined,
    };

    if (isAsiLevel) {
      if (asiMode === "asi") {
        const increases: Partial<Record<AbilityScore, number>> =
          asiSplit === "plus2"
            ? { [asiA]: 2 }
            : { [asiA]: 1, [asiB]: 1 };
        patch.asi = { mode: "asi", increases };
      } else if (featChoice === "grappler") {
        patch.asi = { mode: "feat", featIndex: "grappler" };
      } else {
        patch.asi = {
          mode: "feat",
          customFeat: {
            name: customFeat.name.trim(),
            desc: customFeat.desc.trim(),
          },
        };
      }
    }

    levelUp(patch);

    const addedKnown = [...newCantrips, ...newSpells, ...newPrepared];
    if (addedKnown.length > 0 || newPrepared.length > 0) {
      const latest = useCharacterStore.getState().characters.find(
        (c) => c.id === character.id,
      );
      if (latest) {
        const known = Array.from(
          new Set([...latest.spells.known, ...addedKnown]),
        );
        const prepared = Array.from(
          new Set([...latest.spells.prepared, ...newPrepared]),
        );
        updateCharacter(character.id, {
          spells: { ...latest.spells, known, prepared },
        });
      }
    }

    onComplete?.(character.id);
    onClose();
  }

  function renderSpellPicker(
    options: Spell[],
    selected: string[],
    onToggle: (index: string) => void,
    max: number,
    title: string,
  ) {
    if (max <= 0) return null;
    return (
      <div>
        <p className={styles.hint}>
          {title}: {selected.length}/{max}
        </p>
        {options.length === 0 ? (
          <p className={styles.hint}>No remaining spells on the class list.</p>
        ) : (
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
                    <strong>{spell.name}</strong>
                    <div className={styles.hint}>
                      {spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} ·{" "}
                      {spell.school}
                    </div>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const stepLabels: Record<FlowStep, string> = {
    confirm: "Features",
    subclass: "Subclass",
    asi: "ASI / Feat",
    spells: "Spells",
    hp: "Hit points",
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.modal} anim-drawer-in`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>Level up</h2>
            <p className={styles.subtitle}>
              {character.name} · {klass.name} {currentLevel} → {newLevel}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>

        <div className={styles.steps} aria-label="Level-up steps">
          {flowSteps.map((id, i) => (
            <span
              key={id}
              className={styles.stepChip}
              data-active={i === stepIndex}
              data-done={i < stepIndex}
            >
              {stepLabels[id]}
            </span>
          ))}
        </div>

        <div className={styles.body}>
          {step === "confirm" && (
            <>
              <p className={styles.lede}>
                Confirm advancement to level {newLevel}. New class
                {needsSubclass || subclass ? " and subclass" : ""} features at
                this level appear below.
              </p>
              {classFeatures.length === 0 && subclassFeatures.length === 0 ? (
                <p className={styles.hint}>
                  No named features unlock specifically at level {newLevel}
                  {isAsiLevel ? " (Ability Score Improvement)." : "."}
                </p>
              ) : (
                <div className={styles.featureList}>
                  {classFeatures.map((f) => (
                    <div key={`c-${f.name}`} className={styles.feature}>
                      <div className={styles.featureName}>{f.name}</div>
                      <p className={styles.featureSummary}>{f.summary}</p>
                    </div>
                  ))}
                  {subclassFeatures.map((f) => (
                    <div key={`s-${f.name}`} className={styles.feature}>
                      <div className={styles.featureName}>
                        {subclass?.name}: {f.name}
                      </div>
                      <p className={styles.featureSummary}>{f.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "subclass" && (
            <>
              <p className={styles.lede}>
                Level {klass.subclass_unlock_level} unlocks your subclass. Choose
                one SRD option
                {klass.subclasses.length === 1
                  ? " (pre-selected — only one SRD choice)."
                  : "."}
              </p>
              <div className={styles.optionGrid}>
                {klass.subclasses.map((sub) => {
                  const unlocks = featuresAtLevel(
                    sub.features_by_level,
                    newLevel,
                  );
                  const later = futureSubclassLevels(sub);
                  const selected = subclassId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      className={styles.option}
                      data-selected={selected}
                      aria-pressed={selected}
                      onClick={() => {
                        setSubclassId(sub.id);
                        setError(null);
                      }}
                    >
                      <span className={styles.optionTitle}>
                        {sub.flavor ? `${sub.flavor}: ` : ""}
                        {sub.name}
                        {selected ? " ✓" : ""}
                      </span>
                      <span className={styles.optionDesc}>{sub.summary}</span>
                      {unlocks.length > 0 ? (
                        <span className={styles.optionFeatures}>
                          <strong>At level {newLevel}:</strong>{" "}
                          {unlocks.map((f) => f.name).join(" · ")}
                        </span>
                      ) : (
                        <span className={styles.optionFeatures}>
                          No named features unlock at level {newLevel}.
                        </span>
                      )}
                      {later.length > 0 ? (
                        <span className={styles.optionFuture}>
                          Later features at levels {later.join(", ")}.
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === "asi" && (
            <>
              <p className={styles.lede}>
                Ability Score Improvement: take +2 to one score, +1 to two
                scores, or a feat.
              </p>
              <div className={styles.methodToggle}>
                <button
                  type="button"
                  className={styles.methodBtn}
                  data-active={asiMode === "asi"}
                  onClick={() => setAsiMode("asi")}
                >
                  ASI
                </button>
                <button
                  type="button"
                  className={styles.methodBtn}
                  data-active={asiMode === "feat"}
                  onClick={() => setAsiMode("feat")}
                >
                  Feat
                </button>
              </div>

              {asiMode === "asi" && (
                <>
                  <div className={styles.methodToggle}>
                    <button
                      type="button"
                      className={styles.methodBtn}
                      data-active={asiSplit === "plus2"}
                      onClick={() => setAsiSplit("plus2")}
                    >
                      +2 to one
                    </button>
                    <button
                      type="button"
                      className={styles.methodBtn}
                      data-active={asiSplit === "plus1plus1"}
                      onClick={() => setAsiSplit("plus1plus1")}
                    >
                      +1 / +1
                    </button>
                  </div>
                  <div className={styles.asiGrid}>
                    <label className="field">
                      <span>
                        {asiSplit === "plus2" ? "+2 ability" : "First +1"}
                      </span>
                      <select
                        className="select"
                        value={asiA}
                        onChange={(e) =>
                          setAsiA(e.target.value as AbilityScore)
                        }
                      >
                        {ABILITY_SCORES.map((a) => (
                          <option key={a} value={a}>
                            {abilityLabel(a)} ({scores[a]})
                          </option>
                        ))}
                      </select>
                    </label>
                    {asiSplit === "plus1plus1" && (
                      <label className="field">
                        <span>Second +1</span>
                        <select
                          className="select"
                          value={asiB}
                          onChange={(e) =>
                            setAsiB(e.target.value as AbilityScore)
                          }
                        >
                          {ABILITY_SCORES.map((a) => (
                            <option key={a} value={a}>
                              {abilityLabel(a)} ({scores[a]})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </>
              )}

              {asiMode === "feat" && (
                <>
                  <div className={styles.optionGrid}>
                    <button
                      type="button"
                      className={styles.option}
                      data-selected={featChoice === "grappler"}
                      onClick={() => setFeatChoice("grappler")}
                    >
                      <span className={styles.optionTitle}>
                        {grappler?.name ?? "Grappler"}
                      </span>
                      <span className={styles.optionDesc}>
                        {grappler?.description ?? "SRD feat."}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.option}
                      data-selected={featChoice === "custom"}
                      onClick={() => setFeatChoice("custom")}
                    >
                      <span className={styles.optionTitle}>Custom feat</span>
                      <span className={styles.optionDesc}>
                        Record a homebrew / non-SRD feat by name.
                      </span>
                    </button>
                  </div>
                  {featChoice === "custom" && (
                    <div className={styles.optionGrid}>
                      <label className="field">
                        <span>Feat name</span>
                        <input
                          className="input"
                          value={customFeat.name}
                          onChange={(e) =>
                            setCustomFeat((p) => ({
                              ...p,
                              name: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Description</span>
                        <textarea
                          className="textarea"
                          value={customFeat.desc}
                          onChange={(e) =>
                            setCustomFeat((p) => ({
                              ...p,
                              desc: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {step === "spells" && (
            <>
              <p className={styles.lede}>
                Spellcasting progression increased. Pick new cantrips
                {spellDelta.mode === "spellbook"
                  ? " and spellbook entries"
                  : spellDelta.mode === "known"
                    ? " and spells known"
                    : " and prepared spells"}{" "}
                from the {klass.name} list.
              </p>
              {renderSpellPicker(
                cantripOptions,
                newCantrips,
                (index) =>
                  setNewCantrips((prev) =>
                    toggleInList(prev, index, spellDelta.cantrips),
                  ),
                spellDelta.cantrips,
                "New cantrips",
              )}
              {(spellDelta.mode === "known" ||
                spellDelta.mode === "spellbook") &&
                renderSpellPicker(
                  leveledOptions,
                  newSpells,
                  (index) =>
                    setNewSpells((prev) =>
                      toggleInList(prev, index, spellDelta.known),
                    ),
                  spellDelta.known,
                  spellDelta.mode === "spellbook"
                    ? "New spellbook spells"
                    : "New spells known",
                )}
              {spellDelta.mode === "prepared" &&
                renderSpellPicker(
                  leveledOptions,
                  newPrepared,
                  (index) =>
                    setNewPrepared((prev) =>
                      toggleInList(
                        prev,
                        index,
                        spellDelta.preparedGain ?? 0,
                      ),
                    ),
                  spellDelta.preparedGain ?? 0,
                  `Additional prepared (capacity ${spellDelta.preparedHint})`,
                )}
              {spellDelta.mode === "prepared" &&
                (spellDelta.preparedGain ?? 0) === 0 &&
                spellDelta.cantrips === 0 && (
                  <p className={styles.hint}>
                    Prepared capacity is now {spellDelta.preparedHint}. Adjust
                    prepared spells on the sheet after resting.
                  </p>
                )}
            </>
          )}

          {step === "hp" && (
            <>
              <p className={styles.lede}>
                Gain hit points for level {newLevel}: average or roll d
                {klass.hit_die}, then add Constitution ({conMod >= 0 ? "+" : ""}
                {conMod}).
              </p>
              <div className={styles.methodToggle}>
                <button
                  type="button"
                  className={styles.methodBtn}
                  data-active={hpMode === "average"}
                  onClick={() => {
                    setHpMode("average");
                    setHpRoll(null);
                  }}
                >
                  Average ({avgHp})
                </button>
                <button
                  type="button"
                  className={styles.methodBtn}
                  data-active={hpMode === "roll"}
                  onClick={() => setHpMode("roll")}
                >
                  Roll d{klass.hit_die}
                </button>
              </div>
              {hpMode === "average" ? (
                <p className={styles.hpResult}>
                  +{avgHp + conMod} HP
                  <span className={styles.hint} style={{ display: "block", fontSize: "0.9rem", fontWeight: 500 }}>
                    ({avgHp} avg + {conMod} Con)
                  </span>
                </p>
              ) : (
                <div>
                  <button
                    type="button"
                    className="btn btn-brass"
                    onClick={() => setHpRoll(rollDie(klass.hit_die))}
                  >
                    {hpRoll == null ? "Roll" : "Reroll"}
                  </button>
                  {hpRoll != null && (
                    <p className={styles.hpResult} style={{ marginTop: "0.75rem" }}>
                      Rolled {hpRoll} → +{hpRoll + conMod} HP
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

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
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={goNext}
              disabled={Boolean(validate())}
            >
              {stepIndex >= flowSteps.length - 1 ? "Apply level up" : "Next"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LevelUpWizard;
