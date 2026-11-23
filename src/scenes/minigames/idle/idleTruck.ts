import Phaser from 'phaser';
import { INK } from '../../../core/theme';
import { PIECE_D, PIECE_L, drawBox, drawPieces, hull, poly, rel, shade, type PieceKind } from './idleDraw';
import type { Point } from './idleIso';

// The trucks: a long-nose tractor with a flatbed and two stacks of 3 x 3 pieces lying along it (docs/minigames/idle-pieces-sample.svg is the
// design). It is drawn in its own frame (`a` along the heading, `b` across, `z` up) in the sample's units, scaled by `S` to tiles, and turned
// to face any of the four directions of the grid. The near side is always the side of larger gx / gy, so the same code draws all four.

const S = 0.7;
/** Px of height per sample unit (a tile is 64 px high per unit, see PIECE_H). */
const ZP = 64 * S;
const A0 = -2.2;
const BED_L = 4.4, Y0 = -0.05, Y1 = 1.55;
const BZ0 = 0.3, BZ1 = 0.45;
const CAB_L = 0.85, CAB_H = 1.35, HOOD_L = 0.95, HOOD_W = 0.95, HOOD_H = 0.7;
const STEEL = 0x7d8791, STEEL_D = 0x4f5963, GLASS = 0xbfe3f2, CHROME = 0xc9ced2, LIGHT = 0xffe27a, TIRE = 0x1f1f1f;
const AXLES = [0.8, 1.6, BED_L + 0.4, BED_L + 1.35];

const sa = (x: number): number => A0 + x * S;
const sb = (y: number): number => (y - (Y0 + Y1) / 2) * S;
const zp = (z: number): number => z * ZP;

/** Draws a truck of `color` facing (dx, dy), carrying `kind` pieces. */
export function drawTruck(g: Phaser.GameObjects.Graphics, dx: number, dy: number, color: number, kind: PieceKind, cargo: number): void {
  g.clear();
  const fwd = dx + dy > 0; // the front is toward the viewer
  const alongX = dx !== 0;
  const world = (a: number, b: number): { x: number; y: number } => (alongX ? { x: dx * a, y: b } : { x: b, y: dy * a });
  const W = (a: number, b: number, z: number): Point => { const p = world(a, b); return rel(p.x, p.y, z); };
  /** A block given in sample units: along x0..x1, across y0..y1, height z0..z1. */
  const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: number): void => {
    const p = world(sa(x0), sb(y0)), q = world(sa(x1), sb(y1));
    drawBox(g, rel, Math.min(p.x, q.x), Math.min(p.y, q.y), Math.abs(q.x - p.x), Math.abs(q.y - p.y), zp(z1 - z0), col, zp(z0));
  };
  const quad = (pts: Point[], col: number): void => poly(g, pts, col);
  /** A rectangle on the front face of a part (x fixed), as fractions of its width and height. */
  const front = (x: number, u0: number, u1: number, v0: number, v1: number, zb: number, h: number, w0: number, w: number, col: number): void =>
    quad([W(sa(x), sb(w0 + u0 * w), zp(zb + v1 * h)), W(sa(x), sb(w0 + u1 * w), zp(zb + v1 * h)), W(sa(x), sb(w0 + u1 * w), zp(zb + v0 * h)), W(sa(x), sb(w0 + u0 * w), zp(zb + v0 * h))], col);
  /** The same on the near side face of a part (y fixed). */
  const side = (y: number, u0: number, u1: number, v0: number, v1: number, zb: number, h: number, x0: number, l: number, col: number): void =>
    quad([W(sa(x0 + u0 * l), sb(y), zp(zb + v1 * h)), W(sa(x0 + u1 * l), sb(y), zp(zb + v1 * h)), W(sa(x0 + u1 * l), sb(y), zp(zb + v0 * h)), W(sa(x0 + u0 * l), sb(y), zp(zb + v0 * h))], col);
  const wheel = (x: number, r = 0.34, t = 0.24): void => {
    const ring = (rr: number, yy: number): Point[] => Array.from({ length: 28 }, (_, i) => {
      const an = (i * Math.PI) / 14;
      return W(sa(x) + rr * S * Math.cos(an), sb(yy), zp(r + rr * Math.sin(an)));
    });
    const outer = ring(r, Y1 + t);
    poly(g, hull([...ring(r, Y1), ...outer]), TIRE);
    poly(g, outer, 0x2f2f2f);
    poly(g, ring(r * 0.62, Y1 + t), 0xaeb6bd);
    poly(g, ring(r * 0.22, Y1 + t), STEEL_D);
  };
  const post = (x: number, y: number): void => bx(x, x + 0.1, y, y + 0.1, BZ1, BZ1 + 1.55, STEEL_D);
  const posts = [0.15 + 0.25 * 2, 0.15 + 0.75 * 2, 0.15 + 2.05 + 0.25 * 2, 0.15 + 2.05 + 0.75 * 2];

  // ---- the frame and deck under everything ----
  bx(0, BED_L, Y0, Y1, BZ0, BZ1, STEEL);
  bx(0, BED_L, Y0, Y1, BZ1 - 0.04, BZ1, STEEL_D);

  // ---- the load: two stacks of 3 x 3, far posts, the pieces, near posts ----
  const load = (): void => {
    const board = kind === 'board' || kind === 'planed';
    const per = board ? 36 : 9; // a stack holds 3 x 3 places; boards come four to a place
    const unitsFront = Math.min(per, cargo), unitsRear = Math.max(0, Math.min(per, cargo - per)); // the stack by the cab fills first; one piece in the game is one piece on the truck
    for (const x of posts) post(x, Y0 + 0.02);
    const stack = (sx: number, count: number): void => {
      if (count <= 0) return;
      const p = world(sa(sx), sb(0 - 0.0)), q = world(sa(sx) + PIECE_L, sb(0) + 3 * PIECE_D);
      const x0 = Math.min(p.x, q.x), y0 = Math.min(p.y, q.y);
      drawPieces(g, rel, kind, count, x0, y0, zp(BZ1), alongX ? 1 : 3, alongX ? 3 : 1, alongX ? 'x' : 'y');
    };
    const sxA = 0.15, sxB = 0.15 + 2.05;
    const first = fwd ? [sxA, unitsRear] : [sxB, unitsFront], second = fwd ? [sxB, unitsFront] : [sxA, unitsRear];
    stack(first[0], first[1]);
    stack(second[0], second[1]);
    for (const x of posts) post(x, Y1 - 0.12);
  };

  // ---- the tractor ----
  const cx0 = BED_L + 0.03, fx = cx0 + CAB_L, hx = fx + HOOD_L;
  const hy0 = Y0 + (Y1 - Y0 - HOOD_W) / 2;
  const tractor = (): void => {
    bx(BED_L, BED_L + CAB_L + HOOD_L + 0.08, Y0 + 0.1, Y1 - 0.1, BZ0, BZ1, STEEL);
    const exhaust = (y: number): void => bx(cx0 - 0.04, cx0 + 0.04, y, y + 0.08, BZ0 + 0.3, BZ0 + 1.9, CHROME);
    const hoodPart = (): void => {
      bx(fx, hx, hy0, hy0 + HOOD_W, BZ0 + 0.05, BZ0 + 0.05 + HOOD_H, color);
      if (fwd) {
        front(hx, 0.12, 0.88, 0.1, 0.9, BZ0 + 0.05, HOOD_H, hy0, HOOD_W, CHROME);
        g.lineStyle(2, shade(CHROME, 0.6), 1);
        for (const k of [0.3, 0.5, 0.7]) {
          const a = W(sa(hx), sb(hy0 + 0.12 * HOOD_W), zp(BZ0 + 0.05 + k * HOOD_H)), b = W(sa(hx), sb(hy0 + 0.88 * HOOD_W), zp(BZ0 + 0.05 + k * HOOD_H));
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
        front(hx, 0, 0.12, 0.5, 0.85, BZ0 + 0.05, HOOD_H, hy0, HOOD_W, LIGHT);
        front(hx, 0.88, 1, 0.5, 0.85, BZ0 + 0.05, HOOD_H, hy0, HOOD_W, LIGHT);
      }
      bx(hx - 0.06, hx + 0.1, Y0, Y1, BZ0 - 0.02, BZ0 + 0.18, 0x2b2b2b);
    };
    const cabPart = (): void => {
      bx(cx0, fx, Y0, Y1, BZ1, BZ0 + CAB_H, color);
      bx(cx0, fx, Y0 + 0.05, Y1 - 0.05, BZ0 + CAB_H, BZ0 + CAB_H + 0.05, shade(color, 0.9));
      if (fwd) front(fx, 0.08, 0.92, 0.5, 0.9, BZ0, CAB_H, Y0, Y1 - Y0, GLASS);
      side(Y1, 0.1, 0.52, 0.5, 0.9, BZ0, CAB_H, cx0, CAB_L, GLASS);
      side(Y1, 0.58, 0.9, 0.5, 0.9, BZ0, CAB_H, cx0, CAB_L, GLASS);
      g.lineStyle(2, INK, 0.5);
      const a = W(sa(cx0 + 0.55 * CAB_L), sb(Y1), zp(BZ0 + 0.15 * CAB_H)), b = W(sa(cx0 + 0.55 * CAB_L), sb(Y1), zp(BZ0 + 0.5 * CAB_H));
      g.lineBetween(a.x, a.y, b.x, b.y);
    };
    if (fwd) { exhaust(Y0 + 0.03); cabPart(); hoodPart(); } else { hoodPart(); cabPart(); exhaust(Y0 + 0.03); }
  };

  if (fwd) { load(); tractor(); } else { tractor(); load(); }
  bx(cx0 - 0.04, cx0 + 0.04, Y1 - 0.11, Y1 - 0.03, BZ0 + 0.3, BZ0 + 1.9, CHROME); // the near exhaust stack
  for (const x of AXLES) wheel(x); // the near-side wheels, last
}
