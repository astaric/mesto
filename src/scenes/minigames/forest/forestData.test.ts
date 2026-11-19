import { describe, expect, it } from 'vitest';
import { artKeys } from '../../../test/art';
import { en } from '../../../i18n/en';
import { BIOMES, BOSS_AT_M, biomeAt } from './biomes';
import { DEFS, UNLOCK, makeTask, type Kind, type Metric } from './forestData';
import { WEAPONS } from './weapons';

const kinds = Object.keys(DEFS) as Kind[];

describe('forest data is complete', () => {
  it.each(kinds)('%s: every animation frame is an art file', (k) => {
    for (const tex of DEFS[k].tex) expect(artKeys.has(tex), tex).toBe(true);
  });

  it.each(BIOMES.map((b) => b.id))('%s: its art, spawn bag and quests exist', (id) => {
    const b = BIOMES.find((x) => x.id === id)!;
    expect(artKeys.has(b.horizon.tex), b.horizon.tex).toBe(true);
    for (const d of b.decor) expect(artKeys.has(d.tex), d.tex).toBe(true);
    for (const [k, w] of b.bag) { expect(DEFS[k], `bag ${k}`).toBeDefined(); expect(w).toBeGreaterThan(0); }
    for (const m of b.quests) expect(`quest.${m}` in en, `quest.${m}`).toBe(true);
    expect(`biome.${b.id}` in en).toBe(true);
  });

  it('every enemy in a bag has a quest in that world, so quests and monsters match', () => {
    for (const b of BIOMES) {
      const foes = b.bag.map(([k]) => k as string).filter((k) => DEFS[k as Kind].foe && !DEFS[k as Kind].boss);
      expect(foes.some((k) => b.quests.includes(k as Metric))).toBe(true);
    }
  });

  it('weapons have art and a name', () => {
    for (const w of WEAPONS) { expect(artKeys.has(w.tex), w.tex).toBe(true); expect(w.name in en).toBe(true); }
    expect(WEAPONS[0].price).toBe(0);
  });

  it('shared art keys used by the scenes exist', () => {
    for (const k of ['cloud', 'hill', 'tree', 'forest-pine', 'cave-stalactites', 'forest-heart', 'forest-flash', 'crosshair', 'star', 'coin']) {
      expect(artKeys.has(k), k).toBe(true);
    }
  });
});

describe('biomeAt', () => {
  it('follows the world start distances', () => {
    expect([0, 249, 250, 599, 600, 999, 1000, 5000].map(biomeAt)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
  it('the boss comes after the hell has started', () => expect(BOSS_AT_M).toBeGreaterThan(BIOMES[3].startM));
});

describe('makeTask', () => {
  const forest = BIOMES[0];

  it('every 5th forest quest is the troll, once', () => {
    expect(makeTask(4, [], forest).metric).toBe('troll');
    expect(makeTask(9, [], forest).metric).toBe('troll');
    expect(makeTask(4, ['troll'], forest).metric).not.toBe('troll');
    expect(makeTask(3, [], forest).metric).not.toBe('troll');
  });

  it('never offers the troll outside the forest', () => {
    for (const b of BIOMES.slice(1)) for (let done = 0; done < 30; done++) expect(makeTask(done, [], b).metric).not.toBe('troll');
  });

  it('early forest quests only ask for enemies that are unlocked', () => {
    for (let i = 0; i < 100; i++) {
      const m = makeTask(0, [], forest).metric as string;
      expect(UNLOCK[m as Kind] ?? 0).toBeLessThanOrEqual(0);
    }
  });

  it('goals are positive, grow with quests done and stay within the caps', () => {
    for (const b of BIOMES) {
      for (const done of [0, 5, 20, 100]) {
        for (let i = 0; i < 30; i++) {
          const tk = makeTask(done, [], b);
          expect(tk.goal).toBeGreaterThan(0);
          expect(tk.have).toBe(0);
          if (tk.metric === 'mushroom') expect(tk.goal).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('coin and honey quests always pay score', () => {
    for (let i = 0; i < 200; i++) {
      const tk = makeTask(2, [], forest);
      if (tk.metric === 'coin' || tk.metric === 'honey') expect(tk.reward).toBe('score');
    }
  });
});
