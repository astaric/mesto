import { describe, expect, it } from 'vitest';
import { PLANK_LAYERS, THIRD_BLADE_LEVEL, SECOND_BLADE_LEVEL, X_IN, X_OUT, X_THROUGH, bladesAt, plankPasses, plankPose, restPass } from './idlePlankPose';

describe('plank saw', () => {
  it('has one blade up to level 24, two from level 25 and three from level 50', () => {
    expect([1, 24, 25, 49, 50, 200].map(bladesAt)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(SECOND_BLADE_LEVEL).toBe(25);
    expect(THIRD_BLADE_LEVEL).toBe(50);
  });
  it('cuts one plank at a time with one blade, two with two and all of them with three', () => {
    expect(plankPasses(1)).toEqual([{ base: 3, blades: 1 }, { base: 2, blades: 1 }, { base: 1, blades: 1 }]);
    expect(plankPasses(2)).toEqual([{ base: 2, blades: 2 }, { base: 1, blades: 1 }]);
    expect(plankPasses(3)).toEqual([{ base: 1, blades: 3 }]);
  });
  it('always makes every cut once: PLANK_LAYERS - 1 cuts, each pass leaving a thinner whole log', () => {
    for (let blades = 1; blades <= 5; blades++) {
      const passes = plankPasses(blades);
      expect(passes.reduce((n, p) => n + p.blades, 0)).toBe(PLANK_LAYERS - 1);
      let layers = PLANK_LAYERS;
      for (const p of passes) {
        expect(p.base + p.blades).toBe(layers);
        expect(p.blades).toBeLessThanOrEqual(blades);
        layers = p.base;
      }
      expect(layers).toBe(1);
    }
  });
  it('goes through its passes in order as the work goes on, and ends in the last one', () => {
    for (const level of [1, 25, 50]) {
      const n = plankPasses(bladesAt(level)).length;
      expect(plankPose(0, level)).toMatchObject({ pass: 0, passes: n });
      expect(plankPose(1, level).pass).toBe(n - 1);
      let last = 0;
      for (let i = 0; i <= 1000; i++) { const p = plankPose(i / 1000, level).pass; expect(p).toBeGreaterThanOrEqual(last); last = p; }
      expect(new Set(Array.from({ length: 1001 }, (_, i) => plankPose(i / 1000, level).pass)).size).toBe(n);
    }
    expect(plankPose(0.5, 1)).toMatchObject({ pass: 1, base: 2, blades: 1 });
    expect(plankPose(0.7, 25)).toMatchObject({ pass: 1, base: 1, blades: 1 });
  });
  it('rests at the heights of the first pass', () => {
    expect(restPass(1)).toEqual({ base: 3, blades: 1 });
    expect(restPass(25)).toEqual({ base: 2, blades: 2 });
    expect(restPass(50)).toEqual({ base: 1, blades: 3 });
  });
  it('feeds the log forward through the blades, brings it back between passes and sends it out of the machine in the last one', () => {
    for (const level of [1, 25, 50]) {
      const n = plankPasses(bladesAt(level)).length;
      expect(plankPose(0, level).x).toBeCloseTo(X_IN);
      expect(plankPose(1, level).x).toBeGreaterThan(X_THROUGH);
      expect(plankPose(1, level).x).toBeCloseTo(X_OUT, 1);
      expect(plankPose(1, level).back).toBe(false);
      for (let pass = 0; pass < n - 1; pass++) {
        const fwd = plankPose((pass + 0.5) / n, level), back = plankPose((pass + 0.8) / n, level);
        expect(fwd.back).toBe(false);
        expect(back.back).toBe(true);
        expect(back.x).toBeLessThan(X_THROUGH);
        expect(plankPose((pass + 1) / n - 1e-6, level).x).toBeCloseTo(X_IN, 1); // back at the start when the next pass begins
      }
    }
  });
  it('never makes the log jump within a pass', () => {
    for (const level of [1, 25, 50]) {
      let last = plankPose(0, level);
      for (let i = 1; i <= 2000; i++) {
        const p = plankPose(i / 2000, level);
        if (p.pass === last.pass) expect(Math.abs(p.x - last.x)).toBeLessThan(0.05);
        last = p;
      }
    }
  });
});
