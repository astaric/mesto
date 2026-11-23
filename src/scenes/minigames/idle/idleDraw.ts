import Phaser from 'phaser';
import { INK } from '../../../core/theme';
import {
  AISLES, DEBARKER, F1_LANE, GROUND, LANDING, PILE, LOADING_YARD, SHED, SLOTS, STORAGE,
  tr, type Ground, type GroundKind, type TileRect,
} from './idleLayout';
import { GX, GY, ORIGIN, toWorld, type Point } from './idleIso';

// The static world drawn with flat placeholder blocks. The layout is data (idleLayout.ts); the art that replaces these blocks later
// (docs/minigames/idle-plan.md, step 2) does not change where anything stands. Everything that stands up is its own game object, with the
// depth `x + y + w + d` (the tile sum of its front corner), so things that move (idleView.ts) sort in among it by the same key.

const GRASS = 0xbddb90;
const GROUND_COLOR: Record<GroundKind, number> = {
  forest: 0x8fbf6a, landing: 0xb08a55, road: 0x8e8e8a, courtyard: 0xdcd5c2, floor: 0xcdb98f, lane: 0xbfae82, yard: 0xe8d08e,
};
const LOT = 0xe9dfc4;
export const MACHINE_COLOR = { saw1: 0x7f9fc2, saw2: 0x6a8fbd, planer: 0x7fbf9a } as const;
/** The colours of the pieces on their way: a cut trunk, a peeled trunk, a square log, a rough plank, a planed plank. */
export const PIECE_COLOR = { trunk: 0x8a5a33, peeled: 0xe3c48d, square: 0xf3dfae, plank: 0xd9a964, planed: 0xfff1cc } as const;
/** How tall the pads of the stock places are: low, the pieces on them are what shows. */
export const PAD_H = 8;
/** The depth of the ground: below everything. */
export const GROUND_DEPTH = -1;

/** `color` darkened to `f` of its brightness. */
export function shade(color: number, f: number): number {
  const r = Math.round(((color >> 16) & 255) * f), g = Math.round(((color >> 8) & 255) * f), b = Math.round((color & 255) * f);
  return (r << 16) | (g << 8) | b;
}

/** Turns a tile position (and a height) into a point of the Graphics being drawn into. */
export type Proj = (gx: number, gy: number, z?: number) => Point;
/** For things that move: the same projection, but around the tile (0, 0), so the Graphics can be put at `toWorld(x, y)`. */
export const rel: Proj = (gx, gy, z = 0) => {
  const p = toWorld(gx, gy, z);
  return { x: p.x - ORIGIN.x, y: p.y - ORIGIN.y };
};

function poly(g: Phaser.GameObjects.Graphics, pts: Point[], color: number, stroke = true): void {
  const v = pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
  g.fillStyle(color, 1).fillPoints(v, true);
  if (stroke) g.lineStyle(3, INK, 0.35).strokePoints(v, true);
}

/** A block standing on the ground (or on `z0`): tile position and size (fractions allowed), height in px, the top colour (the sides are darker). */
export function drawBox(g: Phaser.GameObjects.Graphics, proj: Proj, x: number, y: number, w: number, d: number, h: number, color: number, z0 = 0): void {
  const top = [proj(x, y, z0 + h), proj(x + w, y, z0 + h), proj(x + w, y + d, z0 + h), proj(x, y + d, z0 + h)];
  poly(g, [proj(x + w, y, z0), proj(x + w, y + d, z0), top[2], top[1]], shade(color, 0.78));
  poly(g, [proj(x, y + d, z0), proj(x + w, y + d, z0), top[2], top[3]], shade(color, 0.62));
  poly(g, top, color);
}

/** A machine of the line, standing turned along the flow: a belt runs through it from its left side to its right side. */
export function drawMachine(g: Phaser.GameObjects.Graphics, r: TileRect, color: number, proj: Proj = toWorld): void {
  drawBox(g, proj, r.gx0 - 0.7, r.gy0 + 1.1, r.gx1 - r.gx0 + 2.4, 0.8, 16, 0x4a4a4a);
  drawBox(g, proj, r.gx0, r.gy0, r.gx1 - r.gx0 + 1, r.gy1 - r.gy0 + 1, 110, color);
}

export const rectDepth = (r: TileRect, inset = 0): number => r.gx1 + 1 - inset + r.gy1 + 1 - inset;

type Item = { depth: number; run: (g: Phaser.GameObjects.Graphics) => void };

/** Draws the ground and creates one game object for every block of the world, all inside `world`. */
export function buildStaticWorld(scene: Phaser.Scene, world: Phaser.GameObjects.Layer): void {
  const corners = (r: TileRect, z = 0): Point[] => [toWorld(r.gx0, r.gy0, z), toWorld(r.gx1 + 1, r.gy0, z), toWorld(r.gx1 + 1, r.gy1 + 1, z), toWorld(r.gx0, r.gy1 + 1, z)];
  const pair = (a: Point, b: Point): [number, number, number, number] => [a.x, a.y, b.x, b.y];

  // ---- the ground ----
  const g = scene.add.graphics().setDepth(GROUND_DEPTH);
  world.add(g);
  poly(g, [toWorld(0, 0), toWorld(GX, 0), toWorld(GX, GY), toWorld(0, GY)], GRASS);
  const paint = (gr: Ground) => poly(g, corners(gr.rect), GROUND_COLOR[gr.kind]);
  GROUND.forEach(paint);
  // a lighter strip down the middle of every lane marks where a forklift drives: the F1 lane runs along gx, the aisles along gy
  const f1 = F1_LANE;
  poly(g, corners(tr(f1.gx0, f1.gy0 + 1, f1.gx1, f1.gy0 + 1)), shade(GROUND_COLOR.lane, 1.08), false);
  for (const a of Object.values(AISLES)) poly(g, corners(tr(a.gx0 + 1, a.gy0, a.gx0 + 1, a.gy1)), shade(GROUND_COLOR.lane, 1.08), false);
  // the roads' white dashes
  g.lineStyle(6, 0xffffff, 0.8);
  for (let gy = 0; gy < 22; gy += 2) g.lineBetween(...pair(toWorld(9, gy + 0.2), toWorld(9, gy + 1)));
  for (let gy = 0; gy < 20; gy += 2) g.lineBetween(...pair(toWorld(47, gy + 0.2), toWorld(47, gy + 1)));
  for (let gx = 48; gx < 54; gx += 2) g.lineBetween(...pair(toWorld(gx + 0.2, 20), toWorld(gx + 1, 20)));
  // the lots for machines: a light empty tile each (a machine is drawn on it by idleView.ts once it is bought, a plus shows when it can be)
  for (const s of SLOTS) poly(g, corners(s.rect), LOT);

  // ---- the blocks ----
  const items: Item[] = [];
  const box = (x: number, y: number, w: number, d: number, h: number, color: number): Item => ({ depth: x + y + w + d, run: (gr) => drawBox(gr, toWorld, x, y, w, d, h, color) });
  const rectBox = (r: TileRect, h: number, color: number, inset = 0): Item => box(r.gx0 + inset, r.gy0 + inset, r.gx1 - r.gx0 + 1 - 2 * inset, r.gy1 - r.gy0 + 1 - 2 * inset, h, color);

  // the trees are not here: every one of them is a plot the workers tend (idleView.ts), on the grid of FOREST_TREES

  // the places where pieces wait are low pads; the pieces on them are drawn by idleView.ts
  items.push(rectBox(LANDING, PAD_H, 0xc9a36a, 0.15));
  items.push(rectBox(PILE, PAD_H, 0xc08b52, 0.1));
  items.push(rectBox(STORAGE, PAD_H, 0xe0c690, 0.12));
  items.push(rectBox(LOADING_YARD, PAD_H, 0xf0dca4, 0.2));
  // every machine stands turned along the flow: a belt runs through it from its left side to its right side
  const belt = (r: TileRect) => items.push(box(r.gx0 - 0.7, r.gy0 + 1.1, r.gx1 - r.gx0 + 2.4, 0.8, 16, 0x4a4a4a));
  belt(DEBARKER);
  items.push(rectBox(DEBARKER, 110, 0xd9814f));
  // the back wall of the shed and its chimney
  items.push(box(SHED.gx0, SHED.gy0 - 1.2, SHED.gx1 - SHED.gx0 + 1, 0.4, 170, 0x9b7a55));
  items.push(box(38, SHED.gy0 - 1.3, 1, 1, 520, 0x8a8a8a));
  // the saws and planers are not here: they are bought one by one and drawn by idleView.ts (`drawMachine`), the lots stay empty until then

  for (const item of items) {
    const o = scene.add.graphics().setDepth(item.depth);
    world.add(o);
    item.run(o);
  }
}

/** How big a tree is next to the shapes it is drawn from below: a tile is 128 px wide, a tree crown now spans about one tile. Every tree has this size (a sapling only shrinks while it grows). */
export const TREE_SIZE = 0.6;

/** A tree standing at `p` (its foot). */
export function tree(g: Phaser.GameObjects.Graphics, p: Point): void {
  const s = TREE_SIZE;
  g.fillStyle(0x6b4a2b, 1).fillRect(p.x - 9 * s, p.y - 70 * s, 18 * s, 70 * s);
  g.fillStyle(0x2c6a36, 1).fillEllipse(p.x + 5 * s, p.y - 130 * s, 150 * s, 190 * s);
  g.fillStyle(0x3f8f4a, 1).fillEllipse(p.x, p.y - 138 * s, 140 * s, 180 * s);
  g.fillStyle(0x58ab5f, 1).fillEllipse(p.x - 22 * s, p.y - 160 * s, 60 * s, 80 * s);
}

/** What is left of a tree that has been cut down. */
export function stump(g: Phaser.GameObjects.Graphics, p: Point): void {
  const s = TREE_SIZE;
  g.fillStyle(0x6b4a2b, 1).fillRect(p.x - 12 * s, p.y - 22 * s, 24 * s, 22 * s);
  g.fillStyle(0xd9b27c, 1).fillEllipse(p.x, p.y - 22 * s, 24 * s, 10 * s);
}

/** The lumberjack standing at `p`. */
export function lumberjack(g: Phaser.GameObjects.Graphics, p: Point, shirt = 0xd0521e): void {
  g.fillStyle(0x000000, 0.15).fillEllipse(p.x, p.y, 70, 26);
  g.fillStyle(shirt, 1).fillRoundedRect(p.x - 22, p.y - 70, 44, 62, 10);
  g.fillStyle(0xf2c9a0, 1).fillCircle(p.x, p.y - 88, 22);
  g.fillStyle(0xffc83d, 1).fillRect(p.x - 25, p.y - 112, 50, 14);
}
