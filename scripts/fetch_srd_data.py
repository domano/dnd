#!/usr/bin/env python3
"""Fetch D&D 5e 2014 SRD data from dnd5eapi.co and write compact character-sheet JSON."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

BASE = "https://www.dnd5eapi.co/api/2014"
OUT = Path("/workspace/src/data")
TYPES = Path("/workspace/src/types")


def curl_json(url: str, retries: int = 3, allow_404: bool = False) -> Any:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            r = subprocess.run(
                ["curl", "-sSL", "-w", "\n%{http_code}", "--max-time", "60", url],
                capture_output=True,
                text=True,
                check=True,
            )
            body, _, code = r.stdout.rpartition("\n")
            if code == "404":
                if allow_404:
                    return None
                raise RuntimeError(f"404 {url}")
            if code != "200":
                raise RuntimeError(f"HTTP {code} for {url}")
            return json.loads(body)
        except (subprocess.CalledProcessError, json.JSONDecodeError, RuntimeError) as e:
            last_err = e
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def join_desc(desc: list[str] | None) -> str:
    if not desc:
        return ""
    return " ".join(d.strip() for d in desc if d and d.strip())


def concise(text: str, max_len: int = 600) -> str:
    text = " ".join(text.split())
    if len(text) <= max_len:
        return text
    cut = text[: max_len - 1].rsplit(" ", 1)[0]
    return cut + "…"


def cost_str(cost: dict | None) -> str | None:
    if not cost:
        return None
    return f"{cost.get('quantity', 0)} {cost.get('unit', 'gp')}"


def fetch_list(endpoint: str) -> list[dict]:
    data = curl_json(f"{BASE}/{endpoint}")
    return data.get("results", [])


def fetch_all_details(
    endpoint: str, indexes: list[str], label: str, allow_404: bool = False
) -> list[dict]:
    items: list[dict] = []
    total = len(indexes)
    for i, idx in enumerate(indexes, 1):
        data = curl_json(f"{BASE}/{endpoint}/{idx}", allow_404=allow_404)
        if data is not None:
            items.append(data)
        if i % 40 == 0 or i == total:
            print(f"  {label}: {i}/{total}", flush=True)
    return items


# --- Spells ---

def transform_spell(s: dict) -> dict:
    components = [c.lower() for c in s.get("components") or []]
    damage = None
    if s.get("damage"):
        dmg = s["damage"]
        damage = {
            "type": (dmg.get("damage_type") or {}).get("name"),
        }
        if dmg.get("damage_at_slot_level"):
            damage["at_slot_level"] = dmg["damage_at_slot_level"]
        if dmg.get("damage_at_character_level"):
            damage["at_character_level"] = dmg["damage_at_character_level"]

    out: dict[str, Any] = {
        "index": s["index"],
        "name": s["name"],
        "level": s.get("level", 0),
        "school": (s.get("school") or {}).get("name", ""),
        "casting_time": s.get("casting_time", ""),
        "range": s.get("range", ""),
        "components": {
            "v": "v" in components,
            "s": "s" in components,
            "m": "m" in components,
            "material": s.get("material"),
        },
        "duration": s.get("duration", ""),
        "concentration": bool(s.get("concentration")),
        "ritual": bool(s.get("ritual")),
        "description": concise(join_desc(s.get("desc")), 700),
        "higher_level": join_desc(s.get("higher_level")) or None,
        "classes": [c["name"] for c in s.get("classes") or []],
        "damage": damage,
    }
    if s.get("dc"):
        out["dc"] = {
            "ability": (s["dc"].get("dc_type") or {}).get("name"),
            "success": s["dc"].get("dc_success"),
        }
    if s.get("area_of_effect"):
        out["area_of_effect"] = s["area_of_effect"]
    if s.get("attack_type"):
        out["attack_type"] = s["attack_type"]
    return out


def build_spells() -> list[dict]:
    print("Fetching spells…")
    indexes = [r["index"] for r in fetch_list("spells")]
    raw = fetch_all_details("spells", indexes, "spells")
    spells = [transform_spell(s) for s in raw]
    spells.sort(key=lambda x: (x["level"], x["name"]))
    return spells


# --- Feats ---

def transform_feat(f: dict) -> dict:
    prereqs: list[str] = []
    for p in f.get("prerequisites") or []:
        if "ability_score" in p:
            ab = p["ability_score"].get("name", "")
            prereqs.append(f"{ab} {p.get('minimum_score', '')}+".strip())
        elif "type" in p:
            prereqs.append(str(p.get("name") or p["type"]))
        else:
            prereqs.append(json.dumps(p, separators=(",", ":")))
    return {
        "index": f["index"],
        "name": f["name"],
        "description": join_desc(f.get("desc")),
        "prerequisites": prereqs,
    }


def build_feats() -> list[dict]:
    print("Fetching feats…")
    indexes = [r["index"] for r in fetch_list("feats")]
    raw = fetch_all_details("feats", indexes, "feats")
    return [transform_feat(f) for f in raw]


# --- Skills ---

def build_skills() -> list[dict]:
    print("Fetching skills…")
    indexes = [r["index"] for r in fetch_list("skills")]
    raw = fetch_all_details("skills", indexes, "skills")
    skills = []
    for s in raw:
        skills.append(
            {
                "index": s["index"],
                "name": s["name"],
                "ability": (s.get("ability_score") or {}).get("index", "").upper(),
                "ability_name": (s.get("ability_score") or {}).get("name", ""),
                "description": concise(join_desc(s.get("desc")), 400),
            }
        )
    skills.sort(key=lambda x: x["name"])
    return skills


# --- Conditions ---

def build_conditions() -> list[dict]:
    print("Fetching conditions…")
    indexes = [r["index"] for r in fetch_list("conditions")]
    raw = fetch_all_details("conditions", indexes, "conditions")
    out = []
    for c in raw:
        # Keep bullet structure as array for clarity on character sheet
        desc = [d.strip() for d in (c.get("desc") or []) if d and d.strip()]
        out.append({"index": c["index"], "name": c["name"], "description": desc})
    out.sort(key=lambda x: x["name"])
    return out


# --- Equipment ---

CORE_ARMOR = {
    "padded-armor",
    "leather-armor",
    "studded-leather-armor",
    "hide-armor",
    "chain-shirt",
    "scale-mail",
    "breastplate",
    "half-plate-armor",
    "ring-mail",
    "chain-mail",
    "splint-armor",
    "plate-armor",
    "shield",
}

COMMON_GEAR = {
    "abacus",
    "backpack",
    "ball-bearings-bag-of-1000",
    "barrel",
    "basket",
    "bedroll",
    "bell",
    "blanket",
    "block-and-tackle",
    "book",
    "bottle-glass",
    "bucket",
    "caltrops-bag-of-20",
    "candle",
    "case-crossbow-bolt",
    "case-map-or-scroll",
    "chain-10-feet",
    "chalk-1-piece",
    "chest",
    "climbers-kit",
    "clothes-common",
    "clothes-costume",
    "clothes-fine",
    "clothes-travelers",
    "component-pouch",
    "crowbar",
    "flask-or-tankard",
    "grappling-hook",
    "hammer",
    "hammer-sledge",
    "healers-kit",
    "holy-water-flask",
    "hourglass",
    "hunting-trap",
    "ink-1-ounce-bottle",
    "ink-pen",
    "jug-or-pitcher",
    "ladder-10-foot",
    "lamp",
    "lantern-bullseye",
    "lantern-hooded",
    "lock",
    "magnifying-glass",
    "manacles",
    "mess-kit",
    "mirror-steel",
    "oil-flask",
    "paper-one-sheet",
    "parchment-one-sheet",
    "perfume-vial",
    "pick-miners",
    "piton",
    "poison-basic-vial",
    "pole-10-foot",
    "pot-iron",
    "potion-of-healing",
    "pouch",
    "quiver",
    "ram-portable",
    "rations-1-day",
    "robes",
    "rope-hempen-50-feet",
    "rope-silk-50-feet",
    "sack",
    "scale-merchants",
    "sealing-wax",
    "signal-whistle",
    "signet-ring",
    "soap",
    "spellbook",
    "spikes-iron-10",
    "spyglass",
    "tent-two-person",
    "tinderbox",
    "torch",
    "vial",
    "waterskin",
    "whetstone",
    # ammunition
    "arrow",
    "blowgun-needle",
    "crossbow-bolt",
    "sling-bullet",
    # foci / symbols
    "crystal",
    "orb",
    "rod",
    "staff",
    "wand",
    "sprig-of-mistletoe",
    "totem",
    "wooden-staff",
    "yew-wand",
    "amulet",
    "emblem",
    "reliquary",
}


def armor_ac_formula(ac: dict, category: str) -> str:
    base = ac.get("base", 10)
    if category == "Shield":
        return f"+{base}"
    if not ac.get("dex_bonus", True):
        return str(base)
    max_bonus = ac.get("max_bonus")
    if max_bonus is not None:
        return f"{base} + Dex (max {max_bonus})"
    return f"{base} + Dex"


def transform_equipment(e: dict) -> dict | None:
    cat = (e.get("equipment_category") or {}).get("index", "")
    idx = e["index"]
    base: dict[str, Any] = {
        "index": idx,
        "name": e["name"],
        "category": cat,
        "cost": cost_str(e.get("cost")),
        "weight": e.get("weight"),
    }

    if cat == "weapon" or e.get("weapon_category"):
        base["kind"] = "weapon"
        base["weapon_category"] = e.get("weapon_category")
        base["weapon_range"] = e.get("weapon_range")
        if e.get("damage"):
            base["damage"] = {
                "dice": e["damage"].get("damage_dice"),
                "type": (e["damage"].get("damage_type") or {}).get("name"),
            }
        if e.get("two_handed_damage"):
            base["two_handed_damage"] = {
                "dice": e["two_handed_damage"].get("damage_dice"),
                "type": (e["two_handed_damage"].get("damage_type") or {}).get("name"),
            }
        if e.get("range"):
            base["range"] = e["range"]
        if e.get("throw_range"):
            base["throw_range"] = e["throw_range"]
        base["properties"] = [p["name"] for p in e.get("properties") or []]
        if e.get("special"):
            base["special"] = join_desc(e["special"]) if isinstance(e["special"], list) else e["special"]
        return base

    if cat == "armor" or e.get("armor_category"):
        if idx not in CORE_ARMOR:
            return None
        ac = e.get("armor_class") or {}
        category = e.get("armor_category", "")
        base["kind"] = "armor"
        base["armor_category"] = category
        base["armor_class"] = {
            "base": ac.get("base"),
            "dex_bonus": ac.get("dex_bonus", False),
            "max_bonus": ac.get("max_bonus"),
            "formula": armor_ac_formula(ac, category),
        }
        base["str_minimum"] = e.get("str_minimum", 0)
        base["stealth_disadvantage"] = bool(e.get("stealth_disadvantage"))
        return base

    gear_cat = (e.get("gear_category") or {}).get("index", "")
    if gear_cat == "equipment-packs" or (e.get("contents") and cat == "adventuring-gear"):
        # packs
        if e.get("contents"):
            base["kind"] = "pack"
            base["contents"] = [
                {"index": c["item"]["index"], "name": c["item"]["name"], "quantity": c.get("quantity", 1)}
                for c in e.get("contents") or []
            ]
            return base

    # Remaining fetched items are mundane gear/tools/foci/ammo
    if cat in {"adventuring-gear", "tools"} or gear_cat or idx in COMMON_GEAR:
        base["kind"] = "gear"
        if gear_cat:
            base["gear_category"] = gear_cat
        if e.get("desc"):
            base["description"] = concise(join_desc(e["desc"]), 300)
        if e.get("quantity"):
            base["bundle_quantity"] = e["quantity"]
        return base

    return None


def build_equipment() -> list[dict]:
    print("Fetching equipment indexes…")
    # Only indexes that exist under /equipment (excludes magic items miscategorized in weapon/armor lists)
    all_eq = {r["index"] for r in fetch_list("equipment")}

    weapon_set = {
        i["index"]
        for i in curl_json(f"{BASE}/equipment-categories/weapon").get("equipment") or []
    } & all_eq
    pack_set = {
        i["index"]
        for i in curl_json(f"{BASE}/equipment-categories/equipment-packs").get("equipment") or []
    } & all_eq

    # Extra categories useful on a character sheet
    extra: set[str] = set()
    for cat in (
        "adventuring-gear",
        "ammunition",
        "arcane-foci",
        "druidic-foci",
        "holy-symbols",
        "kits",
        "standard-gear",
    ):
        data = curl_json(f"{BASE}/equipment-categories/{cat}")
        for item in data.get("equipment") or []:
            if item["index"] in all_eq:
                extra.add(item["index"])

    indexes = sorted((weapon_set | pack_set | (CORE_ARMOR & all_eq) | (COMMON_GEAR & all_eq) | extra))

    print(f"Fetching {len(indexes)} equipment items…")
    raw = fetch_all_details("equipment", indexes, "equipment", allow_404=True)
    items: list[dict] = []
    for e in raw:
        t = transform_equipment(e)
        if t:
            items.append(t)
    kind_order = {"weapon": 0, "armor": 1, "pack": 2, "gear": 3}
    items.sort(key=lambda x: (kind_order.get(x.get("kind", ""), 9), x["name"]))
    return items


# --- Reference tables ---

def slots_from_spellcasting(sc: dict | None, max_level: int = 9) -> list[int]:
    if not sc:
        return [0] * max_level
    return [sc.get(f"spell_slots_level_{i}", 0) or 0 for i in range(1, max_level + 1)]


def build_reference() -> dict:
    print("Building reference tables…")
    # Proficiency & XP from SRD
    proficiency_bonus = {str(lvl): 2 + ((lvl - 1) // 4) for lvl in range(1, 21)}

    ability_modifiers = {}
    for score in range(1, 31):
        ability_modifiers[str(score)] = (score - 10) // 2

    xp_thresholds = {
        "1": 0,
        "2": 300,
        "3": 900,
        "4": 2700,
        "5": 6500,
        "6": 14000,
        "7": 23000,
        "8": 34000,
        "9": 48000,
        "10": 64000,
        "11": 85000,
        "12": 100000,
        "13": 120000,
        "14": 140000,
        "15": 165000,
        "16": 195000,
        "17": 225000,
        "18": 265000,
        "19": 305000,
        "20": 355000,
    }

    multiclass_prerequisites = {
        "Barbarian": "Strength 13",
        "Bard": "Charisma 13",
        "Cleric": "Wisdom 13",
        "Druid": "Wisdom 13",
        "Fighter": "Strength 13 or Dexterity 13",
        "Monk": "Dexterity 13 and Wisdom 13",
        "Paladin": "Strength 13 and Charisma 13",
        "Ranger": "Dexterity 13 and Wisdom 13",
        "Rogue": "Dexterity 13",
        "Sorcerer": "Charisma 13",
        "Warlock": "Charisma 13",
        "Wizard": "Intelligence 13",
        "notes": (
            "To multiclass into or out of a class, you must meet that class's prerequisite ability score(s). "
            "You gain proficiency per the multiclassing rules; spellcasting uses multiclass caster level rules."
        ),
    }

    # Pull slot tables from API for representative casters
    full_caster = curl_json(f"{BASE}/classes/wizard/levels")
    half_caster = curl_json(f"{BASE}/classes/paladin/levels")
    third_caster = curl_json(f"{BASE}/classes/fighter/levels")  # EK starts at 3; use Arcane Trickster/EK pattern
    # Fighter doesn't have base spellcasting — use SRD table for 1/3 casters manually if missing
    warlock = curl_json(f"{BASE}/classes/warlock/levels")

    # Eldritch Knight levels for third caster
    # The base fighter levels don't include spell slots; encode standard 1/3 caster table
    third_slots_by_level = {
        # level: [1st..5th] — EK/AT start casting at class level 3
        1: [0, 0, 0, 0, 0],
        2: [0, 0, 0, 0, 0],
        3: [2, 0, 0, 0, 0],
        4: [3, 0, 0, 0, 0],
        5: [3, 0, 0, 0, 0],
        6: [3, 0, 0, 0, 0],
        7: [4, 2, 0, 0, 0],
        8: [4, 2, 0, 0, 0],
        9: [4, 2, 0, 0, 0],
        10: [4, 3, 0, 0, 0],
        11: [4, 3, 0, 0, 0],
        12: [4, 3, 0, 0, 0],
        13: [4, 3, 2, 0, 0],
        14: [4, 3, 2, 0, 0],
        15: [4, 3, 2, 0, 0],
        16: [4, 3, 3, 0, 0],
        17: [4, 3, 3, 0, 0],
        18: [4, 3, 3, 0, 0],
        19: [4, 3, 3, 1, 0],
        20: [4, 3, 3, 1, 0],
    }

    full_slots = {}
    for row in full_caster:
        lvl = row["level"]
        full_slots[str(lvl)] = slots_from_spellcasting(row.get("spellcasting"), 9)

    half_slots = {}
    for row in half_caster:
        lvl = row["level"]
        sc = row.get("spellcasting")
        if sc:
            half_slots[str(lvl)] = slots_from_spellcasting(sc, 5)
        else:
            half_slots[str(lvl)] = [0, 0, 0, 0, 0]

    warlock_pact = {}
    for row in warlock:
        lvl = row["level"]
        sc = row.get("spellcasting") or {}
        # Warlock: slots appear at one slot level; find highest non-zero
        slots = slots_from_spellcasting(sc, 9)
        slot_level = 0
        slot_count = 0
        for i, n in enumerate(slots, 1):
            if n:
                slot_level = i
                slot_count = n
        specific = row.get("class_specific") or {}
        warlock_pact[str(lvl)] = {
            "pact_slots": slot_count,
            "slot_level": slot_level,
            "cantrips_known": sc.get("cantrips_known"),
            "spells_known": sc.get("spells_known"),
            "invocations_known": specific.get("invocations_known"),
            "mystic_arcanum": {
                "6": specific.get("mystic_arcanum_level_6", 0),
                "7": specific.get("mystic_arcanum_level_7", 0),
                "8": specific.get("mystic_arcanum_level_8", 0),
                "9": specific.get("mystic_arcanum_level_9", 0),
            },
        }

    # Verify proficiency from API
    for row in full_caster:
        assert proficiency_bonus[str(row["level"])] == row["prof_bonus"]

    return {
        "source": "D&D 5e SRD 2014 (dnd5eapi.co/api/2014)",
        "proficiency_bonus_by_level": proficiency_bonus,
        "ability_score_modifiers": ability_modifiers,
        "xp_by_level": xp_thresholds,
        "multiclass_prerequisites": multiclass_prerequisites,
        "spell_slots": {
            "full_caster": {
                "classes": ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"],
                "slots_by_level": full_slots,
                "slot_levels": list(range(1, 10)),
            },
            "half_caster": {
                "classes": ["Paladin", "Ranger"],
                "slots_by_level": half_slots,
                "slot_levels": list(range(1, 6)),
                "notes": "Half casters gain spellcasting at class level 2.",
            },
            "third_caster": {
                "classes": ["Eldritch Knight (Fighter)", "Arcane Trickster (Rogue)"],
                "slots_by_level": {str(k): v for k, v in third_slots_by_level.items()},
                "slot_levels": list(range(1, 5)),
                "notes": "1/3 casters gain spellcasting at subclass level 3.",
            },
            "warlock_pact_magic": {
                "classes": ["Warlock"],
                "by_level": warlock_pact,
                "notes": (
                    "Pact Magic: all pact slots are the same level and recharge on a short rest. "
                    "Mystic Arcanum spells are once-per-long-rest, not pact slots."
                ),
            },
            "multiclass_caster_levels": {
                "full": "Add full class levels (Bard, Cleric, Druid, Sorcerer, Wizard).",
                "half": "Add half class levels, rounded down (Paladin, Ranger).",
                "third": "Add one-third class levels, rounded down (EK, Arcane Trickster).",
                "warlock": "Pact Magic slots remain separate from the multiclass spell slot table.",
                "notes": (
                    "Sum contributions for a multiclass caster level, then consult the full-caster "
                    "slot table. Cantrips/known/prepared still follow individual class features."
                ),
            },
        },
    }


TYPES_TS = '''/** D&D 5e 2014 SRD types for character sheet data files. */

export type AbilityIndex = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

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
  // weapon
  weapon_category?: string;
  weapon_range?: string;
  damage?: EquipmentDamage;
  two_handed_damage?: EquipmentDamage;
  range?: { normal?: number; long?: number };
  throw_range?: { normal?: number; long?: number };
  properties?: string[];
  special?: string;
  // armor
  armor_category?: string;
  armor_class?: ArmorClassInfo;
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  // pack / gear
  contents?: { index: string; name: string; quantity: number }[];
  gear_category?: string;
  description?: string;
  bundle_quantity?: number;
}

export interface Condition {
  index: string;
  name: string;
  description: string[];
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
'''


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"Wrote {path} ({path.stat().st_size} bytes)")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    TYPES.mkdir(parents=True, exist_ok=True)

    # Coordinate: do not overwrite classes/races/backgrounds if present
    protected = {"classes.json", "races.json", "backgrounds.json"}
    existing = {p.name for p in OUT.iterdir() if p.is_file()}
    skip_note = existing & protected
    if skip_note:
        print(f"Leaving existing protected files untouched: {sorted(skip_note)}")

    spells = build_spells()
    write_json(OUT / "spells.json", spells)

    feats = build_feats()
    write_json(OUT / "feats.json", feats)

    skills = build_skills()
    write_json(OUT / "skills.json", skills)

    equipment = build_equipment()
    write_json(OUT / "equipment.json", equipment)

    conditions = build_conditions()
    write_json(OUT / "conditions.json", conditions)

    reference = build_reference()
    write_json(OUT / "reference.json", reference)

    types_path = TYPES / "dnd.ts"
    types_path.write_text(TYPES_TS, encoding="utf-8")
    print(f"Wrote {types_path}")

    summary = {
        "spells": len(spells),
        "feats": len(feats),
        "skills": len(skills),
        "equipment": len(equipment),
        "equipment_by_kind": {},
        "conditions": len(conditions),
        "reference_keys": list(reference.keys()),
    }
    for item in equipment:
        k = item.get("kind", "?")
        summary["equipment_by_kind"][k] = summary["equipment_by_kind"].get(k, 0) + 1

    print("\n=== SUMMARY ===")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
