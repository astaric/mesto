import { beforeEach, describe, expect, it, vi } from 'vitest';

// millSave is read from localStorage once, when the module is first imported, so each test sets the storage
// up and then imports a fresh copy of the module.
async function load(stored?: unknown) {
  localStorage.clear();
  if (stored !== undefined) localStorage.setItem('mill-save', typeof stored === 'string' ? stored : JSON.stringify(stored));
  vi.resetModules();
  return import('./millSave');
}

describe('millSave', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty, with the free gear and nobody hired', async () => {
    const s = (await load()).millSave;
    expect(s.logs + s.planks + s.sold).toBe(0);
    expect(s.gear).toEqual({ axe: 0, saw: 0, tools: 0 });
    expect(Object.values(s.workers)).toEqual([0, 0, 0, 0]);
    expect(s.made).toEqual([]);
  });

  it('survives corrupt data', async () => {
    for (const bad of ['{nope', '"a string"', '42', 'null', '[1]']) {
      expect((await load(bad)).millSave.logs).toBe(0);
    }
  });

  it('clamps numbers, drops unknown products and keeps gear and workers inside their tiers', async () => {
    const s = (await load({ logs: -4, planks: 'x', sold: 3.7, goods: { table: 2, ufo: 9 }, made: ['table', 'ufo', 'table'], gear: { axe: 99, saw: 1 }, workers: { sawyer: 7, seller: 2 }, pick: 'ufo' })).millSave;
    expect(s.logs).toBe(0);
    expect(s.planks).toBe(0);
    expect(s.sold).toBe(3);
    expect(s.goods.table).toBe(2);
    expect('ufo' in s.goods).toBe(false);
    expect(s.made).toEqual(['table']);
    expect(s.gear).toEqual({ axe: 3, saw: 1, tools: 0 });
    expect(s.workers).toMatchObject({ sawyer: 3, seller: 2, lumberjack: 0 });
    expect(s.pick).toBe('spoon');
  });

  it('saveMill() writes what a later load reads back', async () => {
    const m = await load();
    m.millSave.logs = 5; m.millSave.gear.axe = 2; m.millSave.pick = 'horse';
    m.saveMill();
    vi.resetModules();
    const s = (await import('./millSave')).millSave;
    expect(s).toMatchObject({ logs: 5, pick: 'horse' });
    expect(s.gear.axe).toBe(2);
  });
});
