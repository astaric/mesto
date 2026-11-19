import { removeItem } from './storage';
import { PROFILE_KEY } from './profile';
import { FOREST_KEY, OLD_BEST_KEY } from './forestSave';

// What the reload button throws away: coins, the pet, the weapons and the forest record. Stars are only kept while the
// page is open, so the reload itself clears them. The language choice stays.

/** Erase everything the game saved (the page is reloaded right after, so the in-memory copies do not matter). */
export function resetProgress(): void {
  for (const key of [PROFILE_KEY, FOREST_KEY, OLD_BEST_KEY]) removeItem(key);
}

/** `index.html`'s hold-to-reload button announces itself with this event just before it reloads the page. */
export const RESET_EVENT = 'reset-game';
