import { removeItem } from './storage';
import { PROFILE_KEY } from './profile';
import { FOREST_KEY, OLD_BEST_KEY } from './forestSave';
import { HUNT_KEY } from './huntSave';
import { MILL_KEY } from './millSave';

// What the reload button throws away: coins, the pet, the weapons, the hunting rifles, the sawmill stock and the forest record. Stars are only kept while the
// page is open, so the reload itself clears them. The language choice stays.

/** Erase everything the game saved (the page is reloaded right after, so the in-memory copies do not matter). */
export function resetProgress(): void {
  for (const key of [PROFILE_KEY, FOREST_KEY, OLD_BEST_KEY, HUNT_KEY, MILL_KEY]) removeItem(key);
}

/** `index.html`'s hold-to-reload button announces itself with this event just before it reloads the page. */
export const RESET_EVENT = 'reset-game';
