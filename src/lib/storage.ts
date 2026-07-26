import type {
  Character,
  Currency,
  InventoryItem,
  JournalEntry,
  QuestEntry,
} from "../types/character";
import { createEmptyCharacter, emptyCurrency } from "../types/character";

export const STORAGE_KEY = "dnd5e-sheet-v1";

export interface StoredSheetState {
  characters: Character[];
  activeId: string | null;
}

const EMPTY: StoredSheetState = {
  characters: [],
  activeId: null,
};

function canUseStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function hydrateCurrency(raw: unknown): Currency {
  if (!raw || typeof raw !== "object") return emptyCurrency();
  const c = raw as Partial<Currency>;
  return {
    cp: Number(c.cp) || 0,
    sp: Number(c.sp) || 0,
    ep: Number(c.ep) || 0,
    gp: Number(c.gp) || 0,
    pp: Number(c.pp) || 0,
  };
}

function hydrateInventory(raw: unknown): InventoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const item = (entry ?? {}) as Partial<InventoryItem>;
    return {
      id: typeof item.id === "string" && item.id ? item.id : newId(),
      index: typeof item.index === "string" ? item.index : undefined,
      name: typeof item.name === "string" ? item.name : "Unknown item",
      quantity:
        typeof item.quantity === "number" && Number.isFinite(item.quantity)
          ? item.quantity
          : 1,
      equipped: Boolean(item.equipped),
      notes: typeof item.notes === "string" ? item.notes : undefined,
      weight:
        typeof item.weight === "number" || item.weight === null
          ? item.weight
          : undefined,
      cost:
        typeof item.cost === "string" || item.cost === null
          ? item.cost
          : undefined,
      category: typeof item.category === "string" ? item.category : undefined,
    };
  });
}

function hydrateJournal(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is JournalEntry => Boolean(e && typeof e === "object"))
    .map((e) => ({
      ...e,
      id: typeof e.id === "string" && e.id ? e.id : newId(),
      createdAt:
        typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
      title: typeof e.title === "string" ? e.title : "Untitled",
      body: typeof e.body === "string" ? e.body : "",
    }));
}

function hydrateQuests(raw: unknown): QuestEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is QuestEntry => Boolean(e && typeof e === "object"))
    .map((e) => ({
      ...e,
      id: typeof e.id === "string" && e.id ? e.id : newId(),
      title: typeof e.title === "string" ? e.title : "Untitled quest",
      status:
        e.status === "completed" || e.status === "failed" || e.status === "active"
          ? e.status
          : "active",
      notes: typeof e.notes === "string" ? e.notes : "",
      updatedAt:
        typeof e.updatedAt === "string" ? e.updatedAt : new Date().toISOString(),
    }));
}

/** Fill defaults for older saves missing campaign / inventory fields. */
export function hydrateCharacter(raw: Partial<Character>): Character {
  const base = createEmptyCharacter(raw);
  return {
    ...base,
    weaponProficiencies: Array.isArray(raw.weaponProficiencies)
      ? raw.weaponProficiencies
      : [],
    currency: hydrateCurrency(raw.currency),
    inventory: hydrateInventory(raw.inventory),
    journal: hydrateJournal(raw.journal),
    quests: hydrateQuests(raw.quests),
    activeConditions: Array.isArray(raw.activeConditions)
      ? raw.activeConditions.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export function loadSheetState(): StoredSheetState {
  if (!canUseStorage()) return { ...EMPTY, characters: [] };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, characters: [] };

    const parsed = JSON.parse(raw) as Partial<StoredSheetState>;
    const characters = (
      Array.isArray(parsed.characters) ? parsed.characters : []
    ).map((c) => hydrateCharacter(c as Partial<Character>));
    const activeId =
      typeof parsed.activeId === "string" || parsed.activeId === null
        ? parsed.activeId
        : characters[0]?.id ?? null;

    return { characters, activeId };
  } catch {
    return { ...EMPTY, characters: [] };
  }
}

export function saveSheetState(state: StoredSheetState): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore persistence failures
  }
}

export function clearSheetState(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
