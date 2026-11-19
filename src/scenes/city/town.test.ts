import { describe, expect, it } from 'vitest';
import { journeys } from '../../core/stages';
import { BOTTOM_BASE, CLEARING, FARM_X, FOREST_GATE_Y, MAX_Y, PATH, PATH_X, START, TOP_BASE, WORLD_W, YARD_END, YARD_WALK, inDoorZone, isBlocked, spots, type Rect } from './town';

describe('town', () => {
  it('has exactly one building per stage of the city journey, matched by id', () => {
    const stageIds = journeys.city.stages.map((s) => s.id).sort();
    const spotIds = spots.map((s) => s.id).sort();
    expect(spotIds).toEqual(stageIds);
  });

  it('only the forest is a gate, and it stands at the end of the path', () => {
    const gates = spots.filter((s) => s.kind === 'gate');
    expect(gates.map((g) => g.id)).toEqual(['forest']);
    expect(gates[0]).toMatchObject({ x: PATH_X, base: FOREST_GATE_Y });
  });

  it('the lookout is a tower inside the clearing, and its door can be reached from the front', () => {
    const towers = spots.filter((s) => s.kind === 'tower');
    expect(towers.map((s) => s.id)).toEqual(['lookout']);
    const { x, base } = towers[0];
    expect(x).toBeGreaterThan(CLEARING.x0 + 300);
    expect(x).toBeLessThan(CLEARING.x1);
    expect(base).toBeGreaterThan(CLEARING.y0 + 100);
    expect(base + 60).toBeLessThan(CLEARING.y1);
    expect(isBlocked([], x + 126, base + 60)).toBe(false);
  });

  it('buildings in a row do not overlap', () => {
    for (const row of [spots.filter((s) => s.base === TOP_BASE), spots.filter((s) => !s.kind && s.base !== TOP_BASE)]) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      sorted.slice(1).forEach((s, i) => expect(s.x - s.w / 2).toBeGreaterThan(sorted[i].x + sorted[i].w / 2));
    }
  });
});

describe('farm yard', () => {
  const farm = ['eggs', 'farm', 'cows', 'sheep', 'pigsty', 'rabbits'];

  it('holds every farm building, inside the world, on the yard ground', () => {
    for (const id of farm) {
      const s = spots.find((b) => b.id === id)!;
      expect(s, id).toBeDefined();
      expect(s.x - s.w / 2, id).toBeGreaterThan(FARM_X);
      expect(s.x + s.w / 2 + 20, id).toBeLessThan(WORLD_W - 90);
    }
    expect(YARD_END).toBeGreaterThan(BOTTOM_BASE);
  });

  it('the animals wander between the rows of buildings, not behind them', () => {
    expect(YARD_WALK.y0).toBeGreaterThan(TOP_BASE);
    expect(YARD_WALK.y1).toBeLessThan(BOTTOM_BASE - 460);
  });

  it('every door can be reached from the front', () => {
    for (const id of farm) {
      const s = spots.find((b) => b.id === id)!;
      expect(isBlocked([], s.x, s.base + 60), id).toBe(false);
    }
  });
});

describe('isBlocked', () => {
  const none: Rect[] = [];

  it('the start position is free', () => expect(isBlocked(none, START.x, START.y)).toBe(false));

  it('the edges of the world are solid', () => {
    expect(isBlocked(none, 50, START.y)).toBe(true);
    expect(isBlocked(none, WORLD_W - 50, START.y)).toBe(true);
    expect(isBlocked(none, START.x, MAX_Y + 1)).toBe(true);
  });

  it('north of the street only the path is open', () => {
    expect(isBlocked(none, 300, 300)).toBe(true);
    expect(isBlocked(none, (PATH.x0 + PATH.x1) / 2, 0)).toBe(false);
    expect(isBlocked(none, PATH.x0 - 40, 0)).toBe(true);
  });

  it('walls block with a margin of 30 px', () => {
    const wall: Rect = { x0: 1000, y0: 1000, x1: 1100, y1: 1100 };
    expect(isBlocked([wall], 1050, 1050)).toBe(true);
    expect(isBlocked([wall], 975, 1050)).toBe(true);
    expect(isBlocked([wall], 960, 1050)).toBe(false);
    expect(isBlocked([wall], 1050, 1120)).toBe(false);
  });
});

describe('inDoorZone', () => {
  const plain = { x: 1000, y: 760 };
  const ladder = { x: 1376, y: -1250, wide: true };
  it('a plain door opens only from below', () => {
    expect(inDoorZone(plain, 1000, 780)).toBe(true);
    expect(inDoorZone(plain, 1000, 900)).toBe(false);
    expect(inDoorZone(plain, 1200, 780)).toBe(false);
  });
  it('the lookout ladder opens from the left, the right and below', () => {
    expect(inDoorZone(ladder, 1260, -1200)).toBe(true); // from the left
    expect(inDoorZone(ladder, 1500, -1200)).toBe(true); // from the right
    expect(inDoorZone(ladder, 1376, -1150)).toBe(true); // from below
    expect(inDoorZone(ladder, 1376, -1000)).toBe(false); // far away
  });
  it('the lookout can be reached walking in from the left past its legs', () => {
    const walls = [{ x0: 1338 - 25, y0: -1290, x1: 1338 + 25, y1: -1250 }, { x0: 1162 - 25, y0: -1290, x1: 1162 + 25, y1: -1250 }];
    let x = 1000;
    while (!inDoorZone(ladder, x, -1200) && !isBlocked(walls, x + 5, -1200)) x += 5;
    expect(inDoorZone(ladder, x, -1200)).toBe(true);
  });
});
