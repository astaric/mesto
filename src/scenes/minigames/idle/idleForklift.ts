import Phaser from 'phaser';
import { PIECE_D, PIECE_L, drawBox, drawPieces, hull, poly, rel, type PieceKind } from './idleDraw';
import type { Point } from './idleIso';

// The forklift (docs/minigames/idle-forklift-sample.svg is the design): a yellow truck with an overhead guard, a mast and two forks, and its load
// lying across the forks. Like the trucks it is drawn in its own frame (`a` along the heading, `b` across, `z` up) in the sample's units, scaled
// by `S`, and turned to face any of the four directions; the near side is the side of larger gx / gy.

const S = 0.7;
const ZP = 64 * S;
const A0 = -0.35;
const YEL = 0xffc83d, YEL_D = 0xd9a21f, STEEL = 0x8a8a8a, STEEL_L = 0xb9bec3, DARKG = 0x4a4a4a, TIRE = 0x1f1f1f;
/** The load's pieces start this far along the forks (sample units). */
const LOAD_X = 0.52;

const sa = (x: number): number => A0 + x * S;
const sb = (y: number): number => y * S;
const zp = (z: number): number => z * ZP;

/** Draws a forklift facing (dx, dy) with `cargo` pieces of `kind` on its forks (0 = empty). */
export function drawForklift(g: Phaser.GameObjects.Graphics, dx: number, dy: number, cargo: number, kind: PieceKind): void {
  g.clear();
  const fwd = dx + dy > 0; // the front is toward the viewer
  const alongX = dx !== 0;
  const world = (a: number, b: number): { x: number; y: number } => (alongX ? { x: dx * a, y: b } : { x: b, y: dy * a });
  const W = (a: number, b: number, z: number): Point => { const p = world(a, b); return rel(p.x, p.y, z); };
  const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: number): void => {
    const p = world(sa(x0), sb(y0)), q = world(sa(x1), sb(y1));
    drawBox(g, rel, Math.min(p.x, q.x), Math.min(p.y, q.y), Math.abs(q.x - p.x), Math.abs(q.y - p.y), zp(z1 - z0), col, zp(z0));
  };
  const wheel = (x: number, y: number, r: number, t: number): void => {
    const ring = (rr: number, yy: number): Point[] => Array.from({ length: 24 }, (_, i) => {
      const an = (i * 2 * Math.PI) / 24;
      return W(sa(x) + rr * S * Math.cos(an), sb(yy), zp(r + rr * Math.sin(an)));
    });
    const outer = ring(r, y + t);
    poly(g, hull([...ring(r, y), ...outer]), TIRE);
    poly(g, outer, 0x2f2f2f);
    poly(g, ring(r * 0.55, y + t), STEEL_L);
    poly(g, ring(r * 0.2, y + t), DARKG);
  };

  const body = (): void => {
    bx(-0.75, 0.3, -0.42, 0.42, 0.14, 0.44, YEL);                  // chassis
    bx(-0.78, -0.38, -0.45, 0.45, 0.14, 0.76, DARKG);              // counterweight
    bx(-0.35, 0.2, -0.3, 0.3, 0.44, 0.62, YEL_D);                  // engine cover and seat base
    for (const x of [-0.38, 0]) bx(x, x + 0.06, -0.4, -0.34, 0.44, 1.22, DARKG); // far posts of the overhead guard
    bx(-0.3, -0.08, -0.2, 0.2, 0.62, 0.82, DARKG);                 // seat
    wheel(0.05, 0.42, 0.2, 0.18);                                  // near wheels: big in front, small behind
    wheel(-0.5, 0.42, 0.16, 0.16);
    for (const x of [-0.38, 0]) bx(x, x + 0.06, 0.34, 0.4, 0.44, 1.22, DARKG); // near posts
    bx(-0.45, 0.15, -0.45, 0.45, 1.22, 1.28, DARKG);               // roof
  };
  const front = (): void => {
    for (const y of [-0.42, 0.34]) bx(0.3, 0.4, y, y + 0.08, 0.14, 1.19, STEEL); // mast uprights
    bx(0.3, 0.4, -0.42, 0.42, 1.14, 1.2, STEEL);                   // their cross bar
    bx(0.4, 0.47, -0.45, 0.45, 0.17, 0.67, STEEL_L);               // carriage plate
    for (const y of [-0.38, 0.26]) bx(0.47, 1.65, y, y + 0.12, 0.14, 0.19, STEEL); // the forks
    if (cargo <= 0) return;
    // the load lies across the forks, stacked along them: cells two deep, filled from the mast out, far one first
    const board = kind === 'board' || kind === 'planed';
    const cols = board ? [cargo] : [Math.ceil(cargo / 2), Math.floor(cargo / 2)];
    const order = fwd ? [0, 1] : [1, 0];
    for (const c of order) {
      if (cols[c] <= 0) continue;
      const a0 = sa(LOAD_X) + c * PIECE_D;
      const p = world(a0, sb(-PIECE_L / 2 / S)), q = world(a0 + PIECE_D, sb(PIECE_L / 2 / S));
      drawPieces(g, rel, kind, cols[c], Math.min(p.x, q.x), Math.min(p.y, q.y), zp(0.19), 1, 1, alongX ? 'y' : 'x');
    }
  };

  if (fwd) { body(); front(); } else { front(); body(); }
}
