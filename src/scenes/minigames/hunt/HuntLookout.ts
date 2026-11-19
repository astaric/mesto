import Phaser from 'phaser';
import { W, H } from '../../../core/layout';
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
import {
  CARRY_GOAL, canClimbDown, DEER_HP, SHOOT_GOAL, Magazine, deerToSpawn, hasLeft, isWon, leaveDir, newHunt, onDeliver, onKill, onPickUp, pickTarget,
  type HuntState,
} from './huntLogic';
import { huntWeaponById, type HuntWeapon } from './huntWeapons';

// The lookout hunt, always seen through the hunter's own eyes (first person: your rifle at the bottom of the screen, like
// the forest). In the lookout you shoot the deer wandering over the meadow (tap = shoot). The first ten deer stay where
// they fell: climb down, walk to one (the stick walks you freely over the meadow: sideways the view pans, forwards and
// back the things on the meadow come closer or drift away; the lookout stands in the field), carry it back to the lookout's ladder and climb up again. 60 deer shot and 10 carried is a win.
// Rules are in huntLogic.ts, the rifles in huntWeapons.ts.

const HORIZON = 700;               // y of the far edge of the grass
const FRONT = 1480;                // y of the near edge
const FEET = 0.96;                 // origin y of the deer: where the feet are in the art
const DEER_K = 0.5;                // sprite scale: the art is rasterised at 1.5x (Boot), so this is relative to that
const PAD = 1300;                  // the scenery reaches this far left and right of the screen: the view follows you on the ground
const TX = 270;                    // the lookout: centre x ...
const FOOT = 1230;                 // ... and the y of the ground it stands on
const TOWER_S = 1.2;               // screen px per unit of lookout.svg (440 x 780 units)
const TOWER_K = TOWER_S / 1.5;
const GUN_Y = H + 30;           // base of the rifle at the bottom of the screen (H + 30, like the forest)
const LADDER = { x: TX + 220, y: 1250 };         // the foot of the ladder (y is the depth you stand at on the ground)
const FIELD = { x0: 200, x1: W - 120, y0: HORIZON + 90, y1: FRONT - 30 }; // where the deer may be
const HZ_MIN = FIELD.y0 + 100;     // how far forward you can walk on the ground
const BEHIND = FRONT + 70;         // things this far down the screen are behind you
const HERD = 6;                    // deer on the meadow at once
const JOY_ZONE_X = 750;            // the stick starts in the lower left, but only while walking on the ground
const WALK = 820;
const WALK_CARRYING = 560;
const PICKUP_R = 170;              // how close you must be to a deer to pick it up: sideways ...
const PICKUP_Z = 150;              // ... and in depth
const DELIVER_R = 170;
const DELIVER_Z = 200;
const UP_R = 230;
const WOUNDED_TINT = 0xff8a8a;     // a deer that was hit once but is still alive
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
  moving: boolean;
  vx: number;
  fleeT: number;
  fleeX: number; fleeY: number;
  hp: number;
  dripT: number;             // seconds until a wounded deer drips blood again
  leaving: boolean;          // running off the meadow because the hunter came down
  leaveX: number; leaveY: number;
}

interface Carcass {
  img: Phaser.GameObjects.Image;
  pool: Phaser.GameObjects.Image;
  marker?: Phaser.GameObjects.Text;
  x: number; y: number;
  fall: number;      // 0..1: how far it has dropped to the ground (squash)
  poolK: number;     // 0..1: how big the blood pool has grown
  gone: boolean;
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

  private gun!: Phaser.GameObjects.Image;          // first person: your rifle at the bottom of the screen
  private towerImg!: Phaser.GameObjects.Image;    // the lookout seen from outside (only while on the ground)
  private towerShadow!: Phaser.GameObjects.Ellipse;
  private tufts: { img: Phaser.GameObjects.Image; z: number; k: number }[] = [];
  private corpses: Carcass[] = [];                   // every deer lying on the meadow, also those about to fade
  private carryImg!: Phaser.GameObjects.Image;
  private hx = LADDER.x;   // where you stand on the meadow when on the ground: sideways ...
  private hz = LADDER.y;   // ... and in depth (small = further from the viewer's start, i.e. walked forward)
  private oy = 0;          // how far the things on the meadow are pushed down the screen by walking forward
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
  private actionLabel: string | null = null;   // null: not set yet, so the first refresh always applies
  private arrowL!: Phaser.GameObjects.Text;
  private arrowR!: Phaser.GameObjects.Text;
  private arrowB!: Phaser.GameObjects.Text;
  /** While a delivered deer flies up to the lookout, its sprite is driven by that tween, not by the hunter. */
  private carryLocked = false;

  constructor() { super('HuntLookout'); }

  create(): void {
    this.state = newHunt();
    this.weapon = huntWeaponById(huntSave.weapon);
    this.mag = new Magazine(this.weapon);
    this.mode = 'tower'; this.done = false; this.deer = []; this.carcasses = [];
    this.hx = LADDER.x; this.hz = LADDER.y; this.oy = 0; this.recoil = 0; this.walkPhase = 0;
    this.tufts = []; this.corpses = [];
    this.hold = null; this.actionLabel = null; this.carryLocked = false;
    this.joyZone.maxX = 0;

    this.cameras.main.setScroll(0, 0);
    const before = this.children.length;
    this.backdrop(0x9fd4f5);
    for (const o of this.children.list.slice(before)) (o as Phaser.GameObjects.Image).setScrollFactor(0);   // the back button stays put
    this.buildWorld();

    // your own rifle at the bottom of the screen, and the deer on your shoulder when you carry one
    this.gun = this.add.image(W / 2, GUN_Y, this.weapon.tex).setOrigin(0.5, 1).setDepth(2000).setScrollFactor(0);
    this.gun.setScale(640 / this.gun.height);
    this.carryImg = this.add.image(W - 430, H - 190, 'deer-dead').setScale(0.9).setAngle(-12).setDepth(2100).setScrollFactor(0).setVisible(false);

    this.buildHud();
    this.applyMode();
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
      if (!this.done && this.mode === 'tower' && deerToSpawn(this.state, this.deer.length, HERD) > 0) this.spawn(false);
    } });
  }

  // ---------- world and HUD ----------

  private buildWorld(): void {
    for (let i = 0; i < 14; i++) {
      this.add.image(-PAD + i * 330 + Phaser.Math.Between(0, 200), Phaser.Math.Between(60, 340), 'cloud')
        .setScale(Phaser.Math.FloatBetween(0.5, 1.1)).setDepth(-90);
    }
    // The background is a forest: a dark band with two rows of pines in front of it, the far row darker.
    this.add.rectangle(-PAD, HORIZON - 260, W + 2 * PAD, 280, 0x2f7a4a).setOrigin(0).setDepth(-70);
    for (const row of [{ y: HORIZON - 15, k: 0.45, tint: 0x7fa88a, depth: HORIZON - 20 }, { y: HORIZON + 25, k: 0.42, tint: 0xffffff, depth: HORIZON + 20 }]) {
      for (let x = -PAD; x < W + PAD + 80; x += 105) {
        const tex = Math.random() < 0.8 ? 'forest-pine' : 'tree';
        this.add.image(x + Phaser.Math.Between(-25, 25), row.y + Phaser.Math.Between(-12, 12), tex).setOrigin(0.5, 1)
          .setScale(row.k * Phaser.Math.FloatBetween(0.85, 1.1)).setTint(row.tint).setDepth(row.depth);
      }
    }
    this.add.rectangle(-PAD, HORIZON, W + 2 * PAD, H - HORIZON + 60, 0x7fc46a).setOrigin(0);
    this.add.rectangle(-PAD, HORIZON - 20, W + 2 * PAD, 40, 0x6ab358).setOrigin(0);
    for (let i = 0; i < 230; i++) {
      const y = Phaser.Math.Between(HORIZON + 30, FRONT + 40);
      const k = Phaser.Math.FloatBetween(0.5, 1);
      const tuft = this.add.image(Phaser.Math.Between(-PAD, W + PAD), y, 'grass-tuft').setOrigin(0.5, 1)
        .setScale(sc(y) * k).setDepth(y - 3);
      if (Math.random() < 0.4) tuft.setTint(0xd8f0a0);
      this.tufts.push({ img: tuft, z: y, k });
    }
    // The lookout is seen from outside only once you climb down (up there you are inside it).
    this.towerShadow = this.add.ellipse(TX, FOOT, 640, 80, 0x000000, 0.25).setDepth(FOOT - 2);
    this.towerImg = this.add.image(TX, FOOT, 'lookout').setOrigin(0.5, 1).setScale(TOWER_K).setDepth(FOOT);
  }

  private buildHud(): void {
    hudTitle(this, t('hunt.title'), { fade: true }).setDepth(1000).setScrollFactor(0);
    this.shotC = counter(this, SHOOT_GOAL);
    this.carriedC = counter(this, CARRY_GOAL);
    this.shotC.label.setPosition(W / 2 - 330, 240).setDepth(1000).setScrollFactor(0);
    this.carriedC.label.setPosition(W / 2 + 330, 240).setDepth(1000).setScrollFactor(0);
    outlined(text(this, W / 2 - 330, 315, t('hunt.shot'), 44), '#ffffff', 8).setDepth(1000).setScrollFactor(0);
    outlined(text(this, W / 2 + 330, 315, t('hunt.carried'), 44), '#ffffff', 8).setDepth(1000).setScrollFactor(0);
    this.prompt = outlined(text(this, W / 2, 420, '', 56), '#ffffff', 10).setDepth(1000).setScrollFactor(0);
    const hint = outlined(text(this, W / 2, 560, t('hunt.hint'), 50), '#ffffff', 8).setDepth(1000).setScrollFactor(0);
    this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 800 });
    this.ammoGfx = this.add.graphics().setDepth(5000).setScrollFactor(0);
    this.actionBtn = tapButton(this, W - 380, 1400, '', () => this.onAction()).setDepth(5000).setScrollFactor(0);
    // on the ground: arrows to the deer (or the ladder) that are out of sight
    this.arrowL = outlined(text(this, 90, 900, '◀', 130), '#ffd23f', 12).setScrollFactor(0).setDepth(1000).setAlpha(0);
    this.arrowR = outlined(text(this, W - 90, 900, '▶', 130), '#ffd23f', 12).setScrollFactor(0).setDepth(1000).setAlpha(0);
    this.arrowB = outlined(text(this, W / 2 - 420, H - 170, '↓', 150), '#ffd23f', 12).setScrollFactor(0).setDepth(1000).setAlpha(0);
    for (const a of [this.arrowL, this.arrowR, this.arrowB]) this.tweens.add({ targets: a, scale: 1.2, duration: 450, yoyo: true, repeat: -1 });
  }

  /** The climb button: "Down" in the lookout, "Up" at the foot of the ladder, nothing elsewhere. */
  private refreshButton(): void {
    let label = '';
    if (this.mode === 'tower') label = canClimbDown(this.state) ? `⬇ ${t('hunt.down')}` : '';
    else if (!this.state.carrying && Math.abs(this.hx - LADDER.x) < UP_R && Math.abs(this.hz - LADDER.y) < DELIVER_Z) label = `⬆ ${t('hunt.up')}`;
    if (label === this.actionLabel) return;
    this.actionLabel = label;
    (this.actionBtn.list[1] as Phaser.GameObjects.Text).setText(label);
    this.actionBtn.setVisible(label !== '');
    if (label) this.actionBtn.setInteractive(); else this.actionBtn.disableInteractive();
  }

  private updatePrompt(): void {
    const s = this.state;
    this.prompt.setText(s.carrying ? t('hunt.deliver') : s.lying > 0 && (this.mode === 'ground' || canClimbDown(s)) ? t('hunt.fetch') : '');
  }

  private drawAmmo(): void {
    const g = this.ammoGfx.clear();
    const n = this.weapon.mag, pw = 26, ph = 56, gap = 14;
    const x0 = 150;                   // bottom left, so the rifle in the middle stays clear
    for (let i = 0; i < n; i++) {
      const full = i < this.mag.ammo;
      g.fillStyle(full ? 0xffd23f : 0xffffff, full ? 1 : 0.25).fillRoundedRect(x0 + i * (pw + gap), 1430, pw, ph, 8);
      g.lineStyle(5, INK, full ? 1 : 0.4).strokeRoundedRect(x0 + i * (pw + gap), 1430, pw, ph, 8);
    }
    if (this.mag.reloading) {
      g.fillStyle(0xffffff, 0.5).fillRoundedRect(150, 1500, 300, 14, 7);
      g.fillStyle(0x3fa7ff).fillRoundedRect(150, 1500, 300 * this.mag.reloadProgress, 14, 7);
    }
    this.ammoGfx.setAlpha(this.mode === 'tower' ? 1 : 0.35);
  }

  // ---------- climbing ----------

  /** Up in the lookout you hold your rifle; on the ground you also see the lookout, standing in the field. */
  private applyMode(): void {
    if (this.mode === 'tower') for (const a of [this.arrowL, this.arrowR, this.arrowB]) a.setAlpha(0);
    this.updateView(true);
  }

  /** Walking forward pushes everything on the meadow down the screen (and makes it bigger, the nearer it gets); things
   *  that end up behind you are hidden. Up in the lookout nothing is pushed. */
  private updateView(force = false): void {
    const oy = this.mode === 'ground' ? this.hz - FRONT : 0;
    if (force || oy !== this.oy) {
      this.oy = oy;
      for (const tf of this.tufts) {
        const sy = tf.z - oy;
        tf.img.setVisible(sy <= BEHIND).setY(sy).setScale(sc(sy) * tf.k).setDepth(sy - 3);
      }
    }
    const fy = FOOT - this.oy;
    const k = sc(fy) / sc(FOOT);
    const vis = this.mode === 'ground' && fy <= BEHIND + 120;
    this.towerShadow.setVisible(vis).setPosition(TX, fy).setScale(k).setDepth(fy - 2);
    this.towerImg.setVisible(vis).setPosition(TX, fy).setScale(TOWER_K * k).setDepth(fy);
    this.corpses = this.corpses.filter((c) => !c.gone);
    for (const c of this.corpses) this.placeCarcass(c);
  }

  private onAction(): void {
    if (this.done) return;
    if (this.mode === 'tower') {
      this.mode = 'ground';
      this.hx = LADDER.x; this.hz = LADDER.y;
      this.hold = null;
      this.joy.reset();
      this.joyZone.maxX = JOY_ZONE_X;
      this.applyMode();
      for (const d of this.deer) {                       // climbing down: all the other deer run off the meadow
        const v = leaveDir(d.x, d.y, this.hx, this.hz);
        d.leaving = true; d.leaveX = v.x; d.leaveY = v.y;
      }
    } else if (!this.state.carrying) {
      this.mode = 'tower';
      this.cameras.main.setScroll(0, 0);
      this.gun.setRotation(0).setY(GUN_Y);
      this.joy.reset();
      this.joyZone.maxX = 0;
      this.applyMode();
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

  private shoot(wx: number, wy: number): void {
    if (this.done || this.mode !== 'tower') return;
    if (!this.mag.fire(this.time.now)) {
      if (this.mag.reloading && !this.weapon.auto) sfx.click();
      return;
    }
    const w = this.weapon;
    this.recoil = 1;
    const rot = Phaser.Math.Clamp(Math.atan2(wx - W / 2, H - wy) * 0.6, -0.5, 0.5);
    this.gun.setRotation(rot);
    sfx[w.sound]();
    if (this.mag.reloading) this.time.delayedCall(250, () => sfx.reload());

    const m = { x: W / 2 + Math.sin(rot) * 600, y: GUN_Y - Math.cos(rot) * 600 }; // the rifle's muzzle
    const flash = this.add.circle(m.x, m.y, 45, 0xfff3a0).setDepth(3000);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 130, onComplete: () => flash.destroy() });
    const tracer = this.add.graphics().setDepth(2999);
    tracer.lineStyle(6, 0xfff3a0, 0.9).lineBetween(m.x, m.y, wx, wy);
    this.tweens.add({ targets: tracer, alpha: 0, duration: 140, onComplete: () => tracer.destroy() });
    const ch = this.add.image(wx, wy, 'crosshair').setScale(0.5).setDepth(3000);
    this.tweens.add({ targets: ch, alpha: 0, scale: 0.8, duration: 350, onComplete: () => ch.destroy() });

    const targets = this.deer.map((d) => ({ x: d.x, y: d.img.y - d.img.displayHeight * 0.45, scale: sc(this.sy(d.y)) }));
    const i = pickTarget(targets, wx, wy, w.radius);
    this.startle(wx, wy, 450, 1.2);   // the shot scares the deer around it
    if (i >= 0) this.damage(this.deer[i], w.dmg, wx, wy);
    else this.state.misses += 1;
  }

  // ---------- deer ----------

  private spawn(anywhere: boolean): void {
    const x = anywhere ? Phaser.Math.Between(FIELD.x0 + 250, FIELD.x1) : Phaser.Math.Between(FIELD.x1 - 300, FIELD.x1);
    const y = Phaser.Math.Between(FIELD.y0, FIELD.y1);
    const shadow = this.add.ellipse(x, this.sy(y), 200, 44, 0x000000, 0.28);
    const img = this.add.image(x, this.sy(y), 'deer-1').setOrigin(0.5, FEET);
    if (!anywhere) { img.setAlpha(0); shadow.setAlpha(0); this.tweens.add({ targets: [img, shadow], alpha: 1, duration: 500 }); }
    this.deer.push({
      img, shadow, x, y, tx: x, ty: y, wait: Math.random() * 2, phase: Math.random() * 4,
      moving: false, vx: -1, fleeT: 0, fleeX: -1, fleeY: 0, hp: DEER_HP, dripT: 0, leaving: false, leaveX: 1, leaveY: 0,
    });
  }

  /** Screen y of something standing at depth `z` on the meadow. */
  private sy(z: number): number { return z - this.oy; }

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

  /** A hit: with HP left the deer is wounded and bolts away from the shot, otherwise it falls. */
  private damage(d: Deer, dmg: number, shotX: number, shotY: number): void {
    d.hp -= dmg;
    if (d.hp <= 0) { this.kill(d); return; }
    sfx.hurt();
    d.img.setTint(WOUNDED_TINT);         // a wounded deer stays reddish, bleeds and limps from now on
    this.bleed(d, 7);
    d.fleeT = 1.8;
    d.fleeX = (Math.sign(d.x - shotX) || -1) * 0.9;
    d.fleeY = (Math.sign(this.sy(d.y) - shotY) || 1) * 0.4;
  }

  /** Drops of blood from a wounded deer: a burst when it is hit, a few now and then as it limps along. */
  private bleed(d: Deer, n: number): void {
    const sy = this.sy(d.y), k = sc(sy);
    for (let i = 0; i < n; i++) {
      const x = d.x + Phaser.Math.Between(-40, 40) * k;
      const y0 = sy - d.img.displayHeight * Phaser.Math.FloatBetween(0.25, 0.6);
      const drop = this.add.image(x, y0, 'blood-drop').setScale(Phaser.Math.FloatBetween(0.3, 0.6) * Math.max(0.6, k)).setDepth(sy + 4);
      this.tweens.add({ targets: drop, y: sy + Phaser.Math.Between(-10, 20), duration: 350, ease: 'Quad.in' });
      this.tweens.add({ targets: drop, alpha: 0, delay: 1400, duration: 700, onComplete: () => drop.destroy() });
    }
  }

  /** A deer that ran off the meadow is gone (it does not count as shot). */
  private removeDeer(d: Deer): void {
    this.deer = this.deer.filter((x) => x !== d);
    d.img.destroy(); d.shadow.destroy();
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
      this.tweens.add({ targets: [c.img, c.pool], alpha: 0, delay: 1000, duration: 600, onComplete: () => { c.img.destroy(); c.pool.destroy(); c.gone = true; } });
    }
    this.updatePrompt();
    this.checkWin();
  }

  /** A deer lying on the meadow. `marker`: a bobbing arrow shows it is one to fetch. `fall`: it drops down first. */
  private addCarcass(x: number, y: number, flip: boolean, marker: boolean, fall = false): Carcass {
    const pool = this.add.image(x, y, 'blood-pool').setAlpha(0.9);
    const img = this.add.image(x, y, 'deer-dead').setOrigin(0.5, 0.9).setFlipX(flip);
    const c: Carcass = { img, pool, x, y, fall: fall ? 0.05 : 1, poolK: fall ? 0 : 1, gone: false };
    if (fall) {
      this.tweens.add({ targets: c, poolK: 1, duration: 700, ease: 'Quad.out' });
      this.tweens.add({ targets: c, fall: 1, duration: 260, ease: 'Back.out' });
    }
    if (marker) c.marker = outlined(text(this, x, y, '▼', 90), '#ffd23f', 10);
    this.corpses.push(c);
    this.placeCarcass(c);
    return c;
  }

  /** Put a carcass where it is seen from where you are now. */
  private placeCarcass(c: Carcass): void {
    if (c.gone) return;
    const sy = this.sy(c.y), k = sc(sy), vis = sy <= BEHIND;
    c.img.setVisible(vis).setPosition(c.x, sy).setScale(DEER_K * k, DEER_K * k * c.fall).setDepth(sy);
    c.pool.setVisible(vis).setPosition(c.x, sy - 6).setScale(k * 0.85 * c.poolK).setDepth(sy - 2);
    c.marker?.setVisible(vis).setPosition(c.x, sy - 230 * k + Math.sin(this.time.now * 0.007) * 12).setDepth(1500);
  }

  private updateDeer(d: Deer, dt: number): void {
    let vx = 0, vy = 0;
    if (d.leaving) {
      const sp = 720 * Math.max(0.7, sc(this.sy(d.y)));
      vx = d.leaveX * sp; vy = d.leaveY * sp * 0.6;
      d.moving = true;
    } else if (d.fleeT > 0) {
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
      else {
        const sp = (d.hp < DEER_HP ? 70 : 110) * sc(d.y);   // a wounded deer limps
        vx = (ex / dist) * sp; vy = (ey / dist) * sp * 0.6; d.moving = true;
      }
    }
    if (d.leaving) {                                  // no fence: they run out of the meadow and are gone
      d.x += vx * dt; d.y += vy * dt;
      if (hasLeft(d.x, d.y, FIELD)) { this.removeDeer(d); return; }
    } else {
      d.x = Phaser.Math.Clamp(d.x + vx * dt, FIELD.x0, FIELD.x1);
      d.y = Phaser.Math.Clamp(d.y + vy * dt, FIELD.y0, FIELD.y1);
    }
    if (Math.abs(vx) > 5) d.vx = Math.sign(vx);

    const running = d.leaving || d.fleeT > 0;
    if (d.moving) d.phase += dt * (running ? 11 : 4);
    else d.phase = Math.floor(d.phase / 2) * 2;      // stand on frame 1
    const sy = this.sy(d.y), k = sc(sy), vis = sy <= BEHIND;
    if (d.hp < DEER_HP && d.moving && vis) {                         // a wounded deer leaves a trail of blood
      d.dripT -= dt;
      if (d.dripT <= 0) { d.dripT = 0.3; this.bleed(d, 1); }
    }
    const bob = d.moving ? Math.abs(Math.sin(d.phase * Math.PI)) * (running ? 16 : 5) * k : 0;
    d.img.setTexture(`deer-${(Math.floor(d.phase) % 2) + 1}`).setVisible(vis).setPosition(d.x, sy - bob).setScale(DEER_K * k).setFlipX(d.vx < 0).setDepth(sy);
    d.shadow.setVisible(vis).setPosition(d.x, sy).setDisplaySize(d.img.displayWidth * 0.75, 44 * k).setDepth(sy - 2);
  }

  // ---------- carrying ----------

  private tryPickUp(): void {
    if (this.state.carrying) return;
    const c = this.carcasses.find((k) => Math.abs(k.x - this.hx) < PICKUP_R && Math.abs(k.y - this.hz) < PICKUP_Z);
    if (!c || !onPickUp(this.state)) return;
    this.carcasses = this.carcasses.filter((k) => k !== c);
    c.img.destroy(); c.pool.destroy(); c.marker?.destroy(); c.gone = true;
    this.carryImg.setVisible(true).setAlpha(1);
    sfx.pop();
    this.updatePrompt();
  }

  private tryDeliver(): void {
    if (!this.state.carrying) return;
    if (Math.abs(this.hx - LADDER.x) > DELIVER_R || Math.abs(this.hz - LADDER.y) > DELIVER_Z) return;
    if (!onDeliver(this.state)) return;
    earn(COINS_PER_DELIVERY);
    this.carriedC.set(this.state.carried);
    sfx.coin();
    this.tweens.add({
      targets: this.carryImg, y: this.carryImg.y - 450, alpha: 0, scale: 0.3, duration: 500, ease: 'Cubic.in',
      onComplete: () => this.carryImg.setVisible(false),
    });
    this.carryLocked = true;
    this.time.delayedCall(520, () => { this.carryLocked = false; });
    const coin = this.add.image(W / 2, H * 0.6, 'coin').setScale(0.6).setDepth(3000).setScrollFactor(0);
    this.tweens.add({ targets: coin, y: coin.y - 200, alpha: 0, duration: 900, onComplete: () => coin.destroy() });
    this.updatePrompt();
    this.checkWin();
  }

  private checkWin(): void {
    if (this.done || !isWon(this.state)) return;
    this.done = true;
    this.cameras.main.setScroll(0, 0);   // the win banner is laid out in screen coordinates
    this.joy.reset();
    this.hold = null;
    this.time.delayedCall(700, () => this.win(starsFor(this.state.misses, [20, 50]), { message: 'hunt.win' }));
  }

  // ---------- loop ----------

  private updateHunter(dt: number): void {
    this.recoil = Math.max(0, this.recoil - dt * 6);

    if (this.mode === 'tower') {
      // first person: the rifle kicks back and settles
      this.gun.setY(GUN_Y + this.recoil * 40).setRotation(this.gun.rotation * 0.9)
        .setScale((640 / this.gun.height) * (1 + this.recoil * 0.05));
      return;
    }

    const { x: ix, y: iy } = this.joy.read();
    const mag = Math.hypot(ix, iy);
    const moving = !this.done && mag > 0.15;
    if (moving) {
      const speed = this.state.carrying ? WALK_CARRYING : WALK;
      this.hx = Phaser.Math.Clamp(this.hx + ix * speed * dt, 120, W - 120);
      this.hz = Phaser.Math.Clamp(this.hz + iy * speed * 0.5 * dt, HZ_MIN, FRONT);   // stick up = forward = smaller z
      this.walkPhase += dt * 8 * Math.max(0.5, mag);
    }
    if (!this.done) this.cameras.main.setScroll(this.hx - W / 2, 0);   // the view follows you
    // the rifle hangs low on the ground and sways as you walk
    this.gun.setY(GUN_Y + 170 + (moving ? Math.sin(this.walkPhase * Math.PI) * 14 : 0)).setRotation(0.12)
      .setScale(640 / this.gun.height);
    if (this.state.carrying && !this.carryLocked) this.carryImg.setVisible(true).setAlpha(1).setPosition(W - 430, H - 190).setScale(0.9);
    this.tryPickUp();
    this.tryDeliver();
    this.updateArrows();
  }

  /** Arrows at the edge of the screen towards what you are after (the nearest deer to fetch, or the ladder) while it is
   *  out of sight: left, right, or down when it is behind you. */
  private updateArrows(): void {
    let target: { x: number; z: number } | null = null;
    if (this.state.carrying) target = { x: LADDER.x, z: LADDER.y };
    else if (this.carcasses.length) {
      const dist = (c: Carcass): number => Math.hypot(c.x - this.hx, (c.y - this.hz) * 2);
      const c = this.carcasses.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      target = { x: c.x, z: c.y };
    }
    const sx = target ? target.x - this.cameras.main.scrollX : W / 2;
    const behind = target ? this.sy(target.z) > BEHIND : false;
    this.arrowL.setAlpha(target && sx < 0 ? 0.9 : 0);
    this.arrowR.setAlpha(target && sx > W ? 0.9 : 0);
    this.arrowB.setAlpha(target && behind && sx >= 0 && sx <= W ? 0.9 : 0);
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.mag.update(dt);
    this.updateHunter(dt);
    this.updateView();
    for (const d of [...this.deer]) this.updateDeer(d, dt);
    if (this.hold && this.weapon.auto && !this.done) this.shoot(this.hold.x, this.hold.y);
    this.drawAmmo();
    this.refreshButton();
  }
}
