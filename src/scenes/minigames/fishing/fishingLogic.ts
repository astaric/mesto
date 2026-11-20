// The rules of the fishing boat as plain functions. No Phaser in here.
//
// Two sizes of fish and two nets. A net only catches the fish it is made for: a small fish slips through the mesh of
// the big net, a big fish is too big for the small one.

export type FishKind = 'small' | 'big';
/** A net is named after the fish it catches. */
export type Net = FishKind;

/** How many of each kind have to be caught to win. */
export const QUOTA: Readonly<Record<FishKind, number>> = { small: 6, big: 6 };
/** Radius of a net on the water, in px: where a cast catches things. */
export const NET_RADIUS: Readonly<Record<Net, number>> = { small: 150, big: 270 };
/** Misses that still earn 3 and 2 stars (a net can miss by timing as well as by being the wrong one). */
export const MISS_LIMITS: readonly [number, number] = [4, 9];
/** A tap this close to a fish aims the net at that fish. */
export const ASSIST_RADIUS = 200;

export interface Pt { x: number; y: number }
export interface Swimmer extends Pt { kind: FishKind; vx: number }
export type Caught = Record<FishKind, number>;

export function netCatches(net: Net, fish: FishKind): boolean {
  return net === fish;
}

export interface CastResult {
  /** Indices (into the swimmers) of the fish the net holds. */
  caught: number[];
  /** Fish that were under the net but the wrong size for it: they get away. */
  slipped: number[];
}

/** What a net that lands at `at` does to the fish around it. */
export function resolveCast(net: Net, at: Pt, swimmers: readonly Swimmer[]): CastResult {
  const r = NET_RADIUS[net];
  const res: CastResult = { caught: [], slipped: [] };
  swimmers.forEach((s, i) => {
    if (Math.hypot(s.x - at.x, s.y - at.y) > r) return;
    (netCatches(net, s.kind) ? res.caught : res.slipped).push(i);
  });
  return res;
}

/** Where to throw when the finger is at `tap`: onto the nearest fish within reach, where it will be when the net lands
 *  (`flightMs` later), otherwise right where the finger is. */
export function aimAt(tap: Pt, swimmers: readonly Swimmer[], flightMs: number): Pt {
  let best: Swimmer | null = null, bestD = ASSIST_RADIUS;
  for (const s of swimmers) {
    const d = Math.hypot(s.x - tap.x, s.y - tap.y);
    if (d <= bestD) { bestD = d; best = s; }
  }
  return best ? { x: best.x + best.vx * flightMs / 1000, y: best.y } : { x: tap.x, y: tap.y };
}

export function newCaught(): Caught { return { small: 0, big: 0 }; }

/** One more fish of `kind`; a kind that is already full does not count any more. */
export function addCatch(caught: Caught, kind: FishKind): Caught {
  return { ...caught, [kind]: Math.min(QUOTA[kind], caught[kind] + 1) };
}

export function isDone(caught: Caught): boolean {
  return caught.small >= QUOTA.small && caught.big >= QUOTA.big;
}

/** The kind of the next fish to swim by: the one still missing more (so both are always about), `roll` in [0, 1). */
export function nextKind(caught: Caught, roll: number): FishKind {
  const left = { small: QUOTA.small - caught.small, big: QUOTA.big - caught.big };
  if (left.small <= 0) return 'big';
  if (left.big <= 0) return 'small';
  // Both are needed: a little bias towards the one that is further behind.
  const pSmall = (left.small + 2) / (left.small + left.big + 4);
  return roll < pSmall ? 'small' : 'big';
}
