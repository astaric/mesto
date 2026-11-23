import Phaser from 'phaser';
import { MACHINE_COLOR, PIECE_COLOR, PIECE_D, PIECE_H, PIECE_L, drawBox, poly, shade } from './idleDraw';
import { toWorld, type Point } from './idleIso';
import type { TileRect } from './idleLayout';
import { restPass, type PlankPose } from './idlePlankPose';

// The plank saw (saw 2; docs/minigames/idle-plank-saw4-sample.svg): the square log is fed along the belt between two blue posts joined by a cross beam, and flat blades slide
// across it, sideways, at the heights of the cuts: 1, 2 or 3 of them by level (idlePlankPose.ts). A blade is as thin as the ink line between stacked planks: one flat shape
// with a ratchet of big teeth on the edge that faces the cut, longer than the gap between the posts so that both of its ends are always inside a post (a dark slot in the
// far post shows where it goes in). The log is whole below the lowest blade; the plank above each blade lifts a hair and is gone in the next pass. Only drawing: the timing is
// plain maths in idlePlankPose.ts.

// All x offsets are tiles from the machine's left edge (`gx0`), all y offsets from its back edge (`gy0`); the belt runs along gx through y + 1.5.
const BELT_Z = 16, BELT_Y = 1.1, BELT_W = 0.8;
const BELT = 0x4a4a4a, STEEL_L = 0xdfe4e8, SLOT = 0x1f1f1f, DUST = 0xf1d27a;
/** The log runs along the belt at the same y as any machine's piece, PIECE_L long. */
const LOG_Y = 1.15 + (0.7 - PIECE_D) / 2;
/** The posts' inner faces (the gap the blades slide in), their thickness and height (px), and the blade's body (x), its teeth and how far apart they are. */
const Y0 = 0.75, Y1 = 2.25, POST_T = 0.3, POST_X = 1.18, POST_W = 0.5, POST_H = 110, BEAM_H = 9;
const BX = 1.4, BW = 0.17, DEPTH = 0.12, PITCH = 0.15;
/** The blade is longer than the gap by this much on each side, and slides this far each way: its ends never leave the posts. */
export const STROKE = 0.2;
const PLATE_LEN = Y1 - Y0 + 2 * STROKE;
/** One plank's thickness (px) and how far the plank above a blade lifts (px). */
const LAYER = PIECE_H / 4, LIFT = 2;

export interface PlankParts {
  /** the slots, the log, the blades and the planks above them (between the far post and the near one) */ mid: Phaser.GameObjects.Graphics;
  /** the near post and the cross beam (in front of everything between the posts) */ front: Phaser.GameObjects.Graphics;
  key: string;
}

const post = (g: Phaser.GameObjects.Graphics, r: TileRect, y: number, color: number): void => drawBox(g, toWorld, r.gx0 + POST_X, r.gy0 + y, POST_W, POST_T, POST_H, color);

/** The pieces of the machine that do not change: the belt and the far post. */
export function drawPlankBase(g: Phaser.GameObjects.Graphics, r: TileRect): void {
  drawBox(g, toWorld, r.gx0 - 0.7, r.gy0 + BELT_Y, r.gx1 - r.gx0 + 2.4, BELT_W, BELT_Z, BELT);
  post(g, r, Y0 - POST_T, MACHINE_COLOR.saw2);
}

/** The near post and the cross beam over both posts. */
export function drawPlankFront(g: Phaser.GameObjects.Graphics, r: TileRect): void {
  g.clear();
  post(g, r, Y1, MACHINE_COLOR.saw2);
  drawBox(g, toWorld, r.gx0 + POST_X, r.gy0 + Y0 - POST_T, POST_W, Y1 + POST_T - (Y0 - POST_T), BEAM_H, shade(MACHINE_COLOR.saw2, 0.9), POST_H);
}

/** The height (px) of the i-th blade (0 = the lowest) of a pass whose whole log is `base` planks thick: on the log, then on top of each plank cut off above it (which lifted by `LIFT`). */
export const bladeZ = (base: number, i: number): number => BELT_Z + (base + i) * LAYER + i * LIFT;

/** The blade, shifted `s` tiles along y, lying across the belt at height `z`; the part inside the posts is not drawn. One flat shape (its outline is the line), the teeth move with it. */
function drawBlade(g: Phaser.GameObjects.Graphics, r: TileRect, s: number, z: number): void {
  const start = Y0 - STROKE + s, ya = Math.max(Y0, start), yb = Math.min(Y1, start + PLATE_LEN);
  const at = (x: number, y: number): Point => toWorld(r.gx0 + x, r.gy0 + y, z), clamp = (y: number): number => Math.max(ya, Math.min(yb, y));
  const pts = [at(BX, ya)];
  for (let k = Math.floor((ya - start) / PITCH) - 1; k <= Math.floor((yb - start) / PITCH) + 1; k++) pts.push(at(BX - DEPTH, clamp(start + PITCH * (k + 0.55))), at(BX, clamp(start + PITCH * (k + 1))));
  pts.push(at(BX + BW, yb), at(BX + BW, ya));
  poly(g, pts, STEEL_L);
}

/** The opening in the far post's inner face that a blade at height `z` goes into. */
function drawSlot(g: Phaser.GameObjects.Graphics, r: TileRect, z: number): void {
  const x0 = BX - DEPTH - 0.04, x1 = BX + BW + 0.04, p = (x: number, zz: number): Point => toWorld(r.gx0 + x, r.gy0 + Y0, zz);
  poly(g, [p(x0, z + 3.5), p(x1, z + 3.5), p(x1, z - 1.5), p(x0, z - 1.5)], SLOT);
}

/** The saw at rest: no log, the blades wait in their slots at the heights of the first pass. */
export function drawPlankRest(parts: PlankParts, r: TileRect, level: number): void {
  const { base, blades } = restPass(level);
  parts.mid.clear();
  for (let i = 0; i < blades; i++) drawSlot(parts.mid, r, bladeZ(base, i));
  for (let i = 0; i < blades; i++) drawBlade(parts.mid, r, 0, bladeZ(base, i));
}

/** One frame of the saw at work (cleared here): the blades swing across the log (a smooth swing in time: `ms`) while the log is fed through them. Upstream of the blades the log is whole (`base + blades` planks thick); downstream it is whole
 *  below the lowest blade and the plank above each blade lifts a hair; on the way back only the `base` planks are left. */
export function drawPlankWorking(parts: PlankParts, r: TileRect, pose: PlankPose, ms: number): void {
  const g = parts.mid, { base, blades, x, back } = pose, s = STROKE * Math.sin(ms / 150), cut = BX - DEPTH;
  const box = (x0: number, x1: number, h: number, z: number, color: number): void => { if (x1 - x0 > 0.01) drawBox(g, toWorld, r.gx0 + x0, r.gy0 + LOG_Y, x1 - x0, PIECE_D, h, color, z); };
  g.clear();
  for (let i = 0; i < blades; i++) drawSlot(g, r, bladeZ(base, i));
  if (back) box(x, x + PIECE_L, base * LAYER, BELT_Z, PIECE_COLOR.cant);
  else {
    box(x, Math.min(x + PIECE_L, cut), (base + blades) * LAYER, BELT_Z, PIECE_COLOR.cant);          // not cut yet
    box(Math.max(x, cut), x + PIECE_L, base * LAYER, BELT_Z, PIECE_COLOR.cant);                      // whole below the lowest blade
  }
  for (let i = 0; i < blades; i++) {
    drawBlade(g, r, s, bladeZ(base, i));
    if (!back) box(Math.max(x, cut), x + PIECE_L, LAYER, bladeZ(base, i) + LIFT, PIECE_COLOR.board); // the plank cut off above this blade
  }
  if (back || x + PIECE_L <= cut || x >= BX + BW) return; // sawdust only while the log is in the blades
  let seed = Math.floor(ms / 70) * 7919 + 17; // sawdust at the cuts
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 5; i++) drawBox(g, toWorld, r.gx0 + BX + 0.05 + rnd() * 0.55, r.gy0 + LOG_Y - 0.1 + rnd() * 0.6, 0.07, 0.06, 4, DUST, bladeZ(base, 0) + rnd() * (blades * (LAYER + LIFT)));
}
