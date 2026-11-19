import { WEAPONS, type WeaponId } from '../scenes/minigames/forest/weapons';
import { readItem, readJson, writeJson } from './storage';

// What the forest game remembers between sessions: the weapons bought (with the shared wallet, see
// `profile.ts`), the one in hand, the longest run and how many runs were started (the first ones teach the controls).

export interface ForestSave { owned: WeaponId[]; weapon: WeaponId; best: number; runs: number }

export const FOREST_KEY = 'forest-save';
export const OLD_BEST_KEY = 'forest-best'; // the record used to be stored on its own
const KEY = FOREST_KEY;

function load(): ForestSave {
  const raw = readJson(KEY) as Partial<ForestSave> | null;
  const oldBest = Number(readItem(OLD_BEST_KEY)) || 0;
  if (!raw || typeof raw !== 'object') return { owned: ['pistol'], weapon: 'pistol', best: oldBest, runs: 0 };
  const ids = WEAPONS.map((w) => w.id);
  const owned = (Array.isArray(raw.owned) ? raw.owned : []).filter((id): id is WeaponId => ids.includes(id));
  if (!owned.includes('pistol')) owned.unshift('pistol');
  const weapon = raw.weapon && owned.includes(raw.weapon) ? raw.weapon : 'pistol';
  return { owned, weapon, best: Math.max(Number(raw.best) || 0, oldBest), runs: Math.max(0, Math.floor(Number(raw.runs) || 0)) };
}

export const forestSave: ForestSave = load();

export function saveForest(): void { writeJson(KEY, forestSave); }
