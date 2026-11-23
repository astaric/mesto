import {
  CAP, EXTRA_UNLOCK_LEVEL, deliveryTrucksAt, PLANKS_PER_LOG, ROW_UNLOCK_LEVEL, SLOT_PRICE, TRUCK_MANAGER_COST, TRUCK_MANAGER_UNLOCK_LEVEL, FORKLIFT_MANAGER_COST, FORKLIFT_MANAGER_UNLOCK_LEVEL, MANAGER_COST, MANAGER_UNLOCK_LEVEL, PLANTER_UNLOCK_LEVEL, STOCK_IDS, TUNING, cutterChopS, cutterCost, cuttersAt, cutterSpeed, forkliftCapacity, forkliftCost, forkliftHandleS, forkliftSpeed, machineCost, machineWorkS, planterCost, pieceWorth, truckCost, truckItemS, truckSpeed, planterPlantS, plantersAt, planterSpeed, type StockId,
} from './idleData';
import { DELIVERY_ROUTE, QUEUE_SPACING, FORKLIFT_HOME, FOREST_TREES, LANDING_SPOT, LOGGING_ROUTE, ROW_IDS, ROW_KIND, STATIONS, cutterHome, machineOutId, planterHome, sawInId, treeSpot, type RowId, type SlotIndex, type StationId } from './idleLayout';
import type { Tile } from './idleIso';

// The idle sawmill's rules, Phaser-free: the whole line from a tree to a sold square log (docs/minigames/idle.md). Everything that moves
// (the worker, the forklifts, the trucks) is simulated here in tile coordinates, so the scene only draws what it finds in the state.
// Coins are not touched in here: `tick` returns `sold` events and the scene calls `earn()`.
//
// Who does what by itself: the machines, the delivery truck. Who needs a tap: the cutters and the planters in the forest (one job per tap; the manager taps for them), and the forklifts
// and the logging truck (a tap sets one working for `TUNING.activeS` seconds; it finishes the trip it is on and parks).
//
// A machine holds ONE piece. It works on it by itself, and the finished piece stays on the machine until a forklift takes it away; a forklift
// cannot put a piece on a machine that is not empty, it waits with the piece until the machine is free again. So the line is a chain of
// hand-overs: pile -F1-> debarker -F2-> a saw 1 (or, when all are busy, to the storage and later from there to a free saw) -> ... -out-> yard.
//
// The rows of machines (idleLayout.ts): row 1 = saws 1 (a trunk becomes a square log), row 2 = saws 2 (a log becomes `PLANKS_PER_LOG` planks), row 3 = planers (a plank becomes a planed plank).
// Each row has up to three machines, bought one by one on an empty lot (`slotOffer`, `buyMachine`), each with a level of its own. A finished machine of a row that has another row after it
// passes its pieces on to a free machine of the next row BY ITSELF (no forklift, no tap), one piece at a time, and keeps what is left until one is free (`passOn`). Only the last built row hands its goods
// to the output forklift. A piece is worth what the machines it went through make it worth (`pieceValue`, noted down when it enters the loading yard).

const STEP = 0.05;

export type PlotPhase = 'ready' | 'chopping' | 'stump' | 'planting' | 'growing';
/** A tree of the forest: a grown tree (`ready`), being chopped, a stump, being planted, or a sapling that is growing. `tree` is where it stands, `spot` where a worker stands to tend it. */
export interface Plot { phase: PlotPhase; t: number; tree: Tile; spot: Tile; /** a worker is on his way to it or busy with it, so no other one takes it */ claimed: boolean }

export type WorkerPhase = 'idle' | 'toPlot' | 'working' | 'carrying' | 'returning';
/** A cutter, a worker who only chops. He waits beside the landing; a tap sends him to a grown tree to chop it and carry the trunk back. */
export interface Worker { phase: WorkerPhase; pos: Tile; home: Tile; plot: number; t: number; carrying: boolean }

export type PlanterPhase = 'idle' | 'toPlot' | 'planting' | 'returning';
/** A planter, hired by the planter's levels (`plantersAt`). Like a cutter he waits at home until tapped (or sent by the manager): a tap sends him to a stump, he plants a new tree there and walks home again. */
export interface Planter { phase: PlanterPhase; pos: Tile; home: Tile; plot: number; t: number }

/** `empty` (a forklift may put a piece on it), `working` (on the piece, `t` seconds in), `done` (the finished piece waits on the machine for a forklift). */
export type MachineState = 'empty' | 'working' | 'done';
export type MachineId = 'debarker' | 'saw1' | 'saw2' | 'planer';
/** One machine. `row` is 0 for the debarker, else the row of saws or planers it stands in, `slot` its place there. `level` is its own. `out` is how many finished pieces lie on it while it is `done` (a saw 2 makes `PLANKS_PER_LOG` from one log). */
export interface Machine {
  id: MachineId; row: 0 | RowId; slot: SlotIndex; level: number;
  /** seconds per piece at level 1; `workS` is the time at the machine's current level */ baseS: number; workS: number; state: MachineState; t: number; out: number;
}

export type HaulerPhase = 'idle' | 'toPickup' | 'pick' | 'toDrop' | 'drop' | 'toHome';
/** A forklift. It only picks something up while `active` (seconds left) is above 0; what it holds it still puts down (waiting with it if the place it brings it to is not free), then it drives home. `job` is where it is going and what it does there (`decide`). */
export interface Hauler {
  id: 'f1' | 'f2' | 'out'; home: StationId; /** the station it stands at when it is not driving */ at: StationId; job: Job | null; /** the points it still has to drive through */ path: Tile[];
  pos: Tile; phase: HaulerPhase; t: number; /** how many pieces it holds right now (up to `forkliftCapacity`) */ carrying: number; axis: 'x' | 'y'; active: number;
}

export type StopAction = 'load' | 'unload' | 'none';
/** A stop on a truck's route. `stock` is the place it loads from or unloads to; a truck that `waitFull` stays until it is full. */
export interface Stop { p: Tile; action: StopAction; stock?: StockId; waitFull?: boolean; /** do not leave empty: wait for the first piece, then leave as soon as there is nothing more to load (or the truck is full) */ waitOne?: boolean }
/** `parked`: the logging truck at the pile; `away`: the delivery truck, gone until the next one comes. */
export type TruckPhase = 'parked' | 'away' | 'drive' | 'work';
export interface Truck {
  id: 'logging' | 'delivery'; route: readonly Stop[]; depot: Tile; pos: Tile; i: number; phase: TruckPhase; t: number; cargo: number; capacity: number; axis: 'x' | 'y';
  /** The logging truck's working time left (seconds): while it is above 0 it starts a round of the loop whenever there are trunks on the landing. */
  active: number;
  /** The exit trucks queue for the loading ramp in the order of their tickets (the lowest first): the order they came in. */
  ticket: number;
  /** The fraction of a coin the pieces loaded so far were worth above the whole coins paid for them (each piece is paid as it is loaded; this carries over to the next one, so nothing is lost to rounding). */
  value: number;
}

export interface IdleState {
  stock: Record<StockId, number>;
  plots: Plot[];
  /** The cutters' level: they chop and walk faster with it, and it hires the forest's workers (idleData.ts). */
  level: number;
  /** The planter's own level: 0 until he is bought in the crew dialog. */
  planterLevel: number;
  /** One level for the three forklifts (idleData.ts), bought in the factory dialog; every machine has a level of its own (`Machine.level`). */
  forkliftLevel: number;
  /** The exit trucks' level: they drive and load faster with it, and every 50 levels one more truck is bought (`deliveryTrucksAt`). */
  deliveryLevel: number;
  /** Bought in the factory dialog (the forklifts at level 10 unlock him): the forklifts then work all the time. */
  forkliftManager: boolean;
  /** The logging truck's level, and the truck manager (the logging truck at level 10 unlocks him): it then makes its rounds by itself. */
  truckLevel: number;
  truckManager: boolean;
  /** Bought in the crew dialog: the cutters then chop by themselves. */
  manager: boolean;
  cutters: Worker[];
  planters: Planter[];
  /** The debarker first, then the saw 1 the line starts with, then the other machines in the order they were bought. */
  machines: Machine[];
  haulers: Hauler[];
  trucks: Truck[];
  /** What the pieces lying in the loading yard are worth together, in coins (each was noted down as it came in, see `pieceValue`). */
  yardValue: number;
  /** Pieces and coins sold so far. */
  sold: number;
  coins: number;
}

export type IdleEvent = { type: 'sold'; count: number; coins: number; at: Tile };

const copy = (p: Tile): Tile => ({ gx: p.gx, gy: p.gy });

const newCutter = (k: number): Worker => ({ phase: 'idle', pos: copy(cutterHome(k)), home: copy(cutterHome(k)), plot: 0, t: 0, carrying: false });
const newPlanter = (k: number): Planter => ({ phase: 'idle', pos: copy(planterHome(k)), home: copy(planterHome(k)), plot: 0, t: 0 });

/** An exit truck: away until its turn comes round (`TUNING.truckGapS`), then it drives to the loading ramp and queues there. `ticket` is its place in the line. */
function newDeliveryTruck(ticket: number): Truck {
  return {
    id: 'delivery', depot: DELIVERY_ROUTE.depot, pos: copy(DELIVERY_ROUTE.depot), i: 0, phase: 'away', t: TUNING.truckGapS, cargo: 0, capacity: TUNING.deliveryCapacity, axis: 'y', active: 0, ticket, value: 0,
    route: [
      { p: DELIVERY_ROUTE.dock, action: 'load', stock: 'yard', waitOne: true },
      { p: DELIVERY_ROUTE.turn, action: 'none' },
      { p: DELIVERY_ROUTE.exit, action: 'none' },
    ],
  };
}

const BASE_S: Record<MachineId, number> = { debarker: TUNING.debarkerS, saw1: TUNING.sawS, saw2: TUNING.saw2S, planer: TUNING.planerS };
/** A new machine at level 1, empty. `row` 0 is the debarker. */
function newMachine(id: MachineId, row: 0 | RowId, slot: SlotIndex): Machine {
  return { id, row, slot, level: 1, baseS: BASE_S[id], workS: BASE_S[id], state: 'empty', t: 0, out: 0 };
}

export function newIdle(): IdleState {
  const hauler = (id: Hauler['id']): Hauler => {
    const home = FORKLIFT_HOME[id];
    return { id, home, at: home, job: null, path: [], pos: copy(STATIONS[home].pos), phase: 'idle', t: 0, carrying: 0, axis: 'x', active: 0 };
  };
  // the logging truck is parked in front of the pile; its round: up the east lane, over to the west lane, load at the landing, down, back to the east lane, unload at the pile
  const logging: Truck = {
    id: 'logging', depot: LOGGING_ROUTE.park, pos: copy(LOGGING_ROUTE.park), i: 0, phase: 'parked', t: 0, cargo: 0, capacity: TUNING.loggingCapacity, axis: 'y', active: 0, ticket: 0, value: 0,
    route: [
      { p: LOGGING_ROUTE.north, action: 'none' },
      { p: LOGGING_ROUTE.landing, action: 'load', stock: 'landing' },
      { p: LOGGING_ROUTE.south, action: 'none' },
      { p: LOGGING_ROUTE.park, action: 'unload', stock: 'pile' },
    ],
  };
  // the first exit truck is already parked at the dock, waiting for its load
  const delivery = newDeliveryTruck(0);
  delivery.phase = 'work';
  delivery.t = 0; // (a truck that has been away starts with the gap behind it: this one has just parked)
  delivery.pos = copy(DELIVERY_ROUTE.dock);
  return {
    stock: Object.fromEntries(STOCK_IDS.map((id) => [id, 0])) as Record<StockId, number>,
    plots: FOREST_TREES.map((tree): Plot => ({ phase: 'ready', t: 0, tree: copy(tree), spot: treeSpot(tree), claimed: false })),
    level: 1,
    planterLevel: 0,
    forkliftLevel: 1,
    deliveryLevel: 1,
    forkliftManager: false,
    truckLevel: 1,
    truckManager: false,
    manager: false,
    cutters: [newCutter(0)],
    planters: [],
    machines: [newMachine('debarker', 0, 0), newMachine('saw1', 1, 0)],
    haulers: [hauler('f1'), hauler('f2'), hauler('out')],
    trucks: [logging, delivery],
    yardValue: 0,
    sold: 0,
    coins: 0,
  };
}

// ---------- tapping ----------

const waitingTree = (p: Plot): boolean => p.phase === 'ready' && !p.claimed;
const waitingStump = (p: Plot): boolean => p.phase === 'stump' && !p.claimed;
const squared = (a: Tile, b: Tile): number => (a.gx - b.gx) ** 2 + (a.gy - b.gy) ** 2;

/** Is this tree grown (a cutter is wanted) or a stump (a planter is wanted), not taken by anyone, and is one of them free to go there? */
export const plotWaits = (s: IdleState, i: number): boolean => {
  const p = s.plots[i];
  if (!p) return false;
  if (waitingTree(p)) return s.cutters.some((c) => c.phase === 'idle');
  return waitingStump(p) && s.planters.some((c) => c.phase === 'idle');
};

/** Is cutter `k` free, and is there a tree for him? */
export const workerHasJob = (s: IdleState, k = 0): boolean => s.cutters[k]?.phase === 'idle' && s.plots.some(waitingTree);
/** Is planter `k` free, and is there a stump for him? */
export const planterHasJob = (s: IdleState, k = 0): boolean => s.planters[k]?.phase === 'idle' && s.plots.some(waitingStump);

type Walker = Worker | Planter;
function send(s: IdleState, c: Walker, i: number): void {
  c.plot = i;
  c.phase = 'toPlot';
  s.plots[i].claimed = true;
}

/** The free one of `crew` nearest to `tree`. */
const nearestFree = <T extends Walker>(crew: T[], tree: Tile): T => crew.filter((c) => c.phase === 'idle').sort((a, b) => squared(a.pos, tree) - squared(b.pos, tree))[0];

/** A tap on a grown tree: the free cutter nearest to it walks there and chops it. A tap on a stump: the free planter nearest to it walks there and plants a new tree. False when none is free or nothing is waiting there (or someone is on his way to it). */
export function tapPlot(s: IdleState, i: number): boolean {
  if (!plotWaits(s, i)) return false;
  const p = s.plots[i];
  send(s, waitingTree(p) ? nearestFree(s.cutters, p.tree) : nearestFree(s.planters, p.tree), i);
  return true;
}

/** The plot nearest to `from` that `waiting` accepts, or -1. */
function nearestPlot(s: IdleState, from: Tile, waiting: (p: Plot) => boolean): number {
  let best = -1, bestD = Infinity;
  s.plots.forEach((p, i) => {
    const d = squared(from, p.tree);
    if (waiting(p) && d < bestD) { best = i; bestD = d; }
  });
  return best;
}

/** A tap on cutter `k`: he takes the grown tree nearest to him. */
export function tapWorker(s: IdleState, k = 0): boolean {
  const c = s.cutters[k];
  if (c?.phase !== 'idle') return false;
  const best = nearestPlot(s, c.pos, waitingTree);
  if (best < 0) return false;
  send(s, c, best);
  return true;
}

/** A tap on planter `k`: he takes the stump nearest to him. */
export function tapPlanter(s: IdleState, k: number): boolean {
  const c = s.planters[k];
  if (c?.phase !== 'idle') return false;
  const best = nearestPlot(s, c.pos, waitingStump);
  if (best < 0) return false;
  send(s, c, best);
  return true;
}

// ---------- the crew: what the dialog on the landing sells ----------

export type CrewItem = 'cutter' | 'planter' | 'manager';
export type FactoryItem = 'forklift' | 'forkliftManager' | 'truck' | 'truckManager' | 'deliveryTruck' | 'debarker';
/** The level of the machine in this row and slot, `m21` = row 2, slot 1 (the dialog that opens on a saw or a planer). */
export type MachineItem = `m${RowId}${SlotIndex}`;
export type UpgradeItem = CrewItem | FactoryItem | MachineItem;
export const machineItem = (row: RowId, slot: SlotIndex): MachineItem => `m${row}${slot}`;
const machineOfItem = (s: IdleState, item: MachineItem): Machine | undefined => machineAt(s, Number(item[1]) as RowId, Number(item[2]) as SlotIndex);
/** What the dialog shows for one member of the crew: `locked` (until the cutters are at level `needs`), `offer` (it can be bought, for `price`) or `owned` (the manager, once bought). `level` is the current level (the manager has none). */
export interface Offer { state: 'locked' | 'offer' | 'owned'; level: number; price: number; needs: number }

export function offer(s: IdleState, item: UpgradeItem): Offer {
  switch (item) {
    case 'forklift': return { state: 'offer', level: s.forkliftLevel, price: forkliftCost(s.forkliftLevel), needs: 0 };
    case 'forkliftManager': return { state: s.forkliftManager ? 'owned' : s.forkliftLevel >= FORKLIFT_MANAGER_UNLOCK_LEVEL ? 'offer' : 'locked', level: 0, price: FORKLIFT_MANAGER_COST, needs: FORKLIFT_MANAGER_UNLOCK_LEVEL };
    case 'truck': return { state: 'offer', level: s.truckLevel, price: truckCost(s.truckLevel), needs: 0 };
    case 'deliveryTruck': return { state: 'offer', level: s.deliveryLevel, price: truckCost(s.deliveryLevel), needs: 0 };
    case 'truckManager': return { state: s.truckManager ? 'owned' : s.truckLevel >= TRUCK_MANAGER_UNLOCK_LEVEL ? 'offer' : 'locked', level: 0, price: TRUCK_MANAGER_COST, needs: TRUCK_MANAGER_UNLOCK_LEVEL };
    case 'debarker': return { state: 'offer', level: debarker(s).level, price: levelCost(debarker(s)), needs: 0 };
    case 'cutter': return { state: 'offer', level: s.level, price: cutterCost(s.level), needs: 0 };
    case 'planter': return { state: s.level >= PLANTER_UNLOCK_LEVEL ? 'offer' : 'locked', level: s.planterLevel, price: planterCost(s.planterLevel), needs: PLANTER_UNLOCK_LEVEL };
    case 'manager': return { state: s.manager ? 'owned' : s.level >= MANAGER_UNLOCK_LEVEL ? 'offer' : 'locked', level: 0, price: MANAGER_COST, needs: MANAGER_UNLOCK_LEVEL };
    default: {
      const m = machineOfItem(s, item);
      return m ? { state: 'offer', level: m.level, price: levelCost(m), needs: 0 } : { state: 'locked', level: 0, price: 0, needs: 0 };
    }
  }
}

// ---------- the rows of machines: empty lots, and what opens them ----------

/** What the next level of this machine costs: the debarker and the first saw start at 3 coins; a machine bought on a lot starts at what the lot cost plus 10 %, then 10 % more for each level. */
export const levelCost = (m: Machine): number => machineCost(m.level);

export const machineAt = (s: IdleState, row: RowId, slot: SlotIndex): Machine | undefined => s.machines.find((m) => m.row === row && m.slot === slot);
export const rowMachines = (s: IdleState, row: RowId): Machine[] => s.machines.filter((m) => m.row === row);
/** The last row that has a machine (row 1 always has one): its goods go to the loading yard, the rows before it pass theirs on. */
export const lastRow = (s: IdleState): RowId => ROW_IDS.reduce<RowId>((last, row) => (rowMachines(s, row).length > 0 ? row : last), 1);

/** `built`: a machine stands there. `offer`: an empty lot that can be bought now, for `price` (the plus is drawn on it). `locked`: not yet, `needs` is the level the machine before it must reach (the first of the row before for the first of a row, the one before it in the row for the others). */
export interface SlotOffer { state: 'built' | 'offer' | 'locked'; price: number; needs: number }

export function slotOffer(s: IdleState, row: RowId, slot: SlotIndex): SlotOffer {
  const price = SLOT_PRICE[row - 1][slot];
  if (machineAt(s, row, slot)) return { state: 'built', price, needs: 0 };
  const before = slot > 0 ? machineAt(s, row, (slot - 1) as SlotIndex) : machineAt(s, (row - 1) as RowId, 0);
  const needs = slot > 0 ? EXTRA_UNLOCK_LEVEL : ROW_UNLOCK_LEVEL;
  return { state: before && before.level >= needs ? 'offer' : 'locked', price, needs };
}

/** Puts a new machine, level 1 and empty, on an empty lot that can be bought (the scene takes the coins, `slotOffer(...).price`, first). False when it cannot be bought yet. */
export function buyMachine(s: IdleState, row: RowId, slot: SlotIndex): boolean {
  if (slotOffer(s, row, slot).state !== 'offer') return false;
  s.machines.push(newMachine(ROW_KIND[row], row, slot));
  return true;
}

/** Everything the player has bought: it outlives a visit to the sawmill (core/idleSave.ts saves it). The line itself (stock, trees, who is where) starts afresh every time. */
export interface SavedMachine { row: RowId; slot: SlotIndex; level: number }
export interface IdleUpgrades {
  level: number; planterLevel: number; manager: boolean;
  forkliftLevel: number; forkliftManager: boolean;
  truckLevel: number; truckManager: boolean;
  /** The exit trucks' level (it also decides how many trucks there are). */
  deliveryLevel: number;
  debarkerLevel: number;
  /** The saws and planers there are (the first saw 1 always is) and their levels. */
  machines: SavedMachine[];
}

/** The upgrades of a state, to be saved. */
export const upgradesOf = (s: IdleState): IdleUpgrades => ({
  level: s.level, planterLevel: s.planterLevel, manager: s.manager, forkliftLevel: s.forkliftLevel, forkliftManager: s.forkliftManager,
  truckLevel: s.truckLevel, truckManager: s.truckManager, deliveryLevel: s.deliveryLevel, debarkerLevel: debarker(s).level,
  machines: s.machines.filter((m): m is Machine & { row: RowId } => m.row > 0).map((m) => ({ row: m.row, slot: m.slot, level: m.level })),
});

/** Puts saved upgrades on a fresh state: the levels and the managers, the cutters and planters they hire, the machines that were bought and their speed. A saved machine whose lot could not have been bought (the one before it is missing) is left out. */
export function applyUpgrades(s: IdleState, u: IdleUpgrades): void {
  const { machines, debarkerLevel, ...rest } = u;
  Object.assign(s, rest);
  setLevel(debarker(s), debarkerLevel);
  for (const saved of [...machines].sort((a, b) => a.row - b.row || a.slot - b.slot)) {
    const before = saved.slot > 0 ? machineAt(s, saved.row, (saved.slot - 1) as SlotIndex) : saved.row > 1 ? machineAt(s, (saved.row - 1) as RowId, 0) : true;
    if (!machineAt(s, saved.row, saved.slot) && before) s.machines.push(newMachine(ROW_KIND[saved.row], saved.row, saved.slot));
    const m = machineAt(s, saved.row, saved.slot);
    if (m) setLevel(m, saved.level);
  }
  syncCrew(s);
  syncDeliveryTrucks(s);
}

/** One exit truck for the level, plus one more every 50 levels: a new one comes round after the gap, like any truck that has been away. */
function syncDeliveryTrucks(s: IdleState): void {
  const have = (): number => s.trucks.filter((t) => t.id === 'delivery').length;
  while (have() < deliveryTrucksAt(s.deliveryLevel)) s.trucks.push(newDeliveryTruck(Math.max(...s.trucks.map((t) => t.ticket)) + 1));
}

function setLevel(m: Machine, level: number): void {
  m.level = level;
  m.workS = machineWorkS(m.baseS, level);
}

/** The workers there are for the levels bought: the cutters by the cutter level, the planters by the planter level (each kind is hired only by its own levels). */
function syncCrew(s: IdleState): void {
  while (s.cutters.length < cuttersAt(s.level)) s.cutters.push(newCutter(s.cutters.length));
  while (s.planters.length < plantersAt(s.planterLevel)) s.planters.push(newPlanter(s.planters.length));
}

/** One level more for the cutters. There is no last level; the price just keeps rising. Every tenth level hires one more cutter. */
export function upgradeCutter(s: IdleState): void {
  s.level += 1;
  syncCrew(s);
}

/** One level more for the planters (every tenth hires one more planter): the first one buys him (the cutters must be at level `PLANTER_UNLOCK_LEVEL` first). False while he is locked. */
export function upgradePlanter(s: IdleState): boolean {
  if (offer(s, 'planter').state !== 'offer') return false;
  s.planterLevel += 1;
  syncCrew(s);
  return true;
}

/** Hires the manager (once; the cutters must be at level `MANAGER_UNLOCK_LEVEL`). */
export function hireManager(s: IdleState): boolean {
  if (offer(s, 'manager').state !== 'offer') return false;
  s.manager = true;
  return true;
}

/** Applies the purchase of one thing from the crew dialog (the scene takes the coins, `offer(...).price`, first). False when it cannot be bought. */
/** One level more for the forklifts (every tenth lets them carry one more piece, up to 4). */
export function upgradeForklifts(s: IdleState): void {
  s.forkliftLevel += 1;
}

/** Hires the forklift manager (once; the forklifts must be at level `FORKLIFT_MANAGER_UNLOCK_LEVEL`). */
export function hireForkliftManager(s: IdleState): boolean {
  if (offer(s, 'forkliftManager').state !== 'offer') return false;
  s.forkliftManager = true;
  return true;
}

/** One level more for the logging truck: it drives and loads in 0.97 of the time. */
export function upgradeTrucks(s: IdleState): void {
  s.truckLevel += 1;
}

/** One level more for the exit trucks: they drive and load in 0.97 of the time, and every 50 levels one more truck comes (it joins the queue at the ramp). */
export function upgradeDeliveryTrucks(s: IdleState): void {
  s.deliveryLevel += 1;
  syncDeliveryTrucks(s);
}

/** Hires the truck manager (once; the trucks must be at level `TRUCK_MANAGER_UNLOCK_LEVEL`). */
export function hireTruckManager(s: IdleState): boolean {
  if (offer(s, 'truckManager').state !== 'offer') return false;
  s.truckManager = true;
  return true;
}

/** One level more for a machine: what it makes is worth 3 % more (the machines of a row add up, see `pieceValue`), and it works in 0.97 of the time (a piece being worked on keeps its progress). */
export function upgradeMachine(m: Machine): void {
  setLevel(m, m.level + 1);
}
export const upgradeDebarker = (s: IdleState): void => upgradeMachine(debarker(s));

export function buy(s: IdleState, item: UpgradeItem): boolean {
  if (item === 'forklift') { upgradeForklifts(s); return true; }
  if (item === 'forkliftManager') return hireForkliftManager(s);
  if (item === 'truck') { upgradeTrucks(s); return true; }
  if (item === 'deliveryTruck') { upgradeDeliveryTrucks(s); return true; }
  if (item === 'truckManager') return hireTruckManager(s);
  if (item === 'debarker') { upgradeDebarker(s); return true; }
  if (item === 'cutter') { upgradeCutter(s); return true; }
  if (item === 'planter') return upgradePlanter(s);
  if (item === 'manager') return hireManager(s);
  const m = machineOfItem(s, item);
  if (!m) return false;
  upgradeMachine(m);
  return true;
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
  // the manager sends every free cutter to the nearest grown tree and every free planter to the nearest stump
  if (s.manager) {
    s.cutters.forEach((c, k) => { if (c.phase === 'idle') tapWorker(s, k); });
    s.planters.forEach((c, k) => { if (c.phase === 'idle') tapPlanter(s, k); });
  }
  for (const c of s.cutters) stepWorker(s, c, dt);
  for (const p of s.planters) stepPlanter(s, p, dt);
  for (const m of s.machines) stepMachine(m, dt);
  passOn(s);
  for (const h of s.haulers) { h.active = s.forkliftManager ? TUNING.activeS : Math.max(0, h.active - dt); stepHauler(s, h, dt); } // with the forklift manager they are always on
  // with the truck manager the logging truck is always on
  for (const tr of s.trucks) { tr.active = s.truckManager && tr.id === 'logging' ? TUNING.activeS : Math.max(0, tr.active - dt); stepTruck(s, tr, dt, events); }
}

function stepWorker(s: IdleState, w: Worker, dt: number): void {
  const plot = s.plots[w.plot], speed = cutterSpeed(s.level);
  switch (w.phase) {
    case 'toPlot':
      if (stepTo(w.pos, plot.spot, speed, dt)) { w.phase = 'working'; w.t = 0; plot.phase = 'chopping'; plot.t = 0; }
      break;
    case 'working':
      w.t += dt;
      if (w.t >= cutterChopS(s.level)) { plot.phase = 'stump'; plot.claimed = false; w.carrying = true; w.phase = 'carrying'; }
      break;
    case 'carrying':
      // the trunk goes down on the landing; with a full landing he waits with it
      if (stepTo(w.pos, LANDING_SPOT, speed, dt) && s.stock.landing < CAP.landing) { s.stock.landing += 1; w.carrying = false; w.phase = 'returning'; }
      break;
    case 'returning':
      if (stepTo(w.pos, w.home, speed, dt)) w.phase = 'idle';
      break;
    default:
      break;
  }
}

/** A planter walks to the stump he was sent to, plants, and goes home again to wait for the next tap. */
function stepPlanter(s: IdleState, pl: Planter, dt: number): void {
  const plot = s.plots[pl.plot];
  switch (pl.phase) {
    case 'toPlot':
      if (stepTo(pl.pos, plot.spot, planterSpeed(s.planterLevel), dt)) { pl.phase = 'planting'; pl.t = 0; plot.phase = 'planting'; plot.t = 0; }
      break;
    case 'planting':
      pl.t += dt;
      if (pl.t >= planterPlantS(s.planterLevel)) { plot.phase = 'growing'; plot.t = 0; plot.claimed = false; pl.phase = 'returning'; }
      break;
    case 'returning':
      if (stepTo(pl.pos, pl.home, planterSpeed(s.planterLevel), dt)) pl.phase = 'idle';
      break;
    default:
      break;
  }
}

function stepMachine(m: Machine, dt: number): void {
  if (m.state !== 'working') return;
  m.t = Math.min(m.workS, m.t + dt);
  if (m.t >= m.workS) { m.state = 'done'; m.out = m.id === 'saw2' ? PLANKS_PER_LOG : 1; }
}

/** A finished machine of a row that has a row after it hands its pieces to a free machine of that row, one at a time, by itself. With no free machine it keeps them (and so cannot take a new piece itself). */
function passOn(s: IdleState): void {
  const last = lastRow(s);
  for (let row = 1; row < last; row++) {
    const next = rowMachines(s, (row + 1) as RowId);
    for (const m of rowMachines(s, row as RowId)) {
      while (m.state === 'done' && m.out > 0) {
        const free = next.find((n) => n.state === 'empty');
        if (!free) break;
        m.out -= 1;
        if (m.out <= 0) { m.out = 0; m.state = 'empty'; }
        free.state = 'working'; free.t = 0;
      }
    }
  }
}

// ---------- what the line makes ----------

/** The kind of piece the loading yard gets: what the last built row makes. */
const productOf = (row: RowId): 'logs' | 'plank' | 'planed' => (row === 1 ? 'logs' : row === 2 ? 'plank' : 'planed');
/** Planks are small: where the line makes planks, the yard, the delivery truck and the output forklift hold `PLANKS_PER_LOG` times as many pieces. */
export const pieceMultiplier = (s: IdleState): number => (lastRow(s) >= 2 ? PLANKS_PER_LOG : 1);
export const yardCap = (s: IdleState): number => CAP.yard * pieceMultiplier(s);

/** What a piece that has just left the last built row is worth: the base price of what it is, times the factor of the debarker and of every built row up to the last (the machines of a row add up: `stageFactor`). */
export function pieceValue(s: IdleState): number {
  const last = lastRow(s);
  const stages = [[debarker(s).level]];
  for (const row of ROW_IDS) if (row <= last) stages.push(rowMachines(s, row).map((m) => m.level));
  return pieceWorth(productOf(last), stages);
}

// ---------- the hand-overs between the stations ----------

const debarker = (s: IdleState): Machine => s.machines[0];

const sawInSlot = (st: StationId): SlotIndex | null => (st.startsWith('sawIn') ? (Number(st[5]) as SlotIndex) : null);
/** The machine whose output side this station is, for the stations `out11` ... `out32`. */
const machineOut = (s: IdleState, st: StationId): Machine | undefined => (st.startsWith('out') ? machineAt(s, Number(st[3]) as RowId, Number(st[4]) as SlotIndex) : undefined);
const freeSaw = (s: IdleState): Machine | undefined => rowMachines(s, 1).find((m) => m.state === 'empty');

/** How many pieces there are to take at this station. */
function pieceCount(s: IdleState, st: StationId): number {
  switch (st) {
    case 'pile': return s.stock.pile;
    case 'storage': return s.stock.storage;
    case 'debarkerOut': return debarker(s).state === 'done' ? 1 : 0;
    default: { const m = machineOut(s, st); return m?.state === 'done' ? m.out : 0; }
  }
}
const hasPiece = (s: IdleState, st: StationId): boolean => pieceCount(s, st) >= 1;
function takePieces(s: IdleState, st: StationId, n: number): void {
  if (st === 'pile') s.stock.pile -= n;
  else if (st === 'storage') s.stock.storage -= n;
  else if (st === 'debarkerOut') debarker(s).state = 'empty';
  else {
    const m = machineOut(s, st);
    if (m) { m.out = Math.max(0, m.out - n); if (m.out === 0) m.state = 'empty'; }
  }
}
/** How many pieces can be put down here now? A machine takes one only when it is empty: not while it works and not while a finished piece still waits on it. */
function roomAt(s: IdleState, st: StationId): number {
  switch (st) {
    case 'storage': return CAP.storage - s.stock.storage;
    case 'yard': return yardCap(s) - s.stock.yard;
    case 'debarkerIn': return debarker(s).state === 'empty' ? 1 : 0;
    default: { const k = sawInSlot(st); return k !== null && machineAt(s, 1, k)?.state === 'empty' ? 1 : 0; }
  }
}
const hasRoom = (s: IdleState, st: StationId): boolean => roomAt(s, st) >= 1;
function putPiece(s: IdleState, st: StationId): void {
  if (st === 'storage') s.stock.storage += 1;
  else if (st === 'yard') { s.stock.yard += 1; s.yardValue += pieceValue(s); }
  else if (st === 'debarkerIn') { debarker(s).state = 'working'; debarker(s).t = 0; }
  else {
    const k = sawInSlot(st), m = k === null ? undefined : machineAt(s, 1, k);
    if (m) { m.state = 'working'; m.t = 0; }
  }
}

/** Where a forklift goes next and what it does there: picks up or puts down. */
export interface Job { at: StationId; act: 'pick' | 'drop' }

/** The forklifts' brains: what this one does next, decided afresh after every pick-up and every drop. `null`: nothing, it drives to its rest place (`home`) and waits there, with whatever it
 *  holds; `'stay'`: it waits where it is. Without `active` time left it picks nothing up, it only finishes what it holds (F1 onto the debarker, F2 onto a free saw, the output forklift to the yard).
 *  - F1 takes what the pile has (up to its capacity) and puts it on the debarker one after another, waiting there while the debarker is busy.
 *  - F2 is a buffer on wheels: it takes every peeled trunk off the debarker until its forks are full, and puts one on every empty saw 1 the moment there is one (saws first). It fetches from the
 *    storage only when it holds nothing and a saw waits. With full forks, no saw that needs a trunk and the debarker busy again, it puts ONE trunk in the storage and drives back to its rest place.
 *  - The output forklift collects from the finished machines of the last built row until its forks are full (it waits where it is for the next one), and only then drives to the yard. */
function decide(s: IdleState, h: Hauler, active = h.active > 0): Job | 'stay' | null {
  const c = h.carrying, cap = capacityOf(s, h);
  switch (h.id) {
    case 'f1':
      if (c > 0) return { at: 'debarkerIn', act: 'drop' };
      return active && hasPiece(s, 'pile') ? { at: 'pile', act: 'pick' } : null;
    case 'f2': {
      const saw = freeSaw(s);
      if (c > 0 && saw) return { at: sawInId(saw.slot), act: 'drop' };
      if (!active) return null;
      if (c < cap && hasPiece(s, 'debarkerOut')) return { at: 'debarkerOut', act: 'pick' };
      if (c === 0 && saw && hasPiece(s, 'storage')) return { at: 'storage', act: 'pick' };
      if (c >= cap && debarker(s).state !== 'empty' && hasRoom(s, 'storage')) return { at: 'storage', act: 'drop' };
      return null;
    }
    case 'out': {
      const last = lastRow(s), ready = rowMachines(s, last).filter((m) => m.state === 'done' && m.out > 0).map((m): StationId => machineOutId(last, m.slot));
      if (active && c < cap && ready.length > 0) return { at: ready.includes(h.at) ? h.at : ready[0], act: 'pick' }; // the machine it stands at first
      if (c > 0 && (c >= cap || !active)) return { at: 'yard', act: 'drop' };
      return c > 0 ? 'stay' : null;
    }
  }
}

/** Is this forklift free and is there something for it to carry (a tap would put it to work)? */
export function haulerHasJob(s: IdleState, i: number): boolean {
  const h = s.haulers[i];
  if (h?.phase !== 'idle') return false;
  const job = decide(s, h, true);
  return job !== null && job !== 'stay';
}

/** The points to drive through from standing at station `a` to standing at station `b`: out to the main lane, along it, in to `b`. */
function routeBetween(a: StationId, b: StationId): Tile[] {
  if (a === b) return [];
  // two stations on the same aisle (the same way out to the lane): straight along the aisle
  if (STATIONS[a].via.gx === STATIONS[b].via.gx && STATIONS[a].via.gy === STATIONS[b].via.gy) return [copy(STATIONS[b].pos)];
  const out: Tile[] = [];
  let prev = STATIONS[a].pos;
  for (const p of [STATIONS[a].via, STATIONS[b].via, STATIONS[b].pos]) {
    if (Math.abs(p.gx - prev.gx) > 1e-9 || Math.abs(p.gy - prev.gy) > 1e-9) { out.push(copy(p)); prev = p; }
  }
  return out;
}

/** Drives along the remaining points of the path; true once there is none left. */
function follow(s: IdleState, h: Hauler, dt: number): boolean {
  if (h.path.length === 0) return true;
  if (drive(h, h.path[0], forkliftSpeed(s.forkliftLevel), dt)) h.path.shift();
  return h.path.length === 0;
}

/** How many pieces this forklift takes at its pick-up: as many as it has room for and there are, except that F2 takes from the storage only as many as there are empty saws 1 (it does not carry trunks out of the storage just to bring them back). */
function pickCount(s: IdleState, h: Hauler): number {
  const st = h.job!.at, n = Math.min(capacityOf(s, h) - h.carrying, pieceCount(s, st));
  return h.id === 'f2' && st === 'storage' ? Math.min(n, rowMachines(s, 1).filter((m) => m.state === 'empty').length) : n;
}

/** How many pieces this forklift can carry at once (the output forklift carries planks in bundles, `pieceMultiplier` times as many). */
const capacityOf = (s: IdleState, h: Hauler): number => forkliftCapacity(s.forkliftLevel) * (h.id === 'out' ? pieceMultiplier(s) : 1);

function stepHauler(s: IdleState, h: Hauler, dt: number): void {
  const handleS = forkliftHandleS(s.forkliftLevel);
  switch (h.phase) {
    case 'idle': {
      if (h.id === 'out') h.home = machineOutId(lastRow(s), 0); // it waits behind the first machine of the last built row
      const job = decide(s, h);
      if (job === 'stay') break;
      if (job) { h.job = job; h.path = routeBetween(h.at, job.at); h.phase = job.act === 'pick' ? 'toPickup' : 'toDrop'; }
      else if (h.at !== h.home) { h.path = routeBetween(h.at, h.home); h.phase = 'toHome'; }
      break;
    }
    case 'toPickup':
      if (follow(s, h, dt)) {
        h.at = h.job!.at;
        const n = hasPiece(s, h.at) ? pickCount(s, h) : 0;
        if (n > 0) { takePieces(s, h.at, n); h.carrying += n; h.phase = 'pick'; h.t = 0; }
        else { h.job = null; h.phase = 'idle'; } // what it came for is gone (a row was built): it thinks again
      }
      break;
    case 'pick':
      h.t += dt;
      if (h.t >= handleS) { h.job = null; h.phase = 'idle'; }
      break;
    case 'toDrop':
      if (follow(s, h, dt)) { h.at = h.job!.at; h.phase = 'drop'; h.t = 0; }
      break;
    case 'drop':
      // one piece at a time, as the place has room: a machine that is working, or still holds a finished piece, is not free, and the forklift waits with what it still carries.
      // F2 puts down one and thinks again (a saw takes one; the storage gets one from full forks)
      h.t += dt;
      if (h.t >= handleS && hasRoom(s, h.at)) {
        putPiece(s, h.at);
        h.carrying -= 1;
        h.t = 0;
        if (h.carrying === 0 || h.id === 'f2') { h.job = null; h.phase = 'idle'; }
      }
      break;
    case 'toHome':
      if (follow(s, h, dt)) { h.at = h.home; h.phase = 'idle'; }
      break;
  }
}

/** Is the output forklift putting its load down in the loading yard? An exit truck at the ramp waits for all of it (unless it is full). */
const outUnloading = (s: IdleState): boolean => s.haulers.some((h) => h.id === 'out' && h.phase === 'drop' && h.at === 'yard' && h.carrying > 0);

/** How many exit trucks are in front of this one in the line for the ramp (0 = it is the one at the dock, loading or about to). A truck that has loaded and left is not in the line any more. */
export function queueRank(s: IdleState, tr: Truck): number {
  return s.trucks.filter((o) => o.id === 'delivery' && o !== tr && o.i === 0 && (o.phase === 'drive' || o.phase === 'work') && o.ticket < tr.ticket).length;
}
/** Where this exit truck stands: the dock for the first in line, then every `QUEUE_SPACING` tiles back up the delivery road. */
export const queueSpot = (s: IdleState, tr: Truck): Tile => ({ gx: DELIVERY_ROUTE.dock.gx, gy: DELIVERY_ROUTE.dock.gy - queueRank(s, tr) * QUEUE_SPACING });

function stepTruck(s: IdleState, tr: Truck, dt: number, events: IdleEvent[]): void {
  if (tr.phase === 'parked') {
    // the logging truck sets out on a round when it has been tapped and there is something to fetch
    if (tr.active > 0 && s.stock.landing >= 1) { tr.phase = 'drive'; tr.i = 0; }
    return;
  }
  if (tr.phase === 'away') {
    tr.t += dt;
    if (tr.t >= TUNING.truckGapS) {
      // it takes its place at the back of the line for the ramp, and drives in from the top of the delivery road
      tr.ticket = Math.max(...s.trucks.map((t) => t.ticket)) + 1;
      tr.phase = 'drive'; tr.i = 0; tr.axis = 'y';
      tr.pos = { gx: tr.depot.gx, gy: Math.min(tr.depot.gy, queueSpot(s, tr).gy - QUEUE_SPACING) };
    }
    return;
  }
  const stop = tr.route[tr.i];
  const level = tr.id === 'logging' ? s.truckLevel : s.deliveryLevel;
  if (tr.phase === 'drive') {
    // an exit truck on its way to the ramp drives to its place in the line; only the first one goes on to load
    const queued = tr.id === 'delivery' && tr.i === 0;
    const arrived = drive(tr, queued ? queueSpot(s, tr) : stop.p, truckSpeed(level), dt);
    if (arrived && (!queued || queueRank(s, tr) === 0)) { tr.phase = 'work'; tr.t = 0; }
    return;
  }
  // working at a stop: one piece per `truckItemS`
  const leave = (): void => {
    if (tr.i + 1 >= tr.route.length) {
      // the logging truck is back at the pile and parks; the delivery truck drives out of the map (its load was paid for as it was loaded) and the next one comes
      tr.i = 0; tr.t = 0; tr.cargo = 0;
      tr.phase = tr.id === 'logging' ? 'parked' : 'away';
      return;
    }
    tr.i += 1; tr.phase = 'drive';
  };
  if (stop.action === 'none') { leave(); return; }
  const place = stop.stock!;
  const capacity = tr.id === 'delivery' ? tr.capacity * pieceMultiplier(s) : tr.capacity; // planks are small: a delivery truck takes four times as many of them
  const canMove = stop.action === 'load' ? s.stock[place] >= 1 && tr.cargo < capacity : tr.cargo >= 1 && s.stock[place] < CAP[place];
  // an exit truck that is not full also waits while the output forklift is putting its load down in the yard, and takes all of it
  const done = stop.action === 'load'
    ? tr.cargo >= capacity || (!stop.waitFull && s.stock[place] < 1 && !(stop.waitOne && tr.cargo < 1) && !(place === 'yard' && outUnloading(s)))
    : tr.cargo < 1;
  if (canMove) {
    tr.t += dt;
    if (tr.t >= truckItemS(level)) {
      tr.t = 0;
      if (stop.action === 'load') {
        if (place === 'yard') {
          // the piece takes its worth with it, and it is paid for the moment it is on the truck: whole coins, the fraction is kept on the truck for the next piece
          const worth = s.yardValue / s.stock.yard;
          s.yardValue = s.stock.yard > 1 ? s.yardValue - worth : 0;
          tr.value += worth;
          const coins = Math.round(tr.value);
          tr.value -= coins;
          s.sold += 1; s.coins += coins;
          events.push({ type: 'sold', count: 1, coins, at: copy(tr.pos) });
        }
        s.stock[place] -= 1; tr.cargo += 1;
      } else { s.stock[place] += 1; tr.cargo -= 1; }
    }
  } else if (done) {
    leave();
  }
}

/** Every piece in the line, wherever it is, for the tests: nothing may be made or lost on the way (until a saw 2 cuts a log into planks). */
export function piecesInLine(s: IdleState): number {
  let n = STOCK_IDS.reduce((sum, id) => sum + s.stock[id], 0);
  n += s.machines.reduce((sum, m) => sum + (m.state === 'working' ? 1 : m.state === 'done' ? m.out : 0), 0);
  n += s.haulers.reduce((sum, h) => sum + h.carrying, 0);
  n += s.trucks.filter((t) => t.id === 'logging').reduce((sum, t) => sum + t.cargo, 0); // what is on an exit truck is sold already
  n += s.cutters.filter((c) => c.carrying).length;
  return n;
}
