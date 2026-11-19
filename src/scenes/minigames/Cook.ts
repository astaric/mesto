import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { sfx } from '../../core/sfx';
import { hudTitle } from '../../core/ui';
import { puff, tiledWall } from './kitchen';
import { t } from '../../i18n';
import { INK } from '../../core/theme';

const INGREDIENTS = [
  { key: 'octopus', scale: 0.22, drop: 0.45 },
  { key: 'oil', scale: 0.5, drop: 0.6 },
  { key: 'garlic', scale: 0.55, drop: 0.8 },
  { key: 'lemon', scale: 0.5, drop: 0.8 },
];
const POT_Y = 1000;

/** Kitchen: tap the four ingredients, they jump into the pot, then it all bubbles. */
export class Cook extends StageScene {
  private added = 0;
  private pot!: Phaser.GameObjects.Image;

  constructor() { super('Cook'); }

  create(): void {
    this.added = 0;
    this.backdrop(0xfff1c9);
    tiledWall(this, 760, 0xfff8e1, 0xffefc2);
    this.add.rectangle(0, 1000, W, 536, 0x7a7f87).setOrigin(0);
    this.add.rectangle(0, 990, W, 30, 0x555a61).setOrigin(0);
    for (let i = 0; i < 5; i++) {
      this.add.triangle(W / 2 - 240 + i * 120, 1090, 0, 80, 40, 0, 80, 80, 0xff9f43).setStrokeStyle(6, 0xff5d5d);
    }
    hudTitle(this, t('cook.title'));

    this.pot = this.add.image(W / 2, POT_Y, 'pot').setOrigin(0.5, 1).setScale(0.9).setDepth(2);

    INGREDIENTS.forEach((ing, i) => {
      const x = W / 2 + (i - 1.5) * 360;
      const btn = this.add.container(x, 1360).setDepth(5);
      const bg = this.add.circle(0, 0, 130, 0xffffff).setStrokeStyle(10, INK);
      const icon = this.add.image(0, 0, ing.key).setScale(ing.scale);
      btn.add([bg, icon]).setSize(280, 280).setInteractive();
      this.tweens.add({ targets: btn, scale: 1.07, duration: 500 + i * 100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      btn.once('pointerdown', () => this.add_(ing, btn));
    });
  }

  private add_(ing: typeof INGREDIENTS[number], btn: Phaser.GameObjects.Container): void {
    sfx.pop();
    btn.disableInteractive();
    this.tweens.killTweensOf(btn);
    this.tweens.add({ targets: btn, alpha: 0.3, scale: 0.8, duration: 200 });
    const potTop = POT_Y - this.pot.displayHeight + 70;
    const img = this.add.image(W / 2 + Phaser.Math.Between(-60, 60), 320, ing.key).setScale(ing.drop).setDepth(3);
    this.tweens.add({
      targets: img, y: potTop, angle: 200, duration: 450, ease: 'Cubic.in',
      onComplete: () => {
        sfx.splash();
        this.tweens.add({ targets: img, scale: 0, alpha: 0, duration: 180, onComplete: () => img.destroy() });
        this.tweens.add({ targets: this.pot, scaleY: 0.84, duration: 100, yoyo: true });
        puff(this, img.x, potTop - 20);
      },
    });
    this.added++;
    if (this.added === INGREDIENTS.length) {
      this.time.delayedCall(800, () => {
        sfx.sizzle();
        for (let i = 0; i < 10; i++) puff(this, W / 2 + Phaser.Math.Between(-150, 150), POT_Y - 380, i * 120);
        this.tweens.add({ targets: this.pot, angle: { from: -3, to: 3 }, duration: 120, yoyo: true, repeat: 8 });
        this.win(3, { message: 'common.yum', ms: 1800 }); // nothing to get wrong here
      });
    }
  }
}
