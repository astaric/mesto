import { describe, expect, it } from 'vitest';
import { APPLES_PER_PIG, SQUEEZES_PER_JUG, distToSegment, freeHoles, jugLevel, nearest, pigSize, pigStage, woolTufts } from './barnyardLogic';

describe('milk', () => {
  it('the jug fills up and never overflows', () => {
    expect(jugLevel(0)).toBe(0);
    expect(jugLevel(SQUEEZES_PER_JUG / 2)).toBe(0.5);
    expect(jugLevel(SQUEEZES_PER_JUG)).toBe(1);
    expect(jugLevel(SQUEEZES_PER_JUG + 3)).toBe(1);
  });
});

describe('pigs', () => {
  it('go from thin to fat as they eat', () => {
    expect(pigStage(0)).toBe('thin');
    expect(pigStage(1)).toBe('growing');
    expect(pigStage(APPLES_PER_PIG - 1)).toBe('growing');
    expect(pigStage(APPLES_PER_PIG)).toBe('fat');
  });
  it('grow with every apple, up to a limit', () => {
    expect(pigSize(0)).toBe(1);
    expect(pigSize(1)).toBeGreaterThan(pigSize(0));
    expect(pigSize(APPLES_PER_PIG + 5)).toBe(pigSize(APPLES_PER_PIG));
  });
});

describe('wool', () => {
  it('covers the body with tufts inside the ellipse', () => {
    const tufts = woolTufts(108, 60, 46);
    expect(tufts.length).toBeGreaterThanOrEqual(8);
    for (const p of tufts) expect((p.x / 108) ** 2 + (p.y / 60) ** 2).toBeLessThanOrEqual(1);
  });
  it('a swipe reaches a tuft it passes over, even when the frames skip it', () => {
    expect(distToSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(10);
    expect(distToSegment({ x: -30, y: 40 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(50);
    expect(distToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(Math.hypot(5, 5));
  });
  it('nearest picks the closest point in range', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(nearest(pts, { x: 90, y: 0 }, 50)).toBe(1);
    expect(nearest(pts, { x: 50, y: 200 }, 50)).toBe(-1);
  });
});

describe('rabbits', () => {
  it('only free holes get a rabbit', () => {
    expect(freeHoles(4, new Set([1, 2]))).toEqual([0, 3]);
    expect(freeHoles(2, new Set([0, 1]))).toEqual([]);
  });
});
