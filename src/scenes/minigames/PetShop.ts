import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import type { Pet } from '../../core/stages';
import { hasColors, hasPet, isCurrentPet, PET_COLORS, petTexture, profile, spend, takePet, type PetColor } from '../../core/profile';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';
import { coinCounter, hudTitle, HUD, priceTag, type CoinCounter } from '../../core/ui';
import { INK } from '../../core/theme';
import { t } from '../../i18n';

const OFFERS: { pet: Pet; price: number }[] = [
  { pet: 'bunny', price: 4 },
  { pet: 'cat', price: 6 },
  { pet: 'dog', price: 8 },
  { pet: 'hound', price: 100 },   // the hunting dog: it fetches the deer you shoot from the lookout
];

const SWATCH: Record<PetColor, number> = {
  brown: 0xa0652f, black: 0x2e2e34, white: 0xf6f6f6,
  red: 0xe0443a, orange: 0xf08a2a, yellow: 0xf5cf3a, green: 0x4cb04c, blue: 0x3f82e0, purple: 0x8a55c8, pink: 0xf28cb8,
};

/** Spend the coins you earned: pick one animal to take home (a dog in the coat you like). Every animal and every coat
 *  is paid for once; one you already own is taken again for free. */
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
      // starts on the pet that follows you, else on a coat you own, else brown
      let color: PetColor = profile.pet === o.pet && profile.petOwned ? profile.color : PET_COLORS.find((c) => hasPet(o.pet, c)) ?? 'brown';
      const pet = this.add.image(x, 1010, petTexture(o.pet, color)).setOrigin(0.5, 1).setScale(o.pet === 'hound' ? 1 : 0.8);   // the hunting dog is big
      this.tweens.add({ targets: pet, y: 1000, duration: 500 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const cage = this.add.image(x, 1050, 'cage').setOrigin(0.5, 1).setScale(1.0).setDepth(2);
      // under the cage: the price, ✔ when it is the one following you, ♥ when you own it and can take it for free
      let mark: Phaser.GameObjects.GameObject | undefined;
      const showMark = () => {
        mark?.destroy();
        mark = !hasPet(o.pet, color) ? priceTag(this, x, 1180, o.price).setDepth(3)
          : text(this, x, 1180, isCurrentPet(o.pet, color) ? '✔' : '♥', 90).setDepth(3);
      };
      showMark();
      const hit = this.add.rectangle(x, 800, 480, 700, 0xffffff, 0.001).setDepth(4).setInteractive();
      hit.on('pointerdown', () => this.buy(o, color, pet, cage));
      if (hasColors(o.pet)) this.coatPicker(x, 1290, color, (c) => {
        color = c;
        pet.setTexture(petTexture(o.pet, c));
        sfx.boing();
        showMark();
      });
    });
  }

  /** Round paint pots under a dog, two rows of five: tap one to see the dog in that coat (the coat costs extra unless you own it). */
  private coatPicker(x: number, y: number, current: PetColor, onPick: (c: PetColor) => void): void {
    const rings: Phaser.GameObjects.Arc[] = [];
    PET_COLORS.forEach((c, i) => {
      const cx = x + ((i % 5) - 2) * 92, cy = y + Math.floor(i / 5) * 100;
      const ring = this.add.circle(cx, cy, 45, 0xffffff).setStrokeStyle(8, INK, c === current ? 1 : 0).setDepth(3);
      this.add.circle(cx, cy, 33, SWATCH[c]).setStrokeStyle(5, INK).setDepth(3);
      const hit = this.add.circle(cx, cy, 46, 0xffffff, 0.001).setDepth(5).setInteractive();
      hit.on('pointerdown', () => {
        if (this.bought) return;
        rings.forEach((r, j) => r.setStrokeStyle(8, INK, j === i ? 1 : 0));
        onPick(c);
      });
      rings.push(ring);
    });
  }

  private buy(o: { pet: Pet; price: number }, color: PetColor, pet: Phaser.GameObjects.Image, cage: Phaser.GameObjects.Image): void {
    if (this.bought) return;
    if (isCurrentPet(o.pet, color)) { sfx.boing(); this.tweens.add({ targets: pet, y: pet.y - 120, duration: 200, yoyo: true }); return; }
    const free = hasPet(o.pet, color);
    if (!free && !spend(o.price)) {
      sfx.burp();
      this.tweens.add({ targets: this.wallet.label, x: this.wallet.label.x + 14, duration: 60, yoyo: true, repeat: 3 });
      return;
    }
    this.bought = true;
    takePet(o.pet, color);
    if (!free) {
      this.wallet.refresh();
      sfx.coin();
      for (let i = 0; i < Math.min(o.price, 12); i++) {
        const c = this.add.image(this.wallet.icon.x, HUD.coinY, 'coin').setScale(0.7).setDepth(6);
        this.tweens.add({ targets: c, x: cage.x, y: cage.y - 300, alpha: 0, duration: 600, delay: i * 70, ease: 'Cubic.out', onComplete: () => c.destroy() });
      }
    }
    this.tweens.killTweensOf(pet);
    this.tweens.add({ targets: cage, y: cage.y - 300, alpha: 0, duration: 500, delay: free ? 0 : 300 });
    this.time.delayedCall(free ? 200 : 500, () => {
      sfx.boing();
      this.tweens.add({ targets: pet, y: pet.y - 200, duration: 280, yoyo: true, repeat: 3, ease: 'Sine.out' });
    });
    this.win(3, { message: 'pets.friend', ms: 2300 });
  }
}
