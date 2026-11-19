import { beforeEach, describe, expect, it, vi } from 'vitest';

// huntSave is read from localStorage once, when the module is first imported, so each test sets the storage
// up and then imports a fresh copy of the module.
async function load(stored?: unknown) {
  localStorage.clear();
  if (stored !== undefined) localStorage.setItem('hunt-save', typeof stored === 'string' ? stored : JSON.stringify(stored));
  vi.resetModules();
  return import('./huntSave');
}

describe('huntSave', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the free rifle', async () => {
    expect((await load()).huntSave).toEqual({ owned: ['rifle'], weapon: 'rifle' });
  });

  it('survives corrupt data', async () => {
    for (const bad of ['{nope', '"a string"', '42', 'null']) {
      expect((await load(bad)).huntSave).toEqual({ owned: ['rifle'], weapon: 'rifle' });
    }
  });

  it('keeps what was saved', async () => {
    expect((await load({ owned: ['rifle', 'double'], weapon: 'double' })).huntSave).toEqual({ owned: ['rifle', 'double'], weapon: 'double' });
  });

  it('drops rifles that do not exist, always owns the first, and falls back when the one in hand is not owned', async () => {
    expect((await load({ owned: ['bazooka', 'scope'], weapon: 'scope' })).huntSave).toEqual({ owned: ['rifle', 'scope'], weapon: 'scope' });
    expect((await load({ owned: ['rifle'], weapon: 'repeater' })).huntSave.weapon).toBe('rifle');
  });

  it('saveHunt() writes what a later load reads back', async () => {
    const m = await load();
    m.huntSave.owned.push('repeater'); m.huntSave.weapon = 'repeater';
    m.saveHunt();
    vi.resetModules();
    expect((await import('./huntSave')).huntSave).toEqual({ owned: ['rifle', 'repeater'], weapon: 'repeater' });
  });
});
