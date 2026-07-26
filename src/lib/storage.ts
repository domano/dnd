import type { Character } from "../types/character";

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

export function loadSheetState(): StoredSheetState {
  if (!canUseStorage()) return { ...EMPTY, characters: [] };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, characters: [] };

    const parsed = JSON.parse(raw) as Partial<StoredSheetState>;
    const characters = (
      Array.isArray(parsed.characters) ? parsed.characters : []
    ).map((c) => ({
      ...c,
      weaponProficiencies: Array.isArray(c.weaponProficiencies)
        ? c.weaponProficiencies
        : [],
    })) as Character[];
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
