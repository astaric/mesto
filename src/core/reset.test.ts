import { beforeEach, describe, expect, it } from 'vitest';
import { resetProgress } from './reset';
import { earn, profile, saveProfile } from './profile';
import { forestSave, saveForest } from './forestSave';
import { huntSave, saveHunt } from './huntSave';
import { millSave, saveMill } from './millSave';
import { readItem, writeItem } from './storage';

describe('resetProgress', () => {
  beforeEach(() => localStorage.clear());

  it('erases coins, the pet and the forest save but keeps the language', () => {
    writeItem('lang', 'en');
    earn(30);
    profile.petOwned = true; saveProfile();
    forestSave.best = 400; saveForest();
    writeItem('forest-best', '300');
    huntSave.owned.push('scope'); saveHunt();
    millSave.logs = 3; saveMill();
    expect(readItem('mill-save')).not.toBeNull();
    expect(readItem('profile')).not.toBeNull();
    expect(readItem('hunt-save')).not.toBeNull();
    resetProgress();
    expect(readItem('hunt-save')).toBeNull();
    expect(readItem('mill-save')).toBeNull();
    expect(readItem('profile')).toBeNull();
    expect(readItem('forest-save')).toBeNull();
    expect(readItem('forest-best')).toBeNull();
    expect(readItem('lang')).toBe('en');
  });
});
