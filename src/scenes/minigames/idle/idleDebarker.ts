import Phaser from 'phaser';
import { DEBARKER, LANE_GY, STATIONS } from './idleLayout';
import { PIECE_D, PIECE_H, PIECE_L, drawBox, hull, poly, shade } from './idleDraw';
import { toWorld, type Point } from './idleIso';

// The debarker (docs/minigames/idle-debarker-sample.svg, idea A): a belt runs through a thick ring with a hole; the trunk goes into the hole dark and
// comes out peeled (the belt runs along gy, so forklifts load it from the side) while four blades turn round it and bark chips fall. The belt, the ring and the pieces are separate game objects so that the dark
// half of the trunk can lie behind the ring and the peeled half in front of it (their depths are in the constants below).

/** The belt runs along gy through the middle of the machine's footprint (input end north, output end south, towards the viewer), centred on the forklift lane. */
export const BELT_X = DEBARKER.gx0 + (DEBARKER.gx1 - DEBARKER.gx0 + 1) / 2;
const LANE_Y = LANE_GY;
const BELT_Y0 = LANE_Y - 2.2, BELT_Y1 = LANE_Y + 2.2;
const BELT_W = 0.8, BELT_Z = 16;
/** The ring stands across the belt in the middle of the machine: this deep along the flow. */
export const RING_Y0 = LANE_Y - 0.175;
export const RING_Y1 = LANE_Y + 0.175;
const CZ = BELT_Z + PIECE_H / 2;
const RX = 0.47, RZ = RX * 64, RIX = 0.29, RIZ = RIX * 64;
const ORANGE = 0xd9814f, STEEL_L = 0xdfe4e8, HOLE = 0x2b2b2b, BARK = 0x6b4423, BELT = 0x4a4a4a;
/** A trunk lies on the belt at the input end where F1 puts it (centred on its station), and at the output end where F2 takes it (centred on its station). */
const START_Y = STATIONS.debarkerIn.pos.gy - PIECE_L / 2;
const END_Y = STATIONS.debarkerOut.pos.gy - PIECE_L / 2;
export const TRUNK_X = BELT_X - PIECE_D / 2;
export const OUT_Y = END_Y;

/** Depths: the back belt, the dark half of the trunk, the ring, the blades and chips, the front belt, then the peeled half and the finished pieces (idleView.ts). The back belt is low so that F1 and what it holds are drawn over it. */
export const DEPTH = { back: 29, dark: 31.4, ring: 31.65, fx: 31.9, front: 32.6, peeled: 34.2 } as const;

/** Where a trunk (its north end) is when it is `f` of the way through: from the belt's input end to its output end. */
export const trunkY = (f: number): number => START_Y + (END_Y - START_Y) * Math.min(1, Math.max(0, f));

const ring = (y: number, rx: number, rz: number): Point[] => Array.from({ length: 36 }, (_, i) => {
  const a = (i * Math.PI) / 18;
  return toWorld(BELT_X + rx * Math.cos(a), y, CZ + rz * Math.sin(a));
});

/** Creates the belt and the ring inside `world`. */
export function buildDebarker(scene: Phaser.Scene, world: Phaser.GameObjects.Layer): void {
  const make = (depth: number, run: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics().setDepth(depth);
    world.add(g);
    run(g);
  };
  const x0 = BELT_X - BELT_W / 2;
  make(DEPTH.back, (g) => drawBox(g, toWorld, x0, BELT_Y0, BELT_W, RING_Y0 - BELT_Y0, BELT_Z, BELT));
  make(DEPTH.ring, (g) => {
    drawBox(g, toWorld, BELT_X - RX - 0.05, RING_Y0 - 0.2, 0.16, 0.75, 8, 0x4f5963); // two feet under the ring
    drawBox(g, toWorld, BELT_X + RX - 0.11, RING_Y0 - 0.2, 0.16, 0.75, 8, 0x4f5963);
    poly(g, hull([...ring(RING_Y0, RX, RZ), ...ring(RING_Y1, RX, RZ)]), shade(ORANGE, 0.85));
    poly(g, ring(RING_Y1, RX, RZ), ORANGE);
    poly(g, ring(RING_Y1, RIX, RIZ), HOLE);
    for (let k = 0; k < 8; k++) { // bolts
      const a = k * Math.PI / 4 + 0.2, p = toWorld(BELT_X + 0.38 * Math.cos(a), RING_Y1, CZ + 0.38 * 64 * Math.sin(a));
      g.fillStyle(shade(ORANGE, 0.7), 1).fillCircle(p.x, p.y, 2.5);
    }
  });
  make(DEPTH.front, (g) => drawBox(g, toWorld, x0, RING_Y1, BELT_W, BELT_Y1 - RING_Y1, BELT_Z, BELT));
}

/** The four blades round the hole, turned `frame` steps, and (when `chips`) bark chips falling in front of the ring. */
export function drawBlades(g: Phaser.GameObjects.Graphics, frame: number, chips: boolean): void {
  g.clear();
  const a0 = frame * 0.6;
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2, tip = RIX - 0.12;
    const p = (ang: number, r: number): Point => toWorld(BELT_X + r * Math.cos(ang), RING_Y1, CZ + r * 64 * Math.sin(ang));
    poly(g, [p(a - 0.22, RIX), p(a + 0.22, RIX), p(a + 0.5, tip)], STEEL_L);
  }
  if (!chips) return;
  let seed = frame * 7919 + 13;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 7; i++) {
    drawBox(g, toWorld, BELT_X - 0.4 + rnd() * 0.8, RING_Y1 + 0.1 + rnd() * 0.9, 0.08, 0.1, 5, BARK, 2 + rnd() * 26);
  }
}

