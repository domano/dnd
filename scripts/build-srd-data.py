#!/usr/bin/env python3
"""Build compact SRD 2014 JSON data files from cached dnd5eapi.co responses."""

from __future__ import annotations

import json
import re
from pathlib import Path

API = Path("/tmp/dnd-api")
OUT = Path("/workspace/src/data")

ABILITY = {
    "str": "strength",
    "dex": "dexterity",
    "con": "constitution",
    "int": "intelligence",
    "wis": "wisdom",
    "cha": "charisma",
}

PRIMARY_ABILITIES = {
    "barbarian": ["strength"],
    "bard": ["charisma"],
    "cleric": ["wisdom"],
    "druid": ["wisdom"],
    "fighter": ["strength", "dexterity"],
    "monk": ["dexterity", "wisdom"],
    "paladin": ["strength", "charisma"],
    "ranger": ["dexterity", "wisdom"],
    "rogue": ["dexterity"],
    "sorcerer": ["charisma"],
    "warlock": ["charisma"],
    "wizard": ["intelligence"],
}

SUBCLASS_UNLOCK = {
    "barbarian": 3,
    "bard": 3,
    "cleric": 1,
    "druid": 2,
    "fighter": 3,
    "monk": 3,
    "paladin": 3,
    "ranger": 3,
    "rogue": 3,
    "sorcerer": 1,
    "warlock": 1,
    "wizard": 2,
}

# Spellcasting metadata not fully structured in the API
SPELLCASTING_META = {
    "bard": {
        "type": "full",
        "preparation": "known",
        "ritual": True,
        "spell_list": "bard",
        "focus": "musical instrument or arcane focus (component pouch also ok)",
    },
    "cleric": {
        "type": "full",
        "preparation": "prepared",
        "ritual": True,
        "spell_list": "cleric",
        "focus": "holy symbol",
    },
    "druid": {
        "type": "full",
        "preparation": "prepared",
        "ritual": True,
        "spell_list": "druid",
        "focus": "druidic focus",
    },
    "paladin": {
        "type": "half",
        "preparation": "prepared",
        "ritual": False,
        "spell_list": "paladin",
        "focus": "holy symbol",
        "starts_at_level": 2,
    },
    "ranger": {
        "type": "half",
        "preparation": "known",
        "ritual": False,
        "spell_list": "ranger",
        "starts_at_level": 2,
    },
    "sorcerer": {
        "type": "full",
        "preparation": "known",
        "ritual": False,
        "spell_list": "sorcerer",
        "focus": "arcane focus",
    },
    "warlock": {
        "type": "pact",
        "preparation": "known",
        "ritual": False,
        "spell_list": "warlock",
        "focus": "arcane focus",
    },
    "wizard": {
        "type": "full",
        "preparation": "prepared",
        "ritual": True,
        "spell_list": "wizard",
        "focus": "arcane focus",
        "spellbook": True,
    },
}

SKIP_FEATURE_NAME_RE = re.compile(
    r"^(Ability Score Improvement|"
    r".* Archetype feature|"
    r"Primal Path feature|"
    r"Bard College feature|"
    r"Divine Domain feature|"
    r"Druid Circle feature|"
    r"Martial Archetype feature|"
    r"Monastic Tradition feature|"
    r"Sacred Oath feature|"
    r"Ranger Archetype feature|"
    r"Roguish Archetype feature|"
    r"Sorcerous Origin feature|"
    r"Otherworldly Patron feature|"
    r"Arcane Tradition feature|"
    r".* improvement.*)$",
    re.I,
)


def load(path: Path):
    return json.loads(path.read_text())


def summarize(text: str, max_len: int = 320) -> str:
    text = re.sub(r"\s+", " ", (text or "").replace("\r", "")).strip()
    if len(text) <= max_len:
        return text
    # Prefer end at sentence boundary
    cut = text[: max_len + 1]
    for sep in (". ", "; ", "! ", "? "):
        idx = cut.rfind(sep)
        if idx >= 80:
            return cut[: idx + 1].strip()
    return cut.rsplit(" ", 1)[0].rstrip(",;:") + "…"


def feature_desc(index: str) -> tuple[str, str]:
    path = API / "features" / f"{index}.json"
    if not path.exists():
        return index, ""
    data = load(path)
    desc = " ".join(data.get("desc") or [])
    return data.get("name", index), summarize(desc)


def trait_desc(index: str) -> tuple[str, str, dict]:
    path = API / "traits" / f"{index}.json"
    if not path.exists():
        return index, "", {}
    data = load(path)
    desc = " ".join(data.get("desc") or [])
    extra: dict = {}
    if data.get("proficiencies"):
        extra["proficiencies"] = [p["name"].replace("Skill: ", "") for p in data["proficiencies"]]
    if data.get("proficiency_choices"):
        ch = data["proficiency_choices"]
        # API shape varies; normalize lightly
        if isinstance(ch, dict):
            choose = ch.get("choose")
            opts = []
            frm = ch.get("from", {})
            for o in frm.get("options", []):
                item = o.get("item") or {}
                if item.get("name"):
                    opts.append(item["name"].replace("Skill: ", ""))
            extra["proficiency_choices"] = {"choose": choose, "options": opts}
    return data.get("name", index), summarize(desc, 400), extra


def skill_name(prof_name: str) -> str:
    return prof_name.replace("Skill: ", "")


def categorize_proficiencies(profs: list[dict]) -> dict:
    armor, weapons, tools, other = [], [], [], []
    for p in profs:
        idx = p["index"]
        name = p["name"]
        if idx.startswith("saving-throw-"):
            continue
        if "armor" in idx or idx == "shields":
            armor.append(name)
        elif "weapon" in idx or idx.endswith("swords") or "crossbow" in idx or idx in {
            "longswords", "rapiers", "shortswords", "hand-crossbows", "longbows", "shortbows"
        }:
            weapons.append(name)
        elif "tools" in idx or "kit" in idx or "supplies" in idx or "instruments" in idx or "utensils" in idx:
            tools.append(name)
        elif idx.startswith("skill-"):
            continue
        else:
            # named weapons / tools without keyword
            if any(w in name.lower() for w in ("sword", "bow", "axe", "hammer", "dagger", "mace", "crossbow", "javelin")):
                weapons.append(name)
            elif any(w in name.lower() for w in ("tool", "kit", "supplies", "instrument", "utensil")):
                tools.append(name)
            else:
                other.append(name)
    return {
        "armor": armor,
        "weapons": weapons,
        "tools": tools,
        "other": other,
    }


def parse_proficiency_choices(choices: list[dict]) -> dict:
    skills = None
    tools = []
    other = []
    for ch in choices:
        desc = ch.get("desc") or ""
        opts = []
        for o in ch.get("from", {}).get("options", []):
            if o.get("option_type") == "reference" and o.get("item"):
                opts.append(o["item"]["name"])
            elif o.get("option_type") == "choice":
                # nested choice (monk tools)
                nested = o.get("choice", {})
                nested_opts = []
                for no in nested.get("from", {}).get("options", []):
                    if no.get("item"):
                        nested_opts.append(no["item"]["name"])
                opts.append({
                    "label": nested.get("desc") or o.get("desc") or "choice",
                    "choose": nested.get("choose", 1),
                    "options": nested_opts or None,
                    "from_category": (nested.get("from") or {}).get("equipment_category", {}).get("name")
                    if isinstance(nested.get("from"), dict) else None,
                })
            elif o.get("option_type") == "string":
                opts.append(o.get("string"))
            else:
                # equipment category reference style
                if "item" in o:
                    opts.append(o["item"].get("name"))
                elif "choice" in o:
                    opts.append(o["choice"].get("desc", "choice"))
        # Detect skills
        skill_opts = [skill_name(x) for x in opts if isinstance(x, str) and x.startswith("Skill:")]
        if skill_opts and skills is None:
            skills = {"choose": ch["choose"], "options": skill_opts, "desc": summarize(desc, 160)}
        elif any(isinstance(x, str) and x.startswith("Skill:") for x in opts):
            # secondary skill choice (rare)
            other.append({"choose": ch["choose"], "options": [skill_name(x) if isinstance(x, str) else x for x in opts], "desc": summarize(desc, 160)})
        else:
            entry = {
                "choose": ch["choose"],
                "desc": summarize(desc, 160),
                "options": opts,
            }
            if "instrument" in desc.lower() or "tool" in desc.lower() or "artisan" in desc.lower():
                tools.append(entry)
            else:
                other.append(entry)
    return {"skills": skills, "tools": tools, "other": other}


def slots_from_spellcasting(sc: dict | None) -> list[int] | None:
    if not sc:
        return None
    keys = [k for k in sc if k.startswith("spell_slots_level_")]
    if not keys:
        return None
    max_level = max(int(k.rsplit("_", 1)[1]) for k in keys)
    return [sc.get(f"spell_slots_level_{i}", 0) for i in range(1, max_level + 1)]


def pact_from_slots(slots: list[int] | None) -> dict | None:
    if not slots:
        return {"slot_level": 0, "slot_count": 0}
    for i, n in enumerate(slots, start=1):
        if n:
            return {"slot_level": i, "slot_count": n}
    return {"slot_level": 0, "slot_count": 0}


def build_level_progression(class_index: str, levels: list[dict], caster_type: str | None) -> dict:
    features_by_level: dict[str, list] = {}
    asi_levels = []
    spell_slots = []
    cantrips_known = []
    spells_known = []
    resources_by_level = []

    for lv in levels:
        level = lv["level"]
        feats = []
        for f in lv.get("features", []):
            name = f["name"]
            # Track ASI levels from feature names
            if name == "Ability Score Improvement" or name.startswith("Ability Score Improvement"):
                asi_levels.append(level)
            if SKIP_FEATURE_NAME_RE.match(name):
                continue
            fname, fdesc = feature_desc(f["index"])
            # Prefer API display name
            feats.append({"name": fname or name, "summary": fdesc})
        if feats:
            features_by_level[str(level)] = feats

        sc = lv.get("spellcasting")
        if sc:
            slots = slots_from_spellcasting(sc)
            if caster_type == "pact":
                spell_slots.append(pact_from_slots(slots))
            else:
                spell_slots.append(slots)
            if "cantrips_known" in sc:
                cantrips_known.append(sc["cantrips_known"])
            if "spells_known" in sc:
                spells_known.append(sc["spells_known"])
        elif caster_type:
            # non-casting levels for half casters
            if caster_type == "pact":
                spell_slots.append({"slot_level": 0, "slot_count": 0})
            elif caster_type in ("full", "half", "third"):
                # pad with empty slots once we know width later
                spell_slots.append(None)

        specific = lv.get("class_specific") or {}
        if specific:
            res = dict(specific)
            # Hoist identical creating_spell_slots tables off per-level rows
            if "creating_spell_slots" in res:
                del res["creating_spell_slots"]
            resources_by_level.append({"level": level, **res})

    # Normalize half-caster None slots to zero arrays matching max width
    if caster_type in ("full", "half", "third") and spell_slots:
        width = max((len(s) for s in spell_slots if isinstance(s, list)), default=0)
        spell_slots = [s if isinstance(s, list) else [0] * width for s in spell_slots]
        # trim trailing all-zero higher slots? keep as API provides

    # cantrips/spells arrays only if present for any level
    prog: dict = {
        "features_by_level": features_by_level,
        "asi_levels": asi_levels,
        "resources_by_level": resources_by_level,
    }
    if spell_slots and any(s not in (None, [], {"slot_level": 0, "slot_count": 0}) for s in spell_slots):
        prog["spell_slots"] = spell_slots
    if cantrips_known:
        # Align to 20 levels: fill missing early levels with previous/0
        aligned = []
        # Build map from levels that have spellcasting
        by_level = {}
        for lv in levels:
            sc = lv.get("spellcasting") or {}
            if "cantrips_known" in sc:
                by_level[lv["level"]] = sc["cantrips_known"]
        last = 0
        for i in range(1, 21):
            if i in by_level:
                last = by_level[i]
            aligned.append(last if by_level else 0)
        # If class starts cantrips later, keep 0 until first
        if by_level:
            first = min(by_level)
            aligned = [(by_level[i] if i in by_level else (by_level[max(l for l in by_level if l <= i)] if i >= first else 0)) for i in range(1, 21)]
        prog["cantrips_known"] = aligned
    if spells_known:
        by_level = {}
        for lv in levels:
            sc = lv.get("spellcasting") or {}
            if "spells_known" in sc:
                by_level[lv["level"]] = sc["spells_known"]
        if by_level:
            first = min(by_level)
            aligned = []
            last = 0
            for i in range(1, 21):
                if i in by_level:
                    last = by_level[i]
                aligned.append(last if i >= first else 0)
            prog["spells_known"] = aligned
    return prog


def build_subclass(sub_index: str) -> dict:
    data = load(API / f"subclass-{sub_index}.json")
    levels = load(API / f"subclass-levels-{sub_index}.json")
    features_by_level = {}
    for lv in levels:
        feats = []
        for f in lv.get("features", []):
            fname, fdesc = feature_desc(f["index"])
            feats.append({"name": fname or f["name"], "summary": fdesc})
        if feats:
            features_by_level[str(lv["level"])] = feats
    desc = " ".join(data.get("desc") or [])
    return {
        "id": data["index"],
        "name": data["name"],
        "flavor": data.get("subclass_flavor"),
        "summary": summarize(desc, 280),
        "features_by_level": features_by_level,
    }


def build_class(class_index: str) -> dict:
    data = load(API / f"class-{class_index}.json")
    levels = load(API / f"levels-{class_index}.json")
    meta = SPELLCASTING_META.get(class_index)
    caster_type = meta["type"] if meta else None

    profs = categorize_proficiencies(data.get("proficiencies", []))
    choices = parse_proficiency_choices(data.get("proficiency_choices", []))
    progression = build_level_progression(class_index, levels, caster_type)

    spellcasting = None
    if meta:
        ability = None
        if data.get("spellcasting"):
            ability = ABILITY[data["spellcasting"]["spellcasting_ability"]["index"]]
        spellcasting = {
            "ability": ability,
            "caster_type": meta["type"],
            "preparation": meta["preparation"],
            "ritual": meta["ritual"],
            "spell_list": meta["spell_list"],
            "starts_at_level": meta.get("starts_at_level", data.get("spellcasting", {}).get("level", 1)),
            "spellbook": meta.get("spellbook", False),
            "focus": meta.get("focus"),
        }

    subclasses = [build_subclass(s["index"]) for s in data.get("subclasses", [])]

    # Clean monk nested tool lists: API folds kits into artisan tools
    for tc in choices["tools"]:
        for opt in tc.get("options", []):
            if isinstance(opt, dict) and opt.get("options"):
                opt["options"] = [
                    o for o in opt["options"]
                    if o not in ("Disguise Kit", "Forgery Kit", "Thieves' Tools", "Navigator's Tools", "Poisoner's Kit")
                ]

    result = {
        "id": data["index"],
        "name": data["name"],
        "hit_die": data["hit_die"],
        "primary_abilities": PRIMARY_ABILITIES[class_index],
        "saving_throws": [ABILITY[s["index"]] for s in data.get("saving_throws", [])],
        "proficiencies": {
            "armor": profs["armor"],
            "weapons": profs["weapons"],
            "tools": profs["tools"],
            "skills": choices["skills"],
            "tool_choices": choices["tools"] or None,
            "other_choices": choices["other"] or None,
        },
        "spellcasting": spellcasting,
        "subclass_unlock_level": SUBCLASS_UNLOCK[class_index],
        "subclasses": subclasses,
        "asi_levels": progression["asi_levels"],
        "features_by_level": progression["features_by_level"],
        "resources_by_level": progression["resources_by_level"],
        "source": "SRD 5.1 (2014)",
    }

    # Sorcerer: store spell-slot conversion costs once
    if class_index == "sorcerer":
        for lv in levels:
            table = (lv.get("class_specific") or {}).get("creating_spell_slots")
            if table:
                result["sorcery_point_slot_costs"] = table
                break
    if "spell_slots" in progression:
        result["spell_slots"] = progression["spell_slots"]
    if "cantrips_known" in progression:
        result["cantrips_known"] = progression["cantrips_known"]
    if "spells_known" in progression:
        result["spells_known"] = progression["spells_known"]

    # Clean null tool_choices
    if result["proficiencies"]["tool_choices"] is None:
        del result["proficiencies"]["tool_choices"]
    if result["proficiencies"]["other_choices"] is None:
        del result["proficiencies"]["other_choices"]

    return result


def darkvision_range(traits: list[dict]) -> int | None:
    for t in traits:
        if t["index"] == "darkvision":
            name, desc, _ = trait_desc("darkvision")
            m = re.search(r"within (\d+) feet", desc)
            return int(m.group(1)) if m else 60
    return None


def build_traits(trait_refs: list[dict]) -> list[dict]:
    out = []
    for t in trait_refs:
        name, desc, extra = trait_desc(t["index"])
        entry = {"id": t["index"], "name": name, "summary": desc}
        entry.update(extra)
        out.append(entry)
    return out


def build_race(race_index: str) -> dict:
    data = load(API / f"race-{race_index}.json")
    ability_bonuses = [
        {"ability": ABILITY[b["ability_score"]["index"]], "bonus": b["bonus"]}
        for b in data.get("ability_bonuses", [])
    ]
    ability_bonus_options = None
    if data.get("ability_bonus_options"):
        opt = data["ability_bonus_options"]
        ability_bonus_options = {
            "choose": opt["choose"],
            "options": [
                {"ability": ABILITY[o["ability_score"]["index"]], "bonus": o["bonus"]}
                for o in opt.get("from", {}).get("options", [])
                if o.get("option_type") == "ability_bonus"
            ],
        }

    languages = [l["name"] for l in data.get("languages", [])]
    language_options = None
    if data.get("language_options"):
        lo = data["language_options"]
        opts = []
        frm = lo.get("from", {})
        if frm.get("option_set_type") == "options_array":
            for o in frm.get("options", []):
                if o.get("item"):
                    opts.append(o["item"]["name"])
        language_options = {
            "choose": lo["choose"],
            "options": opts or "any",  # resource_list => any language
        }

    traits = build_traits(data.get("traits", []))
    # skill versatility etc. may be in starting_proficiency_options or traits
    skill_choices = None
    if data.get("starting_proficiency_options"):
        spo = data["starting_proficiency_options"]
        opts = []
        for o in spo.get("from", {}).get("options", []):
            if o.get("item"):
                opts.append(skill_name(o["item"]["name"]))
        skill_choices = {"choose": spo["choose"], "options": opts}
    if skill_choices is None:
        for t in traits:
            pc = t.get("proficiency_choices")
            if pc and pc.get("options") and all(
                o in {
                    "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
                    "History", "Insight", "Intimidation", "Investigation", "Medicine",
                    "Nature", "Perception", "Performance", "Persuasion", "Religion",
                    "Sleight of Hand", "Stealth", "Survival",
                }
                for o in pc["options"]
            ):
                skill_choices = {"choose": pc["choose"], "options": pc["options"]}
                break

    starting_profs = [
        skill_name(p["name"]) if p["index"].startswith("skill-") else p["name"]
        for p in data.get("starting_proficiencies", [])
    ]

    subraces = []
    for sr in data.get("subraces", []):
        sdata = load(API / f"subrace-{sr['index']}.json")
        subraces.append({
            "id": sdata["index"],
            "name": sdata["name"],
            "summary": summarize(sdata.get("desc") or "", 220),
            "ability_bonuses": [
                {"ability": ABILITY[b["ability_score"]["index"]], "bonus": b["bonus"]}
                for b in sdata.get("ability_bonuses", [])
            ],
            "traits": build_traits(sdata.get("racial_traits", [])),
            "source": "SRD 5.1 (2014)",
        })

    # Dragonborn ancestry choices
    ancestry = None
    if race_index == "dragonborn":
        ancestry = []
        for t in sorted((API / "traits").glob("draconic-ancestry-*.json")):
            td = load(t)
            ancestry.append({
                "id": td["index"],
                "name": td["name"].replace("Draconic Ancestry (", "").rstrip(")"),
                "summary": summarize(" ".join(td.get("desc") or []), 200),
            })

    result = {
        "id": data["index"],
        "name": data["name"],
        "size": data.get("size"),
        "speed": data.get("speed"),
        "ability_bonuses": ability_bonuses,
        "ability_bonus_options": ability_bonus_options,
        "languages": languages,
        "language_options": language_options,
        "darkvision": darkvision_range(data.get("traits", [])),
        "traits": traits,
        "starting_proficiencies": starting_profs or None,
        "skill_choices": skill_choices,
        "age": summarize(data.get("age") or "", 160),
        "alignment": summarize(data.get("alignment") or "", 160),
        "size_description": summarize(data.get("size_description") or "", 120),
        "subraces": subraces,
        "source": "SRD 5.1 (2014)",
    }
    if ancestry:
        result["draconic_ancestry_options"] = ancestry
    # Drop nulls
    for k in list(result.keys()):
        if result[k] is None:
            del result[k]
    return result


def build_background(bg_index: str) -> dict:
    data = load(API / f"bg-{bg_index}.json")
    skills = []
    tools = []
    for p in data.get("starting_proficiencies", []):
        if p["index"].startswith("skill-"):
            skills.append(skill_name(p["name"]))
        else:
            tools.append(p["name"])

    language_options = None
    if data.get("language_options"):
        lo = data["language_options"]
        language_options = {
            "choose": lo["choose"],
            "options": "any",
        }

    equipment = []
    for e in data.get("starting_equipment", []):
        equipment.append({
            "name": e["equipment"]["name"],
            "quantity": e.get("quantity", 1),
        })
    equipment_choices = []
    for opt in data.get("starting_equipment_options", []):
        frm = opt.get("from", {})
        if frm.get("option_set_type") == "equipment_category":
            equipment_choices.append({
                "choose": opt["choose"],
                "from_category": frm["equipment_category"]["name"],
            })
        else:
            names = []
            for o in frm.get("options", []):
                if o.get("of"):
                    names.append(o["of"]["name"])
                elif o.get("item"):
                    names.append(o["item"]["name"])
            equipment_choices.append({"choose": opt["choose"], "options": names})

    feature = data.get("feature") or {}
    fdesc = " ".join(feature.get("desc") or [])

    def choice_list(key: str):
        block = data.get(key)
        if not block:
            return None
        opts = []
        for o in block.get("from", {}).get("options", []):
            if o.get("string"):
                opts.append(o["string"])
        return {"choose": block.get("choose", 1), "options": opts}

    return {
        "id": data["index"],
        "name": data["name"],
        "skills": skills,
        "tools": tools or None,
        "language_options": language_options,
        "feature": {
            "name": feature.get("name"),
            "summary": summarize(fdesc, 400),
        },
        "equipment": equipment,
        "equipment_choices": equipment_choices or None,
        "starting_gold": data.get("starting_gold"),
        "personality_traits": choice_list("personality_traits"),
        "ideals": choice_list("ideals"),
        "bonds": choice_list("bonds"),
        "flaws": choice_list("flaws"),
        "source": "SRD 5.1 (2014)",
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    classes = [
        build_class(c)
        for c in [
            "barbarian", "bard", "cleric", "druid", "fighter", "monk",
            "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
        ]
    ]
    (OUT / "classes.json").write_text(json.dumps(classes, indent=2, ensure_ascii=False) + "\n")

    races = [
        build_race(r)
        for r in [
            "dragonborn", "dwarf", "elf", "gnome", "half-elf",
            "half-orc", "halfling", "human", "tiefling",
        ]
    ]
    (OUT / "races.json").write_text(json.dumps(races, indent=2, ensure_ascii=False) + "\n")

    backgrounds = [build_background("acolyte")]
    (OUT / "backgrounds.json").write_text(json.dumps(backgrounds, indent=2, ensure_ascii=False) + "\n")

    # Stats
    subclass_count = sum(len(c["subclasses"]) for c in classes)
    subrace_count = sum(len(r.get("subraces", [])) for r in races)
    feature_entries = sum(
        len(feats) for c in classes for feats in c["features_by_level"].values()
    )
    print(f"classes: {len(classes)}")
    print(f"subclasses: {subclass_count}")
    print(f"races: {len(races)}")
    print(f"subraces: {subrace_count}")
    print(f"backgrounds: {len(backgrounds)}")
    print(f"class feature entries: {feature_entries}")
    for c in classes:
        print(f"  {c['name']}: HD d{c['hit_die']}, subclasses={len(c['subclasses'])}, asi={c['asi_levels']}, caster={c['spellcasting']['caster_type'] if c['spellcasting'] else None}")


if __name__ == "__main__":
    main()
