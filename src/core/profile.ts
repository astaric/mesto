import { readJson, writeJson } from './storage';

// What the player keeps across journeys and sessions: one coin wallet (earned in Checkout, the farm and the
// forest, spent in the pet shop and the weapon shop) and the pet that follows them around the town.

export type Pet = 'dog' | 'cat' | 'bunny' | 'hound';   // the hound is the hunting dog: it fetches the deer in the lookout hunt
export interface Profile { coins: number; pet: Pet; petOwned: boolean }

export const PROFILE_KEY = 'profile';
const KEY = PROFILE_KEY;
const LEGACY_FOREST_KEY = 'forest-save'; // the forest used to keep its own coins in here
const PETS: readonly Pet[] = ['dog', 'cat', 'bunny', 'hound'];

function coinsOf(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function load(): Profile {
  const raw = readJson(KEY) as Partial<Profile> | null;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const pet = PETS.includes(raw.pet as Pet) ? (raw.pet as Pet) : 'dog';
    return { coins: coinsOf(raw.coins), pet, petOwned: raw.petOwned === true };
  }
  // First start with the shared wallet: take over the coins the forest had saved on its own.
  const legacy = readJson(LEGACY_FOREST_KEY) as { coins?: unknown } | null;
  const legacyCoins = legacy && typeof legacy === 'object' ? coinsOf(legacy.coins) : 0;
  return { coins: legacyCoins, pet: 'dog', petOwned: false };
}

export const profile: Profile = load();

export function saveProfile(): void { writeJson(KEY, profile); }

export function earn(n: number): void {
  profile.coins += n;
  saveProfile();
}

/** Take `n` coins if there are enough; false (and nothing taken) otherwise. */
export function spend(n: number): boolean {
  if (profile.coins < n) return false;
  profile.coins -= n;
  saveProfile();
  return true;
}
