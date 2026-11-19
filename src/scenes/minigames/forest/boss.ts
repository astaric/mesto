import Phaser from 'phaser';
import { sfx } from '../../../core/sfx';
import { DEFS } from './forestData';
import type { Ent, RunState } from './state';

// The demon that ends the hell: it flies in, hovers and swings left and right, and hurls fireballs the player must dodge.

const BOSS_Z = 2000;                          // the demon hovers at this distance
const LANES = [-330, 0, 330];                 // fireball lanes (the player can strafe to +-MAX_CAM)

/** What the boss needs from the scene. */
export interface BossHost {
  time: Phaser.Time.Clock;
  run: RunState;
  spawn: (kind: 'fireball', z: number, x: number) => Ent;
  /** The speed-up from quests done, which fireballs share with other enemies. */
  speedUp: () => number;
}

export function updateDemon(h: BossHost, e: Ent, dt: number, run: number): void {
  const arriving = e.z > BOSS_Z;
  e.z = arriving ? Math.max(BOSS_Z, e.z - 700 * dt) : BOSS_Z;
  e.x = Math.sin(e.t * 0.7) * 330;
  e.lift = 40 + Math.sin(e.t * 2.2) * 30;
  if (arriving) { e.throwT = 2; return; }

  e.throwT -= dt;
  if (e.throwT > 0 || e.windup) return;
  const enraged = e.hp <= DEFS.demon.hp / 2;
  e.windup = true;
  sfx.roar();
  e.img.setTint(0xff5050);   // the warning: it turns red just before it attacks
  h.time.delayedCall(550, () => {
    e.windup = false;
    if (h.run.over || !h.run.ents.includes(e)) return;
    e.img.clearTint();
    attack(h, e, enraged, run);
    e.throwT = enraged ? 1.7 : 2.6;
  });
}

function attack(h: BossHost, e: Ent, enraged: boolean, run: number): void {
  e.atk++;
  sfx.fireball();
  /** A fireball that starts at the demon and arrives at `lane` (world x) when it reaches the player. */
  const fire = (lane: number): void => {
    const f = h.spawn('fireball', e.z - 30, e.x);
    f.vx = (lane - e.x) / Math.max(0.5, f.z / (run + DEFS.fireball.v * h.speedUp()));
  };
  /** Two of the three lanes are covered, one is free: the player strafes into the gap. */
  const wall = (): void => {
    const free = Phaser.Math.Between(0, LANES.length - 1);
    LANES.forEach((x, i) => { if (i !== free) fire(x); });
  };
  const pattern = enraged ? [1, 2, 0][e.atk % 3] : [0, 1][e.atk % 2];
  if (pattern === 0) fire(h.run.camX);
  else if (pattern === 1) wall();
  else {
    wall();
    h.time.delayedCall(900, () => { if (!h.run.over && h.run.ents.includes(e)) { sfx.fireball(); wall(); } });
  }
}
