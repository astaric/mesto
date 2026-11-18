import { WEAPONS, type WeaponId } from '../scenes/minigames/weapons';

// What the forest game remembers between sessions: a coin wallet (separate from `progress.coins`,
// which is reset every time a journey starts) and the weapons bought with it.

export interface ForestSave { coins: number; owned: WeaponId[]; weapon: WeaponId }

const KEY = 'forest-save';

function load(): ForestSave {
  const fresh: ForestSave = { coins: 0, owned: ['pistol'], weapon: 'pistol' };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ForestSave> | null;
    if (!raw) return fresh;
    const ids = WEAPONS.map((w) => w.id);
    const owned = (raw.owned ?? []).filter((id): id is WeaponId => ids.includes(id));
    if (!owned.includes('pistol')) owned.unshift('pistol');
    const weapon = raw.weapon && owned.includes(raw.weapon) ? raw.weapon : 'pistol';
    return { coins: Math.max(0, Number(raw.coins) || 0), owned, weapon };
  } catch {
    return fresh; // storage is optional
  }
}

export const forestSave: ForestSave = load();

export function saveForest(): void {
  try { localStorage.setItem(KEY, JSON.stringify(forestSave)); } catch { /* optional */ }
}
