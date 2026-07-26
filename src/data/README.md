# D&D 5e SRD 2014 data

Compact JSON for an interactive character sheet. **SRD 5.1 (2014) only.**

## Sources

| Source | URL | Notes |
|--------|-----|--------|
| dnd5eapi.co (2014) | `https://www.dnd5eapi.co/api/2014/` | Primary. Pure WotC SRD content (`/api/` redirects here). |
| Open5e v2 | `https://api.open5e.com/v2/` with `document__key=srd-2014` | Cross-check for classes/races. |
| Open5e v1 | `https://api.open5e.com/v1/` with `document__slug=wotc-srd` | Race/background/feat cross-check. |

Rebuild helpers:

```bash
# Classes / races / backgrounds (expects cached pulls under /tmp/dnd-api/)
python3 scripts/build-srd-data.py

# Spells, feats, skills, equipment, conditions, reference
python3 scripts/fetch_srd_data.py
```

## Files

| File | Contents |
|------|----------|
| `classes.json` | 12 SRD classes, features, subclasses, spell slots, resources |
| `races.json` | 9 SRD races + subraces, traits, ASI |
| `backgrounds.json` | SRD backgrounds (Acolyte only — sole background in the 5.1 SRD) |
| `spells.json` | 319 SRD spells (level, school, components, classes, damage, etc.) |
| `feats.json` | SRD feats (Grappler only in 5.1 SRD) |
| `skills.json` | All 18 skills with ability associations |
| `equipment.json` | Weapons, armor (AC formulas), packs, common gear |
| `conditions.json` | Condition summaries |
| `reference.json` | Proficiency bonus, ability mods, XP, multiclass prereqs, spell-slot tables |

Types: `src/types/dnd.ts`.

## Scope notes

- Descriptions are shortened summaries for UI use, not full SRD text.
- Primary ability scores are conventional PHB/SRD guidance (not a dedicated API field).
- Spellcasting preparation/ritual/list metadata is derived from SRD class rules.
- Non-SRD classes, races, backgrounds, subclasses, and feats are excluded.
- Magic items listed under equipment-category endpoints are filtered out.
