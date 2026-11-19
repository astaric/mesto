import { HUNT_WEAPONS, type HuntWeaponId } from '../scenes/minigames/hunt/huntWeapons';
import { readJson, writeJson } from './storage';

// What the lookout hunt remembers between sessions: the rifles bought (with the shared wallet, see `profile.ts`)
// and the one in hand.

export interface HuntSave { owned: HuntWeaponId[]; weapon: HuntWeaponId }

export const HUNT_KEY = 'hunt-save';
const START: HuntWeaponId = 'rifle';

function load(): HuntSave {
  const raw = readJson(HUNT_KEY) as Partial<HuntSave> | null;
  if (!raw || typeof raw !== 'object') return { owned: [START], weapon: START };
  const ids = HUNT_WEAPONS.map((w) => w.id);
  const owned = (Array.isArray(raw.owned) ? raw.owned : []).filter((id): id is HuntWeaponId => ids.includes(id));
  if (!owned.includes(START)) owned.unshift(START);
  const weapon = raw.weapon && owned.includes(raw.weapon) ? raw.weapon : START;
  return { owned, weapon };
}

export const huntSave: HuntSave = load();

export function saveHunt(): void { writeJson(HUNT_KEY, huntSave); }
