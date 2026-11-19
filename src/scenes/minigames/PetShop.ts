import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { progress, type Pet } from '../../core/stages';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';
import { t } from '../../i18n';

const OFFERS: { pet: Pet; price: number }[] = [
  { pet: 'bunny', price: 4 },
  { pet: 'cat', price: 6 },
  { pet: 'dog', price: 8 },
];

/** Spend the coins you earned: pick one animal to take home. */
export class PetShop extends StageScene {
  private bought = false;
  private counter!: Phaser.GameObjects.Text;

  constructor() { super('PetShop'); }

  create(): void {
    this.bought = false;
    this.backdrop(0xffd9e6);
    this.add.rectangle(0, 1180, W, 356, 0xe8b6c8).setOrigin(0);
    text(this, W / 2, 150, t('pets.choose'), 120);
    this.add.image(W - 330, 90, 'coin').setScale(0.7);
    this.counter = text(this, W - 200, 90, String(progress.coins), 80);

    OFFERS.forEach((o, i) => {
      const x = 380 + i * 644;
      const pet = this.add.image(x, 1010, o.pet).setOrigin(0.5, 1).setScale(0.8);
      this.tweens.add({ targets: pet, y: 1000, duration: 500 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const cage = this.add.image(x, 1050, 'cage').setOrigin(0.5, 1).setScale(1.0).setDepth(2);
      this.add.image(x - 70, 1180, 'coin').setScale(0.6).setDepth(3);
      text(this, x + 30, 1180, String(o.price), 80).setDepth(3);
      const hit = this.add.rectangle(x, 800, 560, 700, 0xffffff, 0.001).setDepth(4).setInteractive();
      hit.on('pointerdown', () => this.buy(o, pet, cage));
    });
  }

  private buy(o: { pet: Pet; price: number }, pet: Phaser.GameObjects.Image, cage: Phaser.GameObjects.Image): void {
    if (this.bought) return;
    if (progress.coins < o.price) { sfx.burp(); return; }
    this.bought = true;
    progress.pet = o.pet;
    progress.petOwned = true;
    progress.coins -= o.price;
    this.counter.setText(String(progress.coins));
    sfx.coin();
    for (let i = 0; i < o.price; i++) {
      const c = this.add.image(W - 330, 90, 'coin').setScale(0.7).setDepth(6);
      this.tweens.add({ targets: c, x: cage.x, y: cage.y - 300, alpha: 0, duration: 600, delay: i * 70, ease: 'Cubic.out', onComplete: () => c.destroy() });
    }
    this.tweens.killTweensOf(pet);
    this.tweens.add({ targets: cage, y: cage.y - 300, alpha: 0, duration: 500, delay: 300 });
    this.time.delayedCall(500, () => {
      sfx.boing();
      this.tweens.add({ targets: pet, y: pet.y - 200, duration: 280, yoyo: true, repeat: 3, ease: 'Sine.out' });
    });
    text(this, W / 2, 1380, t('pets.friend'), 100).setDepth(7);
    this.time.delayedCall(2300, () => this.finish(1));
  }
}
