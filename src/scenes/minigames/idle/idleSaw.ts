import Phaser from 'phaser';
import { INK } from '../../../core/theme';
import { MACHINE_COLOR, PIECE_COLOR, PIECE_D, PIECE_H, PIECE_L, drawBox, hull, poly, shade } from './idleDraw';
import { toWorld, type Point } from './idleIso';
import type { TileRect } from './idleLayout';
import { LANE, SAW_X, X_START, sawPose } from './idleSawPose';

// The log saw (row 1; docs/minigames/idle-logsaw-shuttle-sample.svg): ONE fixed circular saw standing behind the belt. The peeled trunk shuttles through it
// four times: forward (the disc takes a flat off the far side and the slab falls behind the saw), back, and a quarter roll on powered rollers in the belt. After
// the fourth cut it rolls on to the output end of the belt as a square log. Phaser is only used to draw; the timing (`sawPose`) is plain maths and tested.

// All x offsets are tiles from the machine's left edge (`gx0`), all y offsets from its back edge (`gy0`); the belt runs along gx through y + 1.5.
const BELT_Z = 16;
/** The belt starts at the machine's left edge and ends this far along (tiles); the square log lies on its end. */
const BELT_LEN = 3.0;
const R = PIECE_D / 2, RZ = PIECE_H / 2;
/** The flats stand this far from the axis (a fraction of the radius): four of them leave a square log with rounded corners, a little smaller than the finished block. */
const FLAT = 0.9;
const SAW_Y = LANE - FLAT * R;
const DISC_R = 0.62, DISC_Z = 56;
const DISC_COLOR = 0xdfe4e8, STEEL = 0x4f5963, ORANGE = 0xd9814f, BELT = 0x4a4a4a, DUST = 0xf1d27a;

/** The flat sawn on a trunk, `j` cuts ago (0 = the newest), where it is on the cross-section after `turn` of a quarter roll: the newest faces the saw (the far side, pi). */
const flatAngle = (j: number, turn: number): number => Math.PI - (j + turn) * (Math.PI / 2);

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

/** The disc, turned `phase` radians, standing in the plane y = SAW_Y. */
function drawDisc(g: Phaser.GameObjects.Graphics, r: TileRect, phase: number): void {
  const cx = r.gx0 + SAW_X, y = r.gy0 + SAW_Y, teeth = 18;
  const pt = (a: number, f: number): Point => toWorld(cx + DISC_R * f * Math.cos(a), y, DISC_Z + DISC_R * f * 64 * Math.sin(a));
  poly(g, Array.from({ length: teeth * 2 }, (_, i) => pt(phase + (i * Math.PI) / teeth, i % 2 === 0 ? 1 : 0.86)), DISC_COLOR);
  g.lineStyle(3, shade(DISC_COLOR, 0.6), 1);
  for (let k = 0; k < 3; k++) {
    const a = phase * 0.8 + (k * 2 * Math.PI) / 3, p = pt(a, 0.35), q = pt(a, 0.7);
    g.lineBetween(p.x, p.y, q.x, q.y);
  }
  poly(g, Array.from({ length: 16 }, (_, i) => pt((i * Math.PI) / 8, 0.25)), STEEL);
}

/** The rollers in the belt under the trunk's resting place: dark, orange while they roll it. */
function drawRollers(g: Phaser.GameObjects.Graphics, r: TileRect, rolling: boolean): void {
  for (let i = 0; i < 5; i++) drawBox(g, toWorld, r.gx0 + X_START + i * 0.25, r.gy0 + LANE - 0.3, 0.1, 0.6, 3, rolling ? ORANGE : STEEL, BELT_Z);
}

/** The pieces of the machine that do not change: the belt, the frame behind the saw, the arbor that carries the disc and the hood. */
export function drawSawBase(g: Phaser.GameObjects.Graphics, r: TileRect): void {
  drawBox(g, toWorld, r.gx0, r.gy0 + 1.1, BELT_LEN, 0.8, BELT_Z, BELT); // stays inside the lot, short of the aisles the forklifts drive in
  drawBox(g, toWorld, r.gx0 + SAW_X - 0.25, r.gy0 + 0.55, 0.5, 0.4, 112, MACHINE_COLOR.saw1);
  drawBox(g, toWorld, r.gx0 + SAW_X - 0.35, r.gy0 + 0.5, 0.7, 0.5, 12, shade(MACHINE_COLOR.saw1, 0.9), 112);
  drawBox(g, toWorld, r.gx0 + SAW_X - 0.1, r.gy0 + 0.95, 0.2, SAW_Y - 0.95, 20, STEEL, DISC_Z - 10);
}

export interface SawParts {
  /** the slabs behind the saw (under the belt and frame) */ fx: Phaser.GameObjects.Graphics;
  /** the disc, the rollers and the dust (under the trunk) */ disc: Phaser.GameObjects.Graphics;
  key: string;
}

/** The saw at rest: the disc stands still, the rollers are dark and no slabs lie behind it. */
export function drawSawRest(parts: SawParts, r: TileRect): void {
  parts.fx.clear();
  parts.disc.clear();
  drawRollers(parts.disc, r, false);
  drawDisc(parts.disc, r, 0);
}

/** One frame of the saw at work, `f` (0..1) of the way through the trunk, into the saw's graphics and the machine's piece graphics (cleared here). */
export function drawSawWorking(parts: SawParts, piece: Phaser.GameObjects.Graphics, r: TileRect, f: number, ms: number): void {
  const pose = sawPose(f, PIECE_L), { x } = pose;
  parts.fx.clear();
  parts.disc.clear();
  piece.clear();
  drawRollers(parts.disc, r, pose.rolling);
  drawDisc(parts.disc, r, ms / 55);
  for (let j = 0; j < pose.cuts; j++) { // the slabs that fell behind the saw
    drawBox(parts.fx, toWorld, r.gx0 + SAW_X + 0.4, r.gy0 + 0.62 + (j % 2) * 0.13, 0.9, 0.11, 6, shade(PIECE_COLOR.peeled, 0.9), Math.floor(j / 2) * 6);
  }
  if (pose.cutting) { // sawdust over the cut
    let seed = Math.floor(ms / 70) * 7919 + 17;
    const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 6; i++) drawBox(parts.disc, toWorld, r.gx0 + SAW_X - 0.15 + rnd() * 0.5, r.gy0 + SAW_Y - 0.25 + rnd() * 0.2, 0.08, 0.07, 5, DUST, 16 + rnd() * 34);
  }
  // the trunk: the part behind the saw has this pass's flat too; after a pass the whole trunk has it, and while it rolls the flats move a quarter round
  const flats = (rolled: number): number[] => Array.from({ length: pose.pass + 1 }, (_, j) => flatAngle(j, rolled));
  if (pose.allSawn) { drawTrunk(piece, r, x, x + PIECE_L, flats(pose.rolling ? pose.turn : 0)); return; }
  if (x < SAW_X) drawTrunk(piece, r, x, Math.min(x + PIECE_L, SAW_X), flats(0).slice(1));
  if (x + PIECE_L > SAW_X) drawTrunk(piece, r, Math.max(x, SAW_X), x + PIECE_L, flats(0));
}
