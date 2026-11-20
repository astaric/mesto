// The isometric grid of the idle sawmill. No Phaser in here (see docs/minigames/idle.md).
//
// 2:1 dimetric tiles. A tile is (gx, gy): gx grows toward the lower right of the screen (the way the material flows),
// gy toward the lower left. World pixels: x to the right, y down, a point at height z is drawn z px higher.

export const TILE_W = 128;
export const TILE_H = 64;

/** The map is GX tiles along the flow and GY across it. */
export const GX = 55;
export const GY = 22;

/** The top corner of the map (tile 0, 0) in world pixels: left of it lies the whole gy side of the diamond. */
export const ORIGIN = { x: GY * TILE_W / 2, y: 200 } as const;

/** The world: the diamond, some room above for tall things (chimney, trees) and below for the HUD band. */
export const WORLD_W = (GX + GY) * TILE_W / 2;
export const WORLD_H = ORIGIN.y + (GX + GY) * TILE_H / 2 + 104;

export interface Point { x: number; y: number }
export interface Tile { gx: number; gy: number }

/** Where (gx, gy) is in world pixels; `z` lifts the point up the screen. Fractions of a tile are fine. */
export function toWorld(gx: number, gy: number, z = 0): Point {
  return { x: ORIGIN.x + (gx - gy) * TILE_W / 2, y: ORIGIN.y + (gx + gy) * TILE_H / 2 - z };
}

/** The tile under a world point on the ground (z = 0), as fractions: floor them for the tile. */
export function toTileF(x: number, y: number): Tile {
  const a = (x - ORIGIN.x) / (TILE_W / 2); // gx - gy
  const b = (y - ORIGIN.y) / (TILE_H / 2); // gx + gy
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}

export function toTile(x: number, y: number): Tile {
  const f = toTileF(x, y);
  return { gx: Math.floor(f.gx), gy: Math.floor(f.gy) };
}
