import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';
import { outlined } from '../../core/ui';
import { t } from '../../i18n';

const TARGET = 10;
const NEST_Y = 720;
const BASKET_X = 1024;
const BASKET_Y = 1500;
const EGG_LIFE = 4200;

/** Home farm: hens lay eggs, tap them into the basket before they hatch into chicks. */
export class EggCollect extends StageScene {
  private eggsInNests: boolean[] = [];
  private hens: Phaser.GameObjects.Image[] = [];
  private count = 0;
  private chicks = 0;
  private done = false;
  private counter!: Phaser.GameObjects.Text;
  private basket!: Phaser.GameObjects.Image;

  constructor() { super('EggCollect'); }

  create(): void {
    this.eggsInNests = [false, false, false, false];
    this.hens = [];
    this.count = 0; this.chicks = 0; this.done = false;
    this.backdrop(0xcfeaff);
    this.add.rectangle(0, 760, W, 776, 0x6cd38a).setOrigin(0);
    this.add.rectangle(0, 740, W, 40, 0x58bf76).setOrigin(0);
    // Barn wall behind the hens.
    this.add.rectangle(0, 180, W, 580, 0xe9965a).setOrigin(0);
    for (let x = 0; x < W; x += 160) this.add.rectangle(x, 180, 12, 580, 0xc77a45).setOrigin(0);

    for (let i = 0; i < 4; i++) {
      const x = 340 + i * 456;
      const hen = this.add.image(x, 680, 'hen').setOrigin(0.5, 1).setScale(0.85).setDepth(1);
      this.hens.push(hen);
      this.add.image(x, NEST_Y + 20, 'nest').setOrigin(0.5, 1).setScale(0.95).setDepth(2);
      this.tweens.add({ targets: hen, angle: { from: -2, to: 2 }, duration: 700 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    this.add.rectangle(0, 1180, W, 356, 0x58bf76).setOrigin(0).setDepth(0);
    this.basket = this.add.image(BASKET_X, BASKET_Y, 'basket').setOrigin(0.5, 1).setScale(1.1).setDepth(6);
    this.counter = outlined(text(this, W / 2, 1080, `0 / ${TARGET}`, 100)).setDepth(7);
    text(this, W / 2, 120, t('eggs.collect'), 110);

    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.lay() });
    this.time.delayedCall(300, () => this.lay());
  }

  private lay(): void {
    if (this.done) return;
    const free = [0, 1, 2, 3].filter(i => !this.eggsInNests[i]);
    if (free.length === 0) return;
    const i = Phaser.Utils.Array.GetRandom(free);
    this.eggsInNests[i] = true;
    const hen = this.hens[i];
    const x = hen.x;
    sfx.cluck();
    this.tweens.add({ targets: hen, y: hen.y - 70, duration: 150, yoyo: true, repeat: 1 });
    const gold = Math.random() < 0.15;
    const egg = this.add.image(x, NEST_Y - 20, gold ? 'egg-gold' : 'egg').setOrigin(0.5, 1).setScale(0).setDepth(3);
    this.tweens.add({ targets: egg, scale: 0.9, duration: 300, delay: 300, ease: 'Back.out' });
    this.time.delayedCall(300, () => {
      if (!egg.active) return;
      egg.setInteractive(new Phaser.Geom.Rectangle(-50, -50, 260, 360), Phaser.Geom.Rectangle.Contains);
    });
    const wobble = this.tweens.add({ targets: egg, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: -1, delay: 700 });
    const hatch = this.time.delayedCall(EGG_LIFE, () => this.hatch(egg, i, wobble));
    egg.once('pointerdown', () => this.collect(egg, i, gold, wobble, hatch));
  }

  private collect(egg: Phaser.GameObjects.Image, i: number, gold: boolean, wobble: Phaser.Tweens.Tween, hatch: Phaser.Time.TimerEvent): void {
    if (this.done) return;
    hatch.remove();
    wobble.stop();
    egg.disableInteractive();
    this.eggsInNests[i] = false;
    sfx.pop();
    this.tweens.add({
      targets: egg, x: BASKET_X + Phaser.Math.Between(-120, 120), y: BASKET_Y - 220, scale: 0.55, angle: 0, duration: 520, ease: 'Cubic.in',
      onComplete: () => {
        sfx.coin();
        egg.destroy();
        this.count += gold ? 2 : 1;
        this.counter.setText(`${Math.min(this.count, TARGET)} / ${TARGET}`);
        this.tweens.add({ targets: this.basket, scaleY: 1.0, duration: 90, yoyo: true });
        this.tweens.add({ targets: this.counter, scale: 1.25, duration: 100, yoyo: true });
        if (this.count >= TARGET && !this.done) {
          this.done = true;
          const stars = this.chicks <= 1 ? 3 : this.chicks <= 4 ? 2 : 1;
          this.time.delayedCall(700, () => this.finish(stars));
        }
      },
    });
    if (gold) this.tweens.add({ targets: egg, alpha: 0.7, duration: 100, yoyo: true, repeat: 2 });
  }

  /** Left too long: the egg cracks and a chick runs away. */
  private hatch(egg: Phaser.GameObjects.Image, i: number, wobble: Phaser.Tweens.Tween): void {
    if (this.done || !egg.active) return;
    wobble.stop();
    egg.disableInteractive();
    this.chicks++;
    sfx.crack();
    const x = egg.x;
    egg.destroy();
    this.eggsInNests[i] = false;
    const chick = this.add.image(x, NEST_Y - 10, 'chick').setOrigin(0.5, 1).setScale(0.1).setDepth(4);
    this.tweens.add({ targets: chick, scale: 0.55, duration: 250, ease: 'Back.out' });
    const dir = x < W / 2 ? -1 : 1;
    this.time.delayedCall(300, () => {
      sfx.cluck();
      this.tweens.add({ targets: chick, x: x + dir * 1100, y: NEST_Y + 150, angle: { from: -10, to: 10 }, duration: 1400, ease: 'Sine.in', onComplete: () => chick.destroy() });
    });
  }
}
