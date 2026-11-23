import { describe, expect, it } from 'vitest';
import { PLANK_LAYERS, THIRD_BLADE_LEVEL, SECOND_BLADE_LEVEL, X_BACK, X_IN, X_OUT, X_THROUGH, bladesAt, plankPasses, plankPose, restPass } from './idlePlankPose';

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
  it('feeds the log forward through the blades and brings it back between passes; in the last pass it stays through the blades and goes out as planks', () => {
    for (const level of [1, 25, 50]) {
      const n = plankPasses(bladesAt(level)).length;
      expect(plankPose(0, level).x).toBeCloseTo(X_IN);
      expect(plankPose(1, level)).toMatchObject({ x: X_THROUGH, back: false, last: true });
      for (let pass = 0; pass < n - 1; pass++) {
        const fwd = plankPose((pass + 0.25) / n, level), back = plankPose((pass + 0.8) / n, level);
        expect(fwd.back).toBe(false);
        expect(back.back).toBe(true);
        expect(back.x).toBeLessThan(X_THROUGH);
        expect(plankPose((pass + 1) / n - 1e-6, level).x).toBeCloseTo(X_BACK, 1); // pulled right back to the start of the belt when the next pass begins
        expect(plankPose((pass + 1) / n + 1e-6, level).x).toBeCloseTo(X_BACK, 1);
      }
    }
  });
  it('puts the planks cut off in a pass on the output stack while the log comes back, and ends with all of them there', () => {
    for (const level of [1, 25, 50]) {
      const plan = plankPasses(bladesAt(level)), n = plan.length;
      let planks = 0;
      plan.forEach((p, pass) => {
        const start = plankPose(pass / n + 1e-6, level), end = plankPose((pass + 1) / n - 1e-6, level);
        expect(start.stacked).toBe(planks);                  // what the earlier passes have put there
        expect(start.glide).toBe(0);
        expect(end.glide).toBeCloseTo(1, 1);                 // by the end of the pass they have all arrived
        planks += pass === n - 1 ? p.base + p.blades : p.blades; // the last pass sends the whole log out
      });
      expect(planks).toBe(PLANK_LAYERS);
      expect(plankPose(1, level).stacked + plan[n - 1].base + plan[n - 1].blades).toBe(PLANK_LAYERS);
    }
  });
  it('never makes the log jump within a pass', () => {
    for (const level of [1, 25, 50]) {
      let last = plankPose(0, level);
      for (let i = 1; i <= 2000; i++) {
        const p = plankPose(i / 2000, level);
        if (p.pass === last.pass) { expect(Math.abs(p.x - last.x)).toBeLessThan(0.05); expect(p.glide).toBeGreaterThanOrEqual(last.glide); }
        last = p;
      }
    }
  });
  it('keeps the blades where they are and raises the log instead, so that every cut is at the height of a blade', () => {
    for (const level of [1, 25, 50]) {
      const plan = plankPasses(bladesAt(level)), n = plan.length;
      plan.forEach((p, pass) => {
        const fwd = plankPose((pass + 0.25) / n, level);
        expect(fwd.base0).toBe(plan[0].base);
        expect(fwd.lift).toBe(plan[0].base - p.base);          // raised by the planks it has lost
        expect(fwd.lift + fwd.base).toBe(fwd.base0);            // so the lowest cut is at the lowest blade
        expect(fwd.total).toBe(plan[0].blades);
        expect(fwd.blades).toBeLessThanOrEqual(fwd.total);
      });
      let last = -1;
      for (let i = 0; i <= 2000; i++) { const lift = plankPose(i / 2000, level).lift; expect(lift).toBeGreaterThanOrEqual(last - 1e-9); last = lift; } // it only goes up, smoothly
    }
  });
  it('brings the log all the way back to the start first and only then raises it for the next pass', () => {
    for (const level of [1, 25]) {
      const n = plankPasses(bladesAt(level)).length;
      for (let i = 0; i <= 3000; i++) {
        const p = plankPose(i / 3000, level);
        if (p.lift > p.liftFrom + 1e-9) { expect(p.x).toBeCloseTo(X_BACK); expect(p.back).toBe(true); expect(p.pass).toBeLessThan(n - 1); }
      }
      expect(plankPose(0.999 / n, level).lift).toBeCloseTo(plankPose(1.001 / n, level).lift, 1); // and it is at the new height when the next pass begins
    }
  });
  it('has the log clear of the output stack when it is through the blades, and short of the blades when it waits', () => {
    const LOG = 1.4, TEETH = 1.1 - 0.12; // the log's length; where the blades' teeth are (BX - DEPTH in idlePlank.ts)
    expect(X_THROUGH + LOG).toBeLessThanOrEqual(X_OUT);
    expect(X_IN + LOG).toBeLessThan(TEETH);
    expect(X_THROUGH).toBeGreaterThan(1.1 + 0.17); // its back end is past the blade's body
  });
});
