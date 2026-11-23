import Phaser from 'phaser';
import { INK } from '../../../core/theme';
import { MACHINE_COLOR, PIECE_COLOR, PIECE_D, PIECE_H, PIECE_L, drawBox, hull, poly, shade } from './idleDraw';
import { toWorld, type Point } from './idleIso';
import type { TileRect } from './idleLayout';
import { LANE, SAW_X, X_START, sawFlats, sawPose } from './idleSawPose';

// The log saw (row 1; docs/minigames/idle-logsaw-shuttle-sample.svg): a fixed circular saw standing behind the belt. The peeled trunk shuttles through it
// four times: forward (the disc takes a flat off the far side and the slab falls behind the saw), back, and a quarter roll on powered rollers in the belt. After
// the fourth cut it rolls on to the output end of the belt as a square log. From level 25 a second disc stands on the near side (two flats per pass, two passes), from level 50 two more
// above and below the trunk (all four flats in one pass). Phaser is only used to draw; the timing (`sawPose`) is plain maths and tested.

// All x offsets are tiles from the machine's left edge (`gx0`), all y offsets from its back edge (`gy0`); the belt runs along gx through y + 1.5.
const BELT_Z = 16;
/** The belt starts at the machine's left edge and ends this far along (tiles); the square log lies on its end. */
const BELT_LEN = 3.0;
const R = PIECE_D / 2, RZ = PIECE_H / 2;
/** The flats stand this far from the axis (a fraction of the radius): four of them leave a square log with rounded corners, a little smaller than the finished block. */
const FLAT = 0.9;
const SAW_Y = LANE - FLAT * R;
const DISC_R = 0.62, DISC_Z = 56;
/** The planes of the top and bottom discs (the trunk's top and bottom flats), px above the ground. */
const TOP_Z = BELT_Z + RZ * (1 + FLAT) + 2, BOTTOM_Z = BELT_Z + RZ * (1 - FLAT) + 1;
const NEAR_Y = 2 * LANE - SAW_Y;
const DISC_COLOR = 0xdfe4e8, STEEL = 0x4f5963, ORANGE = 0xd9814f, BELT = 0x4a4a4a, DUST = 0xf1d27a;

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

/** The disc on one side of the trunk (0 far, 1 near, 2 top, 3 bottom), turned `phase` radians: the far and near ones stand upright in a plane y = const, the top and bottom ones lie flat. */
function drawDisc(g: Phaser.GameObjects.Graphics, r: TileRect, phase: number, side = 0): void {
  const cx = r.gx0 + SAW_X, teeth = 18;
  const pt = (a: number, f: number): Point => {
    const u = DISC_R * f * Math.cos(a), v = DISC_R * f * Math.sin(a);
    if (side === 0) return toWorld(cx + u, r.gy0 + SAW_Y, DISC_Z + v * 64);
    if (side === 1) return toWorld(cx + u, r.gy0 + NEAR_Y, DISC_Z + v * 64);
    return toWorld(cx + u, r.gy0 + LANE + v, side === 2 ? TOP_Z : BOTTOM_Z);
  };
  poly(g, Array.from({ length: teeth * 2 }, (_, i) => pt(phase + (i * Math.PI) / teeth, i % 2 === 0 ? 1 : 0.86)), DISC_COLOR);
  g.lineStyle(3, shade(DISC_COLOR, 0.6), 1);
  for (let k = 0; k < 3; k++) {
    const a = phase * 0.8 + (k * 2 * Math.PI) / 3, p = pt(a, 0.35), q = pt(a, 0.7);
    g.lineBetween(p.x, p.y, q.x, q.y);
  }
  poly(g, Array.from({ length: 16 }, (_, i) => pt((i * Math.PI) / 8, 0.25)), STEEL);
}

/** The frames the extra discs hang on, in front of the trunk: the near disc's frame and arbor mirror the first one's across the belt, the top disc hangs from a beam over the trunk (the bottom disc sits in the belt, no frame to see). */
function drawExtraFrames(g: Phaser.GameObjects.Graphics, r: TileRect, discs: number): void {
  if (discs < 2) return;
  for (const x of [SAW_X - 0.8, SAW_X + 0.65]) drawBox(g, toWorld, r.gx0 + x, r.gy0 + 2.05, 0.15, 0.3, 112, MACHINE_COLOR.saw1); // two posts beside the trunk's path, not in front of it
  drawBox(g, toWorld, r.gx0 + SAW_X - 0.8, r.gy0 + 2.05, 1.6, 0.3, 12, shade(MACHINE_COLOR.saw1, 0.9), 112);
  drawBox(g, toWorld, r.gx0 + SAW_X - 0.08, r.gy0 + 2.05, 0.16, 0.3, 112 - (DISC_Z - 10), STEEL, DISC_Z - 10);
  drawBox(g, toWorld, r.gx0 + SAW_X - 0.1, r.gy0 + NEAR_Y, 0.2, 2.05 - NEAR_Y, 20, STEEL, DISC_Z - 10);
  if (discs < 4) return;
  drawBox(g, toWorld, r.gx0 + SAW_X - 0.1, r.gy0 + 0.95, 0.2, LANE + 0.1 - 0.95, 12, STEEL, 100); // the beam from the far frame
  drawBox(g, toWorld, r.gx0 + SAW_X - 0.1, r.gy0 + LANE - 0.1, 0.2, 0.2, 100 - TOP_Z, STEEL, TOP_Z);
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
  /** the frames, slabs and dust in front of the trunk (over it) */ front: Phaser.GameObjects.Graphics;
  /** the discs in front of the trunk, half transparent (a spinning blur) so that the trunk shows through them */ blur: Phaser.GameObjects.Graphics;
  key: string;
}

/** The saw at rest: the disc stands still, the rollers are dark and no slabs lie behind it. */
export function drawSawRest(parts: SawParts, r: TileRect, discs: number): void {
  parts.fx.clear();
  parts.disc.clear();
  parts.front.clear();
  parts.blur.clear();
  drawRollers(parts.disc, r, false);
  drawSawDiscs(parts, r, discs, 0);
}

/** The discs there are for the level, each on its own side: the far one and the bottom one under the trunk, the near and top ones in front of it. */
function drawSawDiscs(parts: SawParts, r: TileRect, discs: number, phase: number): void {
  drawDisc(parts.disc, r, phase, 0);
  if (discs >= 4) drawDisc(parts.disc, r, phase, 3);
  drawExtraFrames(parts.front, r, discs);
  if (discs >= 2) drawDisc(parts.blur, r, phase, 1);
  if (discs >= 4) drawDisc(parts.blur, r, phase, 2);
}

/** One frame of the saw at work, `f` (0..1) of the way through the trunk, into the saw's graphics and the machine's piece graphics (cleared here). */
export function drawSawWorking(parts: SawParts, piece: Phaser.GameObjects.Graphics, r: TileRect, f: number, ms: number, discs: number): void {
  const pose = sawPose(f, PIECE_L, discs), { x } = pose;
  parts.fx.clear();
  parts.disc.clear();
  parts.front.clear();
  parts.blur.clear();
  piece.clear();
  drawRollers(parts.disc, r, pose.rolling);
  drawSawDiscs(parts, r, discs, ms / 55);
  for (let j = 0; j < pose.cuts; j++) { // the slabs that fell off: behind the saw, and with more discs every second one in front of the belt
    const front = discs > 1 && j % 2 === 1;
    drawBox(front ? parts.front : parts.fx, toWorld, r.gx0 + SAW_X + 0.4, front ? r.gy0 + 2.3 : r.gy0 + 0.62 + (j % 2) * 0.13, 0.9, 0.11, 6, shade(PIECE_COLOR.peeled, 0.9), Math.floor(j / 2) * 6);
  }
  if (pose.cutting) { // sawdust over the cut
    let seed = Math.floor(ms / 70) * 7919 + 17;
    const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 6; i++) drawBox(parts.disc, toWorld, r.gx0 + SAW_X - 0.15 + rnd() * 0.5, r.gy0 + SAW_Y - 0.25 + rnd() * 0.2, 0.08, 0.07, 5, DUST, 16 + rnd() * 34);
    if (discs > 1) for (let i = 0; i < 6; i++) drawBox(parts.front, toWorld, r.gx0 + SAW_X - 0.15 + rnd() * 0.5, r.gy0 + NEAR_Y + 0.05 + rnd() * 0.2, 0.08, 0.07, 5, DUST, 16 + rnd() * 34);
  }
  // the trunk: the part behind the saw has this pass's flat too; after a pass the whole trunk has it, and while it rolls the flats move a quarter round
  if (pose.allSawn) { drawTrunk(piece, r, x, x + PIECE_L, sawFlats(pose.pass, discs, pose.rolling ? pose.turn : 0, true)); return; }
  if (x < SAW_X) drawTrunk(piece, r, x, Math.min(x + PIECE_L, SAW_X), sawFlats(pose.pass, discs, 0, false));
  if (x + PIECE_L > SAW_X) drawTrunk(piece, r, Math.max(x, SAW_X), x + PIECE_L, sawFlats(pose.pass, discs, 0, true));
}
