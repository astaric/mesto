// The idle sawmill's numbers, in one place so they are easy to tune. Phaser-free. Every value here is a first guess (docs/minigames/idle.md).

/** The places where pieces wait (the machines hold one piece each, see idleLogic.ts). A full one backs the line up. */
export type StockId = 'landing' | 'pile' | 'storage' | 'yard';
export const STOCK_IDS: readonly StockId[] = ['landing', 'pile', 'storage', 'yard'];

/** How many pieces each place holds. */
export const CAP: Record<StockId, number> = { landing: 10, pile: 10, storage: 6, yard: 6 };

export const TUNING = {
  // forest plot (seconds)
  chopS: 2.5, plantS: 1.5, growS: 15,
  // speeds in tiles per second
  jackSpeed: 2.5, truckSpeed: 4, forkliftSpeed: 3,
  // trucks: seconds per piece loaded or unloaded, pause before the next delivery truck, pieces a truck takes
  truckItemS: 1, truckGapS: 6, loggingCapacity: 5, deliveryCapacity: 5,
  // a tap on a forklift or on the logging truck sets it working for this many seconds (it finishes the trip it is on)
  activeS: 30,
  // forklift: seconds to pick up or put down
  forkliftHandleS: 0.3,
  // machines: seconds per piece at level 1 (the planer works on one plank, the plank saw on one square log)
  debarkerS: 4, sawS: 5, saw2S: 6, planerS: 3,
} as const;

/** Coins for one piece sold, before the machine levels: a square log, a plank (half of a log: a log is cut into `PLANKS_PER_LOG` of them, so cutting doubles what a log is worth) and a planed plank (twice a plank). */
export const PRICE = { logs: 10, plank: 5, planed: 10 } as const;
/** The second saw cuts one square log into this many planks. */
export const PLANKS_PER_LOG = 4;

// ---------- the forest crew (docs/minigames/idle.md): bought in the dialog that opens on the landing ----------

/** The cutters (they chop) have one level for all of them: each level they chop and walk faster. There is no last level. Every `WORKER_LEVELS` levels of its own, a kind of worker gets one more: cutter levels hire cutters, planter levels hire planters. */
export const WORKER_LEVELS = 10;
/** The planters (they replant) and the manager (he sends the cutters to work by himself) cannot be bought before the cutters are at this level. */
export const PLANTER_UNLOCK_LEVEL = 10;
export const MANAGER_UNLOCK_LEVEL = 10;
/** How many cutters there are at this cutter level: one at the start, one more every `WORKER_LEVELS` levels (10, 20, ...). */
export const cuttersAt = (level: number): number => 1 + Math.floor(level / WORKER_LEVELS);
/** How many planters there are at this planter level: none until he is bought (level 0), one from level 1, one more every `WORKER_LEVELS` levels (10, 20, ...). */
export const plantersAt = (planterLevel: number): number => (planterLevel >= 1 ? 1 + Math.floor(planterLevel / WORKER_LEVELS) : 0);

/** The price of an upgrade after `steps` increases: it starts at `first`, and every increase is `growth` times the price the player saw before it, rounded up to whole coins (so the rounding is part of the price the next increase is taken from, not just
 *  of what is shown). A tiny allowance keeps floating-point noise (10 x 1.1 = 11.000000000000002) from rounding a whole price up. */
const priceCache = new Map<string, number[]>();
export function priceAt(first: number, growth: number, steps: number): number {
  const key = `${first}:${growth}`;
  const prices = priceCache.get(key) ?? [first];
  priceCache.set(key, prices);
  while (prices.length <= steps) prices.push(Math.ceil(prices[prices.length - 1] * growth - 1e-9));
  return prices[Math.max(0, steps)];
}

/** The first cutter upgrade costs this, and every next one this much more than the one before (the price is rounded up to whole coins, the growth underneath is not). */
export const CUTTER_FIRST_COST = 1;
export const CUTTER_COST_GROWTH = 1.3;
/** Coins for the step from cutter `level` to the next one. */
export const cutterCost = (level: number): number => priceAt(CUTTER_FIRST_COST, CUTTER_COST_GROWTH, level - 1);
/** Every level a worker needs this much of the time he needed at the level before, for his task and for walking a distance alike. */
export const CUTTER_TIME_FACTOR = 0.97;
export const PLANTER_TIME_FACTOR = 0.97;
/** Seconds the cutter needs for one tree at this level. */
export const cutterChopS = (level: number): number => TUNING.chopS * CUTTER_TIME_FACTOR ** (level - 1);
/** Tiles per second the cutter walks at this level (the same distance takes `CUTTER_TIME_FACTOR` of the time it took one level lower). */
export const cutterSpeed = (level: number): number => TUNING.jackSpeed / CUTTER_TIME_FACTOR ** (level - 1);

/** The planter's own level: 0 is not bought yet, and buying the first level costs `PLANTER_FIRST_COST`; each next one costs `CUTTER_COST_GROWTH` more than the one before. */
export const PLANTER_FIRST_COST = 10;
/** Coins for the step from planter `level` (0 = not bought) to the next one. */
export const planterCost = (level: number): number => priceAt(PLANTER_FIRST_COST, CUTTER_COST_GROWTH, level);
/** Seconds a planter needs for one tree at this level (1 and up). */
export const planterPlantS = (level: number): number => TUNING.plantS * PLANTER_TIME_FACTOR ** (level - 1);
/** Tiles per second a planter walks at this level (1 and up). */
export const planterSpeed = (level: number): number => TUNING.jackSpeed / PLANTER_TIME_FACTOR ** (level - 1);

/** The manager: bought once, no levels. With him the cutters chop by themselves, no taps needed. */
export const MANAGER_COST = 100;

// ---------- the factory: forklifts and machines, bought in the dialog that opens on a machine ----------

/** The forklifts have one level for all three: each level they drive and handle 0.97 of the time faster, and every `FORKLIFT_CAPACITY_LEVELS` levels they can carry one more piece at the same time, up to `FORKLIFT_MAX_CAPACITY`. */
export const FORKLIFT_FIRST_COST = 3;
export const FORKLIFT_TIME_FACTOR = 0.97;
export const FORKLIFT_CAPACITY_LEVELS = 10;
export const FORKLIFT_MAX_CAPACITY = 4;
/** The forklift manager: unlocked when the forklifts reach this level, bought once for this price, no levels. With him the forklifts work all the time, no taps needed. */
export const FORKLIFT_MANAGER_UNLOCK_LEVEL = 10;
export const FORKLIFT_MANAGER_COST = 100;
/** Coins for the step from forklift `level` to the next one (30 % more than the one before, rounded up). */
export const forkliftCost = (level: number): number => priceAt(FORKLIFT_FIRST_COST, CUTTER_COST_GROWTH, level - 1);
/** How many pieces a forklift carries at the same time at this level: 1, then one more every 10 levels (levels 10, 20, 30), at most 4. */
export const forkliftCapacity = (level: number): number => Math.min(FORKLIFT_MAX_CAPACITY, 1 + Math.floor(level / FORKLIFT_CAPACITY_LEVELS));
/** Tiles per second a forklift drives at this level. */
export const forkliftSpeed = (level: number): number => TUNING.forkliftSpeed / FORKLIFT_TIME_FACTOR ** (level - 1);
/** Seconds a forklift needs to pick up or put down at this level. */
export const forkliftHandleS = (level: number): number => TUNING.forkliftHandleS * FORKLIFT_TIME_FACTOR ** (level - 1);

/** The debarker and every saw and planer have a level of their own: every level makes every piece they have worked on sell for 3 % more (compounding) and makes the machine work in 0.97 of the time. The price of a piece is base price x debarker factor x saw factor. */
export const MACHINE_FIRST_COST = 3;
export const MACHINE_VALUE_PER_LEVEL = 1.03;
/** The machines get dearer more slowly than the rest: 10 % more for each level. */
export const MACHINE_COST_GROWTH = 1.1;
/** Coins for the step from this level of a machine to the next one (10 % more each time, rounded up); `bought` is what its lot cost, 0 for the debarker and the first saw. */
export const machineCost = (level: number, bought = 0): number => priceAt(bought > 0 ? machineFirstCost(bought) : MACHINE_FIRST_COST, MACHINE_COST_GROWTH, level - 1);
/** The first level of a machine that was bought on a lot costs what the lot cost plus one level's increase (10 %, rounded up), and each level after it 10 % more again; the machines the game starts with (the debarker, the first saw) have no purchase price and start at `MACHINE_FIRST_COST`. */
export const machineFirstCost = (bought: number): number => Math.ceil(bought * MACHINE_COST_GROWTH - 1e-9);
export const MACHINE_TIME_FACTOR = 0.97;
/** Seconds a machine needs for one piece at this level, given its time at level 1. */
export const machineWorkS = (baseS: number, level: number): number => baseS * MACHINE_TIME_FACTOR ** (level - 1);
/** Reaching level 10, 25 and 50, and then every 50 levels (100, 150, ...), multiplies the machine's price factor by this once more. */
export const MACHINE_MILESTONE_FACTOR = 2;
/** How many of those levels (10, 25, 50, 100, 150, ...) a machine at this level has reached. */
export const machineMilestones = (level: number): number => (level >= 50 ? 2 + Math.floor(level / 50) : level >= 25 ? 2 : level >= 10 ? 1 : 0);
/** What a machine at this level multiplies the price of the goods by: 1 at level 1, 1.03 at level 2, ..., and x2 for every milestone level it has reached (1.03^9 x 2 at level 10). */
export const machineFactor = (level: number): number => MACHINE_VALUE_PER_LEVEL ** (level - 1) * MACHINE_MILESTONE_FACTOR ** machineMilestones(level);
/** What the machines of one stage (the debarker, or the saws or planers of a row) multiply the price by: 1 plus what each machine adds on top of 1, so two machines at +50 % and +80 % make +130 % (x2.3). One machine is just its own factor. */
export const stageFactor = (levels: readonly number[]): number => 1 + levels.reduce((sum, level) => sum + machineFactor(level) - 1, 0);
/** What one piece of this product is worth: its base price times (1 + what every stage it went through adds on top of 1). The stages ADD up (they used to multiply, which made the price grow like the machine factor to the power of the number of stages, far faster than the upgrades cost): with the debarker and a saw both at level 50 a log is worth 10 x (1 + 33 + 33), not 10 x 33 x 33. Not rounded: the sale rounds the whole load. */
export const pieceWorth = (product: keyof typeof PRICE, stages: readonly (readonly number[])[]): number => PRICE[product] * (1 + stages.reduce((sum, levels) => sum + stageFactor(levels) - 1, 0));

// ---------- the rows of machines: what the lots cost and when they open (docs/minigames/idle.md) ----------

/** The first machine of a row can be bought when the first machine of the row before it is at this level (row 1 is built from the start). */
export const ROW_UNLOCK_LEVEL = 100;
/** A second and a third machine of a row can be bought when the one before it in the row is at this level. */
export const EXTRA_UNLOCK_LEVEL = 50;
/** What a lot costs, by row (index 0 = row 1) and slot (0 - 2, in the order they are bought; each dearer than the one before). The first machine of row 1 is the one the line starts with, it is free. */
export const SLOT_PRICE: readonly (readonly number[])[] = [
  [0, 2_000, 6_000],
  [20_000, 40_000, 120_000],
  [200_000, 400_000, 1_200_000],
];

/** The logging truck has a level: each level it drives and loads 0.97 of the time faster. (The exit trucks have their own, below.) */
export const TRUCK_FIRST_COST = 3;
export const TRUCK_TIME_FACTOR = 0.97;
/** Coins for the step from truck `level` to the next one (30 % more than the one before, rounded up). */
export const truckCost = (level: number): number => priceAt(TRUCK_FIRST_COST, CUTTER_COST_GROWTH, level - 1);
/** Tiles per second a truck drives at this level. */
export const truckSpeed = (level: number): number => TUNING.truckSpeed / TRUCK_TIME_FACTOR ** (level - 1);
/** Seconds a truck needs per piece it loads or unloads at this level. */
export const truckItemS = (level: number): number => TUNING.truckItemS * TRUCK_TIME_FACTOR ** (level - 1);
/** The exit trucks (the delivery trucks) have a level of their own: each level they drive and load 0.97 of the time faster, and every `DELIVERY_TRUCK_LEVELS` levels one more truck is bought (levels 50, 100, ...). They share the loading ramp and take turns. Same prices as the logging truck's levels. */
export const DELIVERY_TRUCK_LEVELS = 50;
/** How many exit trucks there are at this level: one at the start, one more every `DELIVERY_TRUCK_LEVELS` levels. */
export const deliveryTrucksAt = (level: number): number => 1 + Math.floor(level / DELIVERY_TRUCK_LEVELS);
/** The truck manager: unlocked when the trucks reach this level, bought once for this price, no levels. With him the logging truck keeps making its rounds, no taps needed (the delivery truck always did). */
export const TRUCK_MANAGER_UNLOCK_LEVEL = 10;
export const TRUCK_MANAGER_COST = 100;
