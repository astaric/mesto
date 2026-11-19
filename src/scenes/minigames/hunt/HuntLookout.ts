import Phaser from 'phaser';
import { W } from '../../../core/layout';
import { StageScene } from '../../../core/MiniGame';
import { Joystick } from '../../../core/Joystick';
import { huntSave } from '../../../core/huntSave';
import { earn } from '../../../core/profile';
import { sfx } from '../../../core/sfx';
import { starsFor } from '../../../core/stars';
import { INK } from '../../../core/theme';
import { tapButton, text } from '../../../core/touch';
import { counter, hudTitle, outlined, type Counter } from '../../../core/ui';
import { t } from '../../../i18n';
import { meadow } from '../barnyard/scenery';
import {
  CARRY_GOAL, DEER_HP, SHOOT_GOAL, Magazine, deerToSpawn, isWon, newHunt, onDeliver, onKill, onPickUp, pickTarget,
  type HuntState,
} from './huntLogic';
import { huntWeaponById, type HuntWeapon } from './huntWeapons';

// The lookout hunt. You sit in a hunting lookout on the left and shoot the deer wandering over the meadow (tap = shoot).
// The first ten deer stay where they fell: climb down, walk to one, carry it back to the lookout's ladder and climb up
// again. 60 deer shot and 10 carried is a win. Rules are in huntLogic.ts, the rifles in huntWeapons.ts.

const HORIZON = 700;               // y of the far edge of the grass
const FRONT = 1480;                // y of the near edge
const FEET = 0.96;                 // origin y of the hunter and the deer: where the feet are in the art
const HUNTER_K = 0.55;             // sprite scales: the art is rasterised at 1.5x (Boot), so these are relative to that
const TOWER_HUNTER_K = 0.45;       // the hunter up in the lookout is smaller: it has to fit under the roof
const DEER_K = 0.5;
const TX = 270;                    // the lookout: centre x ...
const FOOT = 1230;                 // ... and the y of the ground it stands on
const TOWER_S = 1.2;               // screen px per unit of lookout.svg (440 x 780 units)
const TOWER_K = TOWER_S / 1.5;
const PLATFORM_Y = FOOT - (780 - 326) * TOWER_S; // where the hunter stands up there
const LADDER = { x: TX + 220, y: 1250 };         // the foot of the ladder
const FIELD = { x0: 640, x1: W - 120, y0: HORIZON + 90, y1: FRONT - 30 }; // where the deer may be
const HERD = 6;                    // deer on the meadow at once
const JOY_ZONE_X = 750;            // the stick starts in the lower left, but only while walking on the ground
const WALK = 820;
const WALK_CARRYING = 560;
const PICKUP = { x: 150, y: 110 };
const DELIVER_R = 170;
const UP_R = 230;
const COINS_PER_DEER = 1;
const COINS_PER_DELIVERY = 2;

/** Perspective scale of things standing at depth y. */
const sc = (y: number): number => 0.45 + ((y - HORIZON) / (FRONT - HORIZON)) * 0.8;

interface Deer {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number;
  tx: number; ty: number;
  wait: number;
  phase: number;
  hp: number;
  moving: boolean;
  vx: number;
  fleeT: number;
  fleeX: number; fleeY: number;
}

interface Carcass {
  img: Phaser.GameObjects.Image;
  pool: Phaser.GameObjects.Image;
  marker?: Phaser.GameObjects.Text;
  x: number; y: number;
}

type Mode = 'tower' | 'ground';

export class HuntLookout extends StageScene {
  private state!: HuntState;
  private weapon!: HuntWeapon;
  private mag!: Magazine;
  private mode: Mode = 'tower';
  private done = false;
  private deer: Deer[] = [];
  private carcasses: Carcass[] = [];

  private hunter!: Phaser.GameObjects.Image;
  private hunterShadow!: Phaser.GameObjects.Ellipse;
  private carryImg!: Phaser.GameObjects.Image;
  private hx = LADDER.x; private hy = LADDER.y;
  private facing = 1;
  private faceLock = 0;
  private recoil = 0;
  private walkPhase = 0;
  private hold: { id: number; x: number; y: number } | null = null;

  private joy!: Joystick;
  private joyZone = { maxX: 0, minY: 700 };

  private shotC!: Counter;
  private carriedC!: Counter;
  private prompt!: Phaser.GameObjects.Text;
  private ammoGfx!: Phaser.GameObjects.Graphics;
  private actionBtn!: Phaser.GameObjects.Container;
  private actionLabel = '';
  /** While a delivered deer flies up to the lookout, its sprite is driven by that tween, not by the hunter. */
  private carryLocked = false;

  constructor() { super('HuntLookout'); }

  create(): void {
    this.state = newHunt();
    this.weapon = huntWeaponById(huntSave.weapon);
    this.mag = new Magazine(this.weapon);
    this.mode = 'tower'; this.done = false; this.deer = []; this.carcasses = [];
    this.hx = LADDER.x; this.hy = LADDER.y; this.facing = 1; this.faceLock = 0; this.recoil = 0; this.walkPhase = 0;
    this.hold = null; this.actionLabel = ''; this.carryLocked = false;
    this.joyZone.maxX = 0;

    this.backdrop(0x9fd4f5);
    this.buildWorld();

    this.hunterShadow = this.add.ellipse(0, 0, 200, 50, 0x000000, 0.3).setVisible(false);
    this.hunter = this.add.image(TX, PLATFORM_Y, 'hunter-1').setOrigin(0.5, FEET).setScale(TOWER_HUNTER_K).setDepth(FOOT + 1);
    this.carryImg = this.add.image(0, 0, 'deer-dead').setVisible(false);

    this.buildHud();
    this.joy = new Joystick(this, { r: 130, zone: this.joyZone });
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
    });

    // Dev only: `?deer=N` starts with N deer already shot (the first ten of them lying on the meadow).
    const pre = import.meta.env.DEV ? Math.max(0, Math.min(SHOOT_GOAL - 1, Number(new URLSearchParams(location.search).get('deer')) || 0)) : 0;
    for (let i = 0; i < pre; i++) {
      if (onKill(this.state)) {
        const c = this.addCarcass(Phaser.Math.Between(FIELD.x0 + 100, FIELD.x1), Phaser.Math.Between(FIELD.y0, FIELD.y1), Math.random() < 0.5, true, false);
        this.carcasses.push(c);
      }
    }
    this.shotC.set(this.state.shot);
    this.updatePrompt();

    for (let n = deerToSpawn(this.state, 0, HERD); n > 0; n--) this.spawn(true);
    this.time.addEvent({ delay: 700, loop: true, callback: () => {
      if (!this.done && deerToSpawn(this.state, this.deer.length, HERD) > 0) this.spawn(false);
    } });
  }

  // ---------- world and HUD ----------

  private buildWorld(): void {
    for (let i = 0; i < 6; i++) {
      this.add.image(i * 420 + Phaser.Math.Between(0, 200), Phaser.Math.Between(60, 340), 'cloud')
        .setScale(Phaser.Math.FloatBetween(0.5, 1.1)).setDepth(-90);
    }
    // The background is a forest: a dark band with two rows of pines in front of it, the far row darker.
    this.add.rectangle(0, HORIZON - 260, W, 280, 0x2f7a4a).setOrigin(0).setDepth(-70);
    for (const row of [{ y: HORIZON - 15, k: 0.45, tint: 0x7fa88a, depth: HORIZON - 20 }, { y: HORIZON + 25, k: 0.42, tint: 0xffffff, depth: HORIZON + 20 }]) {
      for (let x = -40; x < W + 80; x += 105) {
        const tex = Math.random() < 0.8 ? 'forest-pine' : 'tree';
        this.add.image(x + Phaser.Math.Between(-25, 25), row.y + Phaser.Math.Between(-12, 12), tex).setOrigin(0.5, 1)
          .setScale(row.k * Phaser.Math.FloatBetween(0.85, 1.1)).setTint(row.tint).setDepth(row.depth);
      }
    }
    meadow(this, HORIZON, 0x7fc46a, 0x6ab358);
    for (let i = 0; i < 90; i++) {
      const y = Phaser.Math.Between(HORIZON + 30, FRONT + 40);
      const tuft = this.add.image(Phaser.Math.Between(0, W), y, 'grass-tuft').setOrigin(0.5, 1)
        .setScale(sc(y) * Phaser.Math.FloatBetween(0.5, 1)).setDepth(y - 3);
      if (Math.random() < 0.4) tuft.setTint(0xd8f0a0);
    }
    this.add.ellipse(TX, FOOT, 640, 80, 0x000000, 0.25).setDepth(FOOT - 2);
    this.add.image(TX, FOOT, 'lookout').setOrigin(0.5, 1).setScale(TOWER_K).setDepth(FOOT);
  }

  private buildHud(): void {
    hudTitle(this, t('hunt.title'), { fade: true }).setDepth(1000);
    this.shotC = counter(this, SHOOT_GOAL);
    this.carriedC = counter(this, CARRY_GOAL);
    this.shotC.label.setPosition(W / 2 - 330, 240).setDepth(1000);
    this.carriedC.label.setPosition(W / 2 + 330, 240).setDepth(1000);
    outlined(text(this, W / 2 - 330, 315, t('hunt.shot'), 44), '#ffffff', 8).setDepth(1000);
    outlined(text(this, W / 2 + 330, 315, t('hunt.carried'), 44), '#ffffff', 8).setDepth(1000);
    this.prompt = outlined(text(this, W / 2, 420, '', 56), '#ffffff', 10).setDepth(1000);
    const hint = outlined(text(this, W / 2, 560, t('hunt.hint'), 50), '#ffffff', 8).setDepth(1000);
    this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 800 });
    this.ammoGfx = this.add.graphics().setDepth(5000);
    this.actionBtn = tapButton(this, W - 380, 1400, '', () => this.onAction()).setDepth(5000);
  }

  /** The climb button: "Down" in the lookout, "Up" at the foot of the ladder, nothing elsewhere. */
  private refreshButton(): void {
    let label = '';
    if (this.mode === 'tower') label = `⬇ ${t('hunt.down')}`;
    else if (!this.state.carrying && Math.hypot(this.hx - LADDER.x, (this.hy - LADDER.y) * 1.5) < UP_R) label = `⬆ ${t('hunt.up')}`;
    if (label === this.actionLabel) return;
    this.actionLabel = label;
    (this.actionBtn.list[1] as Phaser.GameObjects.Text).setText(label);
    this.actionBtn.setVisible(label !== '');
    if (label) this.actionBtn.setInteractive(); else this.actionBtn.disableInteractive();
  }

  private updatePrompt(): void {
    const s = this.state;
    this.prompt.setText(s.carrying ? t('hunt.deliver') : s.lying > 0 ? t('hunt.fetch') : '');
  }

  private drawAmmo(): void {
    const g = this.ammoGfx.clear();
    const n = this.weapon.mag, pw = 26, ph = 56, gap = 14;
    const x0 = W / 2 - (n * (pw + gap) - gap) / 2;
    for (let i = 0; i < n; i++) {
      const full = i < this.mag.ammo;
      g.fillStyle(full ? 0xffd23f : 0xffffff, full ? 1 : 0.25).fillRoundedRect(x0 + i * (pw + gap), 1430, pw, ph, 8);
      g.lineStyle(5, INK, full ? 1 : 0.4).strokeRoundedRect(x0 + i * (pw + gap), 1430, pw, ph, 8);
    }
    if (this.mag.reloading) {
      g.fillStyle(0xffffff, 0.5).fillRoundedRect(W / 2 - 150, 1500, 300, 14, 7);
      g.fillStyle(0x3fa7ff).fillRoundedRect(W / 2 - 150, 1500, 300 * this.mag.reloadProgress, 14, 7);
    }
    this.ammoGfx.setAlpha(this.mode === 'tower' ? 1 : 0.35);
  }

  // ---------- climbing ----------

  private onAction(): void {
    if (this.done) return;
    if (this.mode === 'tower') {
      this.mode = 'ground';
      this.hx = LADDER.x; this.hy = LADDER.y; this.facing = 1;
      this.hold = null;
      this.joy.reset();
      this.joyZone.maxX = JOY_ZONE_X;
    } else if (!this.state.carrying) {
      this.mode = 'tower';
      this.facing = 1;
      this.joy.reset();
      this.joyZone.maxX = 0;
    }
  }

  // ---------- input and shooting ----------

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.done || this.mode !== 'tower' || over.length > 0) return;
    if (this.weapon.auto) this.hold = { id: p.id, x: p.x, y: p.y };
    this.shoot(p.x, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.hold && this.hold.id === p.id) { this.hold.x = p.x; this.hold.y = p.y; }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.hold && this.hold.id === p.id) this.hold = null;
  }

  private muzzle(): { x: number; y: number } {
    const s = this.hunter.scaleX;
    return {
      x: this.hunter.x + this.facing * (0.97 - 0.5) * this.hunter.width * s,
      y: this.hunter.y - (FEET - 0.31) * this.hunter.height * s,
    };
  }

  private shoot(wx: number, wy: number): void {
    if (this.done || this.mode !== 'tower') return;
    if (!this.mag.fire(this.time.now)) {
      if (this.mag.reloading && !this.weapon.auto) sfx.click();
      return;
    }
    const w = this.weapon;
    this.facing = wx >= TX ? 1 : -1;
    this.faceLock = 0.45;
    this.recoil = 1;
    sfx[w.sound]();
    if (this.mag.reloading) this.time.delayedCall(250, () => sfx.reload());

    const m = this.muzzle();
    const flash = this.add.circle(m.x, m.y, 45, 0xfff3a0).setDepth(3000);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 130, onComplete: () => flash.destroy() });
    const tracer = this.add.graphics().setDepth(2999);
    tracer.lineStyle(6, 0xfff3a0, 0.9).lineBetween(m.x, m.y, wx, wy);
    this.tweens.add({ targets: tracer, alpha: 0, duration: 140, onComplete: () => tracer.destroy() });
    const ch = this.add.image(wx, wy, 'crosshair').setScale(0.5).setDepth(3000);
    this.tweens.add({ targets: ch, alpha: 0, scale: 0.8, duration: 350, onComplete: () => ch.destroy() });

    const targets = this.deer.map((d) => ({ x: d.x, y: d.y - d.img.displayHeight * 0.45, scale: sc(d.y) }));
    const i = pickTarget(targets, wx, wy, w.radius);
    this.startle(wx, wy, 450, 1.2);   // the shot scares the deer around it
    if (i >= 0) this.damage(this.deer[i], w.dmg, wx, wy);
    else this.state.misses += 1;
  }

  // ---------- deer ----------

  private spawn(anywhere: boolean): void {
    const x = anywhere ? Phaser.Math.Between(FIELD.x0 + 250, FIELD.x1) : Phaser.Math.Between(FIELD.x1 - 300, FIELD.x1);
    const y = Phaser.Math.Between(FIELD.y0, FIELD.y1);
    const shadow = this.add.ellipse(x, y, 200, 44, 0x000000, 0.28);
    const img = this.add.image(x, y, 'deer-1').setOrigin(0.5, FEET);
    if (!anywhere) { img.setAlpha(0); shadow.setAlpha(0); this.tweens.add({ targets: [img, shadow], alpha: 1, duration: 500 }); }
    this.deer.push({
      img, shadow, x, y, tx: x, ty: y, wait: Math.random() * 2, phase: Math.random() * 4, hp: DEER_HP,
      moving: false, vx: -1, fleeT: 0, fleeX: -1, fleeY: 0,
    });
  }

  /** Make the deer within `r` px of (sx, sy) run away from that point for `secs`. */
  private startle(sx: number, sy: number, r: number, secs: number): void {
    for (const d of this.deer) {
      const dx = d.x - sx, dy = (d.y - sy) * 2;
      const dist = Math.hypot(dx, dy);
      if (dist > r) continue;
      d.fleeT = Math.max(d.fleeT, secs);
      d.fleeX = dx / (dist || 1) || -1;
      d.fleeY = dy / (dist || 1) / 2;
    }
  }

  private damage(d: Deer, dmg: number, sx: number, sy: number): void {
    d.hp -= dmg;
    if (d.hp <= 0) { this.kill(d); return; }
    sfx.hurt();
    d.img.setTint(0xff8a8a);
    this.time.delayedCall(160, () => d.img.clearTint());
    d.fleeT = 1.8;                    // a wounded deer bolts away from the shot
    const dx = d.x - sx || -1;
    d.fleeX = Math.sign(dx) * 0.9; d.fleeY = (Math.sign(d.y - sy) || 1) * 0.4;
  }

  private kill(d: Deer): void {
    this.deer = this.deer.filter((x) => x !== d);
    const flip = d.vx < 0;
    d.img.destroy(); d.shadow.destroy();
    sfx.hurt();
    const keep = onKill(this.state);
    earn(COINS_PER_DEER);
    this.shotC.set(this.state.shot);
    const c = this.addCarcass(d.x, d.y, flip, keep, true);
    if (keep) {
      this.carcasses.push(c);
    } else {
      this.tweens.add({ targets: [c.img, c.pool], alpha: 0, delay: 1000, duration: 600, onComplete: () => { c.img.destroy(); c.pool.destroy(); } });
    }
    this.updatePrompt();
    this.checkWin();
  }

  /** A deer lying on the meadow. `marker`: a bobbing arrow shows it is one to fetch. `fall`: it drops down first. */
  private addCarcass(x: number, y: number, flip: boolean, marker: boolean, fall = false): Carcass {
    const s = DEER_K * sc(y);
    const pool = this.add.image(x, y - 6, 'blood-pool').setDepth(y - 2).setAlpha(0.9).setScale(fall ? 0 : sc(y) * 0.85);
    if (fall) this.tweens.add({ targets: pool, scale: sc(y) * 0.85, duration: 700, ease: 'Quad.out' });
    const img = this.add.image(x, y, 'deer-dead').setOrigin(0.5, 0.9).setFlipX(flip).setDepth(y).setScale(s, fall ? 0.05 : s);
    if (fall) this.tweens.add({ targets: img, scaleY: s, duration: 260, ease: 'Back.out' });
    const c: Carcass = { img, pool, x, y };
    if (marker) {
      c.marker = outlined(text(this, x, y - 230 * sc(y), '▼', 90), '#ffd23f', 10).setDepth(1500);
      this.tweens.add({ targets: c.marker, y: c.marker.y + 24, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    return c;
  }

  private updateDeer(d: Deer, dt: number): void {
    let vx = 0, vy = 0;
    if (d.fleeT > 0) {
      d.fleeT -= dt;
      const sp = 560 * sc(d.y);
      vx = d.fleeX * sp; vy = d.fleeY * sp * 0.6;
      d.moving = true;
      if ((d.x <= FIELD.x0 && d.fleeX < 0) || (d.x >= FIELD.x1 && d.fleeX > 0)) d.fleeX = -d.fleeX;
      if ((d.y <= FIELD.y0 && d.fleeY < 0) || (d.y >= FIELD.y1 && d.fleeY > 0)) d.fleeY = -d.fleeY;
    } else if (d.wait > 0) {
      d.wait -= dt;
      d.moving = false;
      if (d.wait <= 0) {
        d.tx = Phaser.Math.Clamp(d.x + Phaser.Math.Between(-450, 450), FIELD.x0, FIELD.x1);
        d.ty = Phaser.Math.Clamp(d.y + Phaser.Math.Between(-200, 200), FIELD.y0, FIELD.y1);
      }
    } else {
      const ex = d.tx - d.x, ey = d.ty - d.y;
      const dist = Math.hypot(ex, ey);
      if (dist < 12) { d.wait = Phaser.Math.FloatBetween(1, 3.5); d.moving = false; }
      else { const sp = 110 * sc(d.y); vx = (ex / dist) * sp; vy = (ey / dist) * sp * 0.6; d.moving = true; }
    }
    d.x = Phaser.Math.Clamp(d.x + vx * dt, FIELD.x0, FIELD.x1);
    d.y = Phaser.Math.Clamp(d.y + vy * dt, FIELD.y0, FIELD.y1);
    if (Math.abs(vx) > 5) d.vx = Math.sign(vx);

    if (d.moving) d.phase += dt * (d.fleeT > 0 ? 11 : 4);
    else d.phase = Math.floor(d.phase / 2) * 2;      // stand on frame 1
    const bob = d.moving ? Math.abs(Math.sin(d.phase * Math.PI)) * (d.fleeT > 0 ? 16 : 5) * sc(d.y) : 0;
    d.img.setTexture(`deer-${(Math.floor(d.phase) % 2) + 1}`).setPosition(d.x, d.y - bob).setScale(DEER_K * sc(d.y)).setFlipX(d.vx < 0).setDepth(d.y);
    d.shadow.setPosition(d.x, d.y).setDisplaySize(d.img.displayWidth * 0.75, 44 * sc(d.y)).setDepth(d.y - 2);
  }

  // ---------- carrying ----------

  private tryPickUp(): void {
    if (this.state.carrying) return;
    const c = this.carcasses.find((k) => Math.abs(k.x - this.hx) < PICKUP.x && Math.abs(k.y - this.hy) < PICKUP.y);
    if (!c || !onPickUp(this.state)) return;
    this.carcasses = this.carcasses.filter((k) => k !== c);
    c.img.destroy(); c.pool.destroy(); c.marker?.destroy();
    this.carryImg.setVisible(true).setAlpha(1);
    sfx.pop();
    this.updatePrompt();
  }

  private tryDeliver(): void {
    if (!this.state.carrying) return;
    if (Math.hypot(this.hx - LADDER.x, (this.hy - LADDER.y) * 1.5) > DELIVER_R) return;
    if (!onDeliver(this.state)) return;
    earn(COINS_PER_DELIVERY);
    this.carriedC.set(this.state.carried);
    sfx.coin();
    this.tweens.add({
      targets: this.carryImg, x: TX, y: PLATFORM_Y - 120, alpha: 0, scale: 0.2, duration: 500, ease: 'Cubic.in',
      onComplete: () => this.carryImg.setVisible(false),
    });
    this.carryLocked = true;
    this.time.delayedCall(520, () => { this.carryLocked = false; });
    const coin = this.add.image(this.hx, this.hy - 260, 'coin').setScale(0.6).setDepth(3000);
    this.tweens.add({ targets: coin, y: coin.y - 200, alpha: 0, duration: 900, onComplete: () => coin.destroy() });
    this.updatePrompt();
    this.checkWin();
  }

  private checkWin(): void {
    if (this.done || !isWon(this.state)) return;
    this.done = true;
    this.joy.reset();
    this.hold = null;
    this.time.delayedCall(700, () => this.win(starsFor(this.state.misses, [20, 50]), { message: 'hunt.win' }));
  }

  // ---------- loop ----------

  private updateHunter(dt: number): void {
    this.faceLock = Math.max(0, this.faceLock - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);

    if (this.mode === 'tower') {
      this.hunterShadow.setVisible(false);
      this.hunter.setTexture('hunter-1').setPosition(TX - this.facing * this.recoil * 10, PLATFORM_Y)
        .setScale(TOWER_HUNTER_K).setFlipX(this.facing < 0).setDepth(FOOT + 1);
      return;
    }

    const { x: ix, y: iy } = this.joy.read();
    const mag = Math.hypot(ix, iy);
    const moving = !this.done && mag > 0.15;
    if (moving) {
      const speed = this.state.carrying ? WALK_CARRYING : WALK;
      this.hx = Phaser.Math.Clamp(this.hx + ix * speed * dt, 120, W - 120);
      this.hy = Phaser.Math.Clamp(this.hy + iy * speed * 0.5 * dt, HORIZON + 60, FRONT);
      this.walkPhase += dt * 8 * Math.max(0.5, mag);
      if (Math.abs(ix) > 0.15) this.facing = ix > 0 ? 1 : -1;
    }
    const s = HUNTER_K * sc(this.hy);
    const bob = moving ? Math.abs(Math.sin(this.walkPhase * Math.PI)) * 10 * sc(this.hy) : 0;
    this.hunter.setTexture(moving ? `hunter-${(Math.floor(this.walkPhase) % 2) + 1}` : 'hunter-1')
      .setPosition(this.hx, this.hy - bob).setScale(s).setFlipX(this.facing < 0).setDepth(this.hy);
    this.hunterShadow.setVisible(true).setPosition(this.hx, this.hy).setDisplaySize(190 * sc(this.hy), 48 * sc(this.hy)).setDepth(this.hy - 2);
    if (this.state.carrying && !this.carryLocked) {
      this.carryImg.setVisible(true).setAlpha(1)
        .setPosition(this.hx, this.hy - bob - this.hunter.displayHeight * 0.68)
        .setScale(s * 0.85).setFlipX(this.facing < 0).setDepth(this.hy + 1);
    }
    this.tryPickUp();
    this.tryDeliver();
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.mag.update(dt);
    this.updateHunter(dt);
    for (const d of [...this.deer]) this.updateDeer(d, dt);
    if (this.hold && this.weapon.auto && !this.done) this.shoot(this.hold.x, this.hold.y);
    this.drawAmmo();
    this.refreshButton();
  }
}
