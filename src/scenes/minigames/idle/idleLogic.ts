import { CAP, PRICE, STOCK_IDS, TUNING, type StockId } from './idleData';
import { ACTIVE_PLOTS, DELIVERY_ROUTE, FORKLIFT_HOME, FOREST_PLOTS, LANDING_SPOT, LOGGING_ROUTE, STATIONS, WORKER_HOME, plotSpot, type StationId } from './idleLayout';
import type { Tile } from './idleIso';

// The idle sawmill's rules, Phaser-free: the whole line from a tree to a sold square log (docs/minigames/idle.md). Everything that moves
// (the worker, the forklifts, the trucks) is simulated here in tile coordinates, so the scene only draws what it finds in the state.
// Coins are not touched in here: `tick` returns `sold` events and the scene calls `earn()`.
//
// Who does what by itself: the machines, the delivery truck. Who needs a tap: the worker in the forest (one job per tap), and the forklifts
// and the logging truck (a tap sets one working for `TUNING.activeS` seconds; it finishes the trip it is on and parks).
//
// A machine holds ONE piece. It works on it by itself, and the finished piece stays on the machine until a forklift takes it away; a forklift
// cannot put a piece on a machine that is not empty, it waits with the piece until the machine is free again. So the line is a chain of
// hand-overs: pile -F1-> debarker -F2-> saw (or, when the saw is busy, to the storage and later from there to the saw) -out-> yard.

const STEP = 0.05;

export type PlotPhase = 'ready' | 'chopping' | 'stump' | 'planting' | 'growing';
/** A tree the worker tends: a grown tree (`ready`), being chopped, a stump, being planted, or a sapling that is growing. */
export interface Plot { phase: PlotPhase; t: number; spot: Tile }

export type WorkerPhase = 'idle' | 'toPlot' | 'working' | 'carrying' | 'returning';
export type WorkerTask = 'chop' | 'plant';
/** The one worker in the forest. He waits beside the landing; a tap sends him to a tree to chop it (and carry the trunk back) or to plant a new one. */
export interface Worker { phase: WorkerPhase; pos: Tile; home: Tile; plot: number; task: WorkerTask; t: number; carrying: boolean }

/** `empty` (a forklift may put a piece on it), `working` (on the piece, `t` seconds in), `done` (the finished piece waits on the machine for a forklift). */
export type MachineState = 'empty' | 'working' | 'done';
export interface Machine { id: 'debarker' | 'saw1'; workS: number; state: MachineState; t: number }

export type HaulerPhase = 'idle' | 'toPickup' | 'pick' | 'toDrop' | 'drop' | 'toHome';
/** A trip: take a piece at `from`, put it down at `to` (stations, see idleLayout.ts). */
export interface Job { from: StationId; to: StationId }
/** A forklift. It only picks a new job while `active` (seconds left) is above 0; a trip it has begun it finishes (waiting with its piece if the place it brings it to is not free), then it drives home. */
export interface Hauler {
  id: 'f1' | 'f2' | 'out'; home: StationId; /** the station it stands at when it is not driving */ at: StationId; job: Job | null; /** the points it still has to drive through */ path: Tile[];
  pos: Tile; phase: HaulerPhase; t: number; carrying: boolean; axis: 'x' | 'y'; active: number;
}

export type StopAction = 'load' | 'unload' | 'none';
/** A stop on a truck's route. `stock` is the place it loads from or unloads to; a truck that `waitFull` stays until it is full. */
export interface Stop { p: Tile; action: StopAction; stock?: StockId; waitFull?: boolean }
/** `parked`: the logging truck at the pile; `away`: the delivery truck, gone until the next one comes. */
export type TruckPhase = 'parked' | 'away' | 'drive' | 'work';
export interface Truck {
  id: 'logging' | 'delivery'; route: readonly Stop[]; depot: Tile; pos: Tile; i: number; phase: TruckPhase; t: number; cargo: number; capacity: number; axis: 'x' | 'y';
  /** The logging truck's working time left (seconds): while it is above 0 it starts a round of the loop whenever there are trunks on the landing. */
  active: number;
}

export interface IdleState {
  stock: Record<StockId, number>;
  plots: Plot[];
  worker: Worker;
  machines: Machine[];
  haulers: Hauler[];
  trucks: Truck[];
  /** Pieces and coins sold so far. */
  sold: number;
  coins: number;
}

export type IdleEvent = { type: 'sold'; count: number; coins: number; at: Tile };

const copy = (p: Tile): Tile => ({ gx: p.gx, gy: p.gy });

export function newIdle(): IdleState {
  const hauler = (id: Hauler['id']): Hauler => {
    const home = FORKLIFT_HOME[id];
    return { id, home, at: home, job: null, path: [], pos: copy(STATIONS[home].pos), phase: 'idle', t: 0, carrying: false, axis: 'x', active: 0 };
  };
  // the logging truck is parked in front of the pile; its round: up the east lane, over to the west lane, load at the landing, down, back to the east lane, unload at the pile
  const logging: Truck = {
    id: 'logging', depot: LOGGING_ROUTE.park, pos: copy(LOGGING_ROUTE.park), i: 0, phase: 'parked', t: 0, cargo: 0, capacity: TUNING.loggingCapacity, axis: 'y', active: 0,
    route: [
      { p: LOGGING_ROUTE.north, action: 'none' },
      { p: LOGGING_ROUTE.landing, action: 'load', stock: 'landing' },
      { p: LOGGING_ROUTE.south, action: 'none' },
      { p: LOGGING_ROUTE.park, action: 'unload', stock: 'pile' },
    ],
  };
  // the delivery truck is already parked at the dock, waiting for its load
  const delivery: Truck = {
    id: 'delivery', depot: DELIVERY_ROUTE.depot, pos: copy(DELIVERY_ROUTE.dock), i: 0, phase: 'work', t: 0, cargo: 0, capacity: TUNING.deliveryCapacity, axis: 'y', active: 0,
    route: [
      { p: DELIVERY_ROUTE.dock, action: 'load', stock: 'yard', waitFull: true },
      { p: DELIVERY_ROUTE.turn, action: 'none' },
      { p: DELIVERY_ROUTE.exit, action: 'none' },
    ],
  };
  return {
    stock: Object.fromEntries(STOCK_IDS.map((id) => [id, 0])) as Record<StockId, number>,
    plots: FOREST_PLOTS.slice(0, ACTIVE_PLOTS).map((p): Plot => ({ phase: 'ready', t: 0, spot: plotSpot(p) })),
    worker: { phase: 'idle', pos: copy(WORKER_HOME), home: copy(WORKER_HOME), plot: 0, task: 'chop', t: 0, carrying: false },
    machines: [
      { id: 'debarker', workS: TUNING.debarkerS, state: 'empty', t: 0 },
      { id: 'saw1', workS: TUNING.sawS, state: 'empty', t: 0 },
    ],
    haulers: [hauler('f1'), hauler('f2'), hauler('out')],
    trucks: [logging, delivery],
    sold: 0,
    coins: 0,
  };
}

// ---------- tapping ----------

/** Is the worker free and this tree ready to be chopped (`ready`) or planted (`stump`)? */
export const plotWaits = (s: IdleState, i: number): boolean => s.worker.phase === 'idle' && (s.plots[i]?.phase === 'ready' || s.plots[i]?.phase === 'stump');

/** Is there a job for the worker, and is he free to take it? */
export const workerHasJob = (s: IdleState): boolean => s.worker.phase === 'idle' && s.plots.some((_, i) => plotWaits(s, i));

function send(s: IdleState, i: number): boolean {
  if (!plotWaits(s, i)) return false;
  s.worker.plot = i;
  s.worker.task = s.plots[i].phase === 'ready' ? 'chop' : 'plant';
  s.worker.phase = 'toPlot';
  return true;
}

/** A tap on a tree: the worker walks there and chops it (a grown tree) or plants a new one (a stump). False when he is busy or the tree is not waiting. */
export const tapPlot = (s: IdleState, i: number): boolean => send(s, i);

/** A tap on the worker: he takes the first grown tree to chop, or else the first stump to plant. */
export function tapWorker(s: IdleState): boolean {
  const grown = s.plots.findIndex((p) => p.phase === 'ready');
  const i = grown >= 0 ? grown : s.plots.findIndex((p) => p.phase === 'stump');
  return i >= 0 && send(s, i);
}

/** A tap on a forklift: it works for `activeS` seconds (a tap on one that works already gives it the full time again). */
export function tapHauler(s: IdleState, i: number): boolean {
  const h = s.haulers[i];
  if (!h) return false;
  h.active = TUNING.activeS;
  return true;
}

/** A tap on the logging truck: it drives its round for `activeS` seconds. */
export function tapTruck(s: IdleState): boolean {
  s.trucks[0].active = TUNING.activeS;
  return true;
}

// ---------- the clock ----------

/** Moves `p` toward `to` at `speed` tiles/s; true once it is there. */
function stepTo(p: Tile, to: Tile, speed: number, dt: number): boolean {
  const dx = to.gx - p.gx, dy = to.gy - p.gy, d = Math.hypot(dx, dy), m = speed * dt;
  if (d <= m) { p.gx = to.gx; p.gy = to.gy; return true; }
  p.gx += (dx / d) * m; p.gy += (dy / d) * m;
  return false;
}
const axisOf = (from: Tile, to: Tile): 'x' | 'y' => (Math.abs(to.gx - from.gx) >= Math.abs(to.gy - from.gy) ? 'x' : 'y');
/** Moves toward `to` and keeps the facing (the axis of the way it goes). */
function drive(v: { pos: Tile; axis: 'x' | 'y' }, to: Tile, speed: number, dt: number): boolean {
  v.axis = axisOf(v.pos, to);
  return stepTo(v.pos, to, speed, dt);
}

/** Advances the whole line by `dt` seconds (in small steps, so a long frame cannot skip a phase). */
export function tick(s: IdleState, dt: number): IdleEvent[] {
  const events: IdleEvent[] = [];
  for (let left = dt; left > 1e-9; left -= STEP) step(s, Math.min(STEP, left), events);
  return events;
}

function step(s: IdleState, dt: number, events: IdleEvent[]): void {
  for (const p of s.plots) if (p.phase === 'growing') { p.t += dt; if (p.t >= TUNING.growS) { p.phase = 'ready'; p.t = 0; } }
  stepWorker(s, dt);
  for (const m of s.machines) stepMachine(m, dt);
  for (const h of s.haulers) { h.active = Math.max(0, h.active - dt); stepHauler(s, h, dt); }
  for (const tr of s.trucks) { tr.active = Math.max(0, tr.active - dt); stepTruck(s, tr, dt, events); }
}

function stepWorker(s: IdleState, dt: number): void {
  const w = s.worker, plot = s.plots[w.plot];
  switch (w.phase) {
    case 'toPlot':
      if (stepTo(w.pos, plot.spot, TUNING.jackSpeed, dt)) { w.phase = 'working'; w.t = 0; plot.phase = w.task === 'chop' ? 'chopping' : 'planting'; plot.t = 0; }
      break;
    case 'working':
      w.t += dt;
      if (w.task === 'chop' && w.t >= TUNING.chopS) { plot.phase = 'stump'; w.carrying = true; w.phase = 'carrying'; }
      else if (w.task === 'plant' && w.t >= TUNING.plantS) { plot.phase = 'growing'; plot.t = 0; w.phase = 'returning'; }
      break;
    case 'carrying':
      // the trunk goes down on the landing; with a full landing he waits with it
      if (stepTo(w.pos, LANDING_SPOT, TUNING.jackSpeed, dt) && s.stock.landing < CAP.landing) { s.stock.landing += 1; w.carrying = false; w.phase = 'returning'; }
      break;
    case 'returning':
      if (stepTo(w.pos, w.home, TUNING.jackSpeed, dt)) w.phase = 'idle';
      break;
    default:
      break;
  }
}

function stepMachine(m: Machine, dt: number): void {
  if (m.state !== 'working') return;
  m.t = Math.min(m.workS, m.t + dt);
  if (m.t >= m.workS) m.state = 'done';
}

// ---------- the hand-overs between the stations ----------

const debarker = (s: IdleState): Machine => s.machines[0];
const saw = (s: IdleState): Machine => s.machines[1];

/** Is there a piece to take at this station? */
function hasPiece(s: IdleState, st: StationId): boolean {
  switch (st) {
    case 'pile': return s.stock.pile >= 1;
    case 'storage': return s.stock.storage >= 1;
    case 'debarkerOut': return debarker(s).state === 'done';
    case 'sawOut': return saw(s).state === 'done';
    default: return false;
  }
}
function takePiece(s: IdleState, st: StationId): void {
  if (st === 'pile') s.stock.pile -= 1;
  else if (st === 'storage') s.stock.storage -= 1;
  else if (st === 'debarkerOut') debarker(s).state = 'empty';
  else if (st === 'sawOut') saw(s).state = 'empty';
}
/** Can a piece be put down here now? A machine takes one only when it is empty: not while it works and not while a finished piece still waits on it. */
function hasRoom(s: IdleState, st: StationId): boolean {
  switch (st) {
    case 'storage': return s.stock.storage < CAP.storage;
    case 'yard': return s.stock.yard < CAP.yard;
    case 'debarkerIn': return debarker(s).state === 'empty';
    case 'sawIn': return saw(s).state === 'empty';
    default: return false;
  }
}
function putPiece(s: IdleState, st: StationId): void {
  if (st === 'storage') s.stock.storage += 1;
  else if (st === 'yard') s.stock.yard += 1;
  else if (st === 'debarkerIn') { debarker(s).state = 'working'; debarker(s).t = 0; }
  else if (st === 'sawIn') { saw(s).state = 'working'; saw(s).t = 0; }
}

/** What this forklift would do next, if anything. F1 fetches from the pile whether or not the debarker is free (it waits there with the trunk); F2 clears the debarker first,
 *  to the saw if the saw is free and to the storage if not, and otherwise feeds the saw from the storage; the output forklift clears the saw into the loading yard. */
function chooseJob(s: IdleState, h: Hauler): Job | null {
  switch (h.id) {
    case 'f1':
      return hasPiece(s, 'pile') ? { from: 'pile', to: 'debarkerIn' } : null;
    case 'f2':
      if (hasPiece(s, 'debarkerOut')) {
        if (hasRoom(s, 'sawIn')) return { from: 'debarkerOut', to: 'sawIn' };
        if (hasRoom(s, 'storage')) return { from: 'debarkerOut', to: 'storage' };
      }
      return hasPiece(s, 'storage') && hasRoom(s, 'sawIn') ? { from: 'storage', to: 'sawIn' } : null;
    case 'out':
      return hasPiece(s, 'sawOut') && hasRoom(s, 'yard') ? { from: 'sawOut', to: 'yard' } : null;
  }
}

/** Is this forklift free and is there something for it to carry (a tap would put it to work)? */
export const haulerHasJob = (s: IdleState, i: number): boolean => s.haulers[i]?.phase === 'idle' && chooseJob(s, s.haulers[i]) !== null;

/** The points to drive through from standing at station `a` to standing at station `b`: out to the main lane, along it, in to `b`. */
function routeBetween(a: StationId, b: StationId): Tile[] {
  if (a === b) return [];
  const out: Tile[] = [];
  let prev = STATIONS[a].pos;
  for (const p of [STATIONS[a].via, STATIONS[b].via, STATIONS[b].pos]) {
    if (Math.abs(p.gx - prev.gx) > 1e-9 || Math.abs(p.gy - prev.gy) > 1e-9) { out.push(copy(p)); prev = p; }
  }
  return out;
}

/** Drives along the remaining points of the path; true once there is none left. */
function follow(h: Hauler, dt: number): boolean {
  if (h.path.length === 0) return true;
  if (drive(h, h.path[0], TUNING.forkliftSpeed, dt)) h.path.shift();
  return h.path.length === 0;
}

function stepHauler(s: IdleState, h: Hauler, dt: number): void {
  switch (h.phase) {
    case 'idle': {
      const job = h.active > 0 ? chooseJob(s, h) : null;
      if (job) { h.job = job; h.path = routeBetween(h.at, job.from); h.phase = 'toPickup'; }
      else if (h.at !== h.home) { h.path = routeBetween(h.at, h.home); h.phase = 'toHome'; }
      break;
    }
    case 'toPickup':
      if (follow(h, dt)) {
        h.at = h.job!.from;
        if (hasPiece(s, h.at)) { takePiece(s, h.at); h.carrying = true; h.phase = 'pick'; h.t = 0; }
        else { h.job = null; h.phase = 'idle'; }
      }
      break;
    case 'pick':
      h.t += dt;
      if (h.t >= TUNING.forkliftHandleS) { h.path = routeBetween(h.at, h.job!.to); h.phase = 'toDrop'; }
      break;
    case 'toDrop':
      if (follow(h, dt)) { h.at = h.job!.to; h.phase = 'drop'; h.t = 0; }
      break;
    case 'drop':
      // a machine that is working, or still holds a finished piece, is not free: the forklift waits with its piece
      h.t += dt;
      if (h.t >= TUNING.forkliftHandleS && hasRoom(s, h.at)) { putPiece(s, h.at); h.carrying = false; h.job = null; h.phase = 'idle'; }
      break;
    case 'toHome':
      if (follow(h, dt)) { h.at = h.home; h.phase = 'idle'; }
      break;
  }
}

function stepTruck(s: IdleState, tr: Truck, dt: number, events: IdleEvent[]): void {
  if (tr.phase === 'parked') {
    // the logging truck sets out on a round when it has been tapped and there is something to fetch
    if (tr.active > 0 && s.stock.landing >= 1) { tr.phase = 'drive'; tr.i = 0; }
    return;
  }
  if (tr.phase === 'away') {
    tr.t += dt;
    if (tr.t >= TUNING.truckGapS) { tr.phase = 'drive'; tr.i = 0; tr.pos = copy(tr.depot); tr.axis = 'y'; }
    return;
  }
  const stop = tr.route[tr.i];
  if (tr.phase === 'drive') {
    if (drive(tr, stop.p, TUNING.truckSpeed, dt)) { tr.phase = 'work'; tr.t = 0; }
    return;
  }
  // working at a stop: one piece per `truckItemS`
  const leave = (): void => {
    if (tr.id === 'delivery' && stop.action === 'load') {
      const coins = tr.cargo * PRICE.logs;
      s.sold += tr.cargo; s.coins += coins;
      events.push({ type: 'sold', count: tr.cargo, coins, at: copy(tr.pos) });
      tr.cargo = 0;
    }
    if (tr.i + 1 >= tr.route.length) {
      // the logging truck is back at the pile and parks; the delivery truck drives out of the map and the next one comes
      tr.i = 0; tr.t = 0; tr.cargo = 0;
      tr.phase = tr.id === 'logging' ? 'parked' : 'away';
      return;
    }
    tr.i += 1; tr.phase = 'drive';
  };
  if (stop.action === 'none') { leave(); return; }
  const place = stop.stock!;
  const canMove = stop.action === 'load' ? s.stock[place] >= 1 && tr.cargo < tr.capacity : tr.cargo >= 1 && s.stock[place] < CAP[place];
  const done = stop.action === 'load' ? tr.cargo >= tr.capacity || (!stop.waitFull && s.stock[place] < 1) : tr.cargo < 1;
  if (canMove) {
    tr.t += dt;
    if (tr.t >= TUNING.truckItemS) {
      tr.t = 0;
      if (stop.action === 'load') { s.stock[place] -= 1; tr.cargo += 1; } else { s.stock[place] += 1; tr.cargo -= 1; }
    }
  } else if (done) {
    leave();
  }
}

/** Every piece in the line, wherever it is, for the tests: nothing may be made or lost on the way. */
export function piecesInLine(s: IdleState): number {
  let n = STOCK_IDS.reduce((sum, id) => sum + s.stock[id], 0);
  n += s.machines.filter((m) => m.state !== 'empty').length;
  n += s.haulers.filter((h) => h.carrying).length;
  n += s.trucks.reduce((sum, t) => sum + t.cargo, 0);
  n += s.worker.carrying ? 1 : 0;
  return n;
}
