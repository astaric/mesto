import Phaser from 'phaser';
import { H, W } from '../../../core/layout';
import { StageScene } from '../../../core/MiniGame';
import { sfx } from '../../../core/sfx';
import { starsFor } from '../../../core/stars';
import { CREAM, INK } from '../../../core/theme';
import { text } from '../../../core/touch';
import { TITLE_FADE_MS, counter, hudTitle, outlined, type Counter } from '../../../core/ui';
import { t } from '../../../i18n';
import {
  MISS_LIMITS, NET_RADIUS, QUOTA, addCatch, aimAt, isDone, newCaught, nextKind, resolveCast,
  type Caught, type FishKind, type Net, type Swimmer,
} from './fishingLogic';

const WATER_Y = 700; // the surface
const FLOOR_Y = 1330; // the sand; the net buttons sit on it, so a tap below this line is not a cast
const SWIM = { y0: 880, y1: 1250 }; // where the fish swim
const BOAT = { x: 1024, scale: 0.6 }; // 0.6 * 1.5 = 0.9 px per unit of boat.svg
const HAND = { left: { x: 730, y: 585 }, right: { x: 1320, y: 585 } }; // where the nets leave the deck
const FLIGHT_MS = 380;
const MAX_FISH = 7;
const SPAWN_MS = 800;
/** A big fish is the old `fish` picture; a small one has its own. */
const TEXTURE: Record<FishKind, string> = { small: 'sea-fish-small', big: 'fish' };
const SIZE: Record<FishKind, number> = { small: 0.5, big: 0.45 };
const NET_DIAMETER = 0.9; // the mesh is this much of the net picture's width

interface Fish { kind: FishKind; img: Phaser.GameObjects.Image; vx: number; baseY: number; phase: number }
interface NetButton { net: Net; box: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics }

/** On a fishing boat: fish swim by under the boat, small ones and big ones. Pick the small or the big net, tap where
 *  a fish is and the net drops on it: only a net of the right size catches it. */
export class FishingBoat extends StageScene {
  private fish: Fish[] = [];
  private got: Caught = newCaught();
  private counters!: Record<FishKind, Counter>;
  private net: Net = 'small';
  private buttons: NetButton[] = [];
  private netBusy = false;
  private misses = 0;
  private done = false;
  private rope!: Phaser.GameObjects.Graphics;
  private ropeFrom: { x: number; y: number } | null = null;
  private ropeTo: Phaser.GameObjects.Container | null = null;

  constructor() { super('FishingBoat'); }

  create(): void {
    this.fish = []; this.got = newCaught(); this.net = 'small'; this.buttons = [];
    this.netBusy = false; this.misses = 0; this.done = false; this.ropeFrom = null; this.ropeTo = null;
    this.backdrop(0xbfe9ff);
    this.drawSea();
    this.addBoat();
    this.rope = this.add.graphics().setDepth(6);

    hudTitle(this, t('boat.title'), { fade: true });
    this.counters = { small: counter(this, QUOTA.small), big: counter(this, QUOTA.big) };
    this.counters.small.label.setX(W / 2 - 220);
    this.counters.big.label.setX(W / 2 + 430);
    this.add.image(W / 2 - 470, 240, TEXTURE.small).setScale(0.4);
    this.add.image(W / 2 + 140, 240, TEXTURE.big).setScale(0.22);
    const hint = outlined(text(this, W / 2, 335, t('boat.hint'), 56));
    this.tweens.add({ targets: hint, alpha: 0, delay: TITLE_FADE_MS + 3000, duration: 800 });

    this.addNetButton('small', W / 2 - 380);
    this.addNetButton('big', W / 2 + 380);
    this.pick('small');

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.cast(p.x, p.y));
    this.time.delayedCall(300, () => this.spawn());
    this.time.addEvent({ delay: SPAWN_MS, loop: true, callback: () => this.spawn() });
  }

  // ---------- the scenery ----------

  private drawSea(): void {
    this.add.circle(1740, 230, 110, 0xffe27a).setStrokeStyle(8, 0xffc83d).setDepth(-5);
    for (const [x, y, s] of [[300, 330, 0.9], [1500, 450, 0.7], [1800, 560, 0.55]] as const) this.add.image(x, y, 'cloud').setScale(s).setAlpha(0.9).setDepth(-4);
    this.add.rectangle(0, WATER_Y, W, 300, 0x4db6ff).setOrigin(0).setDepth(-3);
    this.add.rectangle(0, WATER_Y + 300, W, 250, 0x3a9be6).setOrigin(0).setDepth(-3);
    this.add.rectangle(0, WATER_Y + 550, W, FLOOR_Y - WATER_Y - 550, 0x2f82cf).setOrigin(0).setDepth(-3);
    this.add.rectangle(0, FLOOR_Y, W, H - FLOOR_Y, 0xf2d8a0).setOrigin(0).setDepth(-2);
    this.add.rectangle(0, FLOOR_Y - 20, W, 40, 0xe0c080).setOrigin(0).setDepth(-2);
    this.add.image(150, FLOOR_Y + 40, 'rock').setOrigin(0.5, 1).setScale(0.55).setDepth(-1);
    this.add.image(1900, FLOOR_Y + 30, 'rock').setOrigin(0.5, 1).setScale(0.45).setDepth(-1);
    for (let i = 0; i < 9; i++) this.bubble(Phaser.Math.Between(60, W - 60), Phaser.Math.Between(WATER_Y + 100, FLOOR_Y), i * 500);
  }

  private bubble(x: number, y: number, delay: number): void {
    const b = this.add.circle(x, y, Phaser.Math.Between(10, 26), 0xffffff, 0.4).setStrokeStyle(4, 0xffffff).setDepth(0);
    this.tweens.add({ targets: b, y: WATER_Y + 20, x: x + Phaser.Math.Between(-60, 60), duration: Phaser.Math.Between(5000, 8000), delay, repeat: -1, onRepeat: () => { b.y = FLOOR_Y; } });
  }

  /** The boat rocks on the water; a strip of waves in front of it hides the bottom of its hull. */
  private addBoat(): void {
    const boat = this.add.container(BOAT.x, WATER_Y);
    const hull = this.add.image(0, 0, 'boat').setOrigin(0.5, 340 / 460).setScale(BOAT.scale);
    const man = this.add.image(-140, -100, 'person').setOrigin(0.5, 1).setScale(0.4);
    boat.add([hull, man]).setDepth(1);
    this.tweens.add({ targets: boat, y: WATER_Y + 10, angle: 1.6, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const wave = this.add.graphics().setDepth(3);
    const pts: Phaser.Math.Vector2[] = [];
    for (let x = -400; x <= W + 400; x += 25) pts.push(new Phaser.Math.Vector2(x, WATER_Y - 14 + Math.sin(x / 200 * Math.PI) * 12));
    pts.push(new Phaser.Math.Vector2(W + 400, WATER_Y + 130), new Phaser.Math.Vector2(-400, WATER_Y + 130));
    wave.fillStyle(0x4db6ff).fillPoints(pts, true);
    wave.lineStyle(8, 0xffffff, 0.7).strokePoints(pts.slice(0, -2), false);
    this.tweens.add({ targets: wave, x: -400, duration: 4000, repeat: -1 }); // one wavelength every 400 px: seamless
  }

  // ---------- the fish ----------

  private spawn(): void {
    if (this.done || this.fish.length >= MAX_FISH) return;
    const kind = nextKind(this.got, Math.random());
    const fromLeft = Math.random() < 0.5;
    const speed = kind === 'small' ? Phaser.Math.Between(220, 340) : Phaser.Math.Between(130, 200);
    const y = Phaser.Math.Between(SWIM.y0, SWIM.y1);
    const img = this.add.image(fromLeft ? -260 : W + 260, y, TEXTURE[kind]).setScale(SIZE[kind]).setDepth(2).setFlipX(!fromLeft);
    this.fish.push({ kind, img, vx: fromLeft ? speed : -speed, baseY: y, phase: Math.random() * 6 });
  }

  private swimmers(): Swimmer[] {
    return this.fish.map(f => ({ kind: f.kind, x: f.img.x, y: f.img.y, vx: f.vx }));
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.img.x += f.vx * dt;
      f.img.y = f.baseY + Math.sin(time / 420 + f.phase) * 14;
      f.img.setFlipX(f.vx < 0);
      if (f.img.x < -400 || f.img.x > W + 400) { f.img.destroy(); this.fish.splice(i, 1); }
    }
    this.rope.clear();
    if (this.ropeFrom && this.ropeTo) {
      this.rope.lineStyle(8, INK).lineBetween(this.ropeFrom.x, this.ropeFrom.y, this.ropeTo.x, this.ropeTo.y);
      this.rope.lineStyle(3, 0xe9c48a).lineBetween(this.ropeFrom.x, this.ropeFrom.y, this.ropeTo.x, this.ropeTo.y);
    }
  }

  // ---------- the nets ----------

  private addNetButton(net: Net, x: number): void {
    const w = 700, h = 200, y = 1435;
    const bg = this.add.graphics();
    const netIcon = this.add.image(-250, 0, `net-${net}`);
    netIcon.setScale(NET_RADIUS[net] * 0.7 / NET_DIAMETER / netIcon.width); // the mesh is 0.7 r across: the big net looks bigger
    const label = text(this, 20, 0, t(net === 'small' ? 'boat.netSmall' : 'boat.netBig'), 56);
    label.setScale(Math.min(1, 270 / label.width));
    const fishIcon = this.add.image(250, 0, TEXTURE[net]).setScale(SIZE[net] * 0.5);
    const box = this.add.container(x, y, [bg, netIcon, label, fishIcon]).setSize(w, h).setInteractive().setDepth(10);
    box.on('pointerdown', () => { sfx.click(); this.pick(net); });
    this.buttons.push({ net, box, bg });
  }

  /** Take the `net` in hand: its button is lit and a bit bigger. */
  private pick(net: Net): void {
    this.net = net;
    for (const b of this.buttons) {
      const on = b.net === net;
      b.bg.clear();
      b.bg.fillStyle(on ? 0xffffff : CREAM, on ? 1 : 0.85).fillRoundedRect(-350, -100, 700, 200, 40);
      b.bg.lineStyle(on ? 14 : 8, on ? 0x2fa862 : INK).strokeRoundedRect(-350, -100, 700, 200, 40);
      this.tweens.add({ targets: b.box, scale: on ? 1.08 : 0.94, duration: 120 });
    }
  }

  /** Throw the net in hand at (px, py): it flies from the deck, lands, and takes the fish of its size under it. */
  private cast(px: number, py: number): void {
    if (this.done || this.netBusy || py < WATER_Y + 40 || py > FLOOR_Y - 10) return;
    this.netBusy = true;
    const net = this.net;
    const r = NET_RADIUS[net];
    const hand = px < BOAT.x ? HAND.left : HAND.right;
    const aim = aimAt({ x: px, y: py }, this.swimmers(), FLIGHT_MS);
    const target = { x: Phaser.Math.Clamp(aim.x, 100, W - 100), y: Phaser.Math.Clamp(aim.y, WATER_Y + r * 0.6, FLOOR_Y - r * 0.3) };

    const img = this.add.image(0, 0, `net-${net}`);
    const full = 2 * r / (img.width * NET_DIAMETER);
    img.setScale(full * 0.3);
    const box = this.add.container(hand.x, hand.y, [img]).setDepth(5);
    this.ropeFrom = hand; this.ropeTo = box;
    sfx.whoosh();

    const fly = { p: 0 };
    this.tweens.add({
      targets: fly, p: 1, duration: FLIGHT_MS, ease: 'Sine.in',
      onUpdate: () => {
        box.setPosition(Phaser.Math.Linear(hand.x, target.x, fly.p), Phaser.Math.Linear(hand.y, target.y, fly.p) - Math.sin(Math.PI * fly.p) * 170);
        img.setScale(full * (0.3 + 0.7 * fly.p)).setAngle(fly.p * 200);
      },
      onComplete: () => this.land(box, net, target, hand),
    });
  }

  private land(box: Phaser.GameObjects.Container, net: Net, at: { x: number; y: number }, hand: { x: number; y: number }): void {
    sfx.splash();
    const ring = this.add.circle(at.x, at.y, NET_RADIUS[net] * 0.9, 0xffffff, 0).setStrokeStyle(10, 0xffffff, 0.8).setDepth(4);
    this.tweens.add({ targets: ring, scale: 1.25, alpha: 0, duration: 500, onComplete: () => ring.destroy() });

    const res = resolveCast(net, at, this.swimmers());
    // The wrong net: the fish wriggles out and bolts away from it.
    for (const i of res.slipped) {
      const f = this.fish[i];
      f.vx = (f.img.x >= at.x ? 1 : -1) * 700;
      const puff = text(this, f.img.x, f.img.y - 90, '💨', 90).setDepth(7);
      this.tweens.add({ targets: puff, y: puff.y - 80, alpha: 0, duration: 700, onComplete: () => puff.destroy() });
    }
    if (res.slipped.length > 0) sfx.boing();
    // The right net: the fish are scooped up.
    const taken = res.caught.map(i => this.fish[i]);
    this.fish = this.fish.filter(f => !taken.includes(f));
    taken.forEach((f, k) => {
      this.got = addCatch(this.got, f.kind);
      this.counters[f.kind].set(this.got[f.kind]);
      this.tweens.add({
        targets: f.img, x: at.x, y: at.y, scale: SIZE[f.kind] * 0.6, duration: 260, delay: k * 60, ease: 'Quad.out',
        onComplete: () => { box.add(f.img); f.img.setPosition(Phaser.Math.Between(-30, 30), Phaser.Math.Between(-20, 20)); },
      });
    });
    if (taken.length > 0) { sfx.pop(); sfx.coin(); } else this.misses++;

    if (isDone(this.got)) {
      this.done = true;
      this.time.delayedCall(1300, () => this.win(starsFor(this.misses, MISS_LIMITS), { pay: true }));
    }
    // Back up to the deck with whatever it caught.
    this.time.delayedCall(700, () => {
      this.tweens.add({
        targets: box, x: hand.x, y: hand.y, scale: 0.5, duration: 550, ease: 'Sine.inOut',
        onComplete: () => { box.destroy(); this.ropeFrom = null; this.ropeTo = null; this.netBusy = false; },
      });
    });
  }
}
