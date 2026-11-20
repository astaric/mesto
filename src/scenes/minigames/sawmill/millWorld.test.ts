import { describe, expect, it } from 'vitest';
import { BASE, BUILDINGS, FOREST_X1, MAX_Y, MIN_Y, START, WORLD_W, axeStats, bladePoints, doorAt, exitPoint, isBlocked, touches, treeSpots } from './millWorld';

describe('mini town', () => {
  it('has the forest on the left, the shop at the far right and the three workplaces between, none overlapping', () => {
    expect(BUILDINGS.map((b) => b.id)).toEqual(['saw', 'work', 'sell', 'shop']);
    expect(BUILDINGS[0].x - BUILDINGS[0].w / 2).toBeGreaterThan(FOREST_X1);
    const last = BUILDINGS.at(-1)!;
    expect(last.x + last.w / 2).toBeLessThan(WORLD_W - 100);
    BUILDINGS.slice(1).forEach((b, i) => expect(b.x - b.w / 2).toBeGreaterThan(BUILDINGS[i].x + BUILDINGS[i].w / 2));
  });

  it('every door can be walked up into from the front, and only there', () => {
    for (const b of BUILDINGS) {
      expect(isBlocked(b.x, MIN_Y)).toBe(false);
      expect(doorAt(b.x, MIN_Y + 10)).toBe(b.id);
      expect(doorAt(b.x, BASE + 80)).toBeNull(); // walking past in the lane does not open it
      expect(doorAt(b.x + 200, MIN_Y)).toBeNull();
    }
  });

  it('leaving a building puts the player on free ground outside every door zone', () => {
    for (const b of BUILDINGS) {
      const p = exitPoint(b.id);
      expect(isBlocked(p.x, p.y)).toBe(false);
      expect(doorAt(p.x, p.y)).toBeNull();
    }
    expect(isBlocked(START.x, START.y)).toBe(false);
  });

  it('the player stays inside the world', () => {
    expect(isBlocked(50, 900)).toBe(true);
    expect(isBlocked(WORLD_W, 900)).toBe(true);
    expect(isBlocked(500, MIN_Y - 20)).toBe(true);
    expect(isBlocked(500, MAX_Y + 20)).toBe(true);
  });
});

describe('forest', () => {
  const trees = treeSpots();

  it('has plenty of trees, all in the forest and on walkable ground, none on top of another', () => {
    expect(trees.length).toBeGreaterThanOrEqual(16);
    for (const t of trees) {
      expect(t.x).toBeLessThan(FOREST_X1);
      expect(isBlocked(t.x, t.y)).toBe(false);
    }
    for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) expect(Math.hypot(trees[i].x - trees[j].x, trees[i].y - trees[j].y)).toBeGreaterThan(100);
  });

  it('is the same every time', () => expect(treeSpots()).toEqual(trees));
});

describe('the spinning axe', () => {
  it('a better axe spins faster, is bigger and reaches further', () => {
    for (let tier = 1; tier < 4; tier++) {
      const a = axeStats(tier - 1), b = axeStats(tier);
      expect(b.spin).toBeGreaterThan(a.spin);
      expect(b.scale).toBeGreaterThan(a.scale);
      expect(b.reach).toBeGreaterThan(a.reach);
    }
  });

  it('the blade points lie along the angle, the last one at full reach', () => {
    const pts = bladePoints(100, 200, 0, 150);
    expect(pts.at(-1)).toEqual({ x: 250, y: 200 });
    const up = bladePoints(0, 0, -Math.PI / 2, 100).at(-1)!;
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(-100);
  });

  it('touches a tree only when the blade is within the radius', () => {
    const pts = bladePoints(0, 0, 0, 200);
    expect(touches(pts, 190, 30, 105)).toBe(true);
    expect(touches(pts, 190, 400, 105)).toBe(false);
    expect(touches(pts, -300, 0, 105)).toBe(false);
  });
});
