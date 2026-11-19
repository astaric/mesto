import type { sfx } from '../../../core/sfx';
import type { Key } from '../../../i18n';

// Weapons of the ForestRun shooter. Bought in ForestShop with the (persistent) forest coins.

export type WeaponId = 'pistol' | 'shotgun' | 'smg' | 'laser' | 'rocket';

/** How a shot picks its targets around the tapped point:
 *  `nearest` the closest enemy under the finger, `splash` everything within `radius` px of it,
 *  `pierce` every enemy under the finger, at any distance. */
export type HitMode = 'nearest' | 'splash' | 'pierce';

export interface Weapon {
  id: WeaponId;
  name: Key;
  price: number;
  dmg: number;
  mag: number;
  reload: number;          // seconds
  cooldown: number;        // ms between shots
  mode: HitMode;
  radius: number;          // splash radius in screen px
  auto: boolean;           // keeps firing while the finger is held down
  tex: string;             // gun image shown at the bottom of the screen
  sound: keyof typeof sfx;
  tracer: number;          // tracer colour
  pellets: number;         // tracer lines drawn per shot (cosmetic spread)
}

export const WEAPONS: Weapon[] = [
  { id: 'pistol', name: 'weapon.pistol', price: 0, dmg: 1, mag: 8, reload: 1.0, cooldown: 150, mode: 'nearest', radius: 0, auto: false,
    tex: 'forest-gun', sound: 'bang', tracer: 0xfff3a0, pellets: 1 },
  { id: 'shotgun', name: 'weapon.shotgun', price: 25, dmg: 1, mag: 4, reload: 1.4, cooldown: 450, mode: 'splash', radius: 170, auto: false,
    tex: 'forest-gun-shotgun', sound: 'shotgun', tracer: 0xffd27a, pellets: 6 },
  { id: 'smg', name: 'weapon.smg', price: 50, dmg: 1, mag: 30, reload: 1.3, cooldown: 90, mode: 'nearest', radius: 0, auto: true,
    tex: 'forest-gun-smg', sound: 'smg', tracer: 0xfff3a0, pellets: 1 },
  { id: 'laser', name: 'weapon.laser', price: 90, dmg: 2, mag: 12, reload: 1.2, cooldown: 200, mode: 'pierce', radius: 0, auto: false,
    tex: 'forest-gun-laser', sound: 'laser', tracer: 0x7df9ff, pellets: 1 },
  { id: 'rocket', name: 'weapon.rocket', price: 140, dmg: 5, mag: 2, reload: 2.0, cooldown: 600, mode: 'splash', radius: 320, auto: false,
    tex: 'forest-gun-rocket', sound: 'rocket', tracer: 0xffa23a, pellets: 1 },
];

export const weaponById = (id: WeaponId): Weapon => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
