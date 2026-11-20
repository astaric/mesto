import { beforeEach, describe, expect, it, vi } from 'vitest';

// idleSave is read from localStorage once, when the module is first imported, so each test sets the storage up and then imports a fresh copy.
async function load(stored?: unknown) {
  localStorage.clear();
  if (stored !== undefined) localStorage.setItem('idle-save', typeof stored === 'string' ? stored : JSON.stringify(stored));
  vi.resetModules();
  return import('./idleSave');
}

const BOUGHT = {
  level: 12, planterLevel: 3, manager: true, forkliftLevel: 10, forkliftManager: true, truckLevel: 4, truckManager: false, deliveryLevel: 51, debarkerLevel: 7,
  machines: [{ row: 1, slot: 0, level: 2 }, { row: 1, slot: 1, level: 55 }, { row: 2, slot: 0, level: 3 }],
};

describe('idleSave', () => {
  beforeEach(() => localStorage.clear());

  it('starts with nothing bought', async () => {
    const m = await load();
    expect(m.idleSave).toEqual(m.IDLE_START);
    expect(m.idleSave).toMatchObject({ level: 1, planterLevel: 0, manager: false });
  });

  it('survives corrupt data', async () => {
    for (const bad of ['{nope', '"a string"', '42', 'null']) {
      const m = await load(bad);
      expect(m.idleSave).toEqual(m.IDLE_START);
    }
  });

  it('keeps what was saved', async () => {
    expect((await load(BOUGHT)).idleSave).toEqual(BOUGHT);
  });

  it('cleans garbage field by field', async () => {
    const m = await load({ ...BOUGHT, level: -3, planterLevel: 'x', manager: 'yes', forkliftLevel: 2.5, truckLevel: 1e9, machines: 'no' });
    expect(m.idleSave).toMatchObject({ level: 1, planterLevel: 0, manager: false, forkliftLevel: 1, truckLevel: 5000, machines: [], debarkerLevel: 7, forkliftManager: true });
  });

  it('cleans the list of machines entry by entry: a row 1 - 3, a slot 0 - 2, a whole level, no place twice', async () => {
    const m = await load({
      ...BOUGHT,
      machines: [{ row: 1, slot: 0, level: 5 }, { row: 1, slot: 0, level: 9 }, { row: 4, slot: 0, level: 5 }, { row: 2, slot: 3, level: 5 }, { row: 2, slot: 1.5, level: 5 }, 'x', null, { row: 2, slot: 0, level: -4 }, { row: 3, slot: 2, level: 1e9 }],
    });
    expect(m.idleSave.machines).toEqual([{ row: 1, slot: 0, level: 5 }, { row: 2, slot: 0, level: 1 }, { row: 3, slot: 2, level: 5000 }]);
  });

  it('saveIdle() writes what a later load reads back', async () => {
    const m = await load();
    Object.assign(m.idleSave, BOUGHT);
    m.saveIdle();
    vi.resetModules();
    expect((await import('./idleSave')).idleSave).toEqual(BOUGHT);
  });
});
