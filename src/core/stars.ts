// One rule for what a star means, so that the totals mean the same thing in every game:
//   3 stars: clean (or nearly), 2: a few mistakes, 1: finished anyway.
// Games without a way to make a mistake (cooking, shopping) give 3.

/** The most misses that still earns 3 and 2 stars. */
export const MISS_LIMITS: readonly [number, number] = [2, 5];

export function starsFor(misses: number, limits: readonly [number, number] = MISS_LIMITS): 1 | 2 | 3 {
  if (misses <= limits[0]) return 3;
  if (misses <= limits[1]) return 2;
  return 1;
}

/** Forest run: 3 for beating the demon, otherwise a star per two quests done (0 when none). */
export function forestStars(win: boolean, quests: number): number {
  return win ? 3 : Math.min(3, Math.ceil(quests / 2));
}

/** Coins a finished stage pays, by its stars (index = stars). Stages that earn per action (Checkout, the farm shoot,
 *  the forest) keep doing so; the rest pay this once when they are won (`win(stars, { pay: true })`). */
export const PAYOUT: readonly [number, number, number, number] = [0, 2, 4, 6];

export function payoutFor(stars: number): number {
  return PAYOUT[Math.max(0, Math.min(3, Math.floor(stars)))];
}
