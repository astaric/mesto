import type Phaser from 'phaser';
import type { Kind } from './forestData';
import type { Weapon } from './weapons';

export const MAX_HEARTS = 5;

/** One thing on the path: an enemy, a pickup or a projectile. Its position is world x/z, `lift` is height in world units. */
export interface Ent {
  kind: Kind;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; z: number;
  lift: number;
  baseX: number;          // the lane it follows; `x` adds the sway on top
  hp: number;
  vx: number;
  t: number;
  bs: number;             // base scale (display width at s=1 / texture width)
  throwT: number;         // throw / attack cooldown
  flash: number;
  flashed: boolean;
  counted: boolean;       // bunny already saved
  atk: number;            // demon: attacks made so far
  windup: boolean;        // demon: about to attack
}

/** Everything that changes during one run. `newRun()` makes a fresh one in `create()`, so "Play again" cannot
 *  keep anything over from the last run. (Display objects live in the scene, backdrop and HUD, not here.) */
export interface RunState {
  ents: Ent[];
  camX: number;          // strafe position
  distU: number;         // distance run, in 1/100 m
  metAcc: number;        // metres not yet reported to the quests
  bendAmt: number;       // how much the path curves now
  hearts: number;
  ammo: number;
  reloadT: number;       // seconds of reload left
  nextShot: number;      // scene time (ms) the next shot is allowed
  score: number;
  spawnT: number;        // seconds until the director spawns again
  noHit: number;         // metres since the player was last hurt
  bossSpawned: boolean;
  over: boolean;
  recoil: number;
  holdId: number | null; // pointer that is shooting (auto weapons keep firing)
  holdX: number;
  holdY: number;
}

export function newRun(startM: number, weapon: Weapon): RunState {
  return {
    ents: [], camX: 0, distU: startM * 100, metAcc: 0, bendAmt: 0,
    hearts: MAX_HEARTS, ammo: weapon.mag, reloadT: 0, nextShot: 0,
    score: 0, spawnT: 1.2, noHit: 0, bossSpawned: false, over: false,
    recoil: 0, holdId: null, holdX: 0, holdY: 0,
  };
}
