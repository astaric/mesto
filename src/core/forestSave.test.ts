import { beforeEach, describe, expect, it, vi } from 'vitest';

// forestSave is read from localStorage once, when the module is first imported, so each test sets the storage
// up and then imports a fresh copy of the module.
async function load(stored?: unknown, oldBest?: string) {
  localStorage.clear();
  if (stored !== undefined) localStorage.setItem('forest-save', typeof stored === 'string' ? stored : JSON.stringify(stored));
  if (oldBest !== undefined) localStorage.setItem('forest-best', oldBest);
  vi.resetModules();
  return import('./forestSave');
}

describe('forestSave', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the pistol and nothing else', async () => {
    const { forestSave } = await load();
    expect(forestSave).toEqual({ owned: ['pistol'], weapon: 'pistol', best: 0, runs: 0 });
  });

  it('survives corrupt data', async () => {
    for (const bad of ['{nope', '"a string"', '42', 'null', '[1,2]']) {
      const { forestSave } = await load(bad);
      expect(forestSave).toEqual({ owned: ['pistol'], weapon: 'pistol', best: 0, runs: 0 });
    }
  });

  it('keeps what was saved', async () => {
    const { forestSave } = await load({ owned: ['pistol', 'smg'], weapon: 'smg', best: 321 });
    expect(forestSave).toEqual({ owned: ['pistol', 'smg'], weapon: 'smg', best: 321, runs: 0 });
  });

  it('drops weapons that do not exist and always owns the pistol', async () => {
    const { forestSave } = await load({ owned: ['bazooka', 'laser'], weapon: 'laser' });
    expect(forestSave.owned).toEqual(['pistol', 'laser']);
    expect(forestSave.weapon).toBe('laser');
  });

  it('falls back to the pistol when the equipped weapon is not owned', async () => {
    const { forestSave } = await load({ owned: ['pistol'], weapon: 'rocket' });
    expect(forestSave.weapon).toBe('pistol');
  });

  it('takes over the record that used to be stored under its own key, and keeps the higher one', async () => {
    expect((await load(undefined, '88')).forestSave.best).toBe(88);
    expect((await load({ best: 50 }, '88')).forestSave.best).toBe(88);
    expect((await load({ best: 120 }, '88')).forestSave.best).toBe(120);
  });

  it('saveForest() writes what a later load reads back', async () => {
    const m = await load();
    m.forestSave.owned.push('shotgun'); m.forestSave.weapon = 'shotgun'; m.forestSave.best = 9; m.forestSave.runs = 4;
    m.saveForest();
    vi.resetModules();
    const again = await import('./forestSave');
    expect(again.forestSave).toEqual({ owned: ['pistol', 'shotgun'], weapon: 'shotgun', best: 9, runs: 4 });
  });
});
