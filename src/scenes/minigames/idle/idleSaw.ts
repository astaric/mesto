import Phaser from 'phaser';
import { INK } from '../../../core/theme';
import { MACHINE_COLOR, PIECE_COLOR, PIECE_D, PIECE_H, PIECE_L, drawBox, hull, poly, shade } from './idleDraw';
import { toWorld, type Point } from './idleIso';
import type { TileRect } from './idleLayout';
import { STROKE } from './idlePlank';
import { BELT_END, BW, BX, BX_V, DEPTH, VERTICAL_AT, bladeX, sawFlats, sawPose } from './idleSawPose';

// The log saw (row 1; docs/minigames/idle-logsaw-levels-sample.svg, version B): the peeled trunk is fed along the belt through a portal of blue posts and a cross beam, and flat blades
// like the plank saw's slide across it: 1, 2 or 4 by level (idleSawPose.ts). Each takes one flat off the trunk: the top blade (level 1) planes the top flat, then the trunk rolls a quarter on
// powered rollers in the belt and comes through again, four passes; the second blade (level 25) skims the belt under the trunk and takes the bottom flat, two passes; at level 50 a vertical
// pair a little further down the same (then wider) portal takes the far and near flats, one pass and no roll. A blade is one flat shape, longer than the gap so that both of its ends are
// always inside a post (a dark slot shows where), the vertical ones inside the belt (a slit) and the beam. Phaser is only used to draw; the timing (`sawPose`) is plain maths and tested.

// All x offsets are tiles from the machine's left edge (`gx0`), all y offsets from its back edge (`gy0`); the belt runs along gx through y + 1.5.
const BELT_Z = 16;
const R = PIECE_D / 2, RZ = PIECE_H / 2, LANE = 1.5;
/** The flats stand this far from the axis (a fraction of the radius): four of them leave a square log with rounded corners, a little smaller than the finished block. */
const FLAT = 0.9;
const CZ = BELT_Z + RZ;
/** The planes of the four flats: the top and the bottom (px above the ground), the far and the near (tiles along y). */
const TOP_Z = CZ + FLAT * RZ + 0.5, BOT_Z = CZ - FLAT * RZ - 0.5, FAR_Y = LANE - FLAT * R, NEAR_Y = LANE + FLAT * R;
/** The posts' inner faces (the gap the horizontal blades slide in), their thickness and height (px); the beam. */
const Y0 = 0.75, Y1 = 2.25, POST_T = 0.3, POST_H = 110, BEAM_H = 9;
const PITCH = 0.15, PITCH_Z = 10, STROKE_Z = 14;
/** The portal: a post is just wide enough for a blade's slot; at level 50 the far wall and the beam reach on over the vertical blades. */
const PX0 = BX - DEPTH - 0.06, POST_W = DEPTH + BW + 0.12;
const BELT = 0x4a4a4a, STEEL = 0x4f5963, STEEL_L = 0xdfe4e8, ORANGE = 0xd9814f, SLOT = 0x1f1f1f, DUST = 0xf1d27a;

/** The cross-section of the trunk, a unit circle cut by flats (their outward normals at the given angles, 0 = the viewer's side, pi/2 = up). */
function section(flats: number[]): [number, number][] {
  let pts: [number, number][] = Array.from({ length: 40 }, (_, i) => [Math.cos((i * Math.PI) / 20), Math.sin((i * Math.PI) / 20)]);
  for (const a of flats) {
    const n = [Math.cos(a), Math.sin(a)], f = (p: [number, number]): number => n[0] * p[0] + n[1] * p[1] - FLAT;
    const next: [number, number][] = [];
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length], fp = f(p), fq = f(q);
      if (fp <= 0) next.push(p);
      if (fp * fq < 0) { const t = fp / (fp - fq); next.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    });
    pts = next;
  }
  return pts;
}

/** The peeled trunk between the tile positions x0 and x1 (along gx) with the given flats sawn on it. */
function drawTrunk(g: Phaser.GameObjects.Graphics, r: TileRect, x0: number, x1: number, flats: number[]): void {
  if (x1 - x0 < 0.03) return;
  const color = PIECE_COLOR.peeled, pts = section(flats), n = pts.length, cy = r.gy0 + LANE, cz = BELT_Z + RZ;
  const on = (p: [number, number]): boolean => flats.some((a) => Math.abs(Math.cos(a) * p[0] + Math.sin(a) * p[1] - FLAT) < 1e-6);
  const at = (x: number, p: [number, number]): Point => toWorld(r.gx0 + x, cy + p[0] * R, cz + p[1] * RZ);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], ny = q[1] - p[1], nz = -(q[0] - p[0]);
    if (ny + nz <= 1e-9) continue; // the back faces
    const len = Math.hypot(ny, nz), flat = on(p) && on(q), br = 0.82 + (0.22 * nz) / len + (0.06 * ny) / len;
    poly(g, [at(x0, p), at(x1, p), at(x1, q), at(x0, q)], shade(flat ? shade(color, 1.12) : color, br), false);
  }
  const outline = hull([...pts.map((p) => at(x0, p)), ...pts.map((p) => at(x1, p))]).map((p) => new Phaser.Math.Vector2(p.x, p.y));
  g.lineStyle(3, INK, 0.45).strokePoints(outline, true);
  poly(g, pts.map((p) => at(x1, p)), shade(color, 1.14));
  g.lineStyle(2, shade(color, 0.65), 0.9).strokePoints(pts.map((p) => { const a = at(x1, [p[0] * 0.6, p[1] * 0.6]); return new Phaser.Math.Vector2(a.x, a.y); }), true);
  g.lineStyle(2, shade(color, 0.6), 0.9);
  for (let i = 0; i < n; i++) { // where a flat meets the round
    const p = pts[i];
    if (on(p) && (!on(pts[(i + n - 1) % n]) || !on(pts[(i + 1) % n])) && p[0] + p[1] > -0.1) { const a = at(x0, p), b = at(x1, p); g.lineBetween(a.x, a.y, b.x, b.y); }
  }
}


const portalW = (blades: number): number => POST_W + (blades >= 4 ? VERTICAL_AT : 0);

/** The flat blade `i` (0 top, 1 bottom: lying across the belt, shifted `s` tiles along y; 2 far, 3 near: standing in its plane, shifted `s` px along z). The ends inside the posts, the belt and the beam are not drawn. One flat shape (its outline is the line), the teeth move with it. */
function drawBlade(g: Phaser.GameObjects.Graphics, r: TileRect, i: number, s: number): void {
  const bx = i < 2 ? BX : BX_V;
  if (i < 2) {
    const z = i === 0 ? TOP_Z : BOT_Z, len = Y1 - Y0 + 2 * STROKE, start = Y0 - STROKE + s, ya = Math.max(Y0, start), yb = Math.min(Y1, start + len);
    const at = (x: number, y: number): Point => toWorld(r.gx0 + x, r.gy0 + y, z), clamp = (y: number): number => Math.max(ya, Math.min(yb, y));
    const pts = [at(bx, ya)];
    for (let k = Math.floor((ya - start) / PITCH) - 1; k <= Math.floor((yb - start) / PITCH) + 1; k++) pts.push(at(bx - DEPTH, clamp(start + PITCH * (k + 0.55))), at(bx, clamp(start + PITCH * (k + 1))));
    pts.push(at(bx + BW, yb), at(bx + BW, ya));
    poly(g, pts, STEEL_L);
    return;
  }
  const y = i === 2 ? FAR_Y : NEAR_Y, len = POST_H - BELT_Z + 2 * STROKE_Z, start = BELT_Z - STROKE_Z + s, za = Math.max(BELT_Z, start), zb = Math.min(POST_H, start + len);
  const at = (x: number, z: number): Point => toWorld(r.gx0 + x, r.gy0 + y, z), clamp = (z: number): number => Math.max(za, Math.min(zb, z));
  const pts = [at(bx, za)];
  for (let k = Math.floor((za - start) / PITCH_Z) - 1; k <= Math.floor((zb - start) / PITCH_Z) + 1; k++) pts.push(at(bx - DEPTH, clamp(start + PITCH_Z * (k + 0.55))), at(bx, clamp(start + PITCH_Z * (k + 1))));
  pts.push(at(bx + BW, zb), at(bx + BW, za));
  poly(g, pts, STEEL_L);
}

/** The opening a blade goes into: the horizontal ones in the far post's inner face, the vertical ones a slit in the belt. */
function drawSlot(g: Phaser.GameObjects.Graphics, r: TileRect, i: number): void {
  const b = bladeX(i), x0 = b.from - 0.04, x1 = b.to + 0.04;
  if (i < 2) {
    const z = i === 0 ? TOP_Z : BOT_Z, p = (x: number, zz: number): Point => toWorld(r.gx0 + x, r.gy0 + Y0, zz);
    poly(g, [p(x0, z + 3.5), p(x1, z + 3.5), p(x1, z - 1.5), p(x0, z - 1.5)], SLOT);
  } else {
    const y = i === 2 ? FAR_Y : NEAR_Y, p = (x: number, yy: number): Point => toWorld(r.gx0 + x, r.gy0 + yy, BELT_Z);
    poly(g, [p(x0, y - 0.03), p(x1, y - 0.03), p(x1, y + 0.03), p(x0, y + 0.03)], SLOT, false);
  }
}

/** The rollers in the belt under the trunk's resting place: dark, orange while they roll it. */
function drawRollers(g: Phaser.GameObjects.Graphics, r: TileRect, rolling: boolean): void {
  for (let i = 0; i < 5; i++) drawBox(g, toWorld, r.gx0 + 0.05 + i * 0.25, r.gy0 + LANE - 0.3, 0.1, 0.6, 3, rolling ? ORANGE : STEEL, BELT_Z);
}

/** The pieces of the machine that do not change: the belt (it reaches out into the aisle, where the square log lies on its end). */
export function drawSawBase(g: Phaser.GameObjects.Graphics, r: TileRect): void {
  drawBox(g, toWorld, r.gx0, r.gy0 + 1.1, BELT_END, 0.8, BELT_Z, BELT);
}

export interface SawParts {
  /** the far wall, the slots, the far and bottom blades, the rollers (under the trunk) */ under: Phaser.GameObjects.Graphics;
  /** the top and near blades, the near posts and the beam, sawdust (over the trunk) */ front: Phaser.GameObjects.Graphics;
  key: string;
}

/** The far wall (under the trunk) and, over it, the near posts and the beam. */
function drawPortalBack(g: Phaser.GameObjects.Graphics, r: TileRect, blades: number): void {
  drawBox(g, toWorld, r.gx0 + PX0, r.gy0 + Y0 - POST_T, portalW(blades), POST_T, POST_H, MACHINE_COLOR.saw1);
}
function drawPortalFront(g: Phaser.GameObjects.Graphics, r: TileRect, blades: number): void {
  for (const x of blades >= 4 ? [PX0, BX_V - DEPTH - 0.06] : [PX0]) drawBox(g, toWorld, r.gx0 + x, r.gy0 + Y1, POST_W, POST_T, POST_H, MACHINE_COLOR.saw1);
  drawBox(g, toWorld, r.gx0 + PX0, r.gy0 + Y0 - POST_T, portalW(blades), Y1 + POST_T - (Y0 - POST_T), BEAM_H, shade(MACHINE_COLOR.saw1, 0.9), POST_H);
}

/** Draws the blades `s` (px or tiles, see `drawBlade`) along their strokes: the ones under the trunk, the ones over it. */
function drawBlades(parts: SawParts, r: TileRect, blades: number, sh: number, sv: number): void {
  for (let i = 0; i < blades; i++) drawSlot(parts.under, r, i);
  if (blades >= 2) drawBlade(parts.under, r, 1, sh);   // the bottom blade skims the belt, under the trunk
  if (blades >= 4) drawBlade(parts.under, r, 2, sv);   // the far vertical one, behind the trunk
}

function clearAll(parts: SawParts, piece?: Phaser.GameObjects.Graphics): void {
  parts.under.clear();
  parts.front.clear();
  piece?.clear();
}

/** The saw at rest: no trunk, the blades wait in their slots, the rollers are dark . */
export function drawSawRest(parts: SawParts, r: TileRect, blades: number): void {
  clearAll(parts);
  drawPortalBack(parts.under, r, blades);
  drawRollers(parts.under, r, false);
  drawBlades(parts, r, blades, 0, 0);
  drawBlade(parts.front, r, 0, 0);
  if (blades >= 4) drawBlade(parts.front, r, 3, 0);
  drawPortalFront(parts.front, r, blades);
}

/** One frame of the saw at work, `f` (0..1) of the way through the trunk, into the saw's graphics and the machine's piece graphics (cleared here). The blades swing in time (`ms`). */
export function drawSawWorking(parts: SawParts, piece: Phaser.GameObjects.Graphics, r: TileRect, f: number, ms: number, blades: number): void {
  const pose = sawPose(f, PIECE_L, blades), { x } = pose, sh = STROKE * Math.sin(ms / 150), sv = STROKE_Z * Math.sin(ms / 150);
  clearAll(parts, piece);
  drawPortalBack(parts.under, r, blades);
  drawRollers(parts.under, r, pose.rolling);
  drawBlades(parts, r, blades, sh, sv);
  // the trunk: while it goes forward each stretch has the flats of the blades it has passed, on the way back and while it rolls it is sawn all along (and the flats move a quarter round)
  const flats = (now: number): number[] => sawFlats(pose.pass, blades, 0, now);
  if (pose.rolling) drawTrunk(piece, r, x, x + PIECE_L, sawFlats(pose.pass, blades, pose.turn));
  else if (!pose.forward) drawTrunk(piece, r, x, x + PIECE_L, flats(blades));
  else {
    const planes = blades >= 4 ? [{ at: bladeX(0).from, now: 2 }, { at: bladeX(2).from, now: 4 }] : [{ at: bladeX(0).from, now: blades }];
    let a = x, now = 0;
    for (const pl of planes) {
      if (pl.at >= x + PIECE_L) break;
      if (pl.at > a) { drawTrunk(piece, r, a, pl.at, flats(now)); a = pl.at; }
      now = pl.now;
    }
    drawTrunk(piece, r, a, x + PIECE_L, flats(now));
  }
  drawBlade(parts.front, r, 0, sh);                 // the top blade lies on the trunk
  if (blades >= 4) drawBlade(parts.front, r, 3, sv); // the near vertical one, in front of it
  drawPortalFront(parts.front, r, blades);
  // what is cut off turns into sawdust: flying chips at every blade that has the trunk under it
  let seed = Math.floor(ms / 70) * 7919 + 17;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < blades && pose.forward; i++) {
    const b = bladeX(i);
    if (!(x + PIECE_L > b.from && x < b.to)) continue;
    for (let k = 0; k < 5; k++) {
      const px = r.gx0 + b.from + rnd() * 0.3;
      if (i < 2) drawBox(parts.front, toWorld, px, r.gy0 + LANE - R + rnd() * 2 * R, 0.07, 0.06, 4, DUST, (i === 0 ? TOP_Z : BOT_Z) + rnd() * 10);
      else drawBox(parts.front, toWorld, px, r.gy0 + (i === 2 ? FAR_Y : NEAR_Y) + (rnd() - 0.5) * 0.12, 0.07, 0.06, 4, DUST, BOT_Z + rnd() * (TOP_Z - BOT_Z));
    }
  }
}
