import Phaser from 'phaser';
import { W } from '../../../core/layout';
import { StageScene } from '../../../core/MiniGame';
import { sfx } from '../../../core/sfx';
import { counter, hudTitle, type Counter } from '../../../core/ui';
import { t } from '../../../i18n';
import { distToSegment, woolTufts, type Pt } from './barnyardLogic';
import { meadow } from './scenery';

const GOAL = 3;
const CX = 880;
const CY = 930;
const U = 2.8;                 // pixels per unit of the sheep's drawing (400 x 320)
const SCALE = U / 1.5;         // the art is rasterised at 1.5
const REACH = 90;              // how close the shears must pass to a tuft to cut it
const BASKET = { x: 1780, y: 1330 };

interface Tuft { img: Phaser.GameObjects.Image; p: Pt }

/** On the meadow: drag the shears across the sheep's wool until it is bare, three sheep in a row. */
export class SheepShear extends StageScene {
  private sheep: Phaser.GameObjects.Container | null = null;
  private tufts: Tuft[] = [];
  private sheared = 0;
  private ready = false;
  private done = false;
  private prev: Pt | null = null;
  private goal!: Counter;
  private shears!: Phaser.GameObjects.Image;
  private basket!: Phaser.GameObjects.Image;

  constructor() { super('SheepShear'); }

  create(): void {
    this.sheep = null; this.tufts = []; this.sheared = 0; this.ready = false; this.done = false; this.prev = null;
    this.backdrop(0xcfeaff);
    meadow(this, 760);
    this.add.image(300, 500, 'cloud').setScale(0.9).setAlpha(0.9);
    this.add.image(1500, 400, 'cloud').setScale(0.7).setAlpha(0.9);
    this.add.image(250, 760, 'tree').setOrigin(0.5, 1).setScale(0.8);
    this.basket = this.add.image(BASKET.x, BASKET.y, 'basket').setOrigin(0.5, 1).setScale(0.55).setDepth(20);
    this.goal = counter(this, GOAL);
    hudTitle(this, t('shear.title'));

    this.shears = this.add.image(-300, -300, 'shears').setScale(0.4).setAngle(-25).setDepth(30).setVisible(false);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.prev = { x: p.x, y: p.y }; this.moveShears(p); });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      this.moveShears(p);
      if (this.prev) this.cut(this.prev, { x: p.x, y: p.y });
      this.prev = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', () => { this.prev = null; this.shears.setVisible(false); });

    this.bringSheep();
  }

  private moveShears(p: Phaser.Input.Pointer): void {
    this.shears.setPosition(p.x, p.y - 30).setVisible(!this.done);
  }

  /** A woolly sheep walks in from the left. */
  private bringSheep(): void {
    this.ready = false;
    const c = this.add.container(-700, CY).setDepth(5);
    c.add(this.add.image(0, 0, 'sheep-shorn').setScale(SCALE));
    this.tufts = woolTufts(108, 60, 46).map((p, i) => {
      // the drawing's body is centred at (172, 176) while its image is centred at (200, 160)
      const local = { x: (172 - 200 + p.x) * U, y: (176 - 160 + p.y) * U };
      const img = this.add.image(local.x, local.y, 'wool').setScale((0.95 + (i % 3) * 0.05) * U / 2.2).setAngle((i * 47) % 360);
      c.add(img);
      return { img, p: local };
    });
    this.sheep = c;
    this.tweens.add({ targets: c, x: CX, duration: 800, ease: 'Sine.out', onComplete: () => { this.ready = true; } });
  }

  private cut(a: Pt, b: Pt): void {
    if (!this.ready || this.done || !this.sheep) return;
    const origin = { x: this.sheep.x, y: this.sheep.y };
    const local = (q: Pt): Pt => ({ x: q.x - origin.x, y: q.y - origin.y });
    const la = local(a), lb = local(b);
    const hit = this.tufts.filter(f => distToSegment(f.p, la, lb) <= REACH);
    if (hit.length === 0) return;
    sfx.snip();
    this.tweens.add({ targets: this.shears, scaleX: 0.25, duration: 60, yoyo: true });
    hit.forEach(f => this.pluck(f, origin));
    this.tufts = this.tufts.filter(f => !hit.includes(f));
    if (this.tufts.length === 0) this.bare();
  }

  /** A tuft flies off into the basket. */
  private pluck(f: Tuft, origin: Pt): void {
    const ball = this.add.image(origin.x + f.p.x, origin.y + f.p.y, 'wool').setScale(f.img.scaleX).setAngle(f.img.angle).setDepth(25);
    f.img.destroy();
    this.tweens.add({
      targets: ball, x: BASKET.x, y: BASKET.y - 120, scale: 0.3, angle: ball.angle + 240, duration: 650, ease: 'Cubic.in',
      onComplete: () => {
        ball.destroy();
        this.tweens.add({ targets: this.basket, scaleY: 0.5, duration: 70, yoyo: true });
      },
    });
  }

  private bare(): void {
    const c = this.sheep;
    if (!c) return;
    this.ready = false;
    this.sheared++;
    sfx.baa();
    this.goal.set(this.sheared);
    this.tweens.add({ targets: c, y: CY - 90, duration: 220, yoyo: true, repeat: 1, ease: 'Sine.out' });
    if (this.sheared >= GOAL) { this.done = true; this.shears.setVisible(false); this.time.delayedCall(900, () => this.win(3, { pay: true })); return; }
    this.time.delayedCall(1000, () => {
      this.tweens.add({ targets: c, x: W + 800, duration: 800, ease: 'Sine.in', onComplete: () => c.destroy() });
      this.bringSheep();
    });
  }
}
