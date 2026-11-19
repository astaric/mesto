import { describe, expect, it } from 'vitest';
import { CARRY_GOAL, SHOOT_GOAL, Magazine, deerToSpawn, fleeDir, hitRadius, isWon, keepsCarcass, newHunt, onDeliver, onKill, onPickUp, pickTarget } from './huntLogic';

describe('carcasses', () => {
  it('exactly the first ten deer stay on the meadow', () => {
    const s = newHunt();
    const kept = Array.from({ length: SHOOT_GOAL }, () => onKill(s));
    expect(kept.filter(Boolean)).toHaveLength(CARRY_GOAL);
    expect(kept.slice(0, CARRY_GOAL).every(Boolean)).toBe(true);
    expect(s.lying).toBe(CARRY_GOAL);
  });

  it('a deer that is being carried or was delivered counts against the ten', () => {
    const s = newHunt();
    for (let i = 0; i < 4; i++) onKill(s);
    onPickUp(s);
    expect(s.lying).toBe(3);
    for (let i = 0; i < 6; i++) onKill(s);
    expect(s.lying).toBe(9);          // 9 on the ground + 1 on the back = 10
    expect(keepsCarcass(s)).toBe(false);
    onDeliver(s);
    expect(s.carried).toBe(1);
    expect(keepsCarcass(s)).toBe(false); // 9 lying + 1 delivered
  });
});

describe('carrying', () => {
  it('only one deer at a time, and only when one is lying', () => {
    const s = newHunt();
    expect(onPickUp(s)).toBe(false);
    onKill(s); onKill(s);
    expect(onPickUp(s)).toBe(true);
    expect(onPickUp(s)).toBe(false);
    expect(s.lying).toBe(1);
  });

  it('delivering needs a deer on the back', () => {
    const s = newHunt();
    expect(onDeliver(s)).toBe(false);
    onKill(s); onPickUp(s);
    expect(onDeliver(s)).toBe(true);
    expect(s).toMatchObject({ carried: 1, carrying: false, lying: 0 });
  });
});

describe('winning', () => {
  it('needs 60 shot and 10 delivered', () => {
    const s = newHunt();
    for (let i = 0; i < SHOOT_GOAL; i++) onKill(s);
    expect(isWon(s)).toBe(false);
    for (let i = 0; i < CARRY_GOAL; i++) { onPickUp(s); expect(isWon(s)).toBe(false); onDeliver(s); }
    expect(isWon(s)).toBe(true);
  });

  it('delivering ten without shooting sixty is not enough', () => {
    const s = newHunt();
    for (let i = 0; i < CARRY_GOAL; i++) { onKill(s); onPickUp(s); onDeliver(s); }
    expect(isWon(s)).toBe(false);
  });
});

describe('deerToSpawn', () => {
  it('fills the herd up to the wanted size', () => expect(deerToSpawn(newHunt(), 3, 6)).toBe(3));
  it('stops once the deer still alive are enough to reach 60', () => {
    const s = newHunt(); s.shot = 57;
    expect(deerToSpawn(s, 3, 6)).toBe(0);
    expect(deerToSpawn(s, 1, 6)).toBe(2);
  });
  it('is never negative', () => {
    const s = newHunt(); s.shot = 60;
    expect(deerToSpawn(s, 0, 6)).toBe(0);
    expect(deerToSpawn(newHunt(), 9, 6)).toBe(0);
  });
});

describe('Magazine', () => {
  const rifle = { mag: 3, reload: 1, cooldown: 500 };

  it('waits for the cooldown between shots', () => {
    const m = new Magazine(rifle);
    expect(m.fire(0)).toBe(true);
    expect(m.fire(499)).toBe(false);
    expect(m.fire(500)).toBe(true);
    expect(m.ammo).toBe(1);
  });

  it('the last bullet starts the reload, and nothing fires until it is done', () => {
    const m = new Magazine(rifle);
    m.fire(0); m.fire(500);
    expect(m.reloading).toBe(false);
    expect(m.fire(1000)).toBe(true);
    expect(m.reloading).toBe(true);
    expect(m.fire(2000)).toBe(false);
    m.update(0.5);
    expect(m.reloadProgress).toBeCloseTo(0.5);
    expect(m.ammo).toBe(0);
    m.update(0.6);
    expect(m.reloading).toBe(false);
    expect(m.ammo).toBe(3);
    expect(m.fire(2000)).toBe(true);
  });
});

describe('hitting', () => {
  it('a far deer is more forgiving than its size, a near one grows', () => {
    expect(hitRadius(100, 0.45)).toBe(60);
    expect(hitRadius(100, 1.2)).toBe(120);
  });

  it('picks the nearest deer inside its radius, or none', () => {
    const t = [{ x: 500, y: 500, scale: 1 }, { x: 560, y: 500, scale: 1 }, { x: 1500, y: 900, scale: 1 }];
    expect(pickTarget(t, 540, 500, 100)).toBe(1);
    expect(pickTarget(t, 1000, 700, 100)).toBe(-1);
    expect(pickTarget([], 0, 0, 100)).toBe(-1);
  });
});

describe('fleeDir', () => {
  const box = { x0: 200, x1: 1900, y0: 790, y1: 1450 };

  it('runs away from the hunter, in the open', () => {
    const v = fleeDir(1000, 1100, 600, 1100, box);
    expect(v.x).toBeGreaterThan(0.9);
    expect(Math.abs(v.y)).toBeLessThan(0.1);
    const w = fleeDir(1000, 1000, 1000, 1300, box);
    expect(w.y).toBeLessThan(0);
  });

  it('slides along an edge instead of into it', () => {
    const v = fleeDir(1880, 1100, 1500, 1000, box);   // the hunter is left of it: it would run right, into the wall
    expect(v.x).toBe(0);
    expect(Math.abs(v.y)).toBe(1);
    const t = fleeDir(1000, 800, 1000, 1200, box);    // against the far edge, hunter in front
    expect(t.y).toBe(0);
    expect(Math.abs(t.x)).toBe(1);
  });

  it('never points out of the field, even in a corner', () => {
    for (const [x, y] of [[200, 790], [1900, 790], [200, 1450], [1900, 1450]]) {
      for (const [fx, fy] of [[x - 300, y - 200], [x + 300, y + 200], [x - 300, y + 200], [x + 300, y - 200]]) {
        const v = fleeDir(x, y, fx, fy, box);
        if (x <= box.x0 + 60) expect(v.x).toBeGreaterThanOrEqual(0);
        if (x >= box.x1 - 60) expect(v.x).toBeLessThanOrEqual(0);
        if (y <= box.y0 + 60) expect(v.y).toBeGreaterThanOrEqual(0);
        if (y >= box.y1 - 60) expect(v.y).toBeLessThanOrEqual(0);
      }
    }
  });
});
