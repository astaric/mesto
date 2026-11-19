import type { Key } from '../../../i18n';

// The hunting rifles of the lookout. Bought in HuntShop for coins, and only once the player has won enough stars.

export type HuntWeaponId = 'rifle' | 'scope' | 'double' | 'repeater';

export interface HuntWeapon {
  id: HuntWeaponId;
  name: Key;
  price: number;           // coins
  stars: number;           // total stars needed to be allowed to buy it (nothing is taken)
  dmg: number;             // a deer has DEER_HP
  mag: number;
  reload: number;          // seconds
  cooldown: number;        // ms between shots
  radius: number;          // how far from a deer's centre a shot still hits, at full size
  auto: boolean;           // keeps firing while the finger is held down
  tex: string;             // picture on the shop card
  sound: 'bang' | 'shotgun' | 'smg';
}

export const HUNT_WEAPONS: HuntWeapon[] = [
  { id: 'rifle', name: 'hunt.weapon.rifle', price: 0, stars: 0, dmg: 1, mag: 5, reload: 1.6, cooldown: 500, radius: 130, auto: false, tex: 'hunt-rifle', sound: 'bang' },
  { id: 'scope', name: 'hunt.weapon.scope', price: 40, stars: 5, dmg: 1, mag: 6, reload: 1.3, cooldown: 450, radius: 190, auto: false, tex: 'hunt-scope', sound: 'bang' },
  { id: 'double', name: 'hunt.weapon.double', price: 80, stars: 10, dmg: 2, mag: 2, reload: 1.0, cooldown: 400, radius: 160, auto: false, tex: 'hunt-double', sound: 'shotgun' },
  { id: 'repeater', name: 'hunt.weapon.repeater', price: 140, stars: 16, dmg: 1, mag: 8, reload: 1.2, cooldown: 220, radius: 150, auto: true, tex: 'hunt-repeater', sound: 'smg' },
];

export function huntWeaponById(id: HuntWeaponId): HuntWeapon {
  return HUNT_WEAPONS.find((w) => w.id === id) ?? HUNT_WEAPONS[0];
}

/** May the player buy it? Stars are only a threshold, they are never spent. */
export function unlocked(w: HuntWeapon, totalStars: number): boolean { return totalStars >= w.stars; }
