import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { forestSave, saveForest } from '../../core/forestSave';
import { sfx } from '../../core/sfx';
import { text, tapButton } from '../../core/touch';
import { t } from '../../i18n';
import { WEAPONS, type Weapon } from './weapons';
import { INK, INK_CSS } from '../../core/theme';

interface Card { w: Weapon; bg: Phaser.GameObjects.Rectangle; status: Phaser.GameObjects.Text; coin: Phaser.GameObjects.Image; gun: Phaser.GameObjects.Image }

/** Spend forest coins on weapons and pick the one to take along. Reached as a stage and from the end-of-run screen. */
export class ForestShop extends StageScene {
  private from = 'stage';
  private cards: Card[] = [];
  private counter!: Phaser.GameObjects.Text;

  constructor() { super('ForestShop'); }

  init(d?: { from?: string }): void { this.from = d?.from ?? 'stage'; }

  create(): void {
    this.cards = [];
    this.backdrop(0xdff1d0);
    this.add.rectangle(0, 1250, W, 286, 0xb9dca0).setOrigin(0);
    text(this, W / 2, 130, t('shop.title'), 120);
    this.add.image(W - 330, 90, 'coin').setScale(0.7);
    this.counter = text(this, W - 200, 90, '', 80);

    WEAPONS.forEach((w, i) => {
      const x = 224 + i * 400;
      const bg = this.add.rectangle(x, 760, 370, 840, 0xffffff, 0.9).setStrokeStyle(10, INK);
      const gun = this.add.image(x, 800, w.tex);
      gun.setScale(440 / gun.height);
      text(this, x, 410, t(w.name), 52).setWordWrapWidth(350);
      const coin = this.add.image(x - 64, 1110, 'coin').setScale(0.55);
      const status = text(this, x + 20, 1110, '', 70);
      const hit = this.add.rectangle(x, 760, 370, 840, 0xffffff, 0.001).setInteractive();
      hit.on('pointerdown', () => this.tap(w, bg));
      this.cards.push({ w, bg, status, coin, gun });
    });

    tapButton(this, W / 2, 1400, t('shop.go'), () => this.go());
    this.refresh();
  }

  private refresh(): void {
    this.counter.setText(String(forestSave.coins));
    for (const c of this.cards) {
      const owned = forestSave.owned.includes(c.w.id);
      const equipped = forestSave.weapon === c.w.id;
      c.bg.setFillStyle(equipped ? 0xc9f2b4 : 0xffffff, 0.92).setStrokeStyle(equipped ? 16 : 10, equipped ? 0x2f9e5b : INK);
      c.coin.setVisible(!owned);
      if (!owned) {
        c.status.setText(String(c.w.price)).setX(c.bg.x + 20).setColor(forestSave.coins >= c.w.price ? INK_CSS : '#b5a79a');
        c.gun.setAlpha(forestSave.coins >= c.w.price ? 1 : 0.55);
      } else {
        c.status.setText(t(equipped ? 'shop.equipped' : 'shop.owned')).setX(c.bg.x).setColor(INK_CSS).setFontSize(equipped ? 52 : 60);
        c.gun.setAlpha(1);
      }
    }
  }

  private tap(w: Weapon, bg: Phaser.GameObjects.Rectangle): void {
    if (forestSave.owned.includes(w.id)) {
      forestSave.weapon = w.id;
      sfx.pop();
    } else if (forestSave.coins >= w.price) {
      forestSave.coins -= w.price;
      forestSave.owned.push(w.id);
      forestSave.weapon = w.id;
      sfx.coin(); sfx.chest();
      this.tweens.add({ targets: bg, scaleX: 1.06, scaleY: 1.03, duration: 120, yoyo: true });
    } else {
      sfx.burp();
      this.tweens.add({ targets: bg, x: bg.x + 14, duration: 50, yoyo: true, repeat: 3 });
    }
    saveForest();
    this.refresh();
  }

  private go(): void {
    saveForest();
    if (this.from === 'run') this.scene.start('ForestRun');
    else this.finish(0);
  }
}
