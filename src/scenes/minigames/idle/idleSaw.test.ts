import { describe, expect, it } from 'vitest';
import { BELT_END, BELT_SPEED, BX, BX_V, LAST_S, OUT_STATION_X, PASS_S, ROLL_S, X_OUT, bladeX, passesFor, sawBladesAt, sawFlats, sawPose as pose, sawTotalS } from './idleSawPose';
import { TRANSFER_SPEED } from './idleTransfer';

const L = 1.4;
/** The pose `t` seconds into the work of a saw with `blades` blades. */
const at = (t: number, blades = 1): ReturnType<typeof pose> => pose(t / sawTotalS(blades), L, blades);

describe('log saw', () => {
  it('starts at the input end with nothing cut and ends out of the machine, past every blade, with four cuts', () => {
    for (const blades of [1, 2, 4]) {
      const a = pose(0, L, blades), z = pose(1, L, blades);
      expect(a.pass).toBe(0);
      expect(a.cuts).toBe(0);
      expect(a.x).toBeCloseTo(0.05);
      expect(z.pass).toBe(passesFor(blades) - 1);
      expect(z.cuts).toBe(4);
      expect(z.x).toBeCloseTo(X_OUT);
      expect(z.x).toBeGreaterThan(bladeX(3).to);
    }
  });
  it('has the finished log on the belt, whose end the output forklift stops at', () => {
    expect(BELT_END).toBeCloseTo(X_OUT + L);
    expect(OUT_STATION_X).toBeCloseTo(BELT_END + 0.714);
    expect(bladeX(2).from).toBeGreaterThan(bladeX(0).to); // the vertical blades stand beyond the horizontal ones: they never cross
    expect(BX_V).toBeGreaterThan(BX);
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
  it('only cuts while the trunk is at a blade, and the position never jumps', () => {
    expect(pose(0, L).cutting).toBe(false);
    expect(at(0.01).cutting).toBe(false); // the front end is still short of the teeth
    expect(at(0.5).cutting).toBe(true);
    const n = 4000;
    let last = pose(0, L).x;
    for (let i = 1; i <= n; i++) {
      const x = pose(i / n, L).x;
      if (Math.floor((i / n) * sawTotalS(1) / PASS_S) === Math.floor(((i - 1) / n) * sawTotalS(1) / PASS_S)) expect(Math.abs(x - last)).toBeLessThan(0.05);
      last = x;
    }
  });
});

describe('log saw blades', () => {
  it('has 1, 2 and 4 blades at levels 1, 25 and 50 and needs 4, 2 and 1 passes', () => {
    expect([1, 24, 25, 49, 50, 300].map(sawBladesAt)).toEqual([1, 1, 2, 2, 4, 4]);
    expect([1, 2, 4].map(passesFor)).toEqual([4, 2, 1]);
  });
  it('makes as many cuts per pass as it has blades and ends with four, out of the machine', () => {
    for (const blades of [2, 4]) {
      const passes = passesFor(blades);
      for (let pass = 0; pass < passes - 1; pass++) expect(at(pass * PASS_S + PASS_S * 0.7, blades).cuts).toBe((pass + 1) * blades);
    }
  });
  it('rolls the trunk between the two passes of two blades and never in the single pass of four', () => {
    expect(at(PASS_S * 0.7, 2).rolling).toBe(false);
    expect(at(PASS_S * 0.7, 2).cuts).toBe(2);
    expect(at(PASS_S - ROLL_S / 2, 2).rolling).toBe(true);
    for (let i = 0; i <= 100; i++) expect(pose(i / 100, L, 4).rolling).toBe(false);
  });
  it('reaches the blades one pair after the other in the single pass: the horizontal ones first, the vertical ones further down', () => {
    expect(pose(0, L, 4).reached).toBe(0);
    let seen2 = false;
    for (let i = 0; i <= 1000; i++) {
      const p = pose(i / 1000, L, 4);
      if (p.reached === 2) seen2 = true;
      expect([0, 2, 4]).toContain(p.reached);
    }
    expect(seen2).toBe(true);
    expect(pose(1, L, 4).reached).toBe(4);
  });
  it('puts every flat on a different side of the finished trunk', () => {
    const sides = (flats: number[]): string[] => flats.map((a) => ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4).map(String).sort();
    for (const blades of [1, 2, 4]) expect(sides(sawFlats(passesFor(blades) - 1, blades, 0))).toEqual(['0', '1', '2', '3']);
  });
  it('has only the first blades\' flats on a trunk that has not been through the rest', () => {
    expect(sawFlats(0, 4, 0, 0)).toHaveLength(0);
    expect(sawFlats(0, 4, 0, 2)).toHaveLength(2);
    expect(sawFlats(1, 2, 0, 0)).toHaveLength(2); // the second pass: the first pass's two, none of this one's yet
  });
});
