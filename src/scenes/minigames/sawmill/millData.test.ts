import { describe, expect, it } from 'vitest';
import { en } from '../../../i18n/en';
import { artKeys } from '../../../test/art';
import { AXES, GEAR, PLANKS_PER_LOG, PRODUCTS, SAWS, TOOLS, WORKERS, WORKER_LEVELS } from './millData';

describe('sawmill data', () => {
  it('has 10 different products, each made of 1 to a whole log of planks', () => {
    expect(PRODUCTS).toHaveLength(10);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(10);
    for (const p of PRODUCTS) {
      expect(p.planks).toBeGreaterThanOrEqual(1);
      expect(p.planks).toBeLessThanOrEqual(PLANKS_PER_LOG);
    }
  });

  it('the price per plank never goes down, so a harder product is never a worse deal', () => {
    const per = PRODUCTS.map((p) => p.price / p.planks);
    per.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(per[i]));
  });

  it('gear: the first tier is free, the next cost more and do more', () => {
    for (const tiers of Object.values(GEAR)) {
      expect(tiers[0].cost).toBe(0);
      tiers.slice(1).forEach((t, i) => {
        expect(t.cost).toBeGreaterThan(tiers[i].cost);
        expect(t.power).toBeGreaterThan(tiers[i].power);
      });
    }
    expect(AXES.at(-1)!.power).toBeGreaterThanOrEqual(6);
    expect(SAWS.at(-1)!.power).toBe(PLANKS_PER_LOG);
    expect(TOOLS.length).toBe(3);
  });

  it('workers: every level costs more and works faster', () => {
    expect(WORKERS.map((w) => w.kind)).toEqual(['lumberjack', 'sawyer', 'carpenter', 'seller']);
    for (const w of WORKERS) {
      expect(w.costs).toHaveLength(WORKER_LEVELS);
      expect(w.every).toHaveLength(WORKER_LEVELS);
      w.costs.slice(1).forEach((c, i) => expect(c).toBeGreaterThan(w.costs[i]));
      w.every.slice(1).forEach((e, i) => expect(e).toBeLessThan(w.every[i]));
    }
  });

  it('every texture it names is a file in src/art and every name has a translation', () => {
    const textures = [...PRODUCTS.map((p) => p.tex), ...Object.values(GEAR).flat().map((t) => t.tex)];
    for (const tex of textures) expect(artKeys.has(tex), tex).toBe(true);
    const names = [...PRODUCTS.map((p) => p.name), ...Object.values(GEAR).flat().map((t) => t.name), ...WORKERS.map((w) => w.name)];
    for (const n of names) expect(n in en, n).toBe(true);
  });
});
