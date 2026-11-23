import { describe, expect, it } from 'vitest';
import { CAP, PRICE, STOCK_IDS, TUNING, MANAGER_COST, FORKLIFT_MAX_CAPACITY, cutterChopS, cutterCost, cuttersAt, cutterSpeed, forkliftCapacity, forkliftCost, forkliftHandleS, forkliftSpeed, machineCost, machineFactor, machineWorkS, FORKLIFT_MANAGER_COST, TRUCK_MANAGER_COST, truckCost, truckItemS, truckSpeed, planterCost, planterPlantS, plantersAt, planterSpeed, deliveryTrucksAt, DELIVERY_TRUCK_LEVELS, priceAt, pieceWorth, stageFactor, machineMilestones, MACHINE_MILESTONE_FACTOR, EXTRA_UNLOCK_LEVEL, ROW_UNLOCK_LEVEL, PLANKS_PER_LOG, SLOT_PRICE } from './idleData';
import { LOGGING_ROUTE, QUEUE_SPACING, STATIONS } from './idleLayout';
import { applyUpgrades, upgradesOf, buy, haulerHasJob, hireForkliftManager, hireManager, hireTruckManager, offer, planterHasJob, upgradeDebarker, upgradeForklifts, upgradePlanter, upgradeMachine, upgradeTrucks, upgradeDeliveryTrucks, queueRank, queueSpot, buyMachine, slotOffer, machineAt, rowMachines, lastRow, pieceValue, pieceMultiplier, yardCap, machineItem, newIdle, piecesInLine, plotWaits, tapHauler, tapPlanter, tapPlot, tapTruck, tapWorker, tick, upgradeCutter, workerHasJob, type IdleEvent, type IdleState } from './idleLogic';

/** Puts `n` pieces in the loading yard, worth what the line makes them worth now. */
function fillYard(s: IdleState, n: number): void {
  s.stock.yard = n;
  s.yardValue = n * pieceValue(s);
}

/** Raises a machine to `level` (the levels are free in a test). */
function levelTo(s: IdleState, row: 1 | 2 | 3, slot: 0 | 1 | 2, level: number): void {
  const m = machineAt(s, row, slot)!;
  while (m.level < level) upgradeMachine(m);
}

/** A player who taps a forklift or the truck as soon as it is idle and has something to carry. */
function tapVehicles(s: IdleState): void {
  s.haulers.forEach((h, i) => { if (h.active <= 0 && haulerHasJob(s, i)) tapHauler(s, i); });
  if (s.trucks[0].active <= 0 && s.trucks[0].phase === 'parked' && s.stock.landing >= 1) tapTruck(s);
}

/** Runs `seconds` of play in 0.05 s frames, calling `each` after every frame. */
function run(s: IdleState, seconds: number, each?: (s: IdleState, ev: IdleEvent[]) => void): IdleEvent[] {
  const all: IdleEvent[] = [];
  for (let t = 0; t < seconds; t += 0.05) {
    const ev = tick(s, 0.05);
    all.push(...ev);
    each?.(s, ev);
  }
  return all;
}

/** Plays until the worker is idle again. */
function untilIdle(s: IdleState): void {
  for (let t = 0; t < 60 && s.cutters[0].phase !== 'idle'; t += 0.05) tick(s, 0.05);
}

describe('idle sawmill: the worker in the forest', () => {
  it('waits at the landing until he is tapped, then walks to a grown tree, chops it and brings the trunk back', () => {
    const s = newIdle();
    run(s, 5);
    expect(s.cutters[0].phase).toBe('idle');
    expect(s.cutters[0].pos).toEqual(s.cutters[0].home);
    expect(workerHasJob(s)).toBe(true);
    expect(tapWorker(s)).toBe(true);
    expect(s.cutters[0].phase).toBe('toPlot');
    expect(tapWorker(s)).toBe(false); // busy
    expect(tapPlot(s, 1)).toBe(false);
    run(s, 0.5);
    expect(s.cutters[0].pos).not.toEqual(s.cutters[0].home); // on his way
    let sawChop = false, carriedBeforeLanding = false;
    for (let t = 0; t < 30 && s.cutters[0].phase !== 'idle'; t += 0.05) {
      tick(s, 0.05);
      if (s.plots[0].phase === 'chopping') sawChop = true;
      if (s.cutters[0].carrying && s.stock.landing === 0) carriedBeforeLanding = true;
    }
    expect(sawChop).toBe(true);
    expect(carriedBeforeLanding).toBe(true);
    expect(s.plots[0].phase).toBe('stump');
    expect(s.stock.landing).toBe(1);
    expect(s.cutters[0].pos).toEqual(s.cutters[0].home);
  });

  it('takes the grown tree nearest to him first, and a stump is not something he can be sent to', () => {
    const s = newIdle();
    tapWorker(s);
    expect(s.cutters[0].plot).toBe(0);
    untilIdle(s);
    expect(s.plots[0].phase).toBe('stump');
    expect(plotWaits(s, 0)).toBe(false);
    expect(tapPlot(s, 0)).toBe(false); // he does not plant
    tapWorker(s);
    expect(s.cutters[0].plot).toBe(1);
    untilIdle(s);
    expect(s.stock.landing).toBe(2);
  });

  it('leaves a stump a stump: without the planter nothing grows back', () => {
    const s = newIdle();
    tapWorker(s);
    untilIdle(s);
    run(s, TUNING.growS * 3);
    expect(s.plots[0].phase).toBe('stump');
    expect(s.planters).toHaveLength(0);
  });

  it('has nothing for him to do while every tree is stump or growing', () => {
    const s = newIdle();
    s.plots.forEach((p, i) => { p.phase = i % 2 ? 'growing' : 'stump'; p.t = 0; });
    expect(workerHasJob(s)).toBe(false);
    expect(tapWorker(s)).toBe(false);
    run(s, TUNING.growS + 0.2);
    expect(s.plots.filter((p) => p.phase === 'ready').length).toBe(Math.floor(s.plots.length / 2));
  });

  it('keeps the trunk in his hands while the landing is full', () => {
    const s = newIdle();
    s.stock.landing = CAP.landing;
    tapWorker(s);
    run(s, 20);
    expect(s.cutters[0].phase).toBe('carrying');
    expect(s.stock.landing).toBe(CAP.landing);
    expect(piecesInLine(s)).toBe(CAP.landing + 1);
  });
});

/** Plays until every cutter is idle again. */
function untilBothIdle(s: IdleState): void {
  for (let t = 0; t < 60 && s.cutters.some((c) => c.phase !== 'idle'); t += 0.05) tick(s, 0.05);
}

/** Upgrades the cutter until he is at `level`. */
function levelUp(s: IdleState, level: number): void {
  while (s.level < level) upgradeCutter(s);
}

/** Gets the planter to `level` (the cutters first go to level 10, which unlocks him). */
function plantersTo(s: IdleState, level: number): void {
  levelUp(s, 10);
  while (s.planterLevel < level) upgradePlanter(s);
}

describe('idle sawmill: the cutters\' levels, and the planters and cutters they hire', () => {
  it('costs more and more for every level, chops and walks faster with it, and has no last level', () => {
    expect(cutterCost(1)).toBe(1); // the first upgrade costs one coin
    for (let l = 2; l < 40; l++) expect(cutterCost(l)).toBeGreaterThanOrEqual(cutterCost(l - 1));
    expect(cutterCost(30)).toBeGreaterThan(cutterCost(10) * 10);
    expect(priceAt(10, 1.1, 1)).toBe(11); // 10 x 1.1 is a whole 11, not 12
    // 30 % more than the price before, rounded up to whole coins, and the next increase is taken from the rounded price
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(cutterCost)).toEqual([1, 2, 3, 4, 6, 8, 11, 15, 20]);
    for (let l = 2; l < 40; l++) expect(cutterCost(l)).toBe(Math.ceil(cutterCost(l - 1) * 1.3 - 1e-9));
    expect(cutterChopS(1)).toBe(TUNING.chopS);
    expect(cutterChopS(2)).toBeCloseTo(TUNING.chopS * 0.97, 6); // every level takes 0.97 of the time of the one before
    expect(cutterChopS(5)).toBeCloseTo(cutterChopS(4) * 0.97, 6);
    expect(TUNING.jackSpeed / cutterSpeed(2)).toBeCloseTo(0.97, 6); // the same walk takes 0.97 of the time
    expect(cutterChopS(10)).toBeLessThan(cutterChopS(1));
    expect(cutterSpeed(10)).toBeGreaterThan(cutterSpeed(1));
    const s = newIdle();
    expect(s.level).toBe(1);
    levelUp(s, 25);
    upgradeCutter(s);
    expect(s.level).toBe(26); // still going
  });

  it('chops a tree quicker after an upgrade', () => {
    const slow = newIdle(), fast = newIdle();
    for (let i = 0; i < 5; i++) upgradeCutter(fast);
    const timeToStump = (s: IdleState): number => { tapWorker(s); let t = 0; while (s.plots[0].phase !== 'stump' && t < 60) { tick(s, 0.05); t += 0.05; } return t; };
    expect(timeToStump(fast)).toBeLessThan(timeToStump(slow));
  });

  it('hires one more worker of a kind every tenth level of that kind: cutter levels hire cutters, planter levels hire planters', () => {
    expect([1, 9, 10, 19, 20, 29, 30].map(cuttersAt)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    expect([0, 1, 9, 10, 19, 20, 30].map(plantersAt)).toEqual([0, 1, 1, 2, 2, 3, 4]);
    const s = newIdle();
    levelUp(s, 9);
    expect(s.cutters).toHaveLength(1);
    upgradeCutter(s);
    expect(s.level).toBe(10);
    expect(s.cutters).toHaveLength(2); // the cutter's level 10
    expect(s.planters).toHaveLength(0); // and it hired no planter
    upgradePlanter(s); // bought: level 1
    expect(s.planters).toHaveLength(1);
    expect(s.cutters).toHaveLength(2); // and that hired no cutter
    while (s.planterLevel < 9) upgradePlanter(s);
    expect(s.planters).toHaveLength(1);
    upgradePlanter(s); // planter level 10
    expect(s.planters).toHaveLength(2);
    expect(s.cutters).toHaveLength(2);
    levelUp(s, 20);
    expect(s.cutters).toHaveLength(3);
    expect(s.planters).toHaveLength(2); // cutter levels do not hire planters
  });

  it('puts every new worker on a place of his own', () => {
    const s = newIdle();
    levelUp(s, 200);
    while (s.planterLevel < 200) upgradePlanter(s);
    const homes = [...s.cutters, ...s.planters].map((w) => w.home);
    expect(s.cutters.length).toBe(21);
    expect(s.planters.length).toBe(21);
    for (const [i, a] of homes.entries()) for (const b of homes.slice(i + 1)) expect(Math.hypot(a.gx - b.gx, a.gy - b.gy)).toBeGreaterThan(0.5);
  });

  it('keeps the planter at home until he is tapped: he plants one stump, walks home and waits again', () => {
    const s = newIdle();
    plantersTo(s, 1);
    const far = s.plots.length - 1;
    for (const i of [0, far]) s.plots[i].phase = 'stump';
    run(s, 30);
    expect(s.plots[0].phase).toBe('stump'); // nobody plants by himself
    expect(s.planters[0].phase).toBe('idle');
    expect(planterHasJob(s, 0)).toBe(true);
    const home = s.planters[0].home;
    const dist = (i: number): number => Math.hypot(s.plots[i].tree.gx - home.gx, s.plots[i].tree.gy - home.gy);
    const nearer = dist(0) < dist(far) ? 0 : far;
    expect(tapPlanter(s, 0)).toBe(true);
    expect(s.planters[0].plot).toBe(nearer); // the stump nearest to him
    expect(tapPlanter(s, 0)).toBe(false); // busy
    run(s, 0.5);
    expect(s.planters[0].pos).not.toEqual(home);
    for (let t = 0; t < 30 && s.planters[0].phase !== 'idle'; t += 0.05) tick(s, 0.05);
    expect(s.planters[0].pos).toEqual(home); // back at his place
    expect(s.plots[nearer].phase).toBe('growing');
    const other = nearer === 0 ? far : 0;
    expect(s.plots[other].phase).toBe('stump'); // the other one waits for the next tap
    run(s, 10);
    expect(s.plots[other].phase).toBe('stump');
    expect(tapPlanter(s, 0)).toBe(true);
    for (let t = 0; t < 30 && s.planters[0].phase !== 'idle'; t += 0.05) tick(s, 0.05);
    expect(s.plots[other].phase).toBe('growing');
    run(s, TUNING.growS + 1);
    expect(s.plots.every((p) => p.phase === 'ready')).toBe(true);
  });

  it('sends a planter to a tapped stump, the nearest free one, and only a cutter to a tree', () => {
    const s = newIdle();
    plantersTo(s, 1);
    s.plots[3].phase = 'stump';
    expect(plotWaits(s, 3)).toBe(true);
    expect(plotWaits(s, 4)).toBe(true); // a grown tree: a cutter is free
    expect(tapPlot(s, 3)).toBe(true);
    expect(s.planters[0].plot).toBe(3);
    expect(s.cutters.every((c) => c.phase === 'idle')).toBe(true); // a cutter was not sent
    expect(plotWaits(s, 3)).toBe(false); // taken
    expect(tapPlanter(s, 0)).toBe(false);
    s.plots[5].phase = 'stump';
    expect(plotWaits(s, 5)).toBe(false); // the only planter is busy
    expect(tapPlot(s, 4)).toBe(true); // but a cutter is free for the tree
    expect(s.cutters[0].plot).toBe(4);
  });

  it('keeps a cutter and a planter apart: the cutter chops, the planter replants the stump he leaves', () => {
    const s = newIdle();
    plantersTo(s, 1);
    tapWorker(s);
    untilIdle(s);
    expect(s.stock.landing).toBe(1);
    run(s, 10);
    expect(s.plots[0].phase).toBe('stump'); // the planter waits to be tapped
    expect(tapPlot(s, 0)).toBe(true);
    for (let t = 0; t < 30 && s.planters[0].phase !== 'idle'; t += 0.05) tick(s, 0.05);
    expect(['growing', 'ready']).toContain(s.plots[0].phase);
    expect(piecesInLine(s)).toBe(1);
  });

  it('shares the work between planters: two never go to the same stump', () => {
    const s = newIdle();
    plantersTo(s, 10);
    expect(s.planters.length).toBe(2);
    s.plots[0].phase = 'stump';
    s.plots[1].phase = 'stump';
    expect(tapPlanter(s, 0)).toBe(true);
    expect(tapPlanter(s, 1)).toBe(true);
    expect(s.planters[0].plot).not.toBe(s.planters[1].plot);
    run(s, 10);
    expect(['growing', 'ready']).toContain(s.plots[0].phase);
    expect(['growing', 'ready']).toContain(s.plots[1].phase);
  });

  it('sends different cutters to different trees, and a tap on a busy cutter does nothing', () => {
    const s = newIdle();
    levelUp(s, 10);
    expect(s.cutters.length).toBe(2);
    expect(tapWorker(s, 0)).toBe(true);
    expect(tapWorker(s, 0)).toBe(false); // busy
    expect(tapWorker(s, 1)).toBe(true);
    expect(s.cutters[0].plot).not.toBe(s.cutters[1].plot);
    expect(tapWorker(s, 2)).toBe(false); // there is no third
    untilBothIdle(s);
    expect(s.stock.landing).toBe(2);
    expect(piecesInLine(s)).toBe(2);
    expect(s.plots.some((p) => p.phase === 'chopping')).toBe(false);
  });

  it('sends the free cutter nearest to a tapped tree, and does not take a tree somebody is already walking to', () => {
    const s = newIdle();
    levelUp(s, 10);
    expect(tapPlot(s, 5)).toBe(true);
    const first = s.cutters.findIndex((c) => c.phase === 'toPlot');
    expect(plotWaits(s, 5)).toBe(false); // claimed
    expect(tapPlot(s, 5)).toBe(false);
    expect(tapPlot(s, 6)).toBe(true); // the other cutter
    expect(s.cutters.filter((c) => c.phase === 'toPlot').length).toBe(2);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(tapPlot(s, 7)).toBe(false); // nobody is free
  });
});

describe('idle sawmill: the crew dialog on the landing (cutter, planter, manager)', () => {
  it('shows the cutter level with the price of the next one', () => {
    const s = newIdle();
    expect(offer(s, 'cutter')).toEqual({ state: 'offer', level: 1, price: 1, needs: 0 });
    upgradeCutter(s);
    expect(offer(s, 'cutter')).toEqual({ state: 'offer', level: 2, price: cutterCost(2), needs: 0 });
  });

  it('keeps the planter locked until the cutters are at level 10, and buying him costs 10 coins, then 30 % more each level', () => {
    const s = newIdle();
    levelUp(s, 9);
    expect(offer(s, 'planter')).toMatchObject({ state: 'locked', level: 0, needs: 10 });
    expect(upgradePlanter(s)).toBe(false);
    expect(buy(s, 'planter')).toBe(false);
    expect(s.planters).toHaveLength(0);
    upgradeCutter(s);
    expect(offer(s, 'planter')).toMatchObject({ state: 'offer', level: 0, price: 10 });
    expect(planterCost(0)).toBe(10);
    expect([0, 1, 2, 3, 4].map(planterCost)).toEqual([10, 13, 17, 23, 30]);
    expect(buy(s, 'planter')).toBe(true);
    expect(s.planterLevel).toBe(1);
    expect(s.planters).toHaveLength(1); // he is hired by being bought
    expect(offer(s, 'planter')).toMatchObject({ state: 'offer', level: 1, price: 13 });
    upgradePlanter(s);
    expect(s.planters).toHaveLength(1); // a level does not hire another one
  });

  it('has no planters before he is bought, however far the cutters are, and the cutter levels never hire one', () => {
    const s = newIdle();
    levelUp(s, 30);
    expect(s.planters).toHaveLength(0);
    upgradePlanter(s);
    expect(s.planters).toHaveLength(1); // by his own level: 1
  });

  it('lets the planters work faster with their own level, as the cutters do with theirs', () => {
    expect(planterPlantS(1)).toBe(TUNING.plantS);
    expect(planterPlantS(2)).toBeCloseTo(TUNING.plantS * 0.97, 6);
    expect(TUNING.jackSpeed / planterSpeed(2)).toBeCloseTo(0.97, 6);
    const a = newIdle(), b = newIdle();
    for (const s of [a, b]) { plantersTo(s, 1); s.plots[0].phase = 'stump'; }
    for (let i = 0; i < 6; i++) upgradePlanter(b);
    const timeToSapling = (s: IdleState): number => { tapPlanter(s, 0); let t = 0; while (s.plots[0].phase !== 'growing' && t < 60) { tick(s, 0.05); t += 0.05; } return t; };
    expect(timeToSapling(b)).toBeLessThan(timeToSapling(a));
  });

  it('keeps the manager locked until the cutters are at level 10, costs 100 coins, is bought once and has no levels', () => {
    const s = newIdle();
    levelUp(s, 9);
    expect(offer(s, 'manager')).toMatchObject({ state: 'locked', needs: 10 });
    expect(hireManager(s)).toBe(false);
    upgradeCutter(s);
    expect(offer(s, 'manager')).toMatchObject({ state: 'offer', price: 100 });
    expect(MANAGER_COST).toBe(100);
    expect(buy(s, 'manager')).toBe(true);
    expect(s.manager).toBe(true);
    expect(offer(s, 'manager').state).toBe('owned');
    expect(buy(s, 'manager')).toBe(false); // nothing more to buy
    levelUp(s, 40);
    expect(offer(s, 'manager').state).toBe('owned'); // and still the same: no upgrades
  });

  it('has the manager send every free cutter to a tree by himself, so no tap is needed', () => {
    const s = newIdle();
    run(s, 20);
    expect(s.stock.landing).toBe(0); // nobody taps, nobody chops
    levelUp(s, 10);
    hireManager(s);
    run(s, 12);
    expect(s.stock.landing).toBeGreaterThanOrEqual(2); // two cutters, one trunk about every 5 s each
    expect(piecesInLine(s)).toBe(s.stock.landing + s.cutters.filter((c) => c.carrying).length);
  });

  it('has the manager send the planters to the stumps too, so the forest replants itself', () => {
    const s = newIdle();
    plantersTo(s, 1);
    hireManager(s);
    let chopped = 0;
    run(s, 600, (st) => { chopped += st.stock.landing; st.stock.landing = 0; }); // the trucks would take the trunks away
    expect(chopped).toBeGreaterThan(s.plots.length); // more trunks than there are trees: the stumps were planted again and grew
  });

  it('has a manager with two cutters never put both on the same tree', () => {
    const s = newIdle();
    levelUp(s, 10);
    hireManager(s);
    run(s, 0.2);
    expect(s.cutters[0].plot).not.toBe(s.cutters[1].plot);
    expect(s.plots.filter((p) => p.claimed).length).toBe(2);
  });
});

/** The forklifts' level up to `level`. */
function forkliftsTo(s: IdleState, level: number): void {
  while (s.forkliftLevel < level) upgradeForklifts(s);
}

describe('idle sawmill: the factory dialog and the dialog on a machine (forklifts, debarker, saws)', () => {
  it('offers a level each for the forklifts, the debarker and the first saw, first 3 coins and then 30 % more (10 % for the machines), with no unlock', () => {
    const s = newIdle();
    for (const item of ['forklift', 'debarker', machineItem(1, 0)] as const) expect(offer(s, item)).toEqual({ state: 'offer', level: 1, price: 3, needs: 0 });
    expect([1, 2, 3, 4, 5].map(forkliftCost)).toEqual([3, 4, 6, 8, 11]);
    expect([1, 2, 3, 4, 5, 10, 20].map((l) => machineCost(l))).toEqual([3, 4, 5, 6, 7, 13, 41]); // the machines get 10 % dearer a level, the others 30 %
    expect(buy(s, 'forklift')).toBe(true);
    expect(buy(s, 'debarker')).toBe(true);
    expect(buy(s, 'debarker')).toBe(true);
    expect([s.forkliftLevel, s.machines[0].level, s.machines[1].level]).toEqual([2, 3, 1]); // separate levels
    expect(offer(s, 'debarker').price).toBe(machineCost(3));
    expect(offer(s, machineItem(1, 0)).price).toBe(3);
    expect(offer(s, machineItem(2, 0)).state).toBe('locked'); // no machine there to upgrade
    expect(buy(s, machineItem(2, 0))).toBe(false);
  });

  it('lets forklifts carry one more piece every 10 levels, up to 4', () => {
    expect([1, 2, 9, 10, 19, 20, 29, 30, 31, 40, 100].map(forkliftCapacity)).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 4]);
    expect(FORKLIFT_MAX_CAPACITY).toBe(4);
    // and drive and handle 0.97 of the time faster with every level
    expect(forkliftSpeed(2)).toBeCloseTo(TUNING.forkliftSpeed / 0.97, 6);
    expect(forkliftHandleS(2)).toBeCloseTo(TUNING.forkliftHandleS * 0.97, 6);
  });

  it('has a forklift take as many trunks as it can carry from the pile, and put them on the debarker one after another', () => {
    const s = newIdle();
    forkliftsTo(s, 10);
    expect(forkliftCapacity(s.forkliftLevel)).toBe(2);
    s.stock.pile = 6;
    tapHauler(s, 0);
    run(s, 0.6);
    expect(s.haulers[0].carrying).toBe(2); // two on the forks
    expect(s.stock.pile).toBe(4);
    expect(piecesInLine(s)).toBe(6);
    let carriedMost = 0;
    run(s, 20, () => { carriedMost = Math.max(carriedMost, s.haulers[0].carrying); expect(piecesInLine(s)).toBe(6); });
    expect(carriedMost).toBeLessThanOrEqual(2);
    expect(s.machines[0].state).not.toBe('empty'); // the first one is on the debarker
  });

  it('carries 4 at the top level, and never more', () => {
    const s = newIdle();
    forkliftsTo(s, 50);
    s.stock.pile = 10;
    tapHauler(s, 0);
    let most = 0;
    run(s, 15, () => { most = Math.max(most, s.haulers[0].carrying); });
    expect(most).toBe(4);
  });

  it('has the other forklifts take only as many pieces as the place they bring them to has room for', () => {
    const s = newIdle();
    forkliftsTo(s, 30);
    s.stock.storage = 4;
    tapHauler(s, 1); // F2: storage -> the saw, which takes one piece at a time
    run(s, 8, () => { expect(s.haulers[1].carrying).toBeLessThanOrEqual(1); });
    expect(piecesInLine(s)).toBe(4);
    expect(s.machines[1].state).not.toBe('empty');
  });

  it('prices a piece as its base price x the factor of each level that counts, 3 % more for every level', () => {
    expect(machineFactor(1)).toBe(1);
    expect(machineFactor(2)).toBeCloseTo(1.03, 9);
    expect(machineFactor(3)).toBeCloseTo(1.0609, 9);
    expect(pieceWorth('logs', [[1], [1]])).toBe(PRICE.logs);
    expect(pieceWorth('logs', [[3], [2]])).toBeCloseTo(10 * (1 + 0.0609 + 0.03), 9); // both machines count, and they add
    expect(pieceWorth('logs', [[9], [1]])).toBeCloseTo(10 * (1 + (1.03 ** 8 - 1)), 9);
    expect(pieceWorth('logs', [[4], [4]])).toBeCloseTo(10 * (1 + 2 * (1.03 ** 3 - 1)), 9);
    expect(pieceWorth('logs', [[50], [50]])).toBeLessThan(PRICE.logs * 100); // not x1000 (the old product of the stages)
  });

  it('sells what the delivery truck takes at the price of the levels, each piece as it is loaded', () => {
    const s = newIdle();
    upgradeDebarker(s); upgradeDebarker(s); upgradeMachine(s.machines[1]);
    fillYard(s, 5);
    const sales = run(s, 30);
    expect(sales).toHaveLength(5);
    expect(sales.every((e) => e.count === 1)).toBe(true);
    expect(sales.reduce((n, e) => n + e.coins, 0)).toBe(55); // 5 x 10.91: the fractions are carried from piece to piece, not lost
    expect(s.coins).toBe(55);
    expect(s.sold).toBe(5);
  });

  it('makes each machine work in 0.97 of the time per level, the debarker and the saw by their own levels', () => {
    const s = newIdle();
    expect(s.machines.map((m) => m.workS)).toEqual([TUNING.debarkerS, TUNING.sawS]); // at the start: the debarker and one saw, no other machine
    upgradeDebarker(s);
    expect(s.machines[0].workS).toBeCloseTo(TUNING.debarkerS * 0.97, 9);
    expect(s.machines[1].workS).toBe(TUNING.sawS); // the saw has its own level
    upgradeMachine(s.machines[1]); upgradeMachine(s.machines[1]);
    expect(s.machines[1].workS).toBeCloseTo(TUNING.sawS * 0.97 ** 2, 9);
    expect(machineWorkS(4, 3)).toBeCloseTo(4 * 0.97 ** 2, 9);
    // and a piece really is done sooner
    const slow = newIdle(), fast = newIdle();
    for (let i = 0; i < 20; i++) upgradeDebarker(fast);
    const timeToDone = (x: IdleState): number => { x.machines[0].state = 'working'; x.machines[0].t = 0; let t = 0; while ((x.machines[0].state as string) !== 'done' && t < 30) { tick(x, 0.05); t += 0.05; } return t; };
    expect(timeToDone(fast)).toBeLessThan(timeToDone(slow) * 0.6);
  });
});

/** The trucks' level up to `level`. */
function trucksTo(s: IdleState, level: number): void {
  while (s.truckLevel < level) upgradeTrucks(s);
}

describe('idle sawmill: the trucks and the truck manager', () => {
  it('offers a logging truck level (3 coins, then 30 % more) with no unlock, and makes it drive and load in 0.97 of the time per level', () => {
    const s = newIdle();
    expect(offer(s, 'truck')).toEqual({ state: 'offer', level: 1, price: 3, needs: 0 });
    expect([1, 2, 3, 4, 5].map(truckCost)).toEqual([3, 4, 6, 8, 11]);
    expect(buy(s, 'truck')).toBe(true);
    expect(s.truckLevel).toBe(2);
    expect(truckSpeed(1)).toBe(TUNING.truckSpeed);
    expect(TUNING.truckSpeed / truckSpeed(2)).toBeCloseTo(0.97, 9);
    expect(truckItemS(2)).toBeCloseTo(TUNING.truckItemS * 0.97, 9);
  });

  it('gets a trunk from the landing to the pile in less time with a higher truck level', () => {
    const roundTime = (level: number): number => {
      const s = newIdle();
      trucksTo(s, level);
      s.stock.landing = 5;
      tapTruck(s);
      let t = 0;
      while (s.stock.pile < 5 && t < 120) { tick(s, 0.05); t += 0.05; }
      expect(s.stock.pile).toBe(5);
      return t;
    };
    expect(roundTime(30)).toBeLessThan(roundTime(1) * 0.75);
  });

  it('keeps the truck manager locked until the trucks are at level 10, costs 100, is bought once and has no levels', () => {
    const s = newIdle();
    trucksTo(s, 9);
    expect(offer(s, 'truckManager')).toMatchObject({ state: 'locked', needs: 10, price: TRUCK_MANAGER_COST });
    expect(TRUCK_MANAGER_COST).toBe(100);
    expect(hireTruckManager(s)).toBe(false);
    upgradeTrucks(s);
    expect(offer(s, 'truckManager').state).toBe('offer');
    expect(buy(s, 'truckManager')).toBe(true);
    expect(offer(s, 'truckManager').state).toBe('owned');
    expect(buy(s, 'truckManager')).toBe(false);
    expect(s.forkliftManager).toBe(false);
    expect(s.manager).toBe(false);
  });

  it('is not unlocked by the forklifts, and the forklift manager is not unlocked by the trucks', () => {
    const f = newIdle();
    forkliftsTo(f, 10);
    expect(offer(f, 'truckManager').state).toBe('locked');
    const t = newIdle();
    trucksTo(t, 10);
    expect(offer(t, 'forkliftManager').state).toBe('locked');
  });

  it('keeps the logging truck making rounds by itself, the whole line running without a tap', () => {
    const s = newIdle();
    s.stock.landing = 4;
    run(s, 30);
    expect(s.stock.pile).toBe(0); // nobody taps the truck
    trucksTo(s, 10);
    hireTruckManager(s);
    run(s, 40);
    expect(s.stock.landing).toBe(0);
    expect(s.stock.pile).toBe(4);
    s.stock.landing = 3; // and again, with no tap
    run(s, 40);
    expect(s.stock.pile).toBe(7);
    expect(piecesInLine(s)).toBe(7);
  });
});

describe('idle sawmill: the upgrades outlive a visit', () => {
  const BOUGHT = {
    level: 22, planterLevel: 11, manager: true, forkliftLevel: 10, forkliftManager: true, truckLevel: 4, truckManager: false, deliveryLevel: 51, debarkerLevel: 7,
    machines: [{ row: 1 as const, slot: 0 as const, level: 2 }, { row: 1 as const, slot: 1 as const, level: 60 }, { row: 2 as const, slot: 0 as const, level: 3 }],
  };

  it('puts saved upgrades on a fresh line: levels, managers, the workers they hire and the machines\' speed', () => {
    const s = newIdle();
    applyUpgrades(s, BOUGHT);
    expect(upgradesOf(s)).toEqual(BOUGHT);
    expect(s.trucks.filter((t) => t.id === 'delivery')).toHaveLength(2); // exit truck level 51: a second truck
    expect(s.cutters).toHaveLength(cuttersAt(22)); // 3
    expect(s.planters).toHaveLength(plantersAt(11)); // 2
    expect(s.machines[0].workS).toBeCloseTo(machineWorkS(s.machines[0].baseS, 7), 9);
    expect(s.machines[1].workS).toBeCloseTo(machineWorkS(s.machines[1].baseS, 2), 9);
    expect(s.machines.map((m) => [m.id, m.row, m.slot, m.level])).toEqual([['debarker', 0, 0, 7], ['saw1', 1, 0, 2], ['saw1', 1, 1, 60], ['saw2', 2, 0, 3]]); // the machines that were bought stand again
    expect(s.stock.landing + s.stock.pile + s.sold).toBe(0); // the line itself starts afresh
    expect(s.plots.every((p) => p.phase === 'ready')).toBe(true);
    expect(offer(s, 'cutter').level).toBe(22);
    expect(offer(s, 'manager').state).toBe('owned');
    expect(offer(s, 'truckManager').state).toBe('locked');
  });

  it('is the same as buying them one by one: a saved line plays like the one that was bought', () => {
    const bought = newIdle();
    levelUp(bought, 22);
    plantersTo(bought, 11);
    forkliftsTo(bought, 10);
    trucksTo(bought, 4);
    hireManager(bought); hireForkliftManager(bought);
    for (let i = 1; i < 7; i++) upgradeDebarker(bought);
    upgradeMachine(bought.machines[1]);
    const loaded = newIdle();
    applyUpgrades(loaded, upgradesOf(bought));
    expect(upgradesOf(loaded)).toEqual(upgradesOf(bought));
    expect(loaded.cutters.map((c) => c.home)).toEqual(bought.cutters.map((c) => c.home));
    expect(loaded.planters.map((c) => c.home)).toEqual(bought.planters.map((c) => c.home));
    expect(loaded.machines.map((m) => m.workS)).toEqual(bought.machines.map((m) => m.workS));
  });
});

describe('idle sawmill: the forklift manager', () => {
  it('is locked until the forklifts are at level 10, costs 100 coins, is bought once and has no levels', () => {
    const s = newIdle();
    forkliftsTo(s, 9);
    expect(offer(s, 'forkliftManager')).toMatchObject({ state: 'locked', needs: 10, price: FORKLIFT_MANAGER_COST });
    expect(FORKLIFT_MANAGER_COST).toBe(100);
    expect(hireForkliftManager(s)).toBe(false);
    expect(buy(s, 'forkliftManager')).toBe(false);
    upgradeForklifts(s);
    expect(offer(s, 'forkliftManager')).toMatchObject({ state: 'offer', price: 100 });
    expect(buy(s, 'forkliftManager')).toBe(true);
    expect(s.forkliftManager).toBe(true);
    expect(offer(s, 'forkliftManager').state).toBe('owned');
    expect(buy(s, 'forkliftManager')).toBe(false);
    expect(s.manager).toBe(false); // the forest's manager is a separate one, unlocked by the cutters
  });

  it('is not unlocked by the cutters, and the forest manager is not unlocked by the forklifts', () => {
    const s = newIdle();
    levelUp(s, 10);
    expect(offer(s, 'manager').state).toBe('offer');
    expect(offer(s, 'forkliftManager').state).toBe('locked');
    const f = newIdle();
    forkliftsTo(f, 10);
    expect(offer(f, 'forkliftManager').state).toBe('offer');
    expect(offer(f, 'manager').state).toBe('locked');
  });

  it('keeps the forklifts working without taps: the whole line from the pile to the yard runs by itself', () => {
    const s = newIdle();
    s.stock.pile = 3;
    run(s, 30);
    expect(s.stock.pile).toBe(3); // without him nobody moves
    forkliftsTo(s, 10);
    hireForkliftManager(s);
    expect(s.haulers.every((h) => h.active > 0)).toBe(false); // not until the clock runs
    run(s, 80);
    expect(s.stock.pile).toBe(0);
    // three trunks became three square logs: two went to the yard in one full load, the third waits on the output forklift's forks for a second one (with the manager it never runs out of time)
    expect(s.stock.yard + s.sold).toBe(2);
    expect(s.haulers[2].carrying).toBe(1);
    expect(s.haulers.every((h) => h.active === TUNING.activeS)).toBe(true);
  });
});

describe('idle sawmill: the forklifts and the logging truck work when tapped, for 30 seconds', () => {
  it('leaves the pile alone until the forklift is tapped, then carries while the time lasts and stops', () => {
    const s = newIdle();
    s.stock.pile = 10;
    run(s, 10);
    expect(s.stock.pile).toBe(10);
    expect(s.haulers[0].phase).toBe('idle');
    expect(tapHauler(s, 0)).toBe(true);
    expect(s.haulers[0].active).toBe(TUNING.activeS);
    s.haulers[0].active = 2; // a short window
    run(s, 10);
    expect(s.stock.pile).toBeLessThan(10);
    expect(s.haulers[0].active).toBe(0);
    const left = s.stock.pile;
    run(s, 40);
    expect(s.stock.pile).toBe(left); // no new trip: the player has to tap again
    expect(left).toBeGreaterThan(0);
    expect(piecesInLine(s)).toBe(10);
  });

  it('finishes the trip it is on when the time runs out, and drives home', () => {
    const s = newIdle();
    s.stock.pile = 3;
    tapHauler(s, 0);
    run(s, 0.5);
    expect(s.haulers[0].carrying).toBe(1);
    s.haulers[0].active = 0.01;
    run(s, 5);
    expect(s.haulers[0].carrying).toBe(0);
    expect(s.machines[0].state).not.toBe('empty'); // the trunk is on the debarker
    expect(s.haulers[0].phase).toBe('idle');
    expect(s.haulers[0].pos).toEqual(STATIONS.pile.pos); // back at the pile
    expect(piecesInLine(s)).toBe(3);
    expect(s.stock.pile).toBe(2);
  });

  it('keeps the logging truck parked in front of the pile until it is tapped, and then drives a loop: up, load at the landing, down, back, unload', () => {
    const s = newIdle();
    s.stock.landing = 3;
    run(s, 10);
    expect(s.trucks[0].phase).toBe('parked');
    expect(s.trucks[0].pos).toEqual(LOGGING_ROUTE.park);
    tapTruck(s);
    let turned = false, atLanding = false;
    run(s, 30, (st) => {
      const t = st.trucks[0];
      if (t.pos.gx === LOGGING_ROUTE.landing.gx && Math.abs(t.pos.gy - LOGGING_ROUTE.landing.gy) < 0.01 && t.phase === 'work') atLanding = true;
      if (t.pos.gx < LOGGING_ROUTE.park.gx - 0.1 && t.pos.gy > 4 && t.pos.gy < 10) turned = true; // on the west lane going down
    });
    expect(atLanding).toBe(true);
    expect(turned).toBe(true);
    expect(s.stock.landing).toBe(0);
    expect(s.stock.pile).toBe(3);
    expect(s.trucks[0].phase).toBe('parked');
    expect(s.trucks[0].pos).toEqual(LOGGING_ROUTE.park);
  });

  it('waits parked while tapped and the landing is empty, and sets out when a trunk comes; it does not keep driving after its time is up', () => {
    const s = newIdle();
    tapTruck(s);
    run(s, 5);
    expect(s.trucks[0].phase).toBe('parked');
    s.stock.landing = 1;
    run(s, 1);
    expect(s.trucks[0].phase).not.toBe('parked');
    run(s, 40);
    expect(s.stock.pile).toBe(1);
    // the window is over: a new trunk stays on the landing
    s.stock.landing = 1;
    run(s, 10);
    expect(s.trucks[0].phase).toBe('parked');
    expect(s.stock.landing).toBe(1);
  });

  it('drives rounds one after another for as long as it is tapped and there are trunks', () => {
    const s = newIdle();
    s.trucks[0].capacity = 5; // a small truck, so that it takes more than one round
    s.stock.landing = 10;
    tapTruck(s);
    run(s, TUNING.activeS + 25);
    expect(s.stock.landing).toBe(0);
    expect(s.stock.pile).toBe(10); // two rounds of five
    expect(s.trucks[0].phase).toBe('parked');
  });
});

describe('idle sawmill: from one tree to one square log sold', () => {
  it('makes exactly one sale, of one square log, and loses nothing on the way', () => {
    const s = newIdle();
    s.trucks[1].capacity = 1; // a delivery truck that takes the one log there is
    expect(tapWorker(s)).toBe(true);
    let sold = 0, seen = 0, doneAt = -1, frame = 0;
    const events = run(s, 150, (st, ev) => {
      frame += 1;
      tapVehicles(st);
      sold += ev.reduce((n, e) => n + e.count, 0);
      const inLine = piecesInLine(st);
      if (inLine > 0) seen += 1;
      // one trunk comes out of the forest: it is either in the line or sold, never more or less (the tree itself is not counted)
      if (seen > 0) expect(inLine + sold).toBe(1);
      if (sold === 1 && doneAt < 0) doneAt = frame * 0.05;
      for (const id of STOCK_IDS) expect(st.stock[id]).toBeLessThanOrEqual(CAP[id]);
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'sold', count: 1, coins: PRICE.logs });
    expect(s.sold).toBe(1);
    expect(s.coins).toBe(PRICE.logs);
    expect(piecesInLine(s)).toBe(0);
    for (const id of STOCK_IDS) expect(s.stock[id]).toBe(0);
    expect(doneAt).toBeGreaterThan(0);
    expect(doneAt).toBeLessThan(90);
  });

  it('is the same when the clock runs in big frames', () => {
    const s = newIdle();
    s.trucks[1].capacity = 1; // a delivery truck that takes the one log there is
    tapWorker(s);
    let coins = 0;
    for (let i = 0; i < 150; i++) { tapVehicles(s); coins += tick(s, 1).reduce((n, e) => n + e.coins, 0); }
    expect(coins).toBe(PRICE.logs);
  });

  it('sells the next log too, once the trees have been planted and grown', () => {
    const s = newIdle();
    s.trucks[1].capacity = 1; // a delivery truck that takes the one log there is
    tapWorker(s);
    untilIdle(s);
    tapWorker(s); // second tree
    untilIdle(s);
    run(s, 150, tapVehicles);
    expect(s.sold).toBe(2);
    expect(s.coins).toBe(2 * PRICE.logs);
  });
});

describe('idle sawmill: the line backs up instead of losing things', () => {
  it('does not put a trunk on a machine that is working: the forklift waits with it until the machine is free', () => {
    const s = newIdle();
    s.stock.pile = 2;
    tapHauler(s, 0);
    run(s, 5);                                   // the first trunk is on the debarker, working
    expect(s.machines[0].state).toBe('working');
    run(s, 1);
    expect(s.haulers[0].carrying).toBe(1);    // F1 has the second trunk and waits at the debarker
    expect(s.haulers[0].phase).toBe('drop');
    run(s, TUNING.debarkerS + 5);
    expect(s.machines[0].state).toBe('done');    // finished, but its peeled trunk is still on it: nobody took it away
    expect(s.haulers[0].carrying).toBe(1);    // so the second trunk still waits
    expect(piecesInLine(s)).toBe(2);
  });

  it('keeps a finished trunk on the debarker until F2 comes, which takes it to the saw when the saw is free, and then the next trunk goes on', () => {
    const s = newIdle();
    s.stock.pile = 2;
    tapHauler(s, 0);
    run(s, TUNING.debarkerS + 4);
    expect(s.machines[0].state).toBe('done');
    expect(haulerHasJob(s, 1)).toBe(true);
    tapHauler(s, 1);
    run(s, 4);
    expect(s.machines[0].state).toBe('working');  // F2 took the peeled trunk, F1 put the second one on
    expect(s.machines[1].state).toBe('working');  // the saw has the first
    expect(s.stock.storage).toBe(0);
    expect(s.haulers[0].carrying).toBe(0);
    expect(piecesInLine(s)).toBe(2);
  });

  it('keeps the peeled trunk on F2\'s forks while the saw is busy, puts it in the storage once the debarker has the next one, and brings the storage\'s to the saw when the saw is free again', () => {
    const s = newIdle();
    s.trucks[1].phase = 'away'; s.trucks[1].t = -1000; // no delivery truck comes: what is in the yard stays there
    s.machines[0].state = 'done';
    s.machines[1].state = 'working'; s.machines[1].workS = 1000; // the saw is busy
    tapHauler(s, 1);
    run(s, 6);
    expect(s.machines[0].state).toBe('empty');
    expect(s.haulers[1].carrying).toBe(1);        // it holds the trunk, ready for the saw: the debarker has nothing more for it
    expect(s.stock.storage).toBe(0);
    s.machines[0].state = 'working'; s.machines[0].workS = 1000; // F1 has put the next trunk on the debarker (a slow one)
    run(s, 9);
    expect(s.stock.storage).toBe(1);              // forks full, no saw wants it, more is coming: one goes in the storage
    expect(s.haulers[1].carrying).toBe(0);
    expect(s.haulers[1].at).toBe('debarkerOut');  // and F2 is back at its rest place
    // the saw finishes, the square log waits on it; the storage trunk cannot go on until the log is taken away
    s.machines[0].state = 'empty';
    s.machines[1].workS = TUNING.sawS;
    run(s, TUNING.sawS);
    expect(s.machines[1].state).toBe('done');
    tapHauler(s, 1);
    run(s, 10);
    expect(s.stock.storage).toBe(1);              // F2 has no job: the saw is not empty
    expect(s.haulers[1].phase).toBe('idle');
    // the output forklift takes the square log to the yard; then the storage trunk can go on the saw, be cut, and follow it
    run(s, 40, tapVehicles);
    expect(s.stock.storage).toBe(0);
    expect(s.stock.yard).toBe(2);
    expect(s.machines.map((m) => m.state)).toEqual(['empty', 'empty']);
    expect(piecesInLine(s)).toBe(2);
  });

  it('has F2 gather peeled trunks on its forks up to its capacity while the saws are busy, and hand them out to the saws as they come free', () => {
    const s = newIdle();
    forkliftsTo(s, 30); // carries 4
    s.trucks[1].phase = 'away'; s.trucks[1].t = -1000;
    const saw = s.machines[1], deb = s.machines[0];
    saw.state = 'working'; saw.workS = 1000;
    s.stock.pile = 3;
    tapHauler(s, 0); tapHauler(s, 1);
    run(s, 25);
    expect(s.haulers[1].carrying).toBe(3);        // three peeled trunks, one after another off the debarker
    expect(s.stock.storage).toBe(0);              // not full yet, so none goes to the storage
    expect(s.haulers[1].at).toBe('debarkerOut');
    expect(deb.state).toBe('empty');
    saw.state = 'empty';                          // the saw is free (its log taken away)
    run(s, 4);
    expect(saw.state).toBe('working');            // F2 brought one straight from its forks
    expect(s.haulers[1].carrying).toBe(2);
  });

  it('puts only one trunk in the storage when its forks are full, and only while the debarker has another one coming', () => {
    const s = newIdle();
    forkliftsTo(s, 10); // carries 2
    const saw = s.machines[1], deb = s.machines[0];
    saw.state = 'working'; saw.workS = 1000;
    const f2 = s.haulers[1];
    f2.carrying = 2; tapHauler(s, 1);
    run(s, 10);
    expect(s.stock.storage).toBe(0);              // the debarker is empty: nothing to make room for
    expect(f2.carrying).toBe(2);
    deb.state = 'working'; deb.workS = 1000;
    run(s, 10);
    expect(s.stock.storage).toBe(1);              // one, not both
    expect(f2.carrying).toBe(1);
    expect(f2.at).toBe('debarkerOut');
  });

  it('keeps the square log on the saw until the output forklift comes, and waits with it at a full loading yard', () => {
    const s = newIdle();
    s.machines[1].state = 'working';
    s.machines[1].t = 0;
    s.trucks[1].phase = 'away'; s.trucks[1].t = -1000; // no delivery truck comes: nothing leaves the yard
    run(s, TUNING.sawS + 1);
    expect(s.machines[1].state).toBe('done');
    fillYard(s, CAP.yard);
    run(s, 5);
    expect(s.machines[1].state).toBe('done');     // nobody tapped the output forklift
    tapHauler(s, 2);
    run(s, 10);
    expect(s.machines[1].state).toBe('empty');    // it takes the log (the saw can work again) ...
    expect(s.haulers[2].carrying).toBe(1);        // ... and waits with it at the yard
    expect(s.haulers[2].phase).toBe('drop');
    expect(s.stock.yard).toBe(CAP.yard);
  });

  it('does not pick a trunk off the debarker when its forks are full, the saw is busy and the storage is full', () => {
    const s = newIdle();
    s.machines[0].state = 'done';
    s.machines[1].state = 'working'; s.machines[1].workS = 1000;
    s.stock.storage = CAP.storage;
    s.haulers[1].carrying = 1;
    expect(haulerHasJob(s, 1)).toBe(false);
    tapHauler(s, 1);
    run(s, 3);
    expect(s.machines[0].state).toBe('done');
    expect(s.haulers[1].carrying).toBe(1);
  });

  it('keeps every stock within its capacity with a pile of trunks pushed through', () => {
    const s = newIdle();
    s.stock.landing = CAP.landing;
    s.stock.pile = CAP.pile;
    const before = piecesInLine(s);
    run(s, 400, (st) => {
      tapVehicles(st);
      for (const id of STOCK_IDS) expect(st.stock[id]).toBeLessThanOrEqual(CAP[id]);
      expect(piecesInLine(st) + st.sold).toBe(before);
    });
    expect(s.sold).toBeGreaterThan(2);
  });

  it('loads what the yard has one piece at a time and leaves as soon as it is empty, even when the truck has room left', () => {
    const s = newIdle();
    s.trucks[1].capacity = 2;
    fillYard(s, 1);
    run(s, 0.5);
    expect(s.trucks[1].cargo).toBe(0); // one piece takes a second to load
    const events = run(s, 15);
    expect(events).toHaveLength(1);
    expect(events[0].count).toBe(1); // one piece: it takes one, the second place stays empty
    expect(s.sold).toBe(1);
  });

  it('has the delivery truck take up to 5 pieces, and fewer when there are fewer: it does not wait to be full', () => {
    const s = newIdle();
    expect(TUNING.deliveryCapacity).toBe(18);
    expect(s.trucks[1].capacity).toBe(18);
    run(s, 10);
    expect(s.sold).toBe(0); // nothing to take: the truck waits at the dock, it does not leave empty
    expect(s.trucks[1].phase).toBe('work');
    fillYard(s, 3);
    const sales = run(s, 30);
    expect(sales).toHaveLength(3); // one sale per piece, as it goes on the truck
    for (const e of sales) expect(e).toMatchObject({ type: 'sold', count: 1, coins: PRICE.logs });
    expect(s.sold).toBe(3);
    expect(s.coins).toBe(30);
    expect(s.stock.yard).toBe(0);
  });

  it('fills a delivery truck to 5 when there are more, and the next truck takes the rest', () => {
    const s = newIdle();
    fillYard(s, 6);
    run(s, 4.5);
    expect(s.sold).toBe(4);              // paid for as they are loaded, before the truck has left
    expect(s.trucks[1].phase).toBe('work');
    run(s, 60);
    expect(s.sold).toBe(6);
    expect(s.coins).toBe(6 * PRICE.logs);
    expect(piecesInLine(s)).toBe(0);
  });

  it('brings a new delivery truck after the first has left', () => {
    const s = newIdle();
    s.trucks[1].capacity = 1;
    fillYard(s, 1);
    run(s, 30);
    expect(s.sold).toBe(1);
    fillYard(s, 1);
    run(s, 40);
    expect(s.sold).toBe(2);
  });
});

/** The line with the first saw 1 at level 100 and the rows built as far as `rows`, each first machine at level 100 (the levels are free in a test; the coins are the scene's business). */
function builtRows(rows: 1 | 2 | 3): IdleState {
  const s = newIdle();
  levelTo(s, 1, 0, ROW_UNLOCK_LEVEL);
  if (rows >= 2) { expect(buyMachine(s, 2, 0)).toBe(true); levelTo(s, 2, 0, ROW_UNLOCK_LEVEL); }
  if (rows >= 3) expect(buyMachine(s, 3, 0)).toBe(true);
  return s;
}

describe('idle sawmill: empty lots and what opens them', () => {
  it('starts with the debarker and one saw, every other lot empty and closed', () => {
    const s = newIdle();
    expect(s.machines.map((m) => [m.id, m.row, m.slot])).toEqual([['debarker', 0, 0], ['saw1', 1, 0]]);
    expect(lastRow(s)).toBe(1);
    for (const row of [1, 2, 3] as const) for (const slot of [0, 1, 2] as const) {
      expect(slotOffer(s, row, slot).state).toBe(row === 1 && slot === 0 ? 'built' : 'locked');
    }
    expect(buyMachine(s, 1, 1)).toBe(false);
    expect(buyMachine(s, 2, 0)).toBe(false);
    expect(s.machines).toHaveLength(2);
  });

  it('opens the second saw of a row when the first is at level 50, and the third when the second is', () => {
    const s = newIdle();
    levelTo(s, 1, 0, EXTRA_UNLOCK_LEVEL - 1);
    expect(slotOffer(s, 1, 1)).toMatchObject({ state: 'locked', needs: EXTRA_UNLOCK_LEVEL });
    upgradeMachine(machineAt(s, 1, 0)!);
    expect(machineAt(s, 1, 0)!.level).toBe(50);
    expect(slotOffer(s, 1, 1)).toEqual({ state: 'offer', price: SLOT_PRICE[0][1], needs: 50 });
    expect(slotOffer(s, 1, 2).state).toBe('locked'); // one lot at a time
    expect(buyMachine(s, 1, 2)).toBe(false);
    expect(buyMachine(s, 1, 1)).toBe(true);
    expect(machineAt(s, 1, 1)).toMatchObject({ id: 'saw1', level: 1, state: 'empty', workS: TUNING.sawS }); // a new machine starts at level 1, empty
    expect(slotOffer(s, 1, 1).state).toBe('built');
    expect(buyMachine(s, 1, 1)).toBe(false); // not twice
    expect(slotOffer(s, 1, 2).state).toBe('locked'); // the second saw must be at 50 itself
    levelTo(s, 1, 1, 50);
    expect(slotOffer(s, 1, 2).state).toBe('offer');
    expect(buyMachine(s, 1, 2)).toBe(true);
    expect(rowMachines(s, 1)).toHaveLength(3);
    expect(offer(s, machineItem(1, 1)).price).toBe(machineCost(50)); // the second saw's levels cost what every machine's do
  });

  it('opens the first machine of the next row when the first machine of the row before is at level 100, not before', () => {
    const s = newIdle();
    levelTo(s, 1, 0, ROW_UNLOCK_LEVEL - 1);
    expect(slotOffer(s, 2, 0)).toMatchObject({ state: 'locked', needs: ROW_UNLOCK_LEVEL });
    expect(buyMachine(s, 2, 0)).toBe(false);
    upgradeMachine(machineAt(s, 1, 0)!);
    expect(slotOffer(s, 2, 0)).toEqual({ state: 'offer', price: SLOT_PRICE[1][0], needs: 100 });
    expect(slotOffer(s, 3, 0).state).toBe('locked'); // the planers wait for the second saw
    expect(buyMachine(s, 2, 0)).toBe(true);
    expect(machineAt(s, 2, 0)).toMatchObject({ id: 'saw2', row: 2, level: 1, state: 'empty', workS: TUNING.saw2S });
    expect(lastRow(s)).toBe(2);
    // the extra machines of row 2 open by the first one of row 2, whatever the first of row 1 does
    expect(slotOffer(s, 2, 1).state).toBe('locked');
    levelTo(s, 2, 0, EXTRA_UNLOCK_LEVEL);
    expect(slotOffer(s, 2, 1).state).toBe('offer');
    // and the first planer by the first saw 2 at 100
    expect(slotOffer(s, 3, 0).state).toBe('locked');
    levelTo(s, 2, 0, ROW_UNLOCK_LEVEL);
    expect(buyMachine(s, 3, 0)).toBe(true);
    expect(machineAt(s, 3, 0)!.id).toBe('planer');
    expect(lastRow(s)).toBe(3);
  });

  it('has a lot cost more along each row and from row to row', () => {
    for (const row of SLOT_PRICE) { expect(row[0]).toBeGreaterThanOrEqual(0); expect(row[1]).toBeGreaterThan(row[0]); expect(row[2]).toBeGreaterThan(row[1]); }
    expect(SLOT_PRICE[1][0]).toBeGreaterThan(SLOT_PRICE[0][2]);
    expect(SLOT_PRICE[2][0]).toBeGreaterThan(SLOT_PRICE[1][2]);
  });

  it('puts the machines that were bought back on a saved line, but not one whose lot could not have been bought', () => {
    const s = newIdle();
    applyUpgrades(s, { ...upgradesOf(s), machines: [{ row: 3, slot: 0, level: 4 }, { row: 1, slot: 2, level: 9 }, { row: 1, slot: 0, level: 5 }] });
    expect(s.machines.map((m) => [m.id, m.slot, m.level])).toEqual([['debarker', 0, 1], ['saw1', 0, 5]]); // no planer without a saw 2, no third saw without a second
    expect(upgradesOf(s).machines).toEqual([{ row: 1, slot: 0, level: 5 }]);
  });
});

describe('idle sawmill: the rows pass the work on by themselves', () => {
  it('has a finished saw 1 load a free saw 2 at once, and a saw 2 cut one log into 4 planks', () => {
    const s = builtRows(2);
    const saw1 = machineAt(s, 1, 0)!, saw2 = machineAt(s, 2, 0)!;
    saw1.state = 'working'; saw1.t = 0;
    run(s, saw1.workS + 0.2);
    expect(saw1.state).toBe('empty');   // it gave its log away ...
    expect(saw2.state).toBe('working'); // ... to the saw 2, with no forklift and no tap
    run(s, saw2.workS + 0.1);
    expect(saw2.state).toBe('done');
    expect(saw2.out).toBe(PLANKS_PER_LOG);
    expect(PLANKS_PER_LOG).toBe(4);
    expect(piecesInLine(s)).toBe(4);
  });

  it('has a finished saw 1 wait with its log while no saw 2 is free, and load it the moment one is', () => {
    const s = builtRows(2);
    const saw1 = machineAt(s, 1, 0)!, saw2 = machineAt(s, 2, 0)!;
    saw2.state = 'done'; saw2.out = 4; // the saw 2 has cut, and its planks still lie on it
    saw1.state = 'done'; saw1.out = 1;
    run(s, 5);
    expect(saw1.state).toBe('done'); // nobody takes it: it waits, so the debarker's next trunk cannot go onto it either
    expect(saw1.out).toBe(1);
    expect(saw2.out).toBe(4);
    saw2.state = 'empty'; saw2.out = 0; // the forklift took the planks
    run(s, 0.1);
    expect(saw1.state).toBe('empty');
    expect(saw2.state).toBe('working');
  });

  it('shares the work between the machines of the next row: the first free one gets it', () => {
    const s = builtRows(2);
    levelTo(s, 2, 0, EXTRA_UNLOCK_LEVEL);
    buyMachine(s, 2, 1);
    const a = machineAt(s, 2, 0)!, b = machineAt(s, 2, 1)!, saw1 = machineAt(s, 1, 0)!;
    saw1.state = 'done'; saw1.out = 1;
    run(s, 0.1);
    expect([a.state, b.state]).toEqual(['working', 'empty']);
    saw1.state = 'done'; saw1.out = 1;
    run(s, 0.1);
    expect([a.state, b.state]).toEqual(['working', 'working']); // the first was busy, so the second took it
  });

  it('has a saw 2 hand its planks to the planers one by one, and keep the rest until one is free', () => {
    const s = builtRows(3);
    const saw2 = machineAt(s, 2, 0)!, planer = machineAt(s, 3, 0)!;
    saw2.state = 'done'; saw2.out = 4;
    run(s, 0.1);
    expect(planer.state).toBe('working');
    expect(saw2.out).toBe(3);
    expect(saw2.state).toBe('done');
    run(s, planer.workS + 0.2);
    expect(planer.state).toBe('working'); // the planed plank lies on its output stack and it has already taken the next one
    expect(planer.out).toBe(1);
    expect(saw2.out).toBe(2);
  });

  it('has a planer stack its planks until the stack of four is full, then wait for the forklift', () => {
    const s = builtRows(3);
    const saw2 = machineAt(s, 2, 0)!, planer = machineAt(s, 3, 0)!;
    s.haulers.forEach((h) => { h.phase = 'idle'; });
    saw2.state = 'done'; saw2.out = 4;
    run(s, planer.workS * 4 + 1);
    expect(planer.out).toBe(4);
    expect(planer.state).toBe('done');
    expect(saw2.out).toBe(0);
  });

  it('only gives the output forklift the last built row: with row 2 built a finished saw 1 is not carried to the yard', () => {
    const s = builtRows(2);
    machineAt(s, 1, 0)!.state = 'done';
    machineAt(s, 1, 0)!.out = 1;
    machineAt(s, 2, 0)!.state = 'working';
    machineAt(s, 2, 0)!.t = 0;
    tapHauler(s, 2);
    run(s, 1);
    expect(s.haulers[2].job).toBeNull();
    expect(haulerHasJob(s, 2)).toBe(false);
  });

  it('feeds a second saw 1 when the first is busy, before using the storage', () => {
    const s = newIdle();
    levelTo(s, 1, 0, EXTRA_UNLOCK_LEVEL);
    buyMachine(s, 1, 1);
    const first = machineAt(s, 1, 0)!, second = machineAt(s, 1, 1)!;
    first.state = 'working'; first.t = 0;
    s.machines[0].state = 'done'; s.machines[0].out = 1; // a peeled trunk waits on the debarker
    tapHauler(s, 1);
    run(s, 20);
    expect(s.stock.storage).toBe(0);
    expect(second.state).not.toBe('empty');
    expect(s.machines[0].state).toBe('empty');
  });
});

describe('idle sawmill: what a machine\'s levels cost', () => {
  it('prices the levels of a machine bought on a lot like every machine\'s: 3 coins, then 10 % more each level', () => {
    const s = newIdle();
    expect(offer(s, machineItem(1, 0)).price).toBe(3);
    levelTo(s, 1, 0, EXTRA_UNLOCK_LEVEL);
    buyMachine(s, 1, 1);
    expect(offer(s, machineItem(1, 1)).price).toBe(3); // the lot is the only extra cost
    levelTo(s, 1, 1, 50);
    buyMachine(s, 1, 2);
    expect(offer(s, machineItem(1, 2)).price).toBe(3);
    upgradeMachine(machineAt(s, 1, 2)!);
    expect(offer(s, machineItem(1, 2)).price).toBe(4);
  });

  it('does the same for the first machines of the rows after', () => {
    const s = builtRows(3);
    machineAt(s, 2, 0)!.level = 1; // (builtRows has levelled it)
    machineAt(s, 3, 0)!.level = 1;
    expect(offer(s, machineItem(2, 0)).price).toBe(3);
    expect(offer(s, machineItem(3, 0)).price).toBe(3);
  });

  it('makes a second saw better value than levelling the first one further, once it opens', () => {
    let levels = 0;
    for (let l = 1; l < 50; l++) levels += machineCost(l);
    const secondSaw = SLOT_PRICE[0][1] + levels; // the lot, then the second saw to level 50
    let firstSaw = 0;
    let level = EXTRA_UNLOCK_LEVEL;
    for (; firstSaw + machineCost(level) <= secondSaw; level++) firstSaw += machineCost(level); // the same coins spent on the first saw instead
    const withSecond = pieceWorth('logs', [[1], [EXTRA_UNLOCK_LEVEL, 50]]);
    const firstOnly = pieceWorth('logs', [[1], [level]]);
    expect(withSecond).toBeGreaterThan(firstOnly);
  });
});

describe('idle sawmill: milestone levels', () => {
  it('multiplies a machine\'s price factor by 2 at levels 10, 25 and 50 and then at every 50 (100, 150, ...)', () => {
    const miles = [1, 9, 10, 24, 25, 49, 50, 99, 100, 149, 150, 200, 250].map(machineMilestones);
    expect(miles).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7]);
    expect(MACHINE_MILESTONE_FACTOR).toBe(2);
    expect(machineFactor(9)).toBeCloseTo(1.03 ** 8, 9);
    expect(machineFactor(10)).toBeCloseTo(1.03 ** 9 * 2, 9);
    expect(machineFactor(10) / machineFactor(9)).toBeCloseTo(1.03 * 2, 9); // the step itself
    expect(machineFactor(25)).toBeCloseTo(1.03 ** 24 * 4, 6);
    expect(machineFactor(50)).toBeCloseTo(1.03 ** 49 * 8, 6);
    expect(machineFactor(100)).toBeCloseTo(1.03 ** 99 * 16, 6);
    expect(machineFactor(150) / machineFactor(149)).toBeCloseTo(1.03 * 2, 9);
    for (let level = 2; level < 400; level++) expect(machineFactor(level)).toBeGreaterThan(machineFactor(level - 1)); // never worse for a higher level
  });

  it('adds up the machines of a stage: +50 % and +80 % make +130 %, a new level-1 machine adds nothing', () => {
    // two machines at levels 3 and 4: +6.09 % and +9.27 % give +15.36 %, not the 15.9 % of multiplying them
    expect(stageFactor([3])).toBeCloseTo(machineFactor(3), 9);
    expect(stageFactor([3, 4])).toBeCloseTo(1 + (machineFactor(3) - 1) + (machineFactor(4) - 1), 9);
    expect(stageFactor([3, 4])).toBeCloseTo(1.1536, 3);
    expect(stageFactor([3, 4])).toBeLessThan(machineFactor(3) * machineFactor(4));
    expect(stageFactor([7, 1, 1])).toBeCloseTo(machineFactor(7), 9);
    // with milestones: levels 10 and 25 add their bonuses together
    expect(stageFactor([10, 25]) - 1).toBeCloseTo(machineFactor(10) - 1 + machineFactor(25) - 1, 6);
  });

  it('raises the price of what the line makes by what each saw of the row adds', () => {
    const s = newIdle();
    levelTo(s, 1, 0, 50);
    buyMachine(s, 1, 1);
    const before = pieceValue(s);
    expect(before).toBeCloseTo(PRICE.logs * machineFactor(50), 6); // the second saw is level 1: nothing added yet
    levelTo(s, 1, 1, 10);
    expect(pieceValue(s)).toBeCloseTo(PRICE.logs * (machineFactor(50) + machineFactor(10) - 1), 6);
    expect(pieceValue(s)).toBeGreaterThan(before);
    upgradeDebarker(s); // the debarker is a stage of its own: it adds its own bonus
    expect(pieceValue(s)).toBeCloseTo(PRICE.logs * (1 + (machineFactor(2) - 1) + (machineFactor(50) - 1) + (machineFactor(10) - 1)), 6);
  });
});

describe('idle sawmill: planks and what they are worth', () => {
  it('prices a square log at 10, a plank at half of it (a log is 4 planks: cutting doubles the worth) and a planed plank at double the plank', () => {
    expect(PRICE.logs).toBe(10);
    expect(PRICE.plank).toBe(PRICE.logs / 2);
    expect(PRICE.planed).toBe(PRICE.plank * 2);
    expect(PLANKS_PER_LOG * PRICE.plank).toBe(2 * PRICE.logs);
    expect(PLANKS_PER_LOG * PRICE.planed).toBe(4 * PRICE.logs);
    // what the line makes at level 1 everywhere: it rises along the chain
    const worth = ([1, 2, 3] as const).map((rows) => { const s = builtRows(rows); for (const m of s.machines) m.level = 1; return pieceValue(s) * (rows === 1 ? 1 : PLANKS_PER_LOG); });
    expect(worth).toEqual([10, 20, 40]); // one log's worth of goods: a square log, 4 planks, 4 planed planks
  });

  it('adds up what the debarker and every row it went through add to a piece', () => {
    const s = builtRows(3);
    for (const m of s.machines) m.level = 1;
    machineAt(s, 1, 0)!.level = 2;
    machineAt(s, 2, 0)!.level = 3;
    machineAt(s, 3, 0)!.level = 4;
    s.machines[0].level = 5;
    expect(pieceValue(s)).toBeCloseTo(PRICE.planed * (1 + [2, 3, 4, 5].reduce((sum, l) => sum + machineFactor(l) - 1, 0)), 9);
    // a second machine in a row adds its bonus to the row's; at level 1 it adds nothing
    levelTo(s, 1, 0, 50); buyMachine(s, 1, 1);
    expect(pieceValue(s)).toBeCloseTo(PRICE.planed * (1 + (machineFactor(5) - 1) + (machineFactor(50) - 1) + (machineFactor(3) - 1) + (machineFactor(4) - 1)), 4); // level 50 has reached three milestones
    // rows that are not built do not count
    const two = builtRows(2);
    for (const m of two.machines) m.level = 1;
    expect(pieceValue(two)).toBeCloseTo(PRICE.plank, 9);
  });

  it('lets the yard, the delivery truck and the output forklift hold 4 times as much once the line makes planks', () => {
    expect(pieceMultiplier(newIdle())).toBe(1);
    expect(yardCap(newIdle())).toBe(CAP.yard);
    const s = builtRows(2);
    expect(pieceMultiplier(s)).toBe(PLANKS_PER_LOG);
    expect(yardCap(s)).toBe(CAP.yard * 4);
  });

  it('sells planks at the plank price, wherever they came from', () => {
    const s = builtRows(2);
    for (const m of s.machines) m.level = 1;
    fillYard(s, 7);
    run(s, 40);
    expect(s.trucks[1].cargo).toBe(0);    // gone: the truck took all 7 (it takes up to 5 x 4 = 20 planks) and left
    expect(s.sold).toBe(7);
    expect(s.coins).toBe(7 * PRICE.plank);
    expect(s.yardValue).toBe(0);
  });

  it('keeps the worth of the pieces already in the yard when a row is built: logs stay logs', () => {
    const s = newIdle();
    s.trucks[1].capacity = 1;
    fillYard(s, 2); // two square logs, 10 coins each
    levelTo(s, 1, 0, ROW_UNLOCK_LEVEL);
    expect(buyMachine(s, 2, 0)).toBe(true);
    for (const m of s.machines) m.level = 1; // (so that what is worth what is easy to see)
    expect(pieceValue(s)).toBe(PRICE.plank); // what comes in now is a plank
    expect(s.yardValue).toBe(20);
    expect(s.stock.yard).toBe(2);
    run(s, 40);
    expect(s.coins).toBe(20);
    expect(s.sold).toBe(2);
  });

  it('puts a trunk through all three rows and sells 4 planed planks for it', () => {
    const s = builtRows(3);
    const worth = pieceValue(s);
    s.stock.pile = 1;
    let carriedMost = 0;
    run(s, 400, (x) => { tapVehicles(x); carriedMost = Math.max(carriedMost, x.haulers[2].carrying); });
    expect(s.sold).toBe(PLANKS_PER_LOG);
    expect(Math.abs(s.coins - PLANKS_PER_LOG * worth)).toBeLessThanOrEqual(PLANKS_PER_LOG); // each sale is rounded to whole coins
    expect(s.coins).toBeGreaterThan(0);
    expect(piecesInLine(s)).toBe(0);
    expect(s.machines.every((m) => m.state === 'empty')).toBe(true);
    expect(carriedMost).toBeLessThanOrEqual(PLANKS_PER_LOG); // the output forklift takes bundles of planks
  });

  it('sells the planks of a log when only the plank saw is built, and square logs again if there is no row 2', () => {
    const s = builtRows(2);
    const worth = pieceValue(s);
    s.stock.pile = 1;
    run(s, 400, tapVehicles);
    expect(s.sold).toBe(PLANKS_PER_LOG);
    expect(Math.abs(s.coins - PLANKS_PER_LOG * worth)).toBeLessThanOrEqual(PLANKS_PER_LOG);
  });
});

describe('idle sawmill: the output forklift carries planks in bundles', () => {
  it('carries four planks for each log of capacity, and one log per capacity while the line makes square logs', () => {
    const logs = newIdle();
    forkliftsTo(logs, 10); // capacity 2
    expect(pieceMultiplier(logs)).toBe(1);
    machineAt(logs, 1, 0)!.state = 'done'; machineAt(logs, 1, 0)!.out = 1;
    tapHauler(logs, 2);
    run(logs, 1.5);
    expect(logs.haulers[2].carrying).toBe(1); // one square log is all there is

    for (const [level, capacity] of [[1, 1], [10, 2], [20, 3], [30, 4]] as const) {
      const s = builtRows(2);
      forkliftsTo(s, level);
      expect(forkliftCapacity(s.forkliftLevel)).toBe(capacity);
      const saw2 = machineAt(s, 2, 0)!;
      saw2.state = 'done'; saw2.out = PLANKS_PER_LOG * 5; // more planks than any bundle
      tapHauler(s, 2);
      let most = 0;
      run(s, 8, () => { most = Math.max(most, s.haulers[2].carrying); });
      expect(most).toBe(capacity * PLANKS_PER_LOG);
    }
  });
});

describe('idle sawmill: the exit trucks', () => {
  const exitTrucks = (s: IdleState) => s.trucks.filter((t) => t.id === 'delivery');
  const upTo = (s: IdleState, level: number): void => { while (s.deliveryLevel < level) upgradeDeliveryTrucks(s); };

  it('has a level of their own, priced like the logging truck, that the logging truck does not share', () => {
    const s = newIdle();
    expect(offer(s, 'deliveryTruck')).toEqual({ state: 'offer', level: 1, price: 3, needs: 0 });
    expect(buy(s, 'deliveryTruck')).toBe(true);
    expect([s.deliveryLevel, s.truckLevel]).toEqual([2, 1]);
    expect(offer(s, 'deliveryTruck').price).toBe(truckCost(2));
    expect(offer(s, 'truck').level).toBe(1);
    expect(offer(s, 'truckManager').state).toBe('locked'); // the manager is the logging truck's: exit trucks do not unlock him
    upTo(s, 10);
    expect(offer(s, 'truckManager').state).toBe('locked');
  });

  it('drives and loads in 0.97 of the time per exit truck level, and the logging truck level does not speed them up', () => {
    const timeToSell = (exitLevel: number, loggingLevel: number): number => {
      const s = newIdle();
      upTo(s, exitLevel); trucksTo(s, loggingLevel);
      fillYard(s, 5);
      let t = 0;
      while (s.sold < 5 && t < 100) { tick(s, 0.05); t += 0.05; }
      return t;
    };
    expect(timeToSell(30, 1)).toBeLessThan(timeToSell(1, 1) * 0.8);
    expect(timeToSell(1, 30)).toBeCloseTo(timeToSell(1, 1), 1);
  });

  it('buys one more truck every 50 levels', () => {
    expect(DELIVERY_TRUCK_LEVELS).toBe(50);
    expect([1, 49, 50, 99, 100, 150, 200].map(deliveryTrucksAt)).toEqual([1, 1, 2, 2, 3, 4, 5]);
    const s = newIdle();
    upTo(s, 49);
    expect(exitTrucks(s)).toHaveLength(1);
    upgradeDeliveryTrucks(s);
    expect(exitTrucks(s)).toHaveLength(2);
    expect(exitTrucks(s)[1].phase).toBe('away'); // the new truck comes in from the top of the delivery road
    upTo(s, 100);
    expect(exitTrucks(s)).toHaveLength(3);
    expect(s.trucks[0].id).toBe('logging');
  });

  it('has the trucks wait at the ramp in a line, and only the first one loads', () => {
    const s = newIdle();
    upTo(s, 100); // three trucks
    const [first, second, third] = exitTrucks(s);
    expect(first.phase).toBe('work'); // the first is parked at the dock from the start
    run(s, 20); // the others drive in and queue up
    expect(second.phase).not.toBe('away');
    expect(third.phase).not.toBe('away');
    expect([queueRank(s, first), queueRank(s, second), queueRank(s, third)]).toEqual([0, 1, 2]);
    expect(first.pos).toEqual(queueSpot(s, first));
    expect(second.pos.gx).toBe(first.pos.gx);
    expect(first.pos.gy - second.pos.gy).toBeCloseTo(QUEUE_SPACING, 6); // behind it up the road, not on top of it
    expect(second.pos.gy - third.pos.gy).toBeCloseTo(QUEUE_SPACING, 6);
    expect(first.phase).toBe('work');
    expect(second.phase).toBe('drive'); // at its place in the line, waiting
    expect(third.phase).toBe('drive');
    // with goods in the yard only the first loads: the others stay where they are until it has left (these trucks are fast, at level 100)
    fillYard(s, 2);
    let waited = 0;
    run(s, 1.5, () => { if (first.i === 0 && first.phase === 'work') { waited += 1; expect(second.cargo + third.cargo).toBe(0); expect(second.phase).toBe('drive'); expect(third.phase).toBe('drive'); } });
    expect(waited).toBeGreaterThan(0);
    expect(s.sold).toBe(2); // the first took both
  });

  it('lets the next truck up when the first has loaded and left, one at a time', () => {
    const s = newIdle();
    upTo(s, 50); // two trucks
    const [first, second] = exitTrucks(s);
    first.capacity = 1; second.capacity = 1;
    run(s, 15);
    expect(queueRank(s, second)).toBe(1);
    fillYard(s, 1);
    run(s, 4);
    expect(s.sold).toBe(1); // the first has taken its one piece and left (it is driving out, or gone)
    expect(first.cargo).toBe(0);
    expect(queueRank(s, second)).toBe(0); // so the second is first in line now ...
    run(s, 6);
    expect(second.pos).toEqual(queueSpot(s, second)); // ... and has pulled up to the dock
    expect(second.phase).toBe('work');
    fillYard(s, 1);
    run(s, 6);
    expect(s.sold).toBe(2); // both pieces sold, by two different trucks
  });

  it('never has two trucks loading at the same time, whatever happens to the yard', () => {
    const s = newIdle();
    upTo(s, 150); // four trucks
    for (const t of exitTrucks(s)) t.capacity = 2;
    run(s, 300, (x, ev) => {
      if (x.stock.yard < 1) fillYard(x, 1 + (x.sold % 3));
      const loading = exitTrucks(x).filter((t) => t.i === 0 && t.phase === 'work');
      expect(loading.length).toBeLessThanOrEqual(1);
      for (const t of exitTrucks(x)) if (t.i === 0 && t.phase === 'work') expect(queueRank(x, t)).toBe(0);
      void ev;
    });
    expect(s.sold).toBeGreaterThan(5);
  });

  /** The output forklift standing at the loading yard, about to put down `n` square logs. */
  function unloading(s: IdleState, n: number): void {
    const h = s.haulers[2];
    Object.assign(h, { at: 'yard', phase: 'drop', carrying: n, t: 0, job: { at: 'yard', act: 'drop' }, pos: { ...STATIONS.yard.pos }, active: TUNING.activeS });
  }

  it('waits at the ramp while the output forklift is unloading, and takes all of it, even when it loads faster than the forklift puts down', () => {
    const s = newIdle();
    s.deliveryLevel = 49; // a quick truck (0.23 s a piece; the forklift needs 0.3 s), still only one
    const tr = exitTrucks(s)[0];
    unloading(s, 3);
    run(s, 4, () => { if (s.haulers[2].carrying > 0) expect(tr.i).toBe(0); }); // it does not drive off while the forklift still has something
    expect(s.sold).toBe(3);
    expect(s.stock.yard).toBe(0);
    expect(tr.i > 0 || tr.phase === 'away').toBe(true); // and then it went
  });

  it('drives off full even while the forklift is still unloading: the rest waits for the next truck', () => {
    const s = newIdle();
    exitTrucks(s)[0].capacity = 5; // a small truck: the yard holds more than it takes
    fillYard(s, CAP.yard);
    unloading(s, 2);
    run(s, 8);
    expect(s.sold).toBe(5);
    expect(exitTrucks(s)[0].i).toBeGreaterThan(0);
    expect(s.stock.yard + s.haulers[2].carrying).toBe(CAP.yard + 2 - 5);
  });

  it('sells the worth of what each truck took, with several trucks', () => {
    const s = newIdle();
    upTo(s, 50);
    for (const t of exitTrucks(s)) t.capacity = 2;
    run(s, 15);
    fillYard(s, 6);
    const sales = run(s, 120);
    expect(sales.reduce((n, e) => n + e.count, 0)).toBe(6);
    expect(s.coins).toBe(6 * PRICE.logs);
    expect(s.yardValue).toBe(0);
  });
});

describe('idle sawmill: the output forklift collects before it leaves', () => {
  /** Three saws 1 with a finished square log each (and the first saw at the level that opens the others). */
  function threeSaws(): IdleState {
    const s = newIdle();
    levelTo(s, 1, 0, EXTRA_UNLOCK_LEVEL); buyMachine(s, 1, 1);
    levelTo(s, 1, 1, EXTRA_UNLOCK_LEVEL); buyMachine(s, 1, 2);
    for (const m of rowMachines(s, 1)) { m.state = 'done'; m.out = 1; }
    s.trucks[1].phase = 'away'; s.trucks[1].t = -1000; // no exit truck: what reaches the yard stays there to be counted
    return s;
  }
  /** Runs the forklift and notes how many it held each time it set off for the yard. */
  function loads(s: IdleState, seconds: number): number[] {
    const out: number[] = [];
    let was = s.haulers[2].phase;
    run(s, seconds, () => {
      const h = s.haulers[2];
      if (h.phase === 'toDrop' && was !== 'toDrop') out.push(h.carrying);
      was = h.phase;
    });
    return out;
  }

  it('picks up from machine after machine until the forks are full, then drives to the yard once', () => {
    const s = threeSaws();
    forkliftsTo(s, 20); // carries 3
    expect(forkliftCapacity(s.forkliftLevel)).toBe(3);
    tapHauler(s, 2);
    expect(loads(s, 12)).toEqual([3]); // one trip with all three
    expect(s.stock.yard).toBe(3);
    expect(rowMachines(s, 1).every((m) => m.state === 'empty')).toBe(true);
  });

  it('stops collecting when it is full: with room for two it takes two, then waits with the third for a second one', () => {
    const s = threeSaws();
    forkliftsTo(s, 10); // carries 2
    tapHauler(s, 2);
    expect(loads(s, 25)).toEqual([2]);
    expect(s.stock.yard).toBe(2);
    expect(s.haulers[2].carrying).toBe(1);
    expect(s.haulers[2].phase).toBe('idle'); // waiting at the saws, not on its way to the yard
  });

  it('does not drive off half empty: it waits at the saws for a machine that is still working, and goes once its forks are full', () => {
    const s = threeSaws();
    forkliftsTo(s, 20); // carries 3
    const [a, b, c] = rowMachines(s, 1);
    c.state = 'working'; c.t = 0; c.workS = 1000; // the third is still sawing
    tapHauler(s, 2);
    expect(loads(s, 8)).toEqual([]);
    expect(s.haulers[2].carrying).toBe(2);
    expect(a.state).toBe('empty');
    expect(b.state).toBe('empty');
    c.workS = 0.1;                                // the third one finishes
    expect(loads(s, 8)).toEqual([3]);
    expect(s.stock.yard).toBe(3);
  });

  it('takes a lone piece to the yard when its tap time runs out, rather than keep it', () => {
    const s = threeSaws();
    forkliftsTo(s, 30);
    const [a, b, c] = rowMachines(s, 1);
    for (const m of [b, c]) { m.state = 'empty'; m.out = 0; }
    tapHauler(s, 2);
    expect(loads(s, 8)).toEqual([]);
    expect(loads(s, TUNING.activeS)).toEqual([1]);
    expect(a.state).toBe('empty');
  });

  it('takes bundles of planks from several saws 2: four planks per capacity, from as many machines as it needs', () => {
    const s = builtRows(2);
    levelTo(s, 2, 0, EXTRA_UNLOCK_LEVEL); buyMachine(s, 2, 1);
    const [a, b] = rowMachines(s, 2);
    a.state = 'done'; a.out = 4; b.state = 'done'; b.out = 4;
    s.trucks[1].phase = 'away'; s.trucks[1].t = -1000;
    forkliftsTo(s, 10); // capacity 2 = 8 planks
    tapHauler(s, 2);
    expect(loads(s, 12)).toEqual([8]); // one machine's four planks and the other's four, in one trip
    expect(s.stock.yard).toBe(8);
    expect(a.state).toBe('empty');
    expect(b.state).toBe('empty');
  });

  it('leaves what does not fit for the next trip, and a half-taken machine keeps the rest', () => {
    const s = builtRows(2);
    levelTo(s, 2, 0, EXTRA_UNLOCK_LEVEL); buyMachine(s, 2, 1);
    const [a, b] = rowMachines(s, 2);
    a.state = 'done'; a.out = 4; b.state = 'done'; b.out = 4;
    s.trucks[1].phase = 'away'; s.trucks[1].t = -1000;
    tapHauler(s, 2); // capacity 1 = 4 planks
    expect(loads(s, 4)).toEqual([4]); // it is full with the first machine's planks and goes
    expect(a.state).toBe('empty');
    expect(b.out).toBe(4);
  });

  it('loses nothing: every piece taken from the machines ends up in the yard', () => {
    const s = threeSaws();
    forkliftsTo(s, 20);
    tapHauler(s, 2);
    const before = piecesInLine(s);
    run(s, 15, () => expect(piecesInLine(s)).toBe(before));
    expect(s.stock.yard + s.trucks[1].cargo + s.sold).toBe(3);
  });

  it('brings in forklift F3, a second output forklift, at forklift level 40', () => {
    const s = newIdle();
    while (s.forkliftLevel < 39) upgradeForklifts(s);
    expect(s.haulers.map((h) => h.id)).toEqual(['f1', 'f2', 'out']);
    upgradeForklifts(s);
    expect(s.haulers.map((h) => h.id)).toEqual(['f1', 'f2', 'out', 'f3']);
    upgradeForklifts(s);
    expect(s.haulers).toHaveLength(4);
    const fresh = newIdle();
    applyUpgrades(fresh, upgradesOf(s));
    expect(fresh.haulers.map((h) => h.id)).toContain('f3');
  });
});
