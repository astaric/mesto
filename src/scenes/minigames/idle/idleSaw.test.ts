import { describe, expect, it } from 'vitest';
import { sawPose as pose } from './idleSawPose';

const sawPose = (f: number): ReturnType<typeof pose> => pose(f, 1.4);

describe('log saw', () => {
  it('starts at the input end with nothing cut and ends out of the machine with four cuts', () => {
    const a = sawPose(0), z = sawPose(1);
    expect(a.pass).toBe(0);
    expect(a.cuts).toBe(0);
    expect(a.x).toBeCloseTo(0.05);
    expect(z.pass).toBe(3);
    expect(z.cuts).toBe(4);
    expect(z.allSawn).toBe(true);
    expect(z.x).toBeGreaterThan(1.5);
  });
  it('makes one more cut with every quarter of the work and the trunk goes back and rolls in between', () => {
    for (let pass = 0; pass < 3; pass++) {
      const back = sawPose((pass + 0.7) / 4), roll = sawPose((pass + 0.9) / 4);
      expect(back.cuts).toBe(pass + 1);
      expect(back.rolling).toBe(false);
      expect(roll.rolling).toBe(true);
      expect(roll.x).toBeCloseTo(0.05);
      expect(roll.turn).toBeGreaterThan(0);
      expect(sawPose((pass + 1) / 4 + 0.001).cuts).toBe(pass + 1);
    }
  });
  it('only cuts while the trunk is at the disc, and the position never jumps', () => {
    expect(sawPose(0).cutting).toBe(false);
    expect(sawPose(0.1).cutting).toBe(true);
    let last = sawPose(0).x;
    for (let i = 1; i <= 1000; i++) {
      const x = sawPose(i / 1000).x;
      if (Math.floor((i / 1000) * 4) === Math.floor(((i - 1) / 1000) * 4)) expect(Math.abs(x - last)).toBeLessThan(0.05);
      last = x;
    }
  });
});
