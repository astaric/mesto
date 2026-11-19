import { describe, expect, it } from 'vitest';
import { forestStars, payoutFor, starsFor } from './stars';

describe('starsFor', () => {
  it('3 / 2 / 1 stars by misses', () => {
    expect([0, 2].map((m) => starsFor(m))).toEqual([3, 3]);
    expect([3, 5].map((m) => starsFor(m))).toEqual([2, 2]);
    expect([6, 40].map((m) => starsFor(m))).toEqual([1, 1]);
  });
  it('takes its own limits', () => {
    expect(starsFor(1, [0, 1])).toBe(2);
  });
});

describe('forestStars', () => {
  it('a win is 3 stars whatever the quests', () => expect(forestStars(true, 0)).toBe(3));
  it('a star per two quests, at most 3, none for none', () => {
    expect([0, 1, 2, 3, 5, 9].map((q) => forestStars(false, q))).toEqual([0, 1, 1, 2, 3, 3]);
  });
});

describe('payoutFor', () => {
  it('pays more for more stars, nothing for none', () => {
    expect([0, 1, 2, 3].map(payoutFor)).toEqual([0, 2, 4, 6]);
  });
  it('clamps out-of-range stars', () => {
    expect([-1, 7, 2.9].map(payoutFor)).toEqual([0, 6, 4]);
  });
});
