// The sawmill's mini town as data, no Phaser: a street seen from the front, the forest on its left, the shop at the right
// end, and between them the three workplaces. The player walks in front of the buildings; the axe spins around them.

export const WORLD_W = 3800;
export const BASE = 790;          // ground y of the buildings' front walls
export const MIN_Y = BASE + 10;   // the player cannot walk behind the front walls
export const MAX_Y = 1420;
export const FOREST_X1 = 1250;    // the forest is everything left of this

export type Place = 'saw' | 'work' | 'sell' | 'shop';
export interface Building { id: Place; x: number; w: number }
/** From the forest to the shop: the sawing house, the workshop, the market stall and the shop. */
export const BUILDINGS: readonly Building[] = [
  { id: 'saw', x: 1700, w: 400 },
  { id: 'work', x: 2250, w: 400 },
  { id: 'sell', x: 2800, w: 400 },
  { id: 'shop', x: 3400, w: 460 },
];
export const START = { x: 1380, y: 1050 };

export const isBlocked = (x: number, y: number): boolean => x < 100 || x > WORLD_W - 100 || y < MIN_Y || y > MAX_Y;

/** The door of a building is the strip in front of it that the player walks up into. */
export function doorAt(x: number, y: number): Place | null {
  if (y > BASE + 50) return null;
  return BUILDINGS.find((b) => Math.abs(x - b.x) <= 70)?.id ?? null;
}

/** Where the player stands after leaving a building: in the lane in front of it, outside every door zone. */
export function exitPoint(id: Place): { x: number; y: number } {
  const b = BUILDINGS.find((p) => p.id === id)!;
  return { x: b.x + 120, y: BASE + 140 };
}

/** Where the trees stand: a loose grid in the forest (the same ones every time). */
export function treeSpots(): { x: number; y: number }[] {
  let seed = 7;
  const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const out: { x: number; y: number }[] = [];
  for (const y of [930, 1080, 1230, 1370]) {
    for (let x = 190; x < FOREST_X1 - 60; x += 200) out.push({ x: Math.round(x + (rnd() - 0.5) * 70), y: Math.round(y + (rnd() - 0.5) * 30) });
  }
  return out;
}

// ---------- the spinning axe ----------

/** The axe of tier `tier` (0 = stone): how fast it spins (radians a second), how big the picture is and how far its head is from you. */
export function axeStats(tier: number): { spin: number; scale: number; reach: number } {
  const scale = 0.85 + tier * 0.12;
  return { spin: 5 + tier * 0.8, scale, reach: 190 * scale };
}

/** Points along the blade at angle `a` around (cx, cy), from the middle of the handle to the head: any of them can hit a tree. */
export function bladePoints(cx: number, cy: number, a: number, reach: number): { x: number; y: number }[] {
  return [0.6, 0.8, 1].map((f) => ({ x: cx + Math.cos(a) * reach * f, y: cy + Math.sin(a) * reach * f }));
}

/** Is a tree (its trunk's middle at (tx, ty)) touched by the blade? */
export function touches(points: { x: number; y: number }[], tx: number, ty: number, radius: number): boolean {
  return points.some((p) => Math.hypot(p.x - tx, p.y - ty) <= radius);
}

/** A tree can be hit again this long after a hit (seconds), and a felled one grows back after `REGROW`. */
export const HIT_COOLDOWN = 0.7;
export const REGROW = 7;
export const TREE_HIT_RADIUS = 105;
