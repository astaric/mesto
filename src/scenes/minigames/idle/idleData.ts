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
  truckItemS: 1, truckGapS: 6, loggingCapacity: 5, deliveryCapacity: 1,
  // a tap on a forklift or on the logging truck sets it working for this many seconds (it finishes the trip it is on)
  activeS: 30,
  // forklift: seconds to pick up or put down
  forkliftHandleS: 0.3,
  // machines: seconds per piece
  debarkerS: 4, sawS: 5,
} as const;

/** Coins for one piece sold (the price rises along the chain: square log < rough plank < planed plank). */
export const PRICE = { logs: 10 } as const;
