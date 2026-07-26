# SRD Ledger — D&D 5e 2014

Ink-and-brass character sheet for the **D&D 5e SRD 5.1 (2014)** ruleset. Create adventurers, track combat and spells, level up, and keep expedition notes — all in the browser with local persistence.

## SRD 5.1 scope

This app uses **SRD 5.1 only** (the 2014 System Reference Document). That means:

- **12 classes** with SRD subclasses (e.g. Berserker, Life Domain, Evocation)
- **9 races** (+ subraces) from the SRD
- **1 background** in the SRD (Acolyte), plus a custom-background path in the creation wizard
- **1 feat** in the SRD (Grappler), plus custom feats when leveling
- Spells, skills, conditions, and common equipment from the SRD

Non-SRD subclasses, races, backgrounds, feats, and magic items are out of scope.

## How to run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local development server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | Oxlint |

Characters are saved in **localStorage** on this device.

## Features

- **Home** — Create Character, Open Saved, or browse the Compendium
- **Creation wizard** — Identity → Race → Class → Background → Abilities → Details → Spells (casters) → Review
  - Ability methods: Standard Array, Point Buy (27), Manual
  - Spell step respects known / prepared / spellbook rules at level 1
- **Character sheet** — abilities, combat (AC, HP, death saves), skills (+ expertise), features, spells (slots, attack, save DC), equipment, feats, notes
- **Level-up wizard** — new features, subclass unlock, ASI or feat, spell progression, average or rolled HP
- **Compendium** — searchable SRD classes, races, spells, skills, feats, conditions, equipment, backgrounds
- **Import / export** — JSON backup of saved characters (from Open Saved)
- **Rests** — short rest (pact slots) and long rest (HP, slots, hit dice recovery)

## Data sources

Compact JSON under `src/data/`, typed in `src/types/dnd.ts`.

| Source | Role |
|--------|------|
| [dnd5eapi.co `/api/2014/`](https://www.dnd5eapi.co/api/2014/) | Primary SRD content |
| [Open5e](https://api.open5e.com/) (SRD 2014 filters) | Cross-check for classes/races/backgrounds |

Rebuild helpers (optional):

```bash
python3 scripts/build-srd-data.py
python3 scripts/fetch_srd_data.py
```

See `src/data/README.md` for file-by-file notes.

## Stack

React 19 · TypeScript · Vite · Zustand · CSS modules (Fraunces + Figtree, ink/brass/teal theme)
