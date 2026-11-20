import { describe, expect, it } from 'vitest';
import { PLANKS_PER_LOG, PRODUCTS, TREE_HP, WORKERS } from './millData';
import {
  cancelJob, closeBench, goalsReached, buyGear, buyWorker, chopHit, gearCost, hammerTap, loadBench, millStars, newBench, newClocks, newJob, newMill, newTree,
  sawTap, sellAll, sellBest, sellOne, startJob, workerCost, workNeeded, workersTick,
} from './millLogic';

describe('chopping', () => {
  it('a tree takes TREE_HP hits with the first axe and then gives exactly one log', () => {
    const s = newMill(), tree = newTree();
    for (let i = 1; i < TREE_HP; i++) { expect(chopHit(s, tree)).toBe(false); expect(s.logs).toBe(0); }
    expect(chopHit(s, tree)).toBe(true);
    expect(s.logs).toBe(1);
    expect(tree.hp).toBe(TREE_HP); // a new tree stands there
  });

  it('a better axe fells it faster, the best in one hit', () => {
    const s = newMill(); s.gear.axe = 1;
    const tree = newTree(); let hits = 0;
    while (!chopHit(s, tree)) hits++;
    expect(hits + 1).toBe(TREE_HP / 2);
    s.gear.axe = 3;
    expect(chopHit(s, newTree())).toBe(true);
  });
});

describe('sawing', () => {
  it('needs a log, and four cuts of one plank make four planks from it', () => {
    const s = newMill(), bench = newBench();
    expect(loadBench(s, bench)).toBe(false);
    expect(sawTap(s, bench)).toBe(0);
    s.logs = 2;
    expect(loadBench(s, bench)).toBe(true);
    expect(loadBench(s, bench)).toBe(false); // one log at a time
    for (let i = 0; i < PLANKS_PER_LOG; i++) expect(sawTap(s, bench)).toBe(1);
    expect(s.planks).toBe(PLANKS_PER_LOG);
    expect(s.logs).toBe(1);
    expect(bench.on).toBe(false);
  });

  it('a better saw cuts several planks a tap but never more than the log has', () => {
    const s = newMill(); s.logs = 1; s.gear.saw = 1;
    const bench = newBench(); loadBench(s, bench);
    expect(sawTap(s, bench)).toBe(2);
    expect(sawTap(s, bench)).toBe(2);
    expect(s.planks).toBe(4);
    s.logs = 1; s.gear.saw = 2; s.planks = 0; loadBench(s, bench);
    expect(sawTap(s, bench)).toBe(4);
  });
});

describe('the workshop', () => {
  it('is refused without enough planks and while busy', () => {
    const s = newMill(), job = newJob();
    expect(startJob(s, job, 'table')).toBe(false);
    s.planks = 5;
    expect(startJob(s, job, 'table')).toBe(true);
    expect(s.planks).toBe(1);
    expect(startJob(s, job, 'spoon')).toBe(false); // the bench is busy
  });

  it('hammering finishes the product after workNeeded taps, and it counts as made', () => {
    const s = newMill(), job = newJob(); s.planks = 2;
    startJob(s, job, 'stool');
    const need = workNeeded(s, 'stool');
    for (let i = 1; i < need; i++) expect(hammerTap(s, job)).toBe(false);
    expect(hammerTap(s, job)).toBe(true);
    expect(s.goods.stool).toBe(1);
    expect(s.made).toEqual(['stool']);
    expect(job.id).toBeNull();
  });

  it('better tools need fewer taps, never fewer than one', () => {
    const s = newMill();
    const plain = workNeeded(s, 'wardrobe');
    s.gear.tools = 2;
    expect(workNeeded(s, 'wardrobe')).toBeLessThan(plain);
    expect(workNeeded(s, 'spoon')).toBeGreaterThanOrEqual(1);
  });
});

describe('leaving the mill', () => {
  it('a log left on the bench is cut and an unfinished product gives its planks back', () => {
    const s = newMill(), bench = newBench(), job = newJob();
    s.logs = 1; loadBench(s, bench); sawTap(s, bench);
    closeBench(s, bench);
    expect(s.planks).toBe(PLANKS_PER_LOG);
    expect(bench.on).toBe(false);
    startJob(s, job, 'table');
    expect(s.planks).toBe(0);
    cancelJob(s, job);
    expect(s.planks).toBe(4);
    expect(job.id).toBeNull();
  });
});

describe('selling', () => {
  it('pays the price and counts the sale; nothing to sell pays nothing', () => {
    const s = newMill();
    expect(sellOne(s, 'table')).toBe(0);
    s.goods.table = 2;
    expect(sellOne(s, 'table')).toBe(48);
    expect(s.sold).toBe(1);
    expect(s.goods.table).toBe(1);
  });

  it('sell all empties the shelves; the best sale is the dearest product', () => {
    const s = newMill(); s.goods.spoon = 2; s.goods.wardrobe = 1; s.goods.chair = 1;
    expect(sellBest(s)).toEqual({ id: 'wardrobe', coins: 64 });
    expect(sellAll(s)).toBe(2 * 3 + 30);
    expect(PRODUCTS.every((p) => s.goods[p.id] === 0)).toBe(true);
    expect(sellBest(s)).toBeNull();
  });
});

describe('buying', () => {
  it('gear goes up one tier at a time, with the cost of the next one, and stops at the top', () => {
    const s = newMill();
    expect(gearCost(s, 'axe')).toBe(40);
    expect(buyGear(s, 'axe')).toBe(true);
    expect(gearCost(s, 'axe')).toBe(150);
    buyGear(s, 'axe'); buyGear(s, 'axe');
    expect(gearCost(s, 'axe')).toBeNull();
    expect(buyGear(s, 'axe')).toBe(false);
    expect(s.gear.axe).toBe(3);
  });

  it('a worker is hired, then raised twice, and no further', () => {
    const s = newMill();
    expect(workerCost(s, 'sawyer')).toBe(60);
    for (let i = 0; i < 3; i++) expect(buyWorker(s, 'sawyer')).toBe(true);
    expect(workerCost(s, 'sawyer')).toBeNull();
    expect(buyWorker(s, 'sawyer')).toBe(false);
    expect(s.workers.sawyer).toBe(3);
  });
});

describe('workers', () => {
  it('only hired workers work, one job each time their clock runs out', () => {
    const s = newMill(), clocks = newClocks();
    expect(workersTick(s, clocks, 100).done).toEqual([]);
    buyWorker(s, 'lumberjack'); // 8 s per tree
    expect(workersTick(s, clocks, 7).done).toEqual([]);
    expect(workersTick(s, clocks, 1.5).done).toEqual(['lumberjack']);
    expect(s.logs).toBe(1);
  });

  it('the sawyer turns a log into four planks, and waits when there is none', () => {
    const s = newMill(), clocks = newClocks(); buyWorker(s, 'sawyer');
    expect(workersTick(s, clocks, 10).done).toEqual([]);
    s.logs = 1;
    expect(workersTick(s, clocks, 0.1).done).toEqual(['sawyer']); // the clock was kept full, no waiting again
    expect(s.planks).toBe(PLANKS_PER_LOG);
  });

  it('the carpenter makes the product picked last, the seller sells the dearest and brings coins', () => {
    const s = newMill(), clocks = newClocks();
    buyWorker(s, 'carpenter'); buyWorker(s, 'seller');
    s.planks = 3; s.pick = 'chair';
    const r = workersTick(s, clocks, 10);
    expect(r.done).toEqual(['carpenter', 'seller']); // the chair is made, then the seller sells it in the same tick
    expect(r.coins).toBe(30);
    expect(s.goods.chair).toBe(0);
    s.goods.table = 1;
    expect(workersTick(s, clocks, 4).coins).toBe(48);
  });

  it('a hired worker works faster with each level', () => {
    for (const w of WORKERS) expect(w.every[2]).toBeLessThan(w.every[0]);
  });
});

describe('stars', () => {
  it('one for a first sale, one for hiring everybody, one for making all 10 products', () => {
    const s = newMill();
    expect(millStars(s)).toBe(0);
    expect(goalsReached(s)).toEqual([false, false, false]);
    s.sold = 1; expect(millStars(s)).toBe(1);
    for (const w of WORKERS) buyWorker(s, w.kind);
    expect(millStars(s)).toBe(2);
    s.made = PRODUCTS.map((p) => p.id);
    expect(millStars(s)).toBe(3);
  });
});
