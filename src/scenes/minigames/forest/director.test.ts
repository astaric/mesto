import { describe, expect, it } from 'vitest';
import { BIOMES, BOSS_AT_M } from './biomes';
import { chooseSpawn, isBig, spawnInterval, type DirectorView } from './director';
import type { Kind, Task } from './forestData';

const [forest, , , hell] = BIOMES;
const task = (metric: Task['metric']): Task => ({ metric, goal: 3, have: 0, reward: 'score' });

const view = (over: Partial<DirectorView> = {}): DirectorView => ({
  biome: forest, km: 10, tasks: [], tasksDone: 0, hearts: 5, maxHearts: 5, bossSpawned: false, alive: [], ...over,
});

/** Every kind chooseSpawn can return for this view, over the whole range of the random number. */
function possible(v: DirectorView): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const s = chooseSpawn(v, () => i / 200);
    out.add(s ? (s.type === 'kind' ? s.kind : s.type) : 'none');
  }
  return out;
}

describe('spawnInterval', () => {
  it('shrinks with quests done and distance but never below 0.65 s (before jitter)', () => {
    const at = (done: number, km: number) => spawnInterval(done, km, false, () => 0.5);
    expect(at(0, 0)).toBeCloseTo(1.5);
    expect(at(10, 0)).toBeLessThan(at(0, 0));
    expect(at(0, 500)).toBeLessThan(at(0, 0));
    expect(at(1000, 1000)).toBeCloseTo(0.65);
  });

  it('is slower during the boss fight and jitters by +-20%', () => {
    expect(spawnInterval(0, 0, true, () => 0.5)).toBeCloseTo(1.5 * 1.8);
    expect(spawnInterval(0, 0, false, () => 0)).toBeCloseTo(1.5 * 0.8);
    expect(spawnInterval(0, 0, false, () => 1)).toBeCloseTo(1.5 * 1.2);
  });
});

describe('chooseSpawn', () => {
  it('only offers what the world has in its bag', () => {
    const bag = forest.bag.map(([k]) => k as string);
    for (const s of possible(view({ tasksDone: 99 }))) expect(bag).toContain(s);
  });

  it('forest enemies unlock with quests done', () => {
    const fresh = possible(view({ tasksDone: 0 }));
    expect(fresh.has('mushroom')).toBe(true);
    expect(['bat', 'spider', 'bear'].some((k) => fresh.has(k))).toBe(false);
    expect(possible(view({ tasksDone: 1 })).has('bat')).toBe(true);
    expect(possible(view({ tasksDone: 3 })).has('bear')).toBe(true);
  });

  it('caps the foes on the path, but still offers pickups', () => {
    const crowd: Kind[] = Array(8).fill('mushroom');
    const s = possible(view({ tasksDone: 9, alive: crowd }));
    for (const k of ['mushroom', 'bat', 'spider', 'bear']) expect(s.has(k)).toBe(false);
    expect(s.has('coin')).toBe(true);
  });

  it('allows at most two of each big enemy', () => {
    const s = possible(view({ tasksDone: 9, alive: ['bear', 'bear'] }));
    expect(s.has('bear')).toBe(false);
    expect(isBig('bear')).toBe(true);
    expect(isBig('mushroom')).toBe(false);
  });

  it('wants the kinds of the current quests more', () => {
    const count = (v: DirectorView, kind: string): number =>
      Array.from({ length: 1000 }, (_, i) => chooseSpawn(v, () => i / 1000)).filter((s) => s?.type === 'kind' && s.kind === kind).length;
    const plain = count(view({ tasksDone: 9 }), 'spider');
    const wanted = count(view({ tasksDone: 9, tasks: [task('spider')] }), 'spider');
    expect(wanted).toBeGreaterThan(plain * 1.5);
  });

  it('honey is rarer when the hearts are full', () => {
    const count = (hearts: number): number =>
      Array.from({ length: 1000 }, (_, i) => chooseSpawn(view({ tasksDone: 9, hearts }), () => i / 1000)).filter((s) => s?.type === 'kind' && s.kind === 'honey').length;
    expect(count(5)).toBeLessThan(count(2));
  });

  it('a troll quest summons the troll once', () => {
    expect(chooseSpawn(view({ tasks: [task('troll')] }))).toEqual({ type: 'troll' });
    expect(possible(view({ tasks: [task('troll')], alive: ['troll'] })).has('troll')).toBe(false);
  });

  it('the demon comes in hell after BOSS_AT_M, once', () => {
    expect(chooseSpawn(view({ biome: hell, km: BOSS_AT_M }))).toEqual({ type: 'demon' });
    expect(possible(view({ biome: hell, km: BOSS_AT_M - 1 })).has('demon')).toBe(false);
    expect(possible(view({ biome: hell, km: BOSS_AT_M, bossSpawned: true })).has('demon')).toBe(false);
    expect(possible(view({ biome: forest, km: BOSS_AT_M })).has('demon')).toBe(false);
  });

  it('during the boss fight at most two other foes are out', () => {
    const s = possible(view({ biome: hell, km: BOSS_AT_M + 10, bossSpawned: true, alive: ['demon', 'imp', 'skull'] }));
    expect(s.has('imp')).toBe(false);
    expect(s.has('skull')).toBe(false);
  });
});
