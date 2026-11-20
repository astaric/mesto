import { describe, expect, it } from 'vitest';
import {
  ASSIST_RADIUS, NET_RADIUS, QUOTA, addCatch, aimAt, isDone, netCatches, newCaught, nextKind, resolveCast, type Swimmer,
} from './fishingLogic';

const fish = (kind: 'small' | 'big', x: number, y: number, vx = 0): Swimmer => ({ kind, x, y, vx });

describe('nets', () => {
  it('a net catches only the fish of its own size', () => {
    expect(netCatches('small', 'small')).toBe(true);
    expect(netCatches('big', 'big')).toBe(true);
    expect(netCatches('small', 'big')).toBe(false);
    expect(netCatches('big', 'small')).toBe(false);
  });

  it('the big net is the bigger one', () => expect(NET_RADIUS.big).toBeGreaterThan(NET_RADIUS.small));
});

describe('resolveCast', () => {
  const school = [fish('small', 100, 100), fish('big', 130, 100), fish('small', 100 + NET_RADIUS.small + 40, 100)];

  it('the small net takes the small fish under it, the big one slips away', () => {
    expect(resolveCast('small', { x: 100, y: 100 }, school)).toEqual({ caught: [0], slipped: [1] });
  });

  it('the big net takes the big fish, the small ones slip through the mesh', () => {
    expect(resolveCast('big', { x: 100, y: 100 }, school)).toEqual({ caught: [1], slipped: [0, 2] });
  });

  it('a net takes several fish at once and ignores the ones outside it', () => {
    const r = resolveCast('small', { x: 0, y: 0 }, [fish('small', 10, 0), fish('small', -20, 30), fish('small', 500, 0)]);
    expect(r).toEqual({ caught: [0, 1], slipped: [] });
  });

  it('a cast on open water catches nothing', () => {
    expect(resolveCast('big', { x: 0, y: 0 }, [fish('big', 2000, 0)])).toEqual({ caught: [], slipped: [] });
  });
});

describe('aimAt', () => {
  it('without a fish near the tap the net goes where the finger is', () => {
    expect(aimAt({ x: 50, y: 60 }, [fish('big', 50 + ASSIST_RADIUS + 10, 60)], 400)).toEqual({ x: 50, y: 60 });
  });

  it('with a fish near the tap the net goes where that fish will be when it lands', () => {
    expect(aimAt({ x: 0, y: 0 }, [fish('small', 100, 20, 200)], 500)).toEqual({ x: 200, y: 20 });
  });

  it('it picks the nearest fish', () => {
    expect(aimAt({ x: 0, y: 0 }, [fish('big', 150, 0), fish('small', 40, 0)], 0)).toEqual({ x: 40, y: 0 });
  });
});

describe('the catch', () => {
  it('counts per kind and stops at the quota', () => {
    let c = newCaught();
    for (let i = 0; i < QUOTA.small + 3; i++) c = addCatch(c, 'small');
    expect(c).toEqual({ small: QUOTA.small, big: 0 });
  });

  it('is done only when both kinds are full', () => {
    let c = newCaught();
    for (let i = 0; i < QUOTA.small; i++) c = addCatch(c, 'small');
    expect(isDone(c)).toBe(false);
    for (let i = 0; i < QUOTA.big; i++) c = addCatch(c, 'big');
    expect(isDone(c)).toBe(true);
  });

  it('the next fish is of the kind that is still missing, and both turn up while both are missing', () => {
    expect(nextKind({ small: QUOTA.small, big: 0 }, 0)).toBe('big');
    expect(nextKind({ small: 0, big: QUOTA.big }, 0.99)).toBe('small');
    expect(nextKind(newCaught(), 0)).toBe('small');
    expect(nextKind(newCaught(), 0.99)).toBe('big');
  });
});
