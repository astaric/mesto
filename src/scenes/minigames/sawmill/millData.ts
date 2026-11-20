import type { Key } from '../../../i18n';

// The sawmill's tables. No Phaser in here (and no coins: the scene pays and earns through `profile`).
// One tree is one log, one log is PLANKS_PER_LOG planks, planks are made into products and sold.

export const PLANKS_PER_LOG = 4;
/** Hits a standing tree takes at 1 damage per hit. */
export const TREE_HP = 6;
/** A product's hammering is `planks * WORK_PER_PLANK` taps with the plain hammer. */
export const WORK_PER_PLANK = 3;

export type ProductId = 'spoon' | 'blocks' | 'frame' | 'birdhouse' | 'stool' | 'shelf' | 'chair' | 'horse' | 'table' | 'wardrobe';
/** `planks` 1..PLANKS_PER_LOG; `price` is what a customer pays; `tex` is its picture in `src/art`. */
export interface Product { id: ProductId; planks: number; price: number; tex: string; name: Key }

/** Cheapest to dearest: the price per plank never goes down, so a harder product is never a worse deal. */
export const PRODUCTS: readonly Product[] = [
  { id: 'spoon', planks: 1, price: 3, tex: 'wood-spoon', name: 'mill.product.spoon' },
  { id: 'blocks', planks: 1, price: 4, tex: 'wood-blocks', name: 'mill.product.blocks' },
  { id: 'frame', planks: 1, price: 5, tex: 'wood-frame', name: 'mill.product.frame' },
  { id: 'birdhouse', planks: 2, price: 12, tex: 'wood-birdhouse', name: 'mill.product.birdhouse' },
  { id: 'stool', planks: 2, price: 14, tex: 'wood-stool', name: 'mill.product.stool' },
  { id: 'shelf', planks: 2, price: 16, tex: 'wood-shelf', name: 'mill.product.shelf' },
  { id: 'chair', planks: 3, price: 30, tex: 'wood-chair', name: 'mill.product.chair' },
  { id: 'horse', planks: 3, price: 36, tex: 'wood-horse', name: 'mill.product.horse' },
  { id: 'table', planks: 4, price: 48, tex: 'wood-table', name: 'mill.product.table' },
  { id: 'wardrobe', planks: 4, price: 64, tex: 'wood-wardrobe', name: 'mill.product.wardrobe' },
];

export const productOf = (id: ProductId): Product => PRODUCTS.find((p) => p.id === id)!;

/** A piece of equipment: tier 0 is free and owned from the start; `power` is what it does (see each list). */
export interface Tier { cost: number; power: number; tex: string; name: Key }
/** Equipment lines, each tier better than the last. */
export type GearKind = 'axe' | 'saw' | 'tools';

/** `power` = damage a hit does to a tree (TREE_HP: the last one fells it with one hit). */
export const AXES: readonly Tier[] = [
  { cost: 0, power: 1, tex: 'mill-axe-1', name: 'mill.axe.1' },
  { cost: 40, power: 2, tex: 'mill-axe-2', name: 'mill.axe.2' },
  { cost: 150, power: 3, tex: 'mill-axe-3', name: 'mill.axe.3' },
  { cost: 500, power: TREE_HP, tex: 'mill-axe-4', name: 'mill.axe.4' },
];
/** `power` = planks a tap on the saw cuts (the last one cuts a whole log). */
export const SAWS: readonly Tier[] = [
  { cost: 0, power: 1, tex: 'mill-saw-1', name: 'mill.saw.1' },
  { cost: 60, power: 2, tex: 'mill-saw-2', name: 'mill.saw.2' },
  { cost: 250, power: PLANKS_PER_LOG, tex: 'mill-saw-3', name: 'mill.saw.3' },
];
/** `power` = how many times faster the workshop's hammering goes. */
export const TOOLS: readonly Tier[] = [
  { cost: 0, power: 1, tex: 'mill-tool-1', name: 'mill.tool.1' },
  { cost: 80, power: 2, tex: 'mill-tool-2', name: 'mill.tool.2' },
  { cost: 300, power: 4, tex: 'mill-tool-3', name: 'mill.tool.3' },
];
export const GEAR: Record<GearKind, readonly Tier[]> = { axe: AXES, saw: SAWS, tools: TOOLS };

export type WorkerKind = 'lumberjack' | 'sawyer' | 'carpenter' | 'seller';
export const WORKER_LEVELS = 3;
/** `costs[i]` buys level i+1 (1 = hired); `every[i]` is the seconds one job takes at level i+1.
 *  lumberjack fells a tree, sawyer saws a log, carpenter makes the product picked last, seller sells one item. */
export interface WorkerDef { kind: WorkerKind; name: Key; tint: number; costs: readonly number[]; every: readonly number[] }
export const WORKERS: readonly WorkerDef[] = [
  { kind: 'lumberjack', name: 'mill.worker.lumberjack', tint: 0xff8a5d, costs: [50, 120, 300], every: [8, 5, 3] },
  { kind: 'sawyer', name: 'mill.worker.sawyer', tint: 0x6fa8ff, costs: [60, 150, 350], every: [8, 5, 3] },
  { kind: 'carpenter', name: 'mill.worker.carpenter', tint: 0x6bc788, costs: [80, 200, 400], every: [10, 6, 3.5] },
  { kind: 'seller', name: 'mill.worker.seller', tint: 0xffd23f, costs: [60, 140, 300], every: [4, 2.5, 1.5] },
];
export const workerDef = (kind: WorkerKind): WorkerDef => WORKERS.find((w) => w.kind === kind)!;
