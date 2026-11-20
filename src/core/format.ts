// Big numbers for the idle game (and every price and wallet): 999, 1.5K, 12.3K, 123K, 1.23M, ... B, T, then aa, ab, ... az, ba, ... (the way incremental games count).
// A number keeps three significant digits; below 1000 it is shown whole.

const NAMED = ['', 'K', 'M', 'B', 'T'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** The suffix of the n-th thousand: K, M, B, T for 1 - 4, then aa, ab, ... zz for 5 and up (676 of them); past that there is none and `formatNumber` falls back to an exponent. */
export function suffixOf(group: number): string | null {
  if (group < NAMED.length) return NAMED[group];
  const k = group - NAMED.length;
  return k < 26 * 26 ? LETTERS[Math.floor(k / 26)] + LETTERS[k % 26] : null;
}

/** 3 significant digits, no trailing zeros: 1.5, 12.3, 123. */
const digits = (m: number): string => {
  const s = m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : m.toFixed(0);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const sign = n < 0 ? '-' : '';
  let m = Math.abs(n);
  if (m < 1000) return sign + String(Math.round(m * 100) / 100 === Math.round(m) ? Math.round(m) : Math.round(m * 100) / 100);
  let group = 0;
  while (m >= 1000) { m /= 1000; group += 1; }
  if (digits(m) === '1000') { m = 1; group += 1; } // 999.9K is 1M, not 1000K
  const suffix = suffixOf(group);
  return suffix === null ? sign + n.toExponential(2).replace('+', '') : sign + digits(m) + suffix;
}
