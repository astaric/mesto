// The town as data: sizes, where things stand, and where the player may walk. No Phaser in here.
//
// A 3/4 ("45 degrees") view: the camera looks at the town from the south, so buildings show their front wall and
// a bit of roof, and things further down the screen (bigger y) draw in front. Every object's depth is its ground y.

export const WORLD_W = 6300;
export const WORLD_H = 2300;
export const NORTH = 2400; // the world also reaches this far above y = 0: the forest
export const TOWN_E = 3400; // east of this the street turns into a dirt country road
export const FARM_X = 4450; // where the country road reaches the farm yard

export const WALL_H = 360;
export const ROOF_D = 100;
export const BODY_H = WALL_H + ROOF_D; // how far up the screen a building's silhouette reaches
export const TOP_BASE = 760; // ground y of the top row's front wall (the player can't walk north of this)
export const BOTTOM_BASE = 1800; // ground y of the bottom row's front wall
export const MIN_Y = TOP_BASE + 10;
export const MAX_Y = 2150;
export const START = { x: 260, y: 1050 };
export const ROAD_Y = 1050; // centre line of the street and the country road
export const PATH_X = 1690; // the path north, and the forest gate at its end
export const FOREST_GATE_Y = -1700;
export const FOUNTAIN = { x: 1700, y: 1060 };

export interface Spot { id: string; x: number; base: number; w: number; wall: number; roof: number; gable?: boolean; kind?: 'gate' }
/** One enterable building per stage of the city journey, matched to it by stage `id`. */
export const spots: Spot[] = [
  { id: 'checkout', x: 520, base: TOP_BASE, w: 460, wall: 0xffd9a8, roof: 0xff6b6b },          // checkout
  { id: 'pets', x: 1300, base: TOP_BASE, w: 460, wall: 0xffc6e0, roof: 0xb86bff },         // animals
  { id: 'sweets', x: 2080, base: TOP_BASE, w: 460, wall: 0xfff0a8, roof: 0xff8fb8 },         // sweets
  { id: 'fish', x: 2860, base: TOP_BASE, w: 460, wall: 0xc9ecff, roof: 0x3fa7ff },         // fish
  { id: 'octopus', x: 2600, base: BOTTOM_BASE, w: 520, wall: 0xbfe3ff, roof: 0x2e6fd1, gable: true }, // octopus house
  { id: 'cut', x: 1300, base: BOTTOM_BASE, w: 460, wall: 0xe4ffd0, roof: 0x4fbf6a },      // kitchen / cutting
  { id: 'pizza', x: 1950, base: BOTTOM_BASE, w: 460, wall: 0xfff1d6, roof: 0xe8453c },      // pizzeria
  { id: 'forest', x: PATH_X, base: FOREST_GATE_Y, w: 0, wall: 0, roof: 0, kind: 'gate' },    // forest, at the end of the path north
  { id: 'eggs', x: 4950, base: TOP_BASE, w: 560, wall: 0xe0463c, roof: 0x7a4a2a, gable: true }, // farm: barn (eggs)
  { id: 'farm', x: 5750, base: TOP_BASE, w: 460, wall: 0xfff0c0, roof: 0xe0903a, gable: true }, // farm: hen house (farm shooter)
  { id: 'food', x: 380, base: BOTTOM_BASE, w: 440, wall: 0xdfd3ff, roof: 0x7a6bd6 },       // funny food (monster) house
];

export type Rect = { x0: number; y0: number; x1: number; y1: number };

// The path north: it leaves the street through the gap between the 2nd and 3rd top buildings and climbs
// through the trees to a clearing with the forest gate. North of the street the player may only walk here.
export const PATH: Rect = { x0: 1580, x1: 1800, y0: -1150, y1: MIN_Y };
export const CLEARING: Rect = { x0: 900, x1: 2500, y0: -1730, y1: -1100 };
export const northZones: Rect[] = [PATH, CLEARING];

/** Can the player stand at (x, y)? `walls` are the solid rectangles (buildings, lamps, trees, fountain). */
export function isBlocked(walls: Rect[], x: number, y: number): boolean {
  if (y > MAX_Y || x < 90 || x > WORLD_W - 90) return true;
  // north of the street only the path and the clearing are open
  if (y < MIN_Y && !northZones.some(z => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) return true;
  return walls.some(w => x > w.x0 - 30 && x < w.x1 + 30 && y > w.y0 && y < w.y1);
}
