import Phaser from 'phaser';
import { StageScene } from '../../../core/MiniGame';
import { sfx } from '../../../core/sfx';
import { starsFor } from '../../../core/stars';
import { text } from '../../../core/touch';
import { counter, hudTitle, type Counter } from '../../../core/ui';
import { t } from '../../../i18n';
import { freeHoles } from './barnyardLogic';
import { meadow } from './scenery';

const GOAL = 10;
const HOLES = [{ x: 400, y: 810 }, { x: 1024, y: 810 }, { x: 1648, y: 810 }, { x: 400, y: 1250 }, { x: 1024, y: 1250 }, { x: 1648, y: 1250 }];
const SCALE = 0.55;
const CARROTS = { x: 1024, y: 1400 };
const STAY_MS = 3200;
const MAX_UP = 3;

interface Hole { x: number; y: number; rabbit: Phaser.GameObjects.Image | null; bubble: Phaser.GameObjects.Container | null; timer: Phaser.Time.TimerEvent | null }

/** On the carrot field: rabbits pop out of their burrows, hungry. Tap one to throw it a carrot before it leaves. */
export class RabbitFeed extends StageScene {
  private holes: Hole[] = [];
  private fed = 0;
  private missed = 0;
  private done = false;
  private goal!: Counter;

  constructor() { super('RabbitFeed'); }

  create(): void {
    this.holes = []; this.fed = 0; this.missed = 0; this.done = false;
    this.backdrop(0xcfeaff);
    meadow(this, 600);
    this.add.image(1800, 600, 'tree').setOrigin(0.5, 1).setScale(0.7);
    this.add.image(250, 600, 'tree').setOrigin(0.5, 1).setScale(0.55);
    // the basket of carrots at the bottom, where the carrots come from
    [-70, -25, 25, 70].forEach((dx, i) => this.add.image(CARROTS.x + dx * 1.6, 1500, 'carrot').setOrigin(0.5, 0.9).setScale(0.4).setAngle(dx * 0.6 + (i % 2) * 6).setDepth(1500));
    this.add.image(CARROTS.x, 1536, 'basket').setOrigin(0.5, 1).setScale(0.5).setDepth(1501);
    HOLES.forEach(h => this.addHole(h.x, h.y));
    this.goal = counter(this, GOAL);
    hudTitle(this, t('rabbits.title'));

    this.time.delayedCall(500, () => this.popUp());
    this.time.addEvent({ delay: 950, loop: true, callback: () => this.popUp() });
  }

  private addHole(x: number, y: number): void {
    this.add.ellipse(x, y, 300, 76, 0x4a3022).setDepth(y - 2);
    this.add.ellipse(x, y + 22, 340, 70, 0xa5753f).setStrokeStyle(6, 0x5a3a22).setDepth(y + 1);
    this.holes.push({ x, y, rabbit: null, bubble: null, timer: null });
  }

  private upCount(): number { return this.holes.filter(h => h.rabbit).length; }

  private popUp(): void {
    if (this.done || this.upCount() >= MAX_UP) return;
    const free = freeHoles(this.holes.length, new Set(this.holes.flatMap((h, i) => (h.rabbit ? [i] : []))));
    if (free.length === 0) return;
    const hole = this.holes[Phaser.Utils.Array.GetRandom(free)];
    const img = this.add.image(hole.x, hole.y, 'bunny').setOrigin(0.5, 1).setScale(SCALE).setDepth(hole.y);
    hole.rabbit = img;
    const full = img.height;
    const drive = { p: 0 };
    const show = (): void => { img.setCrop(0, 0, img.width, Math.max(1, full * drive.p)).setY(hole.y + (1 - drive.p) * full * SCALE); };
    show();
    this.tweens.add({
      targets: drive, p: 1, duration: 260, ease: 'Back.out', onUpdate: show,
      onComplete: () => {
        if (!hole.rabbit) return;
        img.setInteractive().once('pointerdown', () => this.feed(hole));
        this.wish(hole);
        hole.timer = this.time.delayedCall(STAY_MS, () => this.leave(hole, false));
      },
    });
  }

  /** The bubble with a carrot over a hungry rabbit. */
  private wish(hole: Hole): void {
    const y = hole.y - hole.rabbit!.displayHeight - 70;
    const bg = this.add.circle(0, 0, 62, 0xffffff).setStrokeStyle(7, 0x5a3a22);
    const c = this.add.image(0, 0, 'carrot').setScale(0.3).setAngle(30);
    const bubble = this.add.container(hole.x + 30, y, [bg, c]).setDepth(hole.y + 5).setScale(0);
    hole.bubble = bubble;
    this.tweens.add({ targets: bubble, scale: 1, duration: 200, ease: 'Back.out' });
    this.tweens.add({ targets: bubble, y: y - 12, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private feed(hole: Hole): void {
    const img = hole.rabbit;
    if (!img || this.done) return;
    hole.timer?.remove();
    img.disableInteractive();
    hole.bubble?.destroy(); hole.bubble = null;
    sfx.pop();
    const mouth = { x: hole.x, y: hole.y - img.displayHeight * 0.45 };
    const carrot = this.add.image(CARROTS.x, CARROTS.y, 'carrot').setScale(0.4).setDepth(9000);
    this.tweens.add({
      targets: carrot, x: mouth.x, y: mouth.y, angle: 360, scale: 0.22, duration: 340, ease: 'Quad.out',
      onComplete: () => {
        carrot.destroy();
        sfx.chomp();
        const heart = text(this, mouth.x, mouth.y - 80, '❤️', 90).setDepth(9000);
        this.tweens.add({ targets: heart, y: heart.y - 140, alpha: 0, duration: 800, onComplete: () => heart.destroy() });
        this.fed++;
        this.goal.set(this.fed);
        this.tweens.add({ targets: img, scaleY: SCALE * 0.9, duration: 90, yoyo: true, repeat: 2 });
        if (this.fed >= GOAL) { this.done = true; this.time.delayedCall(500, () => this.win(starsFor(this.missed))); return; }
        this.time.delayedCall(450, () => this.leave(hole, true));
      },
    });
  }

  /** Back down into the burrow; `happy` is false when it gave up waiting. */
  private leave(hole: Hole, happy: boolean): void {
    const img = hole.rabbit;
    if (!img) return;
    img.disableInteractive();
    hole.timer?.remove(); hole.timer = null;
    if (!happy) {
      this.missed++;
      hole.bubble?.destroy(); hole.bubble = null;
      sfx.hurt();
    }
    const full = img.height;
    const drive = { p: 1 };
    this.tweens.add({
      targets: drive, p: 0, duration: 240, ease: 'Quad.in',
      onUpdate: () => { img.setCrop(0, 0, img.width, Math.max(1, full * drive.p)).setY(hole.y + (1 - drive.p) * full * SCALE); },
      onComplete: () => { img.destroy(); hole.rabbit = null; },
    });
  }
}
