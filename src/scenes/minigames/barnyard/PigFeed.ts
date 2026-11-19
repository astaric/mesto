import Phaser from 'phaser';
import { W } from '../../../core/layout';
import { StageScene } from '../../../core/MiniGame';
import { sfx } from '../../../core/sfx';
import { hudTitle, counter, type Counter } from '../../../core/ui';
import { t } from '../../../i18n';
import { nearest, pigSize, pigStage } from './barnyardLogic';
import { meadow, shelf } from './scenery';

const GOAL = 3;
const PIG_X = [380, 1024, 1668];
const FEET_Y = 1000;
const PIG_SCALE = 0.7;
const BASKET = { x: 480, y: 1450 };
const SHELF_Y = 1470;
const FEED_REACH = 330;

interface Pig {
  x: number; img: Phaser.GameObjects.Image; bubble: Phaser.GameObjects.Image; bubbleBg: Phaser.GameObjects.Arc;
  apples: number; alive: boolean; flip: boolean;
}

/** In the pig sty: drag apples to the pigs until they are fat, then tap a fat pig to get a ham. */
export class PigFeed extends StageScene {
  private pigs: Pig[] = [];
  private hams = 0;
  private done = false;
  private apple: Phaser.GameObjects.Image | null = null;
  private goal!: Counter;
  private title!: Phaser.GameObjects.Text;

  constructor() { super('PigFeed'); }

  create(): void {
    this.pigs = []; this.hams = 0; this.done = false; this.apple = null;
    this.backdrop(0xcfeaff);
    meadow(this, 700, 0xb98b5a, 0x9c7346);
    for (let x = 60; x < W; x += 210) this.add.image(x, 740, 'fence').setOrigin(0.5, 1).setScale(0.4);
    for (const [x, y] of [[250, 1180], [1000, 1250], [1700, 1190]]) this.add.ellipse(x, y, 420, 90, 0x8a6240);
    shelf(this, 1560, SHELF_Y + 13, 760);

    PIG_X.forEach((x, i) => this.addPig(x, i === 1));
    this.add.image(BASKET.x, BASKET.y, 'basket').setOrigin(0.5, 1).setScale(0.7).setDepth(4);
    for (let i = 0; i < 4; i++) this.add.image(BASKET.x - 120 + i * 80, BASKET.y - 150 + (i % 2) * 14, 'apple').setScale(0.5).setDepth(5);
    this.goal = counter(this, GOAL);
    this.title = hudTitle(this, t('pigs.title'));

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
    });
  }

  // ---------- pigs ----------

  private addPig(x: number, flip: boolean): void {
    const img = this.add.image(x, FEET_Y, 'pig').setOrigin(0.5, 1).setScale(PIG_SCALE).setFlipX(flip).setDepth(FEET_Y);
    const bubbleBg = this.add.circle(x, 0, 66, 0xffffff).setStrokeStyle(7, 0x5a3a22).setDepth(FEET_Y + 4);
    const bubble = this.add.image(x, 0, 'apple').setScale(0.5).setDepth(FEET_Y + 5);
    const pig: Pig = { x, img, bubble, bubbleBg, apples: 0, alive: true, flip };
    this.pigs.push(pig);
    this.tweens.add({ targets: img, y: FEET_Y - 8, duration: 600 + x % 5 * 40, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    img.setInteractive().on('pointerdown', () => this.poke(pig));
    this.place(pig);
  }

  /** Body size and the thought bubble above it follow what the pig ate. */
  private place(p: Pig): void {
    const s = PIG_SCALE * pigSize(p.apples);
    p.img.setScale(s);
    const by = FEET_Y - p.img.displayHeight - 80;
    p.bubble.setPosition(p.x, by);
    p.bubbleBg.setPosition(p.x, by);
    const fat = pigStage(p.apples) === 'fat';
    p.bubble.setTexture(fat ? 'knife' : 'apple').setScale(fat ? 0.28 : 0.5).setAngle(fat ? 35 : 0);
  }

  /** Where a pig's mouth is, for the apple to fly to. */
  private mouth(p: Pig): { x: number; y: number } {
    const s = p.img.scaleX * 1.5;
    return { x: p.x + (p.flip ? -1 : 1) * 160 * s, y: FEET_Y - 140 * s };
  }

  private poke(p: Pig): void {
    if (this.done || !p.alive || this.apple) return;
    if (pigStage(p.apples) === 'fat') { this.slaughter(p); return; }
    sfx.oink();
    this.tweens.add({ targets: p.img, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => p.img.setAngle(0) });
  }

  private feed(p: Pig): void {
    const apple = this.apple;
    if (!apple) return;
    this.apple = null;
    const m = this.mouth(p);
    this.tweens.add({
      targets: apple, x: m.x, y: m.y, scale: 0.2, duration: 220, ease: 'Quad.in',
      onComplete: () => {
        apple.destroy();
        sfx.chomp();
        p.apples++;
        this.place(p);
        this.tweens.add({ targets: p.img, scaleY: p.img.scaleY * 1.12, duration: 110, yoyo: true });
        if (pigStage(p.apples) === 'fat') { sfx.ding(); this.title.setText(t('pigs.fat')); }
      },
    });
  }

  /** The knife on a fat pig: it squeals, and a ham flies to the shelf. */
  private slaughter(p: Pig): void {
    p.alive = false;
    if (!this.pigs.some(g => g.alive && pigStage(g.apples) === 'fat')) this.title.setText(t('pigs.title'));
    p.bubble.destroy(); p.bubbleBg.destroy();
    this.tweens.killTweensOf(p.img);
    sfx.oink(); sfx.chop();
    const cx = p.x, cy = FEET_Y - p.img.displayHeight * 0.5;
    const knife = this.add.image(cx + 160, cy - 200, 'knife').setScale(0.5).setAngle(-120).setDepth(9000);
    this.tweens.add({ targets: knife, x: cx - 40, y: cy + 60, duration: 160, ease: 'Quad.in', onComplete: () => this.tweens.add({ targets: knife, alpha: 0, duration: 250, onComplete: () => knife.destroy() }) });
    for (let i = 0; i < 9; i++) {
      const d = this.add.image(cx, cy, 'blood-drop').setScale(Phaser.Math.FloatBetween(0.4, 0.8)).setDepth(FEET_Y + 6);
      this.tweens.add({ targets: d, x: cx + Phaser.Math.Between(-220, 220), y: cy + Phaser.Math.Between(-160, 140), alpha: 0, duration: 800, delay: 150, ease: 'Cubic.out', onComplete: () => d.destroy() });
    }
    this.tweens.add({ targets: p.img, angle: p.flip ? -85 : 85, y: FEET_Y + 10, alpha: 0, duration: 700, delay: 200, onComplete: () => p.img.destroy() });
    this.time.delayedCall(500, () => {
      sfx.coin();
      const slot = this.hams++;
      const ham = this.add.image(cx, cy, 'ham').setScale(0.1).setDepth(9000);
      this.tweens.add({ targets: ham, scale: 0.55, duration: 250, ease: 'Back.out' });
      this.tweens.add({
        targets: ham, x: 1330 + slot * 230, y: SHELF_Y - 50, scale: 0.4, duration: 650, delay: 350, ease: 'Cubic.inOut',
        onComplete: () => {
          this.goal.set(this.hams);
          ham.setDepth(2);
          if (this.hams >= GOAL && !this.done) { this.done = true; this.time.delayedCall(300, () => this.win(3)); }
        },
      });
    });
  }

  // ---------- dragging an apple from the basket ----------

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.done || this.apple) return;
    if (Math.abs(p.x - BASKET.x) > 260 || p.y < BASKET.y - 330 || p.y > BASKET.y + 40) return;
    sfx.pop();
    this.apple = this.add.image(p.x, p.y - 90, 'apple').setScale(0.7).setDepth(9500);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.apple && p.isDown) this.apple.setPosition(p.x, p.y - 90);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const apple = this.apple;
    if (!apple) return;
    const alive = this.pigs.filter(g => g.alive && pigStage(g.apples) !== 'fat');
    const i = nearest(alive.map(g => ({ x: g.x, y: FEET_Y - g.img.displayHeight * 0.5 })), { x: p.x, y: p.y - 90 }, FEED_REACH);
    if (i >= 0) { this.feed(alive[i]); return; }
    // not on a pig: back into the basket
    this.apple = null;
    this.tweens.add({ targets: apple, x: BASKET.x, y: BASKET.y - 150, alpha: 0, duration: 300, onComplete: () => apple.destroy() });
  }
}
