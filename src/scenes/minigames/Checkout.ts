import Phaser from 'phaser';
import { W } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { progress } from '../../core/stages';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';

const GOODS = ['apple', 'bread', 'milk', 'cheese', 'banana'];
const BELT_Y = 960;
const BELT_X0 = 200;
const BELT_X1 = 1650;
const SPEED = 280;
const TARGET = 10;
const PER_CUSTOMER = 3;

/** Underground shop: you are the cashier. Tap items on the belt to scan them; customers come and go. */
export class Checkout extends StageScene {
  private scanned = 0;
  private missed = 0;
  private done = false;
  private items: Phaser.GameObjects.Image[] = [];
  private stripes: Phaser.GameObjects.Rectangle[] = [];
  private counter!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private customer!: Phaser.GameObjects.Image;

  constructor() { super('Checkout'); }

  create(): void {
    this.scanned = 0; this.missed = 0; this.done = false; this.items = []; this.stripes = [];
    this.backdrop(0x3a4256);
    // Underground tiles + shelves.
    for (let y = 0; y < 1536; y += 128) for (let x = 0; x < W; x += 256) {
      this.add.rectangle(x, y, 256, 128, ((x / 256 + y / 128) % 2) ? 0x424a60 : 0x3a4256).setOrigin(0);
    }
    this.add.rectangle(0, 1180, W, 356, 0x5b6479).setOrigin(0);
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(120 + i * 400, 330, 340, 36, 0xa0693a).setOrigin(0);
      this.add.rectangle(120 + i * 400, 480, 340, 36, 0xa0693a).setOrigin(0);
      this.add.image(190 + i * 400, 330, GOODS[i]).setOrigin(0.5, 1).setScale(0.5);
      this.add.image(290 + i * 400, 480, GOODS[(i + 2) % 5]).setOrigin(0.5, 1).setScale(0.5);
    }

    // Belt.
    this.add.image((BELT_X0 + BELT_X1) / 2 + 40, BELT_Y + 40, 'belt').setScale((BELT_X1 - BELT_X0 + 260) / 1800);
    for (let i = 0; i < 10; i++) {
      const s = this.add.rectangle(BELT_X0 + i * 150, BELT_Y + 34, 50, 10, 0x9aa3b2);
      this.stripes.push(s);
    }
    this.add.image(1480, BELT_Y - 10, 'scanner').setOrigin(0.5, 1).setScale(0.55).setDepth(2);

    // Worker (you) and customer.
    this.add.image(120, BELT_Y + 330, 'worker').setOrigin(0.5, 1).setScale(1.0).setDepth(3);
    this.customer = this.add.image(W + 200, BELT_Y + 330, 'customer').setOrigin(0.5, 1).setScale(1.0).setDepth(3);
    this.nextCustomer(true);

    // HUD.
    text(this, W / 2, 130, 'Skeniraj izdelke!', 100).setColor('#ffffff');
    this.add.image(W - 330, 90, 'coin').setScale(0.7);
    this.counter = text(this, W - 200, 90, String(progress.coins), 80).setColor('#ffffff');
    this.progressText = text(this, W / 2, 1450, `0 / ${TARGET}`, 70).setColor('#ffffff');

    this.time.addEvent({ delay: 1100, loop: true, callback: () => this.spawn() });
    this.spawn();
  }

  private spawn(): void {
    if (this.done) return;
    const key = Phaser.Utils.Array.GetRandom(GOODS);
    const item = this.add.image(BELT_X0 - 60, BELT_Y - 10, key).setOrigin(0.5, 1).setScale(0.9).setDepth(1);
    item.setInteractive({ useHandCursor: true });
    this.items.push(item);
    item.once('pointerdown', () => this.scan(item));
  }

  private scan(item: Phaser.GameObjects.Image): void {
    if (this.done) return;
    item.disableInteractive();
    this.items = this.items.filter(i => i !== item);
    sfx.beep();
    this.scanned++;
    progress.coins++;
    this.progressText.setText(`${this.scanned} / ${TARGET}`);
    // Item pops, coin flies to the counter.
    this.tweens.add({ targets: item, scale: 1.3, alpha: 0, y: item.y - 80, duration: 250, onComplete: () => item.destroy() });
    const coin = this.add.image(item.x, item.y - 100, 'coin').setDepth(5);
    this.tweens.add({
      targets: coin, x: W - 330, y: 90, scale: 0.7, duration: 600, ease: 'Cubic.in',
      onComplete: () => { coin.destroy(); sfx.coin(); this.counter.setText(String(progress.coins)); this.tweens.add({ targets: this.counter, scale: 1.3, duration: 100, yoyo: true }); },
    });
    if (this.scanned % PER_CUSTOMER === 0 && this.scanned < TARGET) this.nextCustomer(false);
    if (this.scanned >= TARGET) {
      this.done = true;
      const stars = this.missed <= 2 ? 3 : this.missed <= 5 ? 2 : 1;
      this.time.delayedCall(900, () => this.finish(stars));
    }
  }

  /** The current customer waves and leaves; a new one walks in. */
  private nextCustomer(first: boolean): void {
    const c = this.customer;
    const enter = () => {
      c.setPosition(W + 200, BELT_Y + 330).setAlpha(1).setAngle(0);
      c.setTint(Phaser.Utils.Array.GetRandom([0xffffff, 0xffd9d9, 0xd9ffe6, 0xfff2b8, 0xd9e6ff]));
      this.tweens.add({ targets: c, x: 1850, duration: 900, ease: 'Sine.out' });
    };
    if (first) { enter(); return; }
    this.tweens.add({ targets: c, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, repeat: 3 });
    this.time.delayedCall(500, () => {
      this.tweens.add({ targets: c, x: W + 300, duration: 700, onComplete: enter });
    });
  }

  update(_t: number, dt: number): void {
    const d = (SPEED * dt) / 1000;
    for (const s of this.stripes) {
      s.x += d;
      if (s.x > BELT_X1 + 40) s.x -= 1500;
    }
    for (const it of [...this.items]) {
      it.x += d;
      if (it.x > BELT_X1 + 60) {
        this.items = this.items.filter(i => i !== it);
        it.disableInteractive();
        this.missed++;
        this.tweens.add({ targets: it, y: it.y + 300, alpha: 0, angle: 90, duration: 500, onComplete: () => it.destroy() });
      }
    }
  }
}
