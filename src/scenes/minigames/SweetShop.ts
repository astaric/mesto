import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { sfx } from '../../core/sfx';
import { circleButton, coinCounter, hudTitle, pay, priceTag, type CoinCounter } from '../../core/ui';
import { t } from '../../i18n';
import { INK } from '../../core/theme';

type Treat = 'cake' | 'cupcake';

const OFFERS: { kind: Treat; x: number; scale: number; price: number }[] = [
  { kind: 'cake', x: 600, scale: 0.85, price: 4 },
  { kind: 'cupcake', x: 1448, scale: 0.95, price: 3 },
];
const TOPPINGS = ['cream', 'cherry', 'sprinkles'];
const TOPPING_PRICE = 1;
const SHELF_Y = 1250; // the top of the shelf the toppings stand on

/** Pastry shop: everything costs coins. Pick a cake or a cupcake, then decorate it with up to three toppings; you can
 *  stop after any of them (✔) or leave with ◀ before buying anything. */
export class SweetShop extends StageScene {
  private picked = false;
  private placed = 0;
  private treat?: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.Text;
  private wallet!: CoinCounter;
  private finishing = false;
  private tags: Phaser.GameObjects.Container[] = [];
  private slots: Phaser.GameObjects.Container[] = [];

  constructor() { super('SweetShop'); }

  create(): void {
    this.picked = false;
    this.placed = 0;
    this.finishing = false;
    this.tags = [];
    this.slots = [];
    this.backdrop(0xffd9e6);
    // Shop wall stripes + counter.
    for (let x = 0; x < W; x += 256) this.add.rectangle(x, 0, 128, 1000, 0xffc2d9).setOrigin(0);
    this.add.rectangle(0, 1100, W, 436, 0xe8b6c8).setOrigin(0);
    this.add.rectangle(0, 1080, W, 40, 0xa0693a).setOrigin(0);
    this.title = hudTitle(this, t('sweets.choose'));
    this.wallet = coinCounter(this);

    OFFERS.forEach((o, i) => {
      const img = this.add.image(o.x, 1070, o.kind).setOrigin(0.5, 1).setScale(o.scale);
      this.tweens.add({ targets: img, y: 1050, duration: 500 + i * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const hit = this.add.rectangle(o.x, 760, 620, 700, 0xffffff, 0.001).setDepth(4).setInteractive();
      this.tags.push(priceTag(this, o.x, 1250, o.price).setDepth(3));
      hit.on('pointerdown', () => this.pick(o, img));
    });
  }

  private pick(offer: { kind: Treat; price: number }, img: Phaser.GameObjects.Image): void {
    if (this.picked) return;
    if (!pay(this, this.wallet, offer.price)) return;
    const kind = offer.kind;
    this.picked = true;
    sfx.pop();
    for (const o of OFFERS) {
      const other = this.children.list.find(c => c instanceof Phaser.GameObjects.Image && c.texture.key === o.kind && c !== img);
      if (other && o.kind !== kind) this.tweens.add({ targets: other, alpha: 0, duration: 300 });
    }
    this.tweens.add({ targets: this.tags, alpha: 0, duration: 300 });
    this.children.list.filter(c => c instanceof Phaser.GameObjects.Rectangle && c.input).forEach(c => (c as Phaser.GameObjects.Rectangle).disableInteractive());
    this.tweens.killTweensOf(img);
    this.tweens.add({ targets: img, x: W / 2, y: 1000, scale: 1.1, duration: 500, ease: 'Back.out' });
    this.time.delayedCall(500, () => this.decorate(img));
  }

  private decorate(treat: Phaser.GameObjects.Image): void {
    this.treat = treat;
    this.title.setText(t('sweets.decorate'));
    // A wooden shelf with the toppings standing on it, a paper price tag hanging under each.
    const shelf = this.add.container(0, 0).setDepth(2).setAlpha(0);
    shelf.add([
      this.add.rectangle(W / 2, SHELF_Y + 22, 1500, 44, 0xa0693a).setStrokeStyle(8, INK),
      this.add.rectangle(W / 2, SHELF_Y + 40, 1440, 8, 0x7a4c28),
    ]);
    this.tweens.add({ targets: shelf, alpha: 1, duration: 300 });
    TOPPINGS.forEach((key, i) => {
      const x = W / 2 + (i - 1) * 420;
      const slot = this.add.container(x, SHELF_Y).setDepth(3);
      const icon = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(key === 'cherry' ? 0.55 : 0.6);
      // The price tag: a small piece of paper with a punched hole, tilted a little.
      const paper = this.add.container(0, 120).setAngle((i - 1) * 4);
      paper.add([
        this.add.rectangle(0, 0, 200, 120, 0xfffaf0).setStrokeStyle(6, INK),
        this.add.circle(0, -42, 8, 0xe8b6c8).setStrokeStyle(4, INK),
        priceTag(this, 0, 14, TOPPING_PRICE, 56),
      ]);
      slot.add([icon, paper]).setSize(300, 440);
      slot.setInteractive(new Phaser.Geom.Rectangle(-150, -200, 300, 440), Phaser.Geom.Rectangle.Contains);
      this.tweens.add({ targets: icon, scaleY: icon.scaleY * 1.06, duration: 500 + i * 100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      slot.on('pointerdown', () => this.addTopping(key, i, slot));
      this.slots.push(slot);
    });
    // Stop decorating whenever you like.
    circleButton(this, '✔', () => this.finishUp(), { x: W - 170, y: SHELF_Y + 60 }).setDepth(6);
  }

  private finishUp(): void {
    if (this.finishing) return;
    this.finishing = true;
    const treat = this.treat!;
    this.tweens.add({ targets: treat, angle: { from: -6, to: 6 }, duration: 150, yoyo: true, repeat: 4 });
    this.win(3, { message: 'common.yum', ms: 1700 });
  }

  private addTopping(key: string, i: number, slot: Phaser.GameObjects.Container): void {
    if (this.finishing) return;
    if (!pay(this, this.wallet, TOPPING_PRICE)) return;
    const treat = this.treat!;
    sfx.pop();
    // The topping leaves the shelf (and its tag): it is yours now.
    slot.disableInteractive();
    this.tweens.add({ targets: slot, alpha: 0, y: slot.y - 40, duration: 250 });
    const topY = treat.y - treat.displayHeight * (key === 'cherry' ? 0.8 : 0.7);
    const x = treat.x + (i - 1) * 110;
    const img = this.add.image(x, topY - 500, key).setScale(0.45).setDepth(5);
    this.tweens.add({
      targets: img, y: topY, duration: 450, ease: 'Bounce.out',
      onComplete: () => { sfx.coin(); this.tweens.add({ targets: img, scale: 0.52, duration: 120, yoyo: true }); },
    });
    this.placed++;
    if (this.placed === TOPPINGS.length) this.time.delayedCall(700, () => this.finishUp());
  }
}
