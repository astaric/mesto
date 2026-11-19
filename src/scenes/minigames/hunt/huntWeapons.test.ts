import { describe, expect, it } from 'vitest';
import { artKeys } from '../../../test/art';
import { en } from '../../../i18n/en';
import { HUNT_WEAPONS, huntWeaponById, unlocked } from './huntWeapons';
import { sfx } from '../../../core/sfx';
import { DEER_HP } from './huntLogic';

describe('hunting rifles', () => {
  it('the first one is free, needs no stars and is the fallback', () => {
    expect(HUNT_WEAPONS[0]).toMatchObject({ id: 'rifle', price: 0, stars: 0 });
    expect(huntWeaponById('rifle')).toBe(HUNT_WEAPONS[0]);
  });

  it('ids are unique, and prices and star thresholds only go up', () => {
    expect(new Set(HUNT_WEAPONS.map((w) => w.id)).size).toBe(HUNT_WEAPONS.length);
    HUNT_WEAPONS.slice(1).forEach((w, i) => {
      expect(w.price).toBeGreaterThan(HUNT_WEAPONS[i].price);
      expect(w.stars).toBeGreaterThan(HUNT_WEAPONS[i].stars);
    });
  });

  it('have a picture, a translated name and a real sound', () => {
    for (const w of HUNT_WEAPONS) {
      expect(artKeys.has(w.tex), w.tex).toBe(true);
      expect(w.name in en, w.name).toBe(true);
      expect(typeof sfx[w.sound], w.sound).toBe('function');
    }
  });

  it('are sane: every deer can be killed, a loaded magazine, a cooldown, some reach', () => {
    for (const w of HUNT_WEAPONS) {
      expect(w.dmg).toBeGreaterThan(0);
      expect(w.dmg).toBeLessThanOrEqual(DEER_HP);
      expect(w.mag).toBeGreaterThan(0);
      expect(w.cooldown).toBeGreaterThan(0);
      expect(w.radius).toBeGreaterThan(0);
    }
  });

  it('stars only unlock, they are not spent', () => {
    const scope = huntWeaponById('scope');
    expect(unlocked(scope, scope.stars - 1)).toBe(false);
    expect(unlocked(scope, scope.stars)).toBe(true);
  });
});
