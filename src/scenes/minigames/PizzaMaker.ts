import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { sfx } from '../../core/sfx';
import { text, tapButton } from '../../core/touch';
import { hudTitle } from '../../core/ui';
import { puff, tiledWall } from './kitchen';
import { INGREDIENTS, TIERS, check, layersOf, type Ingredient, type Pizza } from './pizzaData';
import { t } from '../../i18n';
import { INK } from '../../core/theme';

const PX = 1060;          // the pizza on the board
const PY = 640;
const PS = 0.85;          // layer textures are 750px (500 @1.5x): 0.85 => ~640px pizza
const OVEN = { x: 1720, y: 860 }; // centre of the oven mouth
const CUSTOMER_X = 330;
const CUSTOMER_Y = 1090;  // stands behind the counter
const MAX_LAYERS = 8;
const CUSTOMERS = TIERS.length;
const STEPS_Y = 1170;     // the sauce → cheese → toppings reminder, on the counter

/** The texture of an ingredient layer. Cheese goes on as raw mozzarella pieces and comes out of the oven melted. */
const layerTexture = (k: Ingredient, baked: boolean): string => `pizza-${k === 'cheese' && baked ? 'cheese-baked' : k}`;

/** A pizza made of stacked layer textures: dough first, then the given ingredients in order. `baked` shows the finished (melted cheese) look. */
function buildPizza(scene: Phaser.Scene, x: number, y: number, s: number, keys: Ingredient[], baked = false): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  c.add(scene.add.image(0, 0, 'pizza-dough').setScale(s));
  for (const k of keys) c.add(scene.add.image(0, 0, layerTexture(k, baked)).setScale(s));
  return c;
}

/**
 * Pizzeria: three customers come in one after another and order a pizza (shown as a picture in a speech bubble).
 * Tap the ingredients in the right order (sauce, cheese, then toppings), bake it, and get a check or a cross.
 * A wrong pizza means the same customer orders again.
 */
export class PizzaMaker extends StageScene {
  private idx = 0;
  private stars = 0;
  private wrongOnce = false;
  private order: Ingredient[] = [];
  private want!: Pizza;
  private busy = true;
  private pizza!: Phaser.GameObjects.Container;
  private customer?: Phaser.GameObjects.Image;
  private bubble?: Phaser.GameObjects.Container;
  private bakeBtn!: Phaser.GameObjects.Container;
  private glow!: Phaser.GameObjects.Ellipse;
  private steps: { bg: Phaser.GameObjects.Arc; mark: Phaser.GameObjects.Text }[] = [];

  constructor() { super('PizzaMaker'); }

  create(): void {
    this.idx = 0; this.stars = 0; this.wrongOnce = false; this.order = []; this.busy = true;
    this.customer = undefined; this.bubble = undefined;
    this.backdrop(0xfff1c9);

    // Pizzeria wall (red/white tiles), counter in front.
    tiledWall(this, 1000, 0xfff4ee, 0xffd6cc, 125);
    this.add.rectangle(0, 1000, W, 536, 0xc98a4b).setOrigin(0).setDepth(2);
    this.add.rectangle(0, 990, W, 40, 0xa0693a).setOrigin(0).setDepth(2);
    hudTitle(this, t('pizza.make')).setDepth(3);

    // Wooden peel the pizza is built on.
    this.add.circle(PX, PY, 345, 0xe0a96d).setStrokeStyle(10, INK).setDepth(1);
    this.pizza = buildPizza(this, PX, PY, PS, []).setDepth(3);

    // Oven with a glow over its mouth while baking.
    this.add.image(OVEN.x, 1040, 'pizza-oven').setOrigin(0.5, 1).setScale(0.56).setDepth(1);
    this.glow = this.add.ellipse(OVEN.x, OVEN.y + 20, 270, 330, 0xff9f43, 0.85).setDepth(2).setAlpha(0);

    this.makeButtons();
    this.nextCustomer();
  }

  private makeButtons(): void {
    INGREDIENTS.forEach((k, i) => {
      const btn = this.add.container(W / 2 + (i - 4) * 210, 1390).setDepth(5);
      const bg = this.add.circle(0, 0, 98, 0xffffff).setStrokeStyle(10, INK);
      const icon = this.add.image(0, 0, `pizza-ico-${k}`).setScale(0.52);
      btn.add([bg, icon]).setSize(200, 200).setInteractive();
      this.tweens.add({ targets: btn, scale: 1.06, duration: 500 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      btn.on('pointerdown', () => this.addLayer(k));
    });

    // Bin: layers cannot be taken off one by one, only the whole pizza started over.
    const bin = this.add.container(1230, STEPS_Y).setDepth(5);
    bin.add([this.add.circle(0, 0, 90, 0xffffff).setStrokeStyle(10, INK), text(this, 0, 4, '🗑', 100)]);
    bin.setSize(200, 200).setInteractive();
    bin.on('pointerdown', () => {
      if (this.busy || !this.order.length) return;
      sfx.whoosh();
      this.tweens.add({ targets: bin, scale: 0.85, duration: 80, yoyo: true });
      this.resetPizza();
    });
    this.makeSteps();

    this.bakeBtn = tapButton(this, OVEN.x, 1170, t('pizza.bake'), () => this.bake()).setDepth(5).setVisible(false);
  }

  private addLayer(k: Ingredient): void {
    if (this.busy) return;
    if (this.order.length >= MAX_LAYERS) { sfx.boing(); return; }
    this.order.push(k);
    sfx.pop();
    const img = this.add.image(0, -330, layerTexture(k, false)).setScale(PS * 1.2).setAlpha(0).setData('k', k);
    this.pizza.add(img);
    this.tweens.add({
      targets: img, y: 0, scale: PS, alpha: 1, duration: 420, ease: 'Bounce.out',
      onComplete: () => { if (k !== 'sauce') sfx.coin(); },
    });
    this.bakeBtn.setVisible(true);
    this.refreshSteps();
  }

  /** The rule, shown instead of explained: sauce, then cheese, then whatever toppings. Each step lights up when done. */
  private makeSteps(): void {
    const icons = ['pizza-ico-sauce', 'pizza-ico-cheese', ''];
    this.steps = icons.map((key, i) => {
      const x = 520 + i * 150;
      const bg = this.add.circle(x, STEPS_Y, 62, 0xffffff).setStrokeStyle(8, INK).setDepth(5);
      if (key) this.add.image(x, STEPS_Y, key).setScale(0.36).setDepth(6);
      else text(this, x, STEPS_Y + 4, '…', 80).setDepth(6);
      const mark = text(this, x + 44, STEPS_Y - 44, '✔', 60).setDepth(7).setVisible(false);
      return { bg, mark };
    });
    this.refreshSteps();
  }

  private refreshSteps(): void {
    const done = [this.order[0] === 'sauce', this.order[0] === 'sauce' && this.order[1] === 'cheese', this.order.length >= 3];
    const next = done.indexOf(false);
    this.steps.forEach((s, i) => {
      s.mark.setVisible(done[i]);
      s.bg.setAlpha(done[i] ? 1 : i === next ? 1 : 0.45);
      s.bg.setFillStyle(done[i] ? 0xb8f0b8 : 0xffffff);
      this.tweens.killTweensOf(s.bg);
      s.bg.setScale(1);
      if (i === next) this.tweens.add({ targets: s.bg, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
    });
  }

  /** Throw away the layers (not the dough) and return the pizza to the board. */
  private resetPizza(): void {
    this.tweens.killTweensOf(this.pizza);
    this.pizza.setPosition(PX, PY).setScale(1).setAlpha(1);
    this.pizza.list.slice(1).forEach(c => c.destroy());
    this.order = [];
    this.bakeBtn.setVisible(false);
    this.refreshSteps();
  }

  private nextCustomer(): void {
    const tier = TIERS[this.idx];
    this.want = Phaser.Utils.Array.GetRandom(tier);
    this.wrongOnce = false;
    this.busy = true;
    this.customer = this.add.image(-300, CUSTOMER_Y, `pizza-guest-${this.idx + 1}`).setOrigin(0.5, 1).setScale(1.1).setDepth(1);
    this.tweens.add({
      targets: this.customer, x: CUSTOMER_X, duration: 700, ease: 'Back.out',
      onComplete: () => { this.showOrder(); this.busy = false; },
    });
  }

  private showOrder(): void {
    sfx.ding();
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff).lineStyle(10, INK);
    bg.fillRoundedRect(-190, -220, 380, 440, 40).strokeRoundedRect(-190, -220, 380, 440, 40);
    bg.fillTriangle(-30, 214, 50, 214, 10, 290).lineBetween(-30, 220, 10, 290).lineBetween(50, 220, 10, 290);
    const mini = buildPizza(this, 0, -30, 0.4, layersOf(this.want), true);
    const name = text(this, 0, 165, t(`pizza.${this.want.id}`), 56);
    if (name.width > 340) name.setScale(340 / name.width); // long names ("Štirje letni časi") must fit the bubble
    this.bubble = this.add.container(340, 270, [bg, mini, name]).setDepth(4).setScale(0);
    this.tweens.add({ targets: this.bubble, scale: 1, duration: 400, ease: 'Back.out' });
  }

  private bake(): void {
    if (this.busy || !this.order.length) return;
    this.busy = true;
    this.bakeBtn.setVisible(false);
    sfx.whoosh();
    this.tweens.add({
      targets: this.pizza, x: OVEN.x, y: OVEN.y, scale: 0.3, duration: 600, ease: 'Cubic.in',
      onComplete: () => {
        this.pizza.setAlpha(0);
        sfx.sizzle();
        this.tweens.add({ targets: this.glow, alpha: { from: 0.4, to: 0.95 }, duration: 250, yoyo: true, repeat: 3 });
        for (let i = 0; i < 6; i++) puff(this, OVEN.x + Phaser.Math.Between(-90, 90), 560, i * 250);
        this.time.delayedCall(2000, () => {
          this.glow.setAlpha(0);
          this.pizza.setAlpha(1);
          // Out of the oven the mozzarella has melted.
          for (const img of this.pizza.list.slice(1) as Phaser.GameObjects.Image[]) {
            if (img.getData('k') === 'cheese') img.setTexture(layerTexture('cheese', true));
          }
          this.tweens.add({ targets: this.pizza, x: PX, y: PY, scale: 1, duration: 500, ease: 'Back.out', onComplete: () => this.verdict() });
        });
      },
    });
  }

  private verdict(): void {
    const ok = check(this.order, this.want);
    const mark = this.add.image(PX, PY, ok ? 'pizza-check' : 'pizza-cross').setDepth(20).setScale(0);
    this.tweens.add({ targets: mark, scale: 0.8, duration: 350, ease: 'Back.out' });
    if (ok) {
      sfx.coin();
      if (!this.wrongOnce) this.stars++;
      this.tweens.add({ targets: this.customer, y: CUSTOMER_Y - 40, duration: 200, yoyo: true, repeat: 3 });
      this.time.delayedCall(1500, () => { mark.destroy(); this.leave(); });
    } else {
      sfx.hurt();
      this.wrongOnce = true;
      this.tweens.add({ targets: this.customer, x: CUSTOMER_X + 30, duration: 90, yoyo: true, repeat: 5 });
      this.time.delayedCall(1400, () => {
        mark.destroy();
        this.resetPizza();
        this.busy = false;
      });
    }
  }

  /** Customer takes the pizza and leaves; next customer or the end of the stage. */
  private leave(): void {
    const customer = this.customer!;
    this.tweens.add({ targets: this.bubble, scale: 0, duration: 250, onComplete: () => this.bubble?.destroy() });
    this.tweens.add({
      targets: this.pizza, x: CUSTOMER_X, y: 900, scale: 0.3, alpha: 0, duration: 600, ease: 'Cubic.in',
      onComplete: () => this.resetPizza(),
    });
    this.time.delayedCall(500, () => {
      this.tweens.add({
        targets: customer, x: -300, duration: 700, ease: 'Cubic.in',
        onComplete: () => {
          customer.destroy();
          this.idx++;
          if (this.idx >= CUSTOMERS) this.win(Math.max(1, this.stars));
          else this.nextCustomer();
        },
      });
    });
  }
}
