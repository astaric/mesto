import { describe, expect, it } from 'vitest';
import { BELT_SPEED, LAST_S, PASS_S, ROLL_S, discsAt, passesFor, sawFlats, sawPose as pose, sawTotalS } from './idleSawPose';
import { TRANSFER_SPEED } from './idleTransfer';

const sawPose = (f: number): ReturnType<typeof pose> => pose(f, 1.4);
/** The pose `t` seconds into the work of a saw with `discs` discs. */
const at = (t: number, discs = 1): ReturnType<typeof pose> => pose(t / sawTotalS(discs), 1.4, discs);

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
  it('makes one more cut with every pass and the trunk goes back and rolls in between', () => {
    for (let pass = 0; pass < 3; pass++) {
      const back = at(pass * PASS_S + PASS_S * 0.7), roll = at(pass * PASS_S + PASS_S - ROLL_S / 2);
      expect(back.cuts).toBe(pass + 1);
      expect(back.rolling).toBe(false);
      expect(roll.rolling).toBe(true);
      expect(roll.x).toBeCloseTo(0.05);
      expect(roll.turn).toBeGreaterThan(0);
      expect(at((pass + 1) * PASS_S + 0.001).cuts).toBe(pass + 1);
    }
  });
  it('moves the trunk at the speed of the conveyors', () => {
    expect(TRANSFER_SPEED).toBe(BELT_SPEED);
    const dt = 0.01;
    expect((at(0.5 + dt).x - at(0.5).x) / dt).toBeCloseTo(BELT_SPEED, 3); // forward
    expect((at(PASS_S * 0.7 + dt).x - at(PASS_S * 0.7).x) / dt).toBeCloseTo(-BELT_SPEED, 3); // back
    expect((at(3 * PASS_S + 0.2 + dt).x - at(3 * PASS_S + 0.2).x) / dt).toBeCloseTo(BELT_SPEED, 3); // the last pass out
    expect(sawTotalS(1)).toBeCloseTo(3 * PASS_S + LAST_S);
  });
  it('only cuts while the trunk is at the disc, and the position never jumps', () => {
    expect(sawPose(0).cutting).toBe(false);
    expect(at(0.6).cutting).toBe(true);
    const n = 4000;
    let last = sawPose(0).x;
    for (let i = 1; i <= n; i++) {
      const x = sawPose(i / n).x;
      if (Math.floor((i / n) * sawTotalS(1) / PASS_S) === Math.floor(((i - 1) / n) * sawTotalS(1) / PASS_S)) expect(Math.abs(x - last)).toBeLessThan(0.05);
      last = x;
    }
  });
});

describe('log saw discs', () => {
  it('has 1, 2 and 4 discs at levels 1, 25 and 50 and needs 4, 2 and 1 passes', () => {
    expect([1, 24, 25, 49, 50, 300].map(discsAt)).toEqual([1, 1, 2, 2, 4, 4]);
    expect([1, 2, 4].map(passesFor)).toEqual([4, 2, 1]);
  });
  it('makes as many cuts per pass as it has discs and ends with four, out of the machine', () => {
    for (const discs of [2, 4]) {
      const passes = passesFor(discs), z = pose(1, 1.4, discs);
      expect(z.pass).toBe(passes - 1);
      expect(z.cuts).toBe(4);
      expect(z.x).toBeGreaterThan(1.5);
      for (let pass = 0; pass < passes - 1; pass++) expect(at(pass * PASS_S + PASS_S * 0.7, discs).cuts).toBe((pass + 1) * discs);
    }
  });
  it('rolls the trunk between the two passes of two discs and never in the single pass of four', () => {
    expect(at(PASS_S * 0.7, 2).rolling).toBe(false);
    expect(at(PASS_S * 0.7, 2).cuts).toBe(2);
    expect(at(PASS_S - ROLL_S / 2, 2).rolling).toBe(true);
    for (let i = 0; i <= 100; i++) expect(pose(i / 100, 1.4, 4).rolling).toBe(false);
  });
  it('puts every flat on a different side of the finished trunk', () => {
    const sides = (flats: number[]): string[] => flats.map((a) => ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4).map(String).sort();
    for (const discs of [1, 2, 4]) expect(sides(sawFlats(passesFor(discs) - 1, discs, 0, true))).toEqual(['0', '1', '2', '3']);
  });
});
