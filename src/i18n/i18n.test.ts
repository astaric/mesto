import { describe, expect, it } from 'vitest';
import { en } from './en';
import { sl } from './sl';
import { t } from './index';

const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();

describe('translations', () => {
  const keys = Object.keys(en) as (keyof typeof en)[];

  it('Slovene has the same keys as English', () => expect(Object.keys(sl).sort()).toEqual([...keys].sort()));

  it('no translation is empty', () => {
    for (const k of keys) { expect(en[k].trim(), `en ${k}`).not.toBe(''); expect(sl[k].trim(), `sl ${k}`).not.toBe(''); }
  });

  it('both languages use the same {placeholders}', () => {
    for (const k of keys) expect(placeholders(sl[k]), k).toEqual(placeholders(en[k]));
  });

  it('keys contain no Slovene letters (English identifiers only)', () => {
    for (const k of keys) expect(k, k).toMatch(/^[a-zA-Z0-9.]+$/);
  });
});

describe('t()', () => {
  it('fills placeholders and leaves unknown ones as they are', () => {
    expect(t('quest.coin', { n: '3/6' })).toContain('3/6');
    expect(t('quest.coin', { other: 1 })).toContain('{n}');
  });
  it('without parameters returns the text as is', () => expect(t('title.play')).toBeTruthy());
});
