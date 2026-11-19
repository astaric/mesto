import { beforeEach, describe, expect, it, vi } from 'vitest';

// profile is read from localStorage once, when the module is first imported, so each test sets the storage up
// and then imports a fresh copy.
async function load(stored?: unknown, legacy?: unknown) {
  localStorage.clear();
  if (stored !== undefined) localStorage.setItem('profile', typeof stored === 'string' ? stored : JSON.stringify(stored));
  if (legacy !== undefined) localStorage.setItem('forest-save', JSON.stringify(legacy));
  vi.resetModules();
  return import('./profile');
}

describe('profile', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', async () => {
    expect((await load()).profile).toEqual({ coins: 0, pet: 'dog', petOwned: false });
  });

  it('survives corrupt data', async () => {
    for (const bad of ['{nope', '"a string"', '42', 'null', '[1,2]']) {
      expect((await load(bad)).profile).toEqual({ coins: 0, pet: 'dog', petOwned: false });
    }
  });

  it('keeps what was saved, and never has negative or odd coins or an unknown pet', async () => {
    expect((await load({ coins: 12, pet: 'cat', petOwned: true })).profile).toEqual({ coins: 12, pet: 'cat', petOwned: true });
    expect((await load({ coins: -5, pet: 'dragon' })).profile).toEqual({ coins: 0, pet: 'dog', petOwned: false });
    expect((await load({ coins: 'lots' })).profile.coins).toBe(0);
  });

  it('takes over the coins the forest used to keep, only until there is a profile', async () => {
    expect((await load(undefined, { coins: 33 })).profile.coins).toBe(33);
    expect((await load({ coins: 2 }, { coins: 33 })).profile.coins).toBe(2);
  });

  it('earn and spend persist; spend refuses what the wallet cannot pay', async () => {
    const m = await load();
    m.earn(10);
    expect(m.spend(25)).toBe(false);
    expect(m.profile.coins).toBe(10);
    expect(m.spend(4)).toBe(true);
    vi.resetModules();
    expect((await import('./profile')).profile.coins).toBe(6);
  });
});
