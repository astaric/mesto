// The rules of the barnyard games (cows, sheep, pigs, rabbits) as plain functions. No Phaser in here.

/** Squeezes it takes to fill a milk jug. */
export const SQUEEZES_PER_JUG = 6;
/** Apples a pig has to eat to be fat enough. */
export const APPLES_PER_PIG = 3;

/** How full the jug is, 0..1, after `squeezes`. */
export function jugLevel(squeezes: number): number {
  return Math.max(0, Math.min(1, squeezes / SQUEEZES_PER_JUG));
}

/** Where the pig is in its life: hungry (thin), growing, or fat enough for the knife. */
export type PigStage = 'thin' | 'growing' | 'fat';
export function pigStage(apples: number): PigStage {
  if (apples >= APPLES_PER_PIG) return 'fat';
  return apples > 0 ? 'growing' : 'thin';
}
/** Body scale of a pig that ate `apples`: 1 when thin, up to 1.5 when fat. */
export function pigSize(apples: number): number {
  return 1 + 0.5 * Math.min(apples, APPLES_PER_PIG) / APPLES_PER_PIG;
}

export interface Pt { x: number; y: number }

/** Distance from point `p` to the segment a-b (a finger swipe between two frames). */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Tufts of wool that cover a sheep's body: a staggered (honeycomb) grid inside an ellipse of radii (rx, ry), centred on (0, 0). */
export function woolTufts(rx: number, ry: number, step: number): Pt[] {
  const out: Pt[] = [];
  const rowStep = step * 0.866;
  const rows = Math.floor((2 * ry) / rowStep) + 1;
  const cols = Math.ceil(rx / step) + 1;
  for (let r = 0; r < rows; r++) {
    const y = (r - (rows - 1) / 2) * rowStep;
    const shift = r % 2 ? step / 2 : 0;
    for (let k = -cols; k <= cols; k++) {
      const x = k * step + shift;
      if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) out.push({ x, y });
    }
  }
  return out;
}

/** The first thing under the finger: the index of the nearest point of `pts` within `r` of `p`, or -1. */
export function nearest(pts: Pt[], p: Pt, r: number): number {
  let best = -1, bestD = r;
  pts.forEach((q, i) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Which of `holes` are free for a new rabbit, given which are `busy`. */
export function freeHoles(count: number, busy: ReadonlySet<number>): number[] {
  return Array.from({ length: count }, (_, i) => i).filter(i => !busy.has(i));
}
