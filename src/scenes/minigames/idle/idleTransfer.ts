import { X_IN } from './idlePlankPose';
import { X_OUT } from './idleSawPose';
import type { Tile } from './idleIso';
import { slotRect, type SlotIndex } from './idleLayout';

// The conveyor between a saw 1 and the saw 2 in the same slot of row 2 (Phaser-free, so that the rules can use it and it can be tested): a finished square log rides the belt that crosses the
// aisle F3 in a straight line along gx, out of its saw 1 and into the saw 2 standing in the same column. Logs never change column. Drawn by idleBridge.ts.

/** How fast the log rides the conveyor (tiles a second). */
export const TRANSFER_SPEED = 2;
/** The belt's width (tiles). */
export const BELT_W = 0.8;
/** Where the log's back-left corner is in y when it lies on a belt (the same as any machine's piece; the same number as `PIECE_D` in idleDraw.ts, which needs Phaser). */
const LOG_Y = 1.15 + (0.7 - 0.35) / 2;

/** The points the log's back-left corner goes through from where it lies at the end of the saw 1 in this slot to where it starts at the saw 2 of the same slot. */
export function transferRoute(slot: SlotIndex): Tile[] {
  const a = slotRect(1, slot), b = slotRect(2, slot), y = a.gy0 + LOG_Y;
  return [{ gx: a.gx0 + X_OUT, gy: y }, { gx: b.gx0 + X_IN, gy: y }];
}

export function routeLength(route: readonly Tile[]): number {
  let n = 0;
  for (let i = 1; i < route.length; i++) n += Math.abs(route[i].gx - route[i - 1].gx) + Math.abs(route[i].gy - route[i - 1].gy);
  return n;
}

/** Where the log is after riding `d` tiles of the route (clamped to its ends). */
export function routePoint(route: readonly Tile[], d: number): Tile {
  let left = Math.max(0, d);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], len = Math.abs(b.gx - a.gx) + Math.abs(b.gy - a.gy);
    if (left <= len) return len === 0 ? { ...b } : { gx: a.gx + ((b.gx - a.gx) * left) / len, gy: a.gy + ((b.gy - a.gy) * left) / len };
    left -= len;
  }
  return { ...route[route.length - 1] };
}

/** Seconds a log takes from the saw 1 to the saw 2 of this slot. */
export const transferS = (slot: SlotIndex): number => routeLength(transferRoute(slot)) / TRANSFER_SPEED;
