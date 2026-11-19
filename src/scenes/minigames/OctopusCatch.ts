import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { sfx } from '../../core/sfx';
import { starsFor } from '../../core/stars';
import { counter, hudTitle, type Counter } from '../../core/ui';
import { t } from '../../i18n';

const TARGET = 8;
const LIFE = 1700;
// Rocks in two rows; the back row is drawn behind the front row.
const HOLES = [
  { x: 350, y: 980, d: 1 }, { x: 1024, y: 980, d: 1 }, { x: 1698, y: 980, d: 1 },
  { x: 687, y: 1380, d: 3 }, { x: 1361, y: 1380, d: 3 },
];
const SCALE = 0.45;

/** Under the sea: octopuses peek out from behind the rocks, tap them before they hide again. */
export class OctopusCatch extends StageScene {
  private busy: boolean[] = [];
  private count = 0;
  private misses = 0;
  private done = false;
  private goal!: Counter;

  constructor() { super('OctopusCatch'); }

  create(): void {
    this.busy = HOLES.map(() => false);
    this.count = 0; this.misses = 0; this.done = false;
    this.backdrop(0x4db6ff);
    this.add.rectangle(0, 0, W, 500, 0x6fc7ff).setOrigin(0);
    this.add.rectangle(0, 800, W, 736, 0xf2d8a0).setOrigin(0).setDepth(-1);
    this.add.rectangle(0, 780, W, 40, 0xe0c080).setOrigin(0).setDepth(-1);

    HOLES.forEach(h => this.add.image(h.x, h.y, 'rock').setOrigin(0.5, 1).setDepth(h.d + 1));
    for (let i = 0; i < 9; i++) this.bubble(Phaser.Math.Between(60, W - 60), Phaser.Math.Between(300, 1400), i * 400);

    this.goal = counter(this, TARGET);
    this.goal.label.setDepth(8);
    hudTitle(this, t('octopus.catch')).setDepth(8);

    this.time.addEvent({ delay: 800, loop: true, callback: () => this.peek() });
    this.time.delayedCall(300, () => this.peek());
  }

  private bubble(x: number, y: number, delay: number): void {
    const b = this.add.circle(x, y, Phaser.Math.Between(14, 34), 0xffffff, 0.45).setStrokeStyle(4, 0xffffff).setDepth(0);
    this.tweens.add({ targets: b, y: -60, x: x + Phaser.Math.Between(-80, 80), duration: Phaser.Math.Between(5000, 8000), delay, repeat: -1, onRepeat: () => { b.y = 1560; } });
  }

  private peek(): void {
    if (this.done) return;
    const free = HOLES.map((_, i) => i).filter(i => !this.busy[i]);
    if (free.length === 0) return;
    const i = Phaser.Utils.Array.GetRandom(free);
    const h = HOLES[i];
    this.busy[i] = true;
    const rest = h.y - 190; // rock texture is 240px tall at scale 1 (SVGs are rasterised at 1.5x)
    const oct = this.add.image(h.x, h.y + 40, 'octopus').setOrigin(0.5, 1).setScale(SCALE).setDepth(h.d);
    const wobble = this.tweens.add({ targets: oct, y: rest, duration: 260, ease: 'Back.out' });
    this.time.delayedCall(260, () => {
      if (!oct.active) return;
      oct.setInteractive(new Phaser.Geom.Rectangle(-100, -150, 960, 700), Phaser.Geom.Rectangle.Contains);
      this.tweens.add({ targets: oct, angle: { from: -6, to: 6 }, duration: 220, yoyo: true, repeat: -1 });
    });
    const hide = this.time.delayedCall(LIFE, () => this.hide(oct, i, wobble));
    oct.once('pointerdown', () => this.catchIt(oct, i, hide, wobble));
  }

  private catchIt(oct: Phaser.GameObjects.Image, i: number, hide: Phaser.Time.TimerEvent, wobble: Phaser.Tweens.Tween): void {
    if (this.done) return;
    hide.remove();
    wobble.stop();
    oct.disableInteractive();
    this.tweens.killTweensOf(oct);
    sfx.pop();
    sfx.splash();
    this.tweens.add({
      targets: oct, y: oct.y - 260, scale: 0.7, alpha: 0, angle: 360, duration: 450, ease: 'Cubic.out',
      onComplete: () => {
        oct.destroy();
        this.busy[i] = false;
      },
    });
    this.count++;
    this.goal.set(this.count);
    if (this.count >= TARGET) {
      this.done = true;
      this.time.delayedCall(300, () => this.win(starsFor(this.misses)));
    }
  }

  /** Too slow: the octopus ducks back behind the rock. */
  private hide(oct: Phaser.GameObjects.Image, i: number, wobble: Phaser.Tweens.Tween): void {
    if (this.done || !oct.active) return;
    wobble.stop();
    oct.disableInteractive();
    this.tweens.killTweensOf(oct);
    this.misses++;
    this.tweens.add({
      targets: oct, y: HOLES[i].y + 40, angle: 0, duration: 260, ease: 'Cubic.in',
      onComplete: () => { oct.destroy(); this.busy[i] = false; },
    });
  }
}
