import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { progress, type Treat } from '../../core/stages';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';
import { t } from '../../i18n';
import { INK } from '../../core/theme';

const OFFERS: { kind: Treat; x: number; scale: number }[] = [
  { kind: 'cake', x: 600, scale: 0.85 },
  { kind: 'cupcake', x: 1448, scale: 0.95 },
];
const TOPPINGS = ['cream', 'cherry', 'sprinkles'];

/** Pastry shop: pick a cake or a cupcake, then decorate it with three toppings. */
export class SweetShop extends StageScene {
  private picked = false;
  private placed = 0;
  private treat?: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.Text;

  constructor() { super('SweetShop'); }

  create(): void {
    this.picked = false;
    this.placed = 0;
    this.backdrop(0xffd9e6);
    // Shop wall stripes + counter.
    for (let x = 0; x < W; x += 256) this.add.rectangle(x, 0, 128, 1000, 0xffc2d9).setOrigin(0);
    this.add.rectangle(0, 1100, W, 436, 0xe8b6c8).setOrigin(0);
    this.add.rectangle(0, 1080, W, 40, 0xa0693a).setOrigin(0);
    this.title = text(this, W / 2, 150, t('sweets.choose'), 120);

    OFFERS.forEach((o, i) => {
      const img = this.add.image(o.x, 1070, o.kind).setOrigin(0.5, 1).setScale(o.scale);
      this.tweens.add({ targets: img, y: 1050, duration: 500 + i * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const hit = this.add.rectangle(o.x, 760, 620, 700, 0xffffff, 0.001).setDepth(4).setInteractive();
      hit.on('pointerdown', () => this.pick(o.kind, img));
      (img as any).hit = hit;
    });
  }

  private pick(kind: Treat, img: Phaser.GameObjects.Image): void {
    if (this.picked) return;
    this.picked = true;
    progress.treat = kind;
    sfx.pop();
    for (const o of OFFERS) {
      const other = this.children.list.find(c => c instanceof Phaser.GameObjects.Image && c.texture.key === o.kind && c !== img);
      if (other && o.kind !== kind) this.tweens.add({ targets: other, alpha: 0, duration: 300 });
    }
    this.children.list.filter(c => c instanceof Phaser.GameObjects.Rectangle && c.input).forEach(c => (c as Phaser.GameObjects.Rectangle).disableInteractive());
    this.tweens.killTweensOf(img);
    this.tweens.add({ targets: img, x: W / 2, y: 1000, scale: 1.1, duration: 500, ease: 'Back.out' });
    this.time.delayedCall(500, () => this.decorate(img));
  }

  private decorate(treat: Phaser.GameObjects.Image): void {
    this.treat = treat;
    this.title.setText(t('sweets.decorate'));
    TOPPINGS.forEach((key, i) => {
      const x = W / 2 + (i - 1) * 420;
      const btn = this.add.container(x, 1330);
      const bg = this.add.circle(0, 0, 130, 0xffffff).setStrokeStyle(10, INK);
      const icon = this.add.image(0, 0, key).setScale(key === 'cherry' ? 0.55 : 0.6);
      btn.add([bg, icon]).setSize(280, 280).setInteractive();
      this.tweens.add({ targets: btn, scale: 1.07, duration: 500 + i * 100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      btn.once('pointerdown', () => this.addTopping(key, i, btn));
    });
  }

  private addTopping(key: string, i: number, btn: Phaser.GameObjects.Container): void {
    const treat = this.treat!;
    sfx.pop();
    btn.disableInteractive();
    this.tweens.killTweensOf(btn);
    this.tweens.add({ targets: btn, alpha: 0.3, scale: 0.8, duration: 200 });
    const topY = treat.y - treat.displayHeight * (key === 'cherry' ? 0.8 : 0.7);
    const x = treat.x + (i - 1) * 110;
    const img = this.add.image(x, topY - 500, key).setScale(0.45).setDepth(5);
    this.tweens.add({
      targets: img, y: topY, duration: 450, ease: 'Bounce.out',
      onComplete: () => { sfx.coin(); this.tweens.add({ targets: img, scale: 0.52, duration: 120, yoyo: true }); },
    });
    this.placed++;
    if (this.placed === TOPPINGS.length) {
      this.time.delayedCall(700, () => {
        sfx.yay();
        text(this, W / 2, 230, t('common.yum'), 150).setDepth(8);
        this.tweens.add({ targets: treat, angle: { from: -6, to: 6 }, duration: 150, yoyo: true, repeat: 4 });
        this.time.delayedCall(1700, () => this.finish(3));
      });
    }
  }
}
