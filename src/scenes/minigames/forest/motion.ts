import Phaser from 'phaser';
import type { Def } from './forestData';

/** The part of an entity that `stepMotion` reads and writes (no Phaser objects: this is plain maths). */
export interface Motion { x: number; baseX: number; z: number; lift: number; vx: number; t: number }

/** Distance (z) inside which a thing stops steering towards the player. */
const HOMING_STOPS_AT = 700;

/** Move one thing for `dt` seconds as its `Def.move` describes. `camX` is where the player is.
 *  The caller has already advanced `e.t` and `e.z`. */
export function stepMotion(e: Motion, def: Def, dt: number, camX: number): void {
  const m = def.move;
  if (!m) return;
  if (m.drift) {
    e.x += e.vx * dt;
  } else {
    if (m.homing && e.z > HOMING_STOPS_AT) e.baseX += Phaser.Math.Clamp(camX - e.baseX, -m.homing * dt, m.homing * dt);
    e.x = e.baseX + (m.sway ? Math.sin(e.t * m.sway[0]) * m.sway[1] : 0);
  }
  if (m.bob) e.lift = def.lift + Math.sin(e.t * m.bob[0]) * m.bob[1];
  if (m.hop) e.lift = Math.abs(Math.sin(e.t * m.hop[0])) * m.hop[1];
  if (m.drop) e.lift = Math.max(0, e.lift - m.drop.speed * dt);
}
