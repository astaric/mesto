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
    expect((await load()).profile).toEqual({ coins: 0, pet: 'dog', petOwned: false, color: 'brown', owned: [] });
  });

  it('survives corrupt data', async () => {
    for (const bad of ['{nope', '"a string"', '42', 'null', '[1,2]']) {
      expect((await load(bad)).profile).toEqual({ coins: 0, pet: 'dog', petOwned: false, color: 'brown', owned: [] });
    }
  });

  it('keeps what was saved, and never has negative or odd coins or an unknown pet', async () => {
    expect((await load({ coins: 12, pet: 'cat', petOwned: true })).profile).toEqual({ coins: 12, pet: 'cat', petOwned: true, color: 'brown', owned: ['cat'] });
    expect((await load({ coins: 1, pet: 'hound', petOwned: true, color: 'white', owned: ['hound-white'] })).profile).toEqual({ coins: 1, pet: 'hound', petOwned: true, color: 'white', owned: ['hound-white'] });
    expect((await load({ coins: -5, pet: 'dragon' })).profile).toEqual({ coins: 0, pet: 'dog', petOwned: false, color: 'brown', owned: [] });
    expect((await load({ coins: 'lots' })).profile.coins).toBe(0);
  });

  it('keeps the dog coat; old saves (no coat) get the look they always had', async () => {
    expect((await load({ pet: 'dog', petOwned: true })).profile.color).toBe('brown');
    expect((await load({ pet: 'hound', petOwned: true })).profile.color).toBe('black');
    expect((await load({ pet: 'dog', petOwned: true, color: 'plaid' })).profile.color).toBe('brown');
    expect((await load({ pet: 'dog', petOwned: true, color: 'pink' })).profile.color).toBe('pink');
  });

  it('owns every pet and coat it was bought in; taking an owned one again is free', async () => {
    const m = await load({ pet: 'dog', petOwned: true, color: 'green' });
    expect(m.profile.owned).toEqual(['dog-green']);   // an old save owns just its one pet
    expect(m.hasPet('dog', 'green')).toBe(true);
    expect(m.hasPet('dog', 'blue')).toBe(false);
    m.takePet('hound', 'black');
    m.takePet('cat', 'blue');                           // the coat means nothing for a cat
    m.takePet('dog', 'green');                          // back to the first one
    expect(m.profile.owned).toEqual(['dog-green', 'hound-black', 'cat']);
    expect(m.isCurrentPet('dog', 'green')).toBe(true);
    expect(m.isCurrentPet('dog', 'blue')).toBe(false);
    expect(m.isCurrentPet('cat', 'brown')).toBe(false);
    m.takePet('cat', 'brown');
    expect(m.isCurrentPet('cat', 'red')).toBe(true);
    expect(m.profile.color).toBe('green');              // a cat does not change the dog coat
    vi.resetModules();
    expect((await import('./profile')).profile.owned).toEqual(['dog-green', 'hound-black', 'cat']);
  });

  it('drops unknown or repeated owned entries', async () => {
    expect((await load({ owned: ['cat', 'cat', 'dragon', 7, 'hound-pink'], pet: 'cat', petOwned: true })).profile.owned).toEqual(['cat', 'hound-pink']);
  });

  it('names a texture file for every pet and coat', async () => {
    const m = await load();
    const { artKeys } = await import('../test/art');
    for (const pet of ['dog', 'cat', 'bunny', 'hound'] as const) {
      for (const c of m.PET_COLORS) expect(artKeys.has(m.petTexture(pet, c)), `${pet} ${c}`).toBe(true);
    }
    for (const c of m.PET_COLORS) for (const f of [1, 2] as const) expect(artKeys.has(m.houndRunTexture(c, f))).toBe(true);
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
