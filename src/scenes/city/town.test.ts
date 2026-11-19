import { describe, expect, it } from 'vitest';
import { journeys } from '../../core/stages';
import { FOREST_GATE_Y, MAX_Y, PATH, PATH_X, START, TOP_BASE, WORLD_W, isBlocked, spots, type Rect } from './town';

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

  it('buildings in a row do not overlap', () => {
    for (const row of [spots.filter((s) => s.base === TOP_BASE), spots.filter((s) => s.kind !== 'gate' && s.base !== TOP_BASE)]) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      sorted.slice(1).forEach((s, i) => expect(s.x - s.w / 2).toBeGreaterThan(sorted[i].x + sorted[i].w / 2));
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
