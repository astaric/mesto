import { describe, expect, it } from 'vitest';
import { DEFS } from './forestData';
import { stepMotion, type Motion } from './motion';

const thing = (over: Partial<Motion> = {}): Motion => ({ x: 0, baseX: 0, z: 3000, lift: 0, vx: 0, t: 0, ...over });

/** One frame the way the scene does it: time passes, then the thing moves. */
function frame(e: Motion, kind: keyof typeof DEFS, dt: number, camX: number): void {
  e.t += dt;
  stepMotion(e, DEFS[kind], dt, camX);
}

describe('stepMotion', () => {
  it('leaves things without a move alone', () => {
    const e = thing({ x: 123, baseX: 123, lift: 40 });
    frame(e, 'honey', 0.5, 300);
    expect(e).toMatchObject({ x: 123, baseX: 123, lift: 40 });
  });

  it('homing steers the lane towards the player, at most `homing` px per second', () => {
    const e = thing({ baseX: -300, x: -300 });
    frame(e, 'bear', 0.1, 300); // bear: homing 95
    expect(e.baseX).toBeCloseTo(-300 + 9.5);
    const close = thing({ baseX: 290, x: 290 });
    frame(close, 'bear', 0.1, 300); // already near: does not overshoot
    expect(close.baseX).toBeCloseTo(299.5, 0);
    expect(close.baseX).toBeLessThanOrEqual(300);
  });

  it('homing stops when the thing is close', () => {
    const e = thing({ baseX: -300, x: -300, z: 600 });
    frame(e, 'bear', 0.1, 300);
    expect(e.baseX).toBe(-300);
  });

  it('sway keeps x within `amp` of the lane', () => {
    const e = thing({ baseX: 100, x: 100, z: 600 }); // no homing
    for (let i = 0; i < 200; i++) { frame(e, 'imp', 0.05, 0); expect(Math.abs(e.x - 100)).toBeLessThanOrEqual(280 + 1e-9); }
  });

  it('a thing with homing but no sway (the troll) sits on its lane', () => {
    const e = thing({ baseX: 50, x: 999, z: 600 });
    frame(e, 'troll', 0.1, 0);
    expect(e.x).toBe(50);
  });

  it('bob is added to the resting height, hop never goes below the ground', () => {
    const bat = thing({ z: 600 });
    for (let i = 0; i < 100; i++) {
      frame(bat, 'bat', 0.03, 0);
      expect(Math.abs(bat.lift - DEFS.bat.lift)).toBeLessThanOrEqual(50 + 1e-9);
    }
    const slime = thing({ z: 600 });
    for (let i = 0; i < 100; i++) { frame(slime, 'slime', 0.03, 0); expect(slime.lift).toBeGreaterThanOrEqual(0); expect(slime.lift).toBeLessThanOrEqual(70); }
  });

  it('drift moves x by vx and ignores the lane', () => {
    const e = thing({ x: 0, vx: 200 });
    frame(e, 'fireball', 0.5, 999);
    expect(e.x).toBeCloseTo(100);
    expect(e.baseX).toBe(0);
  });

  it('the spider drops from its start height to the ground and stays there', () => {
    const e = thing({ lift: DEFS.spider.move!.drop!.from, z: 600 });
    frame(e, 'spider', 0.1, 0);
    expect(e.lift).toBeCloseTo(650 - 42);
    for (let i = 0; i < 100; i++) frame(e, 'spider', 0.1, 0);
    expect(e.lift).toBe(0);
  });
});
