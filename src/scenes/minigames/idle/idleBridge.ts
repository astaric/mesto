import Phaser from 'phaser';
import { drawBox } from './idleDraw';
import { toWorld } from './idleIso';
import { slotRect, type SlotIndex } from './idleLayout';
import { BELT_END } from './idleSawPose';
import { BELT_W } from './idleTransfer';

// The conveyors across the aisle F3 (idleTransfer.ts has the route): one straight belt in every column that has both a saw 1 and a saw 2, from the end of the saw 1's belt to the start of the saw 2's.
// Every belt is its own flat game object with the depth of its front corner, like the rest of the static world. They are rebuilt whenever a saw 1 or a saw 2 is added.

const BELT_Z = 16, BELT = 0x4a4a4a;
/** The belt of a machine lies at lane y + this, 0.8 wide (the same as drawSawBase's and drawMachine's). */
const LANE = 1.1;
/** A saw 1's belt ends this far from its left edge, a saw 2's belt starts this far before its left edge (idleSaw.ts, idleDraw.ts). */
const SAW1_END = BELT_END, SAW2_START = -0.7;

export interface Bridge { key: string; objs: Phaser.GameObjects.Graphics[]; /** the depth a log riding it is drawn at */ depth: number }

/** The key of what the bridge is made of: the slots that have a saw 1 and a saw 2. */
export const bridgeKey = (slots: readonly SlotIndex[]): string => slots.join('');

export function buildBridge(scene: Phaser.Scene, world: Phaser.GameObjects.Layer, slots: readonly SlotIndex[]): Bridge {
  const objs: Phaser.GameObjects.Graphics[] = [];
  let depth = 0;
  for (const i of slots) {
    const a = slotRect(1, i), b = slotRect(2, i), x = a.gx0 + SAW1_END, w = b.gx0 + SAW2_START - x, y = a.gy0 + LANE;
    const g = scene.add.graphics().setDepth(x + w + y + BELT_W - 0.5);
    world.add(g);
    drawBox(g, toWorld, x, y, w, BELT_W, BELT_Z, BELT);
    objs.push(g);
    depth = Math.max(depth, x + w + y + BELT_W);
  }
  return { key: bridgeKey(slots), objs, depth: depth + 0.5 };
}

export const destroyBridge = (b: Bridge): void => b.objs.forEach((g) => g.destroy());
