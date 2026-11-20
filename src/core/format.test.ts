import { describe, expect, it } from 'vitest';
import { formatNumber, suffixOf } from './format';

describe('formatNumber', () => {
  it('shows numbers below a thousand whole', () => {
    expect([0, 7, 42, 999].map(formatNumber)).toEqual(['0', '7', '42', '999']);
    expect(formatNumber(12.4)).toBe('12.4');
    expect(formatNumber(999.4)).toBe('999.4');
  });

  it('uses K, M, B, T with three significant digits and no trailing zeros', () => {
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(12_345)).toBe('12.3K');
    expect(formatNumber(123_456)).toBe('123K');
    expect(formatNumber(1_234_567)).toBe('1.23M');
    expect(formatNumber(2_000_000_000)).toBe('2B');
    expect(formatNumber(4.56e12)).toBe('4.56T');
  });

  it('carries over instead of showing 1000K', () => {
    expect(formatNumber(999_999)).toBe('1M');
    expect(formatNumber(999_900)).toBe('1M');
    expect(formatNumber(999_400)).toBe('999K');
  });

  it('goes on with aa, ab, ... after T, then ba, bb ...', () => {
    expect(formatNumber(1e15)).toBe('1aa');
    expect(formatNumber(2.5e18)).toBe('2.5ab');
    expect(formatNumber(1e15 * 1000 ** 25)).toBe('1az');
    expect(formatNumber(1e15 * 1000 ** 26)).toBe('1ba');
    expect(suffixOf(5)).toBe('aa');
    expect(suffixOf(5 + 26 * 26 - 1)).toBe('zz');
    expect(suffixOf(5 + 26 * 26)).toBeNull();
  });

  it('has enough suffixes for every number a double can hold, and handles negatives and non-numbers', () => {
    expect(formatNumber(1e250)).toBe('10da');
    expect(formatNumber(Number.MAX_VALUE)).toMatch(/^\d+(\.\d+)?[a-z]{2}$/);
    expect(formatNumber(-1500)).toBe('-1.5K');
    expect(formatNumber(Infinity)).toBe('Infinity');
    expect(formatNumber(NaN)).toBe('NaN');
  });
});
