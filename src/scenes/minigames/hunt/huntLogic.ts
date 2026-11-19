// The rules of the lookout hunt, without Phaser: 60 deer to shoot from the lookout, 10 of them to carry back to it.

export const SHOOT_GOAL = 60;
export const CARRY_GOAL = 10;
export const DEER_HP = 2;

export interface HuntState {
  shot: number;       // deer shot so far
  carried: number;    // deer delivered to the lookout
  lying: number;      // carcasses on the meadow, waiting to be fetched
  carrying: boolean;  // the hunter has a deer on their back
  misses: number;     // shots that hit nothing
}

export function newHunt(): HuntState { return { shot: 0, carried: 0, lying: 0, carrying: false, misses: 0 }; }

/** Does the deer that falls now stay on the ground to be fetched? The first ten do, so the hunt can always be won;
 *  the rest just disappear. */
export function keepsCarcass(s: HuntState): boolean {
  return s.carried + s.lying + (s.carrying ? 1 : 0) < CARRY_GOAL;
}

/** A deer fell. Returns whether it stays on the meadow. */
export function onKill(s: HuntState): boolean {
  const keep = keepsCarcass(s);
  s.shot += 1;
  if (keep) s.lying += 1;
  return keep;
}

/** The hunter picked a carcass up (only one at a time). */
export function onPickUp(s: HuntState): boolean {
  if (s.carrying || s.lying <= 0) return false;
  s.lying -= 1;
  s.carrying = true;
  return true;
}

/** The hunter reached the lookout with the deer on their back. */
export function onDeliver(s: HuntState): boolean {
  if (!s.carrying) return false;
  s.carrying = false;
  s.carried += 1;
  return true;
}

export function isWon(s: HuntState): boolean { return s.shot >= SHOOT_GOAL && s.carried >= CARRY_GOAL; }

/** Deer that still have to appear: none once enough are down, so the herd thins out at the end. */
export function deerToSpawn(s: HuntState, alive: number, wanted: number): number {
  const missing = SHOOT_GOAL - s.shot - alive;
  return Math.max(0, Math.min(wanted - alive, missing));
}

// ---------- the rifle ----------

/** Magazine, cooldown and reload of the weapon in hand. Time is in ms for `now` and seconds for `update`. */
export class Magazine {
  ammo: number;
  private reloadT = 0;
  private nextShot = 0;

  constructor(private readonly w: { mag: number; reload: number; cooldown: number }) { this.ammo = w.mag; }

  get reloading(): boolean { return this.reloadT > 0; }
  /** 0 just started reloading, 1 loaded. */
  get reloadProgress(): number { return this.reloadT > 0 ? 1 - this.reloadT / this.w.reload : 1; }

  canShoot(now: number): boolean { return this.reloadT <= 0 && this.ammo > 0 && now >= this.nextShot; }

  /** Take a shot if allowed. The last bullet starts the reload. */
  fire(now: number): boolean {
    if (!this.canShoot(now)) return false;
    this.ammo -= 1;
    this.nextShot = now + this.w.cooldown;
    if (this.ammo <= 0) this.reloadT = this.w.reload;
    return true;
  }

  update(dt: number): void {
    if (this.reloadT <= 0) return;
    this.reloadT -= dt;
    if (this.reloadT <= 0) { this.reloadT = 0; this.ammo = this.w.mag; }
  }
}

// ---------- hitting ----------

export interface Target { x: number; y: number; scale: number }

/** How far from a deer's centre a shot still counts: a far (small) deer is a bit more forgiving than its size. */
export function hitRadius(base: number, scale: number): number { return Math.max(base * 0.6, base * scale); }

/** Index of the nearest target under the shot, or -1. `y` of a target is the centre of its body. */
export function pickTarget(targets: readonly Target[], wx: number, wy: number, baseRadius: number): number {
  let best = -1;
  let bestD = Infinity;
  targets.forEach((t, i) => {
    const r = hitRadius(baseRadius, t.scale);
    const d = (t.x - wx) ** 2 + (t.y - wy) ** 2;
    if (d < r * r && d < bestD) { bestD = d; best = i; }
  });
  return best;
}
