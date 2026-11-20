import { describe, expect, it } from 'vitest';
import { GX, GY, ORIGIN, WORLD_H, WORLD_W, toTile, toWorld } from './idleIso';

describe('idle isometric grid', () => {
  it('puts the corners of the map where the doc says', () => {
    expect(toWorld(0, 0)).toEqual({ x: 1408, y: 200 });
    expect(toWorld(GX, 0).x).toBe(WORLD_W); // right corner touches the right edge of the world
    expect(toWorld(0, GY).x).toBe(0);       // left corner touches the left edge
    expect(WORLD_W).toBe(4928);
    expect(WORLD_H).toBe(2768);
  });

  it('keeps the whole diamond inside the world, below the top margin', () => {
    for (const [gx, gy] of [[0, 0], [GX, 0], [0, GY], [GX, GY]]) {
      const p = toWorld(gx, gy);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(WORLD_W);
      expect(p.y).toBeGreaterThanOrEqual(ORIGIN.y);
      expect(p.y).toBeLessThanOrEqual(WORLD_H);
    }
  });

  it('a step along gx goes down-right, a step along gy goes down-left, and z goes up', () => {
    const o = toWorld(5, 5);
    expect(toWorld(6, 5)).toEqual({ x: o.x + 64, y: o.y + 32 });
    expect(toWorld(5, 6)).toEqual({ x: o.x - 64, y: o.y + 32 });
    expect(toWorld(5, 5, 100)).toEqual({ x: o.x, y: o.y - 100 });
  });

  it('toTile is the inverse of toWorld, also inside a tile', () => {
    for (const [gx, gy] of [[0, 0], [7, 3], [20, 13], [54, 21]]) {
      const c = toWorld(gx + 0.5, gy + 0.5);
      expect(toTile(c.x, c.y)).toEqual({ gx, gy });
    }
  });
});
