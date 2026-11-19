import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import type { Pet } from '../../core/stages';
import { profile, saveProfile, spend } from '../../core/profile';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';
import { coinCounter, hudTitle, HUD, priceTag, type CoinCounter } from '../../core/ui';
import { t } from '../../i18n';

const OFFERS: { pet: Pet; price: number }[] = [
  { pet: 'bunny', price: 4 },
  { pet: 'cat', price: 6 },
  { pet: 'dog', price: 8 },
  { pet: 'hound', price: 100 },   // the hunting dog: it fetches the deer you shoot from the lookout
];

/** Spend the coins you earned: pick one animal to take home. */
export class PetShop extends StageScene {
  private bought = false;
  private wallet!: CoinCounter;

  constructor() { super('PetShop'); }

  create(): void {
    this.bought = false;
    this.backdrop(0xffd9e6);
    this.add.rectangle(0, 1180, W, 356, 0xe8b6c8).setOrigin(0);
    hudTitle(this, t('pets.choose'));
    this.wallet = coinCounter(this);

    OFFERS.forEach((o, i) => {
      const x = 256 + i * 512;
      const pet = this.add.image(x, 1010, o.pet).setOrigin(0.5, 1).setScale(o.pet === 'hound' ? 1 : 0.8);   // the hunting dog is big
      this.tweens.add({ targets: pet, y: 1000, duration: 500 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const cage = this.add.image(x, 1050, 'cage').setOrigin(0.5, 1).setScale(1.0).setDepth(2);
      if (this.owns(o)) {
        text(this, x, 1180, '✔', 90).setDepth(3);
      } else {
        priceTag(this, x, 1180, o.price).setDepth(3);
      }
      const hit = this.add.rectangle(x, 800, 480, 700, 0xffffff, 0.001).setDepth(4).setInteractive();
      hit.on('pointerdown', () => this.buy(o, pet, cage));
    });
  }

  /** The pet that already follows you is not sold to you again. */
  private owns(o: { pet: Pet }): boolean { return profile.petOwned && profile.pet === o.pet; }

  private buy(o: { pet: Pet; price: number }, pet: Phaser.GameObjects.Image, cage: Phaser.GameObjects.Image): void {
    if (this.bought) return;
    if (this.owns(o)) { sfx.boing(); this.tweens.add({ targets: pet, y: pet.y - 120, duration: 200, yoyo: true }); return; }
    if (!spend(o.price)) {
      sfx.burp();
      this.tweens.add({ targets: this.wallet.label, x: this.wallet.label.x + 14, duration: 60, yoyo: true, repeat: 3 });
      return;
    }
    this.bought = true;
    profile.pet = o.pet;
    profile.petOwned = true;
    saveProfile();
    this.wallet.refresh();
    sfx.coin();
    for (let i = 0; i < Math.min(o.price, 12); i++) {
      const c = this.add.image(this.wallet.icon.x, HUD.coinY, 'coin').setScale(0.7).setDepth(6);
      this.tweens.add({ targets: c, x: cage.x, y: cage.y - 300, alpha: 0, duration: 600, delay: i * 70, ease: 'Cubic.out', onComplete: () => c.destroy() });
    }
    this.tweens.killTweensOf(pet);
    this.tweens.add({ targets: cage, y: cage.y - 300, alpha: 0, duration: 500, delay: 300 });
    this.time.delayedCall(500, () => {
      sfx.boing();
      this.tweens.add({ targets: pet, y: pet.y - 200, duration: 280, yoyo: true, repeat: 3, ease: 'Sine.out' });
    });
    this.win(3, { message: 'pets.friend', ms: 2300 });
  }
}
