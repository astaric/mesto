import { WEAPONS, type WeaponId } from '../scenes/minigames/forest/weapons';
import { readItem, readJson, writeJson } from './storage';

// What the forest game remembers between sessions: a coin wallet (separate from `progress.coins`,
// which is reset every time a journey starts), the weapons bought with it and the longest run.

export interface ForestSave { coins: number; owned: WeaponId[]; weapon: WeaponId; best: number }

const KEY = 'forest-save';
const OLD_BEST_KEY = 'forest-best'; // the record used to be stored on its own

function load(): ForestSave {
  const raw = readJson(KEY) as Partial<ForestSave> | null;
  const oldBest = Number(readItem(OLD_BEST_KEY)) || 0;
  if (!raw || typeof raw !== 'object') return { coins: 0, owned: ['pistol'], weapon: 'pistol', best: oldBest };
  const ids = WEAPONS.map((w) => w.id);
  const owned = (Array.isArray(raw.owned) ? raw.owned : []).filter((id): id is WeaponId => ids.includes(id));
  if (!owned.includes('pistol')) owned.unshift('pistol');
  const weapon = raw.weapon && owned.includes(raw.weapon) ? raw.weapon : 'pistol';
  return { coins: Math.max(0, Number(raw.coins) || 0), owned, weapon, best: Math.max(Number(raw.best) || 0, oldBest) };
}

export const forestSave: ForestSave = load();

export function saveForest(): void { writeJson(KEY, forestSave); }
