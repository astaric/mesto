import { describe, expect, it } from 'vitest';
import { artKeys } from '../../test/art';
import { en } from '../../i18n/en';
import { INGREDIENTS, TIERS, check, layersOf, type Ingredient } from './pizzaData';

const all = TIERS.flat();

describe('pizza data', () => {
  it('has three tiers, every pizza is named and every ingredient has layer art and an icon', () => {
    expect(TIERS).toHaveLength(3);
    for (const p of all) expect(`pizza.${p.id}` in en, p.id).toBe(true);
    for (const k of INGREDIENTS) expect(artKeys.has(`pizza-${k}`), `pizza-${k}`).toBe(true);
    expect(artKeys.has('pizza-dough')).toBe(true);
  });

  it('pizza ids are unique, and later tiers need at least as many toppings', () => {
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    const most = TIERS.map((t) => Math.max(...t.map((p) => p.toppings.length)));
    expect(most[0]).toBeLessThanOrEqual(most[1]);
    expect(most[1]).toBeLessThanOrEqual(most[2]);
  });

  it('layersOf shows the base, then the toppings', () => {
    const romana = all.find((p) => p.id === 'romana')!;
    expect(layersOf(romana)).toEqual(['sauce', 'cheese', 'ham']);
  });
});

describe('check', () => {
  const romana = all.find((p) => p.id === 'romana')!;
  const harlekin = all.find((p) => p.id === 'harlekin')!;

  it('accepts the exact pizza', () => expect(check(['sauce', 'cheese', 'ham'], romana)).toBe(true));
  it('accepts toppings in any order', () => {
    expect(check(['sauce', 'cheese', 'olives', 'frankfurter', 'ham', 'mushrooms'], harlekin)).toBe(true);
    expect(check(['sauce', 'cheese', 'mushrooms', 'ham', 'olives', 'frankfurter'], harlekin)).toBe(true);
  });
  it('needs sauce then cheese first', () => {
    expect(check(['cheese', 'sauce', 'ham'], romana)).toBe(false);
    expect(check(['ham', 'sauce', 'cheese'], romana)).toBe(false);
  });
  it('rejects missing, extra and wrong toppings', () => {
    expect(check(['sauce', 'cheese'], romana)).toBe(false);
    expect(check(['sauce', 'cheese', 'ham', 'ham'], romana)).toBe(false);
    expect(check(['sauce', 'cheese', 'ham', 'onion'], romana)).toBe(false);
    expect(check(['sauce', 'cheese', 'onion'], romana)).toBe(false);
    expect(check([], romana)).toBe(false);
  });
  it('does not mutate the order it was given', () => {
    const order: Ingredient[] = ['sauce', 'cheese', 'mushrooms', 'ham', 'olives', 'frankfurter'];
    const copy = [...order];
    check(order, harlekin);
    expect(order).toEqual(copy);
  });
  it('every pizza passes its own check', () => {
    for (const p of all) expect(check(layersOf(p), p), p.id).toBe(true);
  });
});
