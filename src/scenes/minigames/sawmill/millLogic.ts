import { AXES, GEAR, PLANKS_PER_LOG, PRODUCTS, SAWS, TOOLS, TREE_HP, WORKERS, WORKER_LEVELS, WORK_PER_PLANK, productOf, workerDef, type GearKind, type ProductId, type WorkerKind } from './millData';

// The sawmill's rules, Phaser-free: what a tap, a worker's turn, a purchase or a sale does to the stock. Coins are
// not in here: the scene takes them from the wallet (`pay()`) or gives them (`earn()`) around these calls.

export interface MillSave {
  logs: number; planks: number;
  goods: Record<ProductId, number>;
  /** Products made at least once (a star for all of them). */
  made: ProductId[];
  /** Products sold so far (a star for the first). */
  sold: number;
  /** Tier index of the axe, the saw and the workshop tools (0 = the free one). */
  gear: Record<GearKind, number>;
  /** 0 = not hired, 1..WORKER_LEVELS. */
  workers: Record<WorkerKind, number>;
  /** The product the carpenter makes: the one picked last in the workshop. */
  pick: ProductId;
}

export const emptyGoods = (): Record<ProductId, number> => Object.fromEntries(PRODUCTS.map((p) => [p.id, 0])) as Record<ProductId, number>;
export const emptyWorkers = (): Record<WorkerKind, number> => Object.fromEntries(WORKERS.map((w) => [w.kind, 0])) as Record<WorkerKind, number>;
export const newMill = (): MillSave => ({ logs: 0, planks: 0, goods: emptyGoods(), made: [], sold: 0, gear: { axe: 0, saw: 0, tools: 0 }, workers: emptyWorkers(), pick: PRODUCTS[0].id });

// ---------- chopping ----------

export interface Tree { hp: number }
export const newTree = (): Tree => ({ hp: TREE_HP });
/** One hit with the current axe. True when the tree falls: it gives a log. */
export function chopHit(s: MillSave, tree: Tree): boolean {
  tree.hp -= AXES[s.gear.axe].power;
  if (tree.hp > 0) return false;
  s.logs += 1;
  tree.hp = TREE_HP;
  return true;
}

// ---------- sawing ----------

/** The log on the saw bench: `on` while one lies there, `cuts` = planks already cut from it. */
export interface Bench { on: boolean; cuts: number }
export const newBench = (): Bench => ({ on: false, cuts: 0 });
/** Put a log on the bench. False when one is already there or there is none. */
export function loadBench(s: MillSave, b: Bench): boolean {
  if (b.on || s.logs < 1) return false;
  s.logs -= 1; b.on = true; b.cuts = 0;
  return true;
}
/** Take the log off the bench (leaving the sawmill): the planks it still had in it are cut. */
export function closeBench(s: MillSave, b: Bench): void {
  if (b.on) s.planks += PLANKS_PER_LOG - b.cuts;
  b.on = false; b.cuts = 0;
}
/** One tap on the saw: cuts `power` planks (never more than the log has left). Returns how many came off. */
export function sawTap(s: MillSave, b: Bench): number {
  if (!b.on) return 0;
  const n = Math.min(SAWS[s.gear.saw].power, PLANKS_PER_LOG - b.cuts);
  b.cuts += n; s.planks += n;
  if (b.cuts >= PLANKS_PER_LOG) b.on = false;
  return n;
}

// ---------- the workshop ----------

/** What is on the workbench: `id` while a product is being hammered, `taps` so far. */
export interface Job { id: ProductId | null; taps: number }
export const newJob = (): Job => ({ id: null, taps: 0 });
/** Hammer taps a product needs with the current tools. */
export const workNeeded = (s: MillSave, id: ProductId): number => Math.ceil((productOf(id).planks * WORK_PER_PLANK) / TOOLS[s.gear.tools].power);
const finish = (s: MillSave, id: ProductId): void => {
  s.goods[id] += 1;
  if (!s.made.includes(id)) s.made.push(id);
};
/** Give the planks of an unfinished product back (leaving the sawmill). */
export function cancelJob(s: MillSave, j: Job): void {
  if (j.id) s.planks += productOf(j.id).planks;
  j.id = null; j.taps = 0;
}
/** Take the planks and put the product on the bench. False when busy or too few planks. */
export function startJob(s: MillSave, j: Job, id: ProductId): boolean {
  const p = productOf(id);
  if (j.id || s.planks < p.planks) return false;
  s.planks -= p.planks; j.id = id; j.taps = 0; s.pick = id;
  return true;
}
/** One hammer tap. True when the product is done. */
export function hammerTap(s: MillSave, j: Job): boolean {
  if (!j.id) return false;
  j.taps += 1;
  if (j.taps < workNeeded(s, j.id)) return false;
  finish(s, j.id); j.id = null; j.taps = 0;
  return true;
}

// ---------- selling ----------

/** Sell one of `id`: the coins it brings (0 when there is none). */
export function sellOne(s: MillSave, id: ProductId): number {
  if (s.goods[id] < 1) return 0;
  s.goods[id] -= 1; s.sold += 1;
  return productOf(id).price;
}
/** Sell everything: the coins it brings. */
export function sellAll(s: MillSave): number {
  return PRODUCTS.reduce((sum, p) => { let c = 0; while (s.goods[p.id] > 0) c += sellOne(s, p.id); return sum + c; }, 0);
}
/** Sell one item of the dearest product in stock (what the seller does): its id and price, or null. */
export function sellBest(s: MillSave): { id: ProductId; coins: number } | null {
  const best = [...PRODUCTS].reverse().find((p) => s.goods[p.id] > 0);
  return best ? { id: best.id, coins: sellOne(s, best.id) } : null;
}

// ---------- buying ----------

/** Price of the next tier of a gear line, or null at the top. */
export function gearCost(s: MillSave, kind: GearKind): number | null { return GEAR[kind][s.gear[kind] + 1]?.cost ?? null; }
export function buyGear(s: MillSave, kind: GearKind): boolean {
  if (gearCost(s, kind) === null) return false;
  s.gear[kind] += 1;
  return true;
}
/** Price of hiring a worker / raising their level, or null at the top level. */
export function workerCost(s: MillSave, kind: WorkerKind): number | null { return s.workers[kind] >= WORKER_LEVELS ? null : workerDef(kind).costs[s.workers[kind]]; }
export function buyWorker(s: MillSave, kind: WorkerKind): boolean {
  if (workerCost(s, kind) === null) return false;
  s.workers[kind] += 1;
  return true;
}

// ---------- the workers ----------

/** Seconds one job of a hired worker takes, or null when not hired. */
export const workerEvery = (s: MillSave, kind: WorkerKind): number | null => (s.workers[kind] > 0 ? workerDef(kind).every[s.workers[kind] - 1] : null);

/** Do one job for `kind` (the seller's is `sellBest`, which brings coins). True when there was something to do. */
export function workerJob(s: MillSave, kind: Exclude<WorkerKind, 'seller'>): boolean {
  switch (kind) {
    case 'lumberjack': s.logs += 1; return true;
    case 'sawyer':
      if (s.logs < 1) return false;
      s.logs -= 1; s.planks += PLANKS_PER_LOG; return true;
    case 'carpenter': {
      const p = productOf(s.pick);
      if (s.planks < p.planks) return false;
      s.planks -= p.planks; finish(s, p.id); return true;
    }
  }
}

/** Advance every hired worker's clock by `dt` seconds. Returns the workers that finished a job (and the coins the
 *  seller made, to be earned by the caller). A worker with nothing to do waits with a full clock, not a stored-up one. */
export function workersTick(s: MillSave, clocks: Record<WorkerKind, number>, dt: number): { done: WorkerKind[]; coins: number } {
  const done: WorkerKind[] = []; let coins = 0;
  for (const w of WORKERS) {
    const every = workerEvery(s, w.kind);
    if (every === null) continue;
    clocks[w.kind] += dt;
    if (clocks[w.kind] < every) continue;
    clocks[w.kind] = every;
    if (w.kind === 'seller') {
      const sale = sellBest(s);
      if (!sale) continue;
      coins += sale.coins; clocks[w.kind] = 0; done.push(w.kind);
    } else if (workerJob(s, w.kind)) { clocks[w.kind] = 0; done.push(w.kind); }
  }
  return { done, coins };
}
export const newClocks = (): Record<WorkerKind, number> => emptyWorkers();

// ---------- stars ----------

/** The three goals, each worth a star: something sold, every worker hired, every product made once. */
export function goalsReached(s: MillSave): [boolean, boolean, boolean] {
  return [s.sold > 0, WORKERS.every((w) => s.workers[w.kind] > 0), PRODUCTS.every((p) => s.made.includes(p.id))];
}
export const millStars = (s: MillSave): number => goalsReached(s).filter(Boolean).length;
