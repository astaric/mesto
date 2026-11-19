import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { progress, type Catch } from '../../core/stages';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';
import { t, type Key } from '../../i18n';

const OFFERS: { kind: Catch; x: number; scale: number; label: Key }[] = [
  { kind: 'fish', x: 540, scale: 0.62, label: 'fishShop.fish' },
  { kind: 'octopus', x: 1500, scale: 0.6, label: 'fishShop.octopus' },
];

/** Fish shop: pick a fish or an octopus; it gets wrapped up to take home. */
export class FishShop extends StageScene {
  private picked = false;

  constructor() { super('FishShop'); }

  create(): void {
    this.picked = false;
    this.backdrop(0xcfeaff);
    for (let y = 0; y < 900; y += 150) this.add.rectangle(0, y, W, 75, 0xbfe0fa).setOrigin(0);
    // Ice counter.
    this.add.rectangle(0, 1020, W, 516, 0xe8f6ff).setOrigin(0);
    this.add.rectangle(0, 1000, W, 40, 0x8fb8d6).setOrigin(0);
    for (let i = 0; i < 12; i++) this.add.rectangle(100 + i * 170, 1150 + (i % 3) * 90, 90, 60, 0xffffff, 0.9).setAngle(i * 17);
    text(this, W / 2, 150, t('fishShop.choose'), 120);

    OFFERS.forEach((o, i) => {
      const img = this.add.image(o.x, 880, o.kind).setScale(o.scale);
      this.tweens.add({ targets: img, y: 850, angle: { from: -3, to: 3 }, duration: 600 + i * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      text(this, o.x, 1250, t(o.label), 80);
      const hit = this.add.rectangle(o.x, 850, 760, 600, 0xffffff, 0.001).setDepth(4).setInteractive();
      hit.on('pointerdown', () => this.pick(o, img));
    });
  }

  private pick(o: { kind: Catch; label: Key }, img: Phaser.GameObjects.Image): void {
    if (this.picked) return;
    this.picked = true;
    progress.fish = o.kind;
    sfx.pop();
    this.children.list.forEach(c => {
      if (c instanceof Phaser.GameObjects.Rectangle && c.input) c.disableInteractive();
      else if (c instanceof Phaser.GameObjects.Image && c !== img) this.tweens.add({ targets: c, alpha: 0, duration: 300 });
      else if (c instanceof Phaser.GameObjects.Text) this.tweens.add({ targets: c, alpha: 0, duration: 300 });
    });
    this.tweens.killTweensOf(img);
    this.tweens.add({ targets: img, x: W / 2, y: 760, angle: 0, duration: 500, ease: 'Back.out' });
    this.time.delayedCall(600, () => {
      const wrap = this.add.image(W / 2, 1180, 'wrap').setOrigin(0.5, 1).setScale(0.1).setDepth(6);
      sfx.whoosh();
      this.tweens.add({ targets: wrap, scale: 0.85, duration: 400, ease: 'Back.out' });
      this.tweens.add({ targets: img, y: 700, scale: img.scale * 0.8, duration: 400 });
      text(this, W / 2, 200, t('fishShop.wrapped'), 150).setDepth(8);
      this.time.delayedCall(500, () => {
        sfx.boing();
        this.tweens.add({ targets: [wrap, img], y: '-=120', duration: 250, yoyo: true, repeat: 2, ease: 'Sine.out' });
      });
      this.time.delayedCall(1900, () => this.finish(1));
    });
  }
}
