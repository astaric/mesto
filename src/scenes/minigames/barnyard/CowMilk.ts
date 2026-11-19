import Phaser from 'phaser';
import { W } from '../../../core/layout';
import { StageScene } from '../../../core/MiniGame';
import { sfx } from '../../../core/sfx';
import { text } from '../../../core/touch';
import { counter, hudTitle, type Counter } from '../../../core/ui';
import { t } from '../../../i18n';
import { SQUEEZES_PER_JUG, jugLevel } from './barnyardLogic';
import { barnInterior, shelf } from './scenery';

const GOAL = 5;
const FLOOR_Y = 840;
const FEET_Y = 980;
const COW_X = [340, 1024, 1708];
const COW_SCALE = 0.8;
const JUG_SCALE = 0.5;
const U = 1.5 * JUG_SCALE; // one unit of the jug's drawing, in pixels (the art is rasterised at 1.5)
const JUG_BOTTOM = FEET_Y + 210;
const SHELF_Y = 1470;

interface Stall { x: number; cow: Phaser.GameObjects.Image; jug: Phaser.GameObjects.Image; milk: Phaser.GameObjects.Rectangle; squeezes: number; busy: boolean }

/** At the cow shed: squeeze a cow's udder again and again until the jug is full, then the milk goes on the shelf. */
export class CowMilk extends StageScene {
  private stalls: Stall[] = [];
  private jugs = 0;
  private done = false;
  private goal!: Counter;
  private hint?: Phaser.GameObjects.Text;

  constructor() { super('CowMilk'); }

  create(): void {
    this.stalls = []; this.jugs = 0; this.done = false;
    this.backdrop(0xcfeaff);
    barnInterior(this, FLOOR_Y);
    shelf(this, W / 2, SHELF_Y + 13, 1240);

    COW_X.forEach((x, i) => this.addStall(x, i));
    this.goal = counter(this, GOAL);
    hudTitle(this, t('milk.title'));

    // a pointing finger on the first udder until somebody squeezes
    this.hint = text(this, COW_X[0], FEET_Y - 20, '👆', 120).setDepth(20);
    this.tweens.add({ targets: this.hint, y: this.hint.y - 40, duration: 450, yoyo: true, repeat: -1 });
  }

  private addStall(x: number, i: number): void {
    const cow = this.add.image(x, FEET_Y, 'cow').setOrigin(0.5, 0.9).setScale(COW_SCALE).setDepth(1);
    this.tweens.add({ targets: cow, scaleY: COW_SCALE * 1.015, duration: 900 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const milk = this.add.rectangle(x - 10 * U, JUG_BOTTOM - 24 * U, 100 * U, 166 * U, 0xffffff).setOrigin(0.5, 1).setScale(1, 0).setDepth(4);
    const jug = this.add.image(x, JUG_BOTTOM, 'jug').setOrigin(0.5, 1).setScale(JUG_SCALE).setDepth(5);
    const stall: Stall = { x, cow, jug, milk, squeezes: 0, busy: false };
    this.stalls.push(stall);
    this.add.zone(x, FEET_Y - 40, 340, 260).setDepth(10).setInteractive().on('pointerdown', () => this.squeeze(stall));
  }

  private squeeze(s: Stall): void {
    if (this.done || s.busy) return;
    if (this.hint) { this.hint.destroy(); this.hint = undefined; }
    s.squeezes++;
    sfx.squirt();
    this.tweens.add({ targets: s.cow, scaleX: COW_SCALE * 1.03, duration: 70, yoyo: true });
    this.spray(s);
    this.tweens.add({ targets: s.milk, scaleY: jugLevel(s.squeezes), duration: 160 });
    if (s.squeezes >= SQUEEZES_PER_JUG) this.fillUp(s);
  }

  /** Two squirts from the teats into the jug. */
  private spray(s: Stall): void {
    for (const dx of [-26, 26]) {
      const drop = this.add.circle(s.x + dx, FEET_Y - 14, 11, 0xffffff).setStrokeStyle(3, 0xbfd8ee).setDepth(6);
      this.tweens.add({ targets: drop, y: FEET_Y + 56, duration: 170, ease: 'Quad.in', onComplete: () => drop.destroy() });
    }
  }

  /** The jug is full: it turns into a carton that goes on the shelf, and the cow gets a fresh jug. */
  private fillUp(s: Stall): void {
    s.busy = true;
    sfx.moo();
    const slot = this.jugs++;
    const x = W / 2 + (slot - (GOAL - 1) / 2) * 230;
    this.time.delayedCall(260, () => {
      sfx.coin();
      const carton = this.add.image(s.x, JUG_BOTTOM - 60, 'milk').setOrigin(0.5, 1).setScale(0.3).setDepth(8);
      this.tweens.add({ targets: [s.jug, s.milk], alpha: 0, duration: 200 });
      this.tweens.add({ targets: carton, scale: 0.55, y: JUG_BOTTOM - 140, duration: 220, ease: 'Back.out' });
      this.tweens.add({
        targets: carton, x, y: SHELF_Y, scale: 0.6, duration: 600, delay: 260, ease: 'Cubic.inOut',
        onComplete: () => {
          this.goal.set(this.jugs);
          carton.setDepth(2);
          if (this.jugs >= GOAL) { this.done = true; this.time.delayedCall(300, () => this.win(3, { pay: true })); }
        },
      });
    });
    if (this.jugs >= GOAL) return;
    this.time.delayedCall(1100, () => {
      s.squeezes = 0;
      s.milk.setScale(1, 0).setAlpha(1);
      s.jug.setAlpha(0).setScale(JUG_SCALE * 0.6);
      this.tweens.add({ targets: s.jug, alpha: 1, scale: JUG_SCALE, duration: 300, ease: 'Back.out', onComplete: () => { s.busy = false; } });
    });
  }
}
