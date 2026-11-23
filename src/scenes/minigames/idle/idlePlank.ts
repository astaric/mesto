import Phaser from 'phaser';
import { INK } from '../../../core/theme';
import { MACHINE_COLOR, PIECE_COLOR, PIECE_D, PIECE_H, PIECE_L, drawBox, drawPiece, drawPieces, poly, shade } from './idleDraw';
import { toWorld, type Point } from './idleIso';
import type { TileRect } from './idleLayout';
import { X_OUT, X_THROUGH, restPass, type PlankPose } from './idlePlankPose';

// The plank saw (saw 2; docs/minigames/idle-plank-saw4-sample.svg): the square log is fed along the belt between two blue posts joined by a cross beam, and flat blades slide
// across it, sideways, at the heights of the cuts: 1, 2 or 3 of them by level (idlePlankPose.ts). A blade is as thin as the ink line between stacked planks: one flat shape
// with a ratchet of big teeth on the edge that faces the cut, longer than the gap between the posts so that both of its ends are always inside a post (a dark slot in the
// far post shows where it goes in). The log is whole below the lowest blade; the planks cut off above it glide to the output end and are stacked there (ready for the forklift) while the log goes back for the next cut; the last frame is the finished stack. Only drawing: the timing is
// plain maths in idlePlankPose.ts.

// All x offsets are tiles from the machine's left edge (`gx0`), all y offsets from its back edge (`gy0`); the belt runs along gx through y + 1.5.
const BELT_Z = 16, BELT_Y = 1.1, BELT_W = 0.8;
const BELT = 0x4a4a4a, STEEL_L = 0xdfe4e8, SLOT = 0x1f1f1f, DUST = 0xf1d27a;
/** The log runs along the belt at the same y as any machine's piece, PIECE_L long. */
const LOG_Y = 1.15 + (0.7 - PIECE_D) / 2;
/** The posts' inner faces (the gap the blades slide in), their thickness and height (px), and the blade's body (x), its teeth and how far apart they are. */
const Y0 = 0.75, Y1 = 2.25, POST_T = 0.3, POST_W = 0.5, POST_H = 110, BEAM_H = 9;
const BX = 1.1, BW = 0.17, DEPTH = 0.12, PITCH = 0.15;
/** Where the posts stand along the belt (tiles from the machine's left edge). */
export const POST_X = 0.88;
/** The blade is longer than the gap by this much on each side, and slides this far each way: its ends never leave the posts. */
export const STROKE = 0.2;
const PLATE_LEN = Y1 - Y0 + 2 * STROKE;
/** One plank's thickness (px). */
const LAYER = PIECE_H / 4;

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

/** The height (px) of the i-th blade (0 = the lowest) of a pass whose whole log is `base` planks thick: on the log, then on top of each plank cut off above it. */
export const bladeZ = (base: number, i: number): number => BELT_Z + (base + i) * LAYER;

/** The blade, shifted `s` tiles along y, lying across the belt at height `z`; the part inside the posts is not drawn. One flat shape (its outline is the line), the teeth move with it. */
function drawBlade(g: Phaser.GameObjects.Graphics, r: TileRect, s: number, z: number, lo = Y0, hi = Y1): void {
  const start = Y0 - STROKE + s, ya = Math.max(lo, start), yb = Math.min(hi, start + PLATE_LEN);
  if (yb - ya < 0.01) return;
  const at = (x: number, y: number): Point => toWorld(r.gx0 + x, r.gy0 + y, z), clamp = (y: number): number => Math.max(ya, Math.min(yb, y));
  const pts = [at(BX, ya)];
  for (let k = Math.floor((ya - start) / PITCH) - 1; k <= Math.floor((yb - start) / PITCH) + 1; k++) pts.push(at(BX - DEPTH, clamp(start + PITCH * (k + 0.55))), at(BX, clamp(start + PITCH * (k + 1))));
  pts.push(at(BX + BW, yb), at(BX + BW, ya));
  const cutLo = lo > Y0 && ya === lo, cutHi = hi < Y1 && yb === hi; // an edge made by splitting the blade (behind / in front of the log) is not an edge of the blade: no outline there
  if (!cutLo && !cutHi) { poly(g, pts, STEEL_L); return; }
  poly(g, pts, STEEL_L, false);
  const n = pts.length, path = cutLo ? pts : [...pts.slice(n - 2), ...pts.slice(0, n - 2)];
  g.lineStyle(3, INK, 0.35).strokePoints(path.map((p) => new Phaser.Math.Vector2(p.x, p.y)), false);
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

/** A block lying on the belt along the log's lane, filled like `drawBox` but outlined by hand: an open end (the block goes on in the next one) gets no outline. */
function slab(g: Phaser.GameObjects.Graphics, r: TileRect, x0: number, x1: number, h: number, z0: number, color: number, openLeft: boolean, openRight: boolean): void {
  const y0 = r.gy0 + LOG_Y, y1 = y0 + PIECE_D, ax = r.gx0 + x0, bx = r.gx0 + x1, z1 = z0 + h;
  const P = (x: number, y: number, z: number): Point => toWorld(x, y, z);
  const face = (pts: Point[], c: number): void => poly(g, pts, c, false);
  face([P(bx, y0, z0), P(bx, y1, z0), P(bx, y1, z1), P(bx, y0, z1)], shade(color, 0.78));
  face([P(ax, y1, z0), P(bx, y1, z0), P(bx, y1, z1), P(ax, y1, z1)], shade(color, 0.62));
  face([P(ax, y0, z1), P(bx, y0, z1), P(bx, y1, z1), P(ax, y1, z1)], color);
  const lines: [Point, Point][] = [
    [P(ax, y0, z1), P(bx, y0, z1)], [P(ax, y1, z1), P(bx, y1, z1)], [P(ax, y1, z0), P(bx, y1, z0)], // along the block: top back, top front, bottom front
  ];
  if (!openLeft) lines.push([P(ax, y0, z1), P(ax, y1, z1)], [P(ax, y1, z0), P(ax, y1, z1)]);
  if (!openRight) lines.push([P(bx, y0, z1), P(bx, y1, z1)], [P(bx, y1, z0), P(bx, y1, z1)], [P(bx, y0, z0), P(bx, y1, z0)], [P(bx, y0, z0), P(bx, y0, z1)]);
  g.lineStyle(3, INK, 0.35);
  for (const [a, b] of lines) g.lineBetween(a.x, a.y, b.x, b.y);
}

/** The carriage that raises the log: a steel plate under it on two telescoping legs. */
function drawCarriage(g: Phaser.GameObjects.Graphics, r: TileRect, x: number, z: number): void {
  const plate = 3, y = r.gy0 + LOG_Y;
  for (const lx of [x + 0.15, x + PIECE_L - 0.23]) drawBox(g, toWorld, r.gx0 + lx, y + PIECE_D / 2 - 0.04, 0.08, 0.08, z - plate - BELT_Z, 0x9aa5ae, BELT_Z);
  drawBox(g, toWorld, r.gx0 + x - 0.05, y - 0.08, PIECE_L + 0.1, PIECE_D + 0.16, plate, 0x7a8590, z - plate);
}

/** One frame of the saw at work (`mid` cleared here, and `piece`, which holds the output stack): the blades swing across the log (a smooth swing in time: `ms`) while the log is fed through them. Upstream of the blades the log is whole
 *  (`base + blades` planks thick); downstream it is whole below the lowest blade and the planks above are separate boards. When the cut is through, those planks glide to the output end and lie on the stack there (where the forklift takes
 *  them from) while the log (`base` planks) goes back for the next cut; in the last pass the rest of the log glides out too, so the last frame is the finished stack. */
export function drawPlankWorking(parts: PlankParts, piece: Phaser.GameObjects.Graphics, r: TileRect, pose: PlankPose, ms: number): void {
  const g = parts.mid, { base, blades, x, back, stacked, glide, last, lift, liftFrom, base0, total } = pose, cut = BX - DEPTH;
  const Z = BELT_Z + lift * LAYER; // the log is raised on a carriage, the blades stay put
  /** A block of the log from x0 to x1 (tiles): `openLeft` / `openRight` mean that end is not an end of the piece but where it goes on in another block (no outline there, so no line shows across the log). */
  const box = (x0: number, x1: number, h: number, z: number, color: number, openLeft = false, openRight = false): void => {
    if (x1 - x0 > 0.01) slab(g, r, x0, x1, h, z, color, openLeft, openRight);
  };
  g.clear();
  piece.clear();
  for (let i = 0; i < total; i++) drawSlot(g, r, bladeZ(base0, i));
  // the blades keep swinging at their heights in every pass (one that has no cut to make in this pass just swings over the log)
  const swing = STROKE * Math.sin(ms / 150), shift = (_i: number): number => swing;
  // the part of a blade inside and behind the log is hidden by it (the log goes over it); the part in front of the log's near face is drawn over the log
  const logFront = LOG_Y + PIECE_D, end = x + PIECE_L, glidingOut = glide > 0;
  // the blades are over the log (all of each) when it has not reached them yet (waiting at the start of the belt), and on the way back, when the planks above the lowest blade are gone and the blades only lie on its top
  const upstream = (end <= cut || back) && !(last && glidingOut);
  if (!upstream) for (let i = 0; i < total; i++) drawBlade(g, r, shift(i), bladeZ(base0, i), Y0, logFront);
  if (lift > 0.02 && !(last && glidingOut)) drawCarriage(g, r, x, Z);
  if (last && glidingOut) { /* the whole log is on its way to the stack */ }
  else if (back) box(x, end, base * LAYER, Z, PIECE_COLOR.cant);
  else if (x >= cut) {
    box(x, end, base * LAYER, Z, PIECE_COLOR.cant);
    for (let j = base; j < base + blades; j++) box(x, end, LAYER, Z + j * LAYER, PIECE_COLOR.board);
  } else if (end <= cut) box(x, end, (base + blades) * LAYER, Z, PIECE_COLOR.cant);
  else {
    // the blades are in the log: below the lowest blade it is one piece all along, above it the uncut part is one block and the cut part separate planks (the join has no outline)
    box(x, end, base * LAYER, Z, PIECE_COLOR.cant);
    box(x, cut, blades * LAYER, Z + base * LAYER, PIECE_COLOR.cant, false, true);
    for (let j = base; j < base + blades; j++) box(cut, end, LAYER, Z + j * LAYER, PIECE_COLOR.board, true, false);
  }
  for (let i = 0; i < total; i++) drawBlade(g, r, shift(i), bladeZ(base0, i), upstream ? Y0 : logFront, Y1);
  // the output stack: what the earlier passes (and the finished glide of this one) put there; the planks of this pass still on their way are drawn over it
  const first = last ? 0 : base, group = last ? base + blades : blades, landed = glide >= 1 ? group : 0, e = glide * glide * (3 - 2 * glide);
  const ox = r.gx0 + X_OUT, oy = r.gy0 + LOG_Y;
  drawPieces(piece, toWorld, 'board', stacked + landed, ox, oy, BELT_Z, 1, 1);
  if (glide > 0 && glide < 1) {
    for (let k = 0; k < group; k++) {
      const from = first + k, to = stacked + k, ex = X_THROUGH + (X_OUT - X_THROUGH) * e;
      drawPiece(piece, toWorld, 'board', r.gx0 + ex, oy, BELT_Z + (from + liftFrom + (to - from - liftFrom) * e) * LAYER);
    }
  }
  if (back || glidingOut || x + PIECE_L <= cut || x >= BX + BW) return; // sawdust only while the log is in the blades
  let seed = Math.floor(ms / 70) * 7919 + 17; // sawdust at the cuts
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 5; i++) drawBox(g, toWorld, r.gx0 + BX + 0.05 + rnd() * 0.55, r.gy0 + LOG_Y - 0.1 + rnd() * 0.6, 0.07, 0.06, 4, DUST, bladeZ(base0, 0) + rnd() * (blades * LAYER));
}
