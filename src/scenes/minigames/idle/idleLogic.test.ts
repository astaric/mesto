import { describe, expect, it } from 'vitest';
import { CAP, PRICE, STOCK_IDS, TUNING } from './idleData';
import { LOGGING_ROUTE, STATIONS } from './idleLayout';
import { haulerHasJob, newIdle, piecesInLine, plotWaits, tapHauler, tapPlot, tapTruck, tapWorker, tick, workerHasJob, type IdleEvent, type IdleState } from './idleLogic';

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
  for (let t = 0; t < 60 && s.worker.phase !== 'idle'; t += 0.05) tick(s, 0.05);
}

describe('idle sawmill: the worker in the forest', () => {
  it('waits at the landing until he is tapped, then walks to a grown tree, chops it and brings the trunk back', () => {
    const s = newIdle();
    run(s, 5);
    expect(s.worker.phase).toBe('idle');
    expect(s.worker.pos).toEqual(s.worker.home);
    expect(workerHasJob(s)).toBe(true);
    expect(tapWorker(s)).toBe(true);
    expect(s.worker.phase).toBe('toPlot');
    expect(tapWorker(s)).toBe(false); // busy
    expect(tapPlot(s, 1)).toBe(false);
    run(s, 0.5);
    expect(s.worker.pos).not.toEqual(s.worker.home); // on his way
    let sawChop = false, carriedBeforeLanding = false;
    for (let t = 0; t < 30 && s.worker.phase !== 'idle'; t += 0.05) {
      tick(s, 0.05);
      if (s.plots[0].phase === 'chopping') sawChop = true;
      if (s.worker.carrying && s.stock.landing === 0) carriedBeforeLanding = true;
    }
    expect(sawChop).toBe(true);
    expect(carriedBeforeLanding).toBe(true);
    expect(s.plots[0].phase).toBe('stump');
    expect(s.stock.landing).toBe(1);
    expect(s.worker.pos).toEqual(s.worker.home);
  });

  it('takes a grown tree before a stump, and a tap on a stump plants it', () => {
    const s = newIdle();
    tapWorker(s);
    untilIdle(s);
    expect(s.plots.map((p) => p.phase)).toEqual(['stump', 'ready', 'ready']);
    tapWorker(s);
    expect(s.worker.plot).toBe(1); // the next grown tree, not the stump
    untilIdle(s);
    expect(tapPlot(s, 0)).toBe(true); // the stump
    expect(s.worker.task).toBe('plant');
    untilIdle(s);
    expect(s.plots[0].phase).toBe('growing');
  });

  it('is free again as soon as the new tree is planted: he does not wait for it to grow, and can chop another tree meanwhile', () => {
    const s = newIdle();
    tapWorker(s);
    untilIdle(s);
    tapPlot(s, 0);
    untilIdle(s);
    expect(s.plots[0].phase).toBe('growing');
    expect(s.worker.phase).toBe('idle');
    expect(tapWorker(s)).toBe(true); // another tree
    expect(s.worker.plot).toBe(1);
    run(s, 3);
    expect(s.plots[0].phase).toBe('growing'); // still growing while he works
    untilIdle(s);
    expect(s.stock.landing).toBe(2);
  });

  it('has the planted tree grow into a tree again, and has nothing for him to do while every tree is busy', () => {
    const s = newIdle();
    s.plots.forEach((p) => { p.phase = 'growing'; p.t = 0; });
    expect(workerHasJob(s)).toBe(false);
    expect(tapWorker(s)).toBe(false);
    run(s, TUNING.growS + 0.2);
    expect(s.plots.every((p) => p.phase === 'ready')).toBe(true);
    expect(plotWaits(s, 2)).toBe(true);
  });

  it('keeps the trunk in his hands while the landing is full', () => {
    const s = newIdle();
    s.stock.landing = CAP.landing;
    tapWorker(s);
    run(s, 20);
    expect(s.worker.phase).toBe('carrying');
    expect(s.stock.landing).toBe(CAP.landing);
    expect(piecesInLine(s)).toBe(CAP.landing + 1);
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
    expect(s.haulers[0].carrying).toBe(true);
    s.haulers[0].active = 0.01;
    run(s, 5);
    expect(s.haulers[0].carrying).toBe(false);
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
    s.stock.landing = CAP.landing;
    tapTruck(s);
    run(s, TUNING.activeS + 25);
    expect(s.stock.landing).toBe(0);
    expect(s.stock.pile).toBe(CAP.landing); // two rounds of five
    expect(s.trucks[0].phase).toBe('parked');
  });
});

describe('idle sawmill: from one tree to one square log sold', () => {
  it('makes exactly one sale, of one square log, and loses nothing on the way', () => {
    const s = newIdle();
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
    tapWorker(s);
    let coins = 0;
    for (let i = 0; i < 150; i++) { tapVehicles(s); coins += tick(s, 1).reduce((n, e) => n + e.coins, 0); }
    expect(coins).toBe(PRICE.logs);
  });

  it('sells the next log too, once the trees have been planted and grown', () => {
    const s = newIdle();
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
    run(s, 4);                                   // the first trunk is on the debarker, working
    expect(s.machines[0].state).toBe('working');
    run(s, 0.5);
    expect(s.haulers[0].carrying).toBe(true);    // F1 has the second trunk and waits at the debarker
    expect(s.haulers[0].phase).toBe('drop');
    run(s, TUNING.debarkerS + 5);
    expect(s.machines[0].state).toBe('done');    // finished, but its peeled trunk is still on it: nobody took it away
    expect(s.haulers[0].carrying).toBe(true);    // so the second trunk still waits
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
    expect(s.haulers[0].carrying).toBe(false);
    expect(piecesInLine(s)).toBe(2);
  });

  it('takes the peeled trunk to the storage when the saw is busy, and from the storage to the saw when the saw is free again', () => {
    const s = newIdle();
    s.trucks[1].phase = 'away'; s.trucks[1].t = -1000; // no delivery truck comes: what is in the yard stays there
    s.machines[0].state = 'done';
    s.machines[1].state = 'working';              // the saw is busy
    tapHauler(s, 1);
    run(s, 8);
    expect(s.machines[0].state).toBe('empty');
    expect(s.stock.storage).toBe(1);              // brought to the storage
    expect(s.machines[1].state).not.toBe('empty');
    // the saw finishes, the square log waits on it; the storage trunk cannot go on until the log is taken away
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

  it('keeps the square log on the saw until the output forklift comes, and does not take it while the loading yard is full', () => {
    const s = newIdle();
    s.machines[1].state = 'working';
    s.machines[1].t = 0;
    s.trucks[1].phase = 'away'; s.trucks[1].t = -1000; // no delivery truck comes: nothing leaves the yard
    run(s, TUNING.sawS + 1);
    expect(s.machines[1].state).toBe('done');
    s.stock.yard = CAP.yard;
    expect(haulerHasJob(s, 2)).toBe(false);
    tapHauler(s, 2);
    run(s, 10);
    expect(s.machines[1].state).toBe('done');
    expect(s.stock.yard).toBe(CAP.yard);
  });

  it('does not pick a trunk off the debarker when the saw is busy and the storage is full', () => {
    const s = newIdle();
    s.machines[0].state = 'done';
    s.machines[1].state = 'working';
    s.stock.storage = CAP.storage;
    expect(haulerHasJob(s, 1)).toBe(false);
    tapHauler(s, 1);
    run(s, 3);
    expect(s.machines[0].state).toBe('done');
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

  it('keeps the delivery truck at the dock until it is full', () => {
    const s = newIdle();
    s.trucks[1].capacity = 2;
    s.stock.yard = 1;
    const events = run(s, 15);
    expect(events).toHaveLength(0);
    expect(s.trucks[1].cargo).toBe(1);
    expect(s.trucks[1].phase).toBe('work');
    s.stock.yard = 1;
    const later = run(s, 40);
    expect(later).toHaveLength(1);
    expect(later[0].count).toBe(2);
  });

  it('brings a new delivery truck after the first has left', () => {
    const s = newIdle();
    s.stock.yard = 1;
    run(s, 30);
    expect(s.sold).toBe(1);
    s.stock.yard = 1;
    run(s, 40);
    expect(s.sold).toBe(2);
  });
});
