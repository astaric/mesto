import Phaser from 'phaser';
import { W } from '../../../core/layout';
import { StageScene } from '../../../core/MiniGame';
import { huntSave, saveHunt } from '../../../core/huntSave';
import { profile } from '../../../core/profile';
import { sfx } from '../../../core/sfx';
import { totalStars } from '../../../core/stages';
import { text, tapButton } from '../../../core/touch';
import { coinCounter, hudTitle, outlined, pay, priceTag, type CoinCounter } from '../../../core/ui';
import { INK, INK_CSS } from '../../../core/theme';
import { t } from '../../../i18n';
import { HUNT_WEAPONS, unlocked, type HuntWeapon } from './huntWeapons';

interface Card { w: HuntWeapon; bg: Phaser.GameObjects.Rectangle; status: Phaser.GameObjects.Text; price: Phaser.GameObjects.Container; need: Phaser.GameObjects.Text; gun: Phaser.GameObjects.Image }

const CARD_W = 440;
const CARD_GAP = 480;

/** Buy hunting rifles with coins (a rifle also needs a total number of stars, which are only counted, never spent) and
 *  pick the one to take to the lookout. Every door of the lookout leads here first, then on to the hunt. */
export class HuntShop extends StageScene {
  private cards: Card[] = [];
  private wallet!: CoinCounter;

  constructor() { super('HuntShop'); }

  create(): void {
    this.cards = [];
    this.backdrop(0xdff1d0);
    this.add.rectangle(0, 1250, W, 286, 0xb9dca0).setOrigin(0);
    hudTitle(this, t('hunt.shop.title'));
    this.wallet = coinCounter(this);
    outlined(text(this, W / 2, 240, `⭐ ${totalStars()}`, 80));
    text(this, W / 2, 1222, t('shop.earn'), 44).setWordWrapWidth(W - 300);

    const x0 = W / 2 - CARD_GAP * (HUNT_WEAPONS.length - 1) / 2;
    HUNT_WEAPONS.forEach((w, i) => {
      const x = x0 + i * CARD_GAP;
      const bg = this.add.rectangle(x, 760, CARD_W, 840, 0xffffff, 0.9).setStrokeStyle(10, INK);
      const gun = this.add.image(x, 800, w.tex);
      gun.setScale(440 / gun.height);
      text(this, x, 410, t(w.name), 52).setWordWrapWidth(CARD_W - 30);
      const price = priceTag(this, x, 1110, w.price, 70);
      const need = text(this, x, 1110,t('hunt.shop.stars', { n: w.stars }), 46);
      const status = text(this, x, 1110, '', 60);
      const hit = this.add.rectangle(x, 760, CARD_W, 840, 0xffffff, 0.001).setInteractive();
      const card: Card = { w, bg, status, price, need, gun };
      hit.on('pointerdown', () => this.tap(card));
      this.cards.push(card);
    });

    tapButton(this, W / 2, 1400, t('hunt.shop.go'), () => this.go());
    this.refresh();
  }

  private refresh(): void {
    this.wallet.label.setText(String(profile.coins));
    const stars = totalStars();
    for (const c of this.cards) {
      const owned = huntSave.owned.includes(c.w.id);
      const equipped = huntSave.weapon === c.w.id;
      const open = unlocked(c.w, stars);
      c.bg.setFillStyle(equipped ? 0xc9f2b4 : 0xffffff, 0.92).setStrokeStyle(equipped ? 16 : 10, equipped ? 0x2f9e5b : INK);
      c.price.setVisible(!owned && open);
      c.need.setVisible(!owned && !open);
      c.status.setVisible(owned);
      if (owned) c.status.setText(t(equipped ? 'shop.equipped' : 'shop.owned')).setColor(INK_CSS).setFontSize(equipped ? 52 : 60);
      c.gun.setAlpha(owned || (open && profile.coins >= c.w.price) ? 1 : 0.55);
    }
  }

  private tap(c: Card): void {
    const w = c.w;
    if (huntSave.owned.includes(w.id)) {
      huntSave.weapon = w.id;
      sfx.pop();
    } else if (!unlocked(w, totalStars())) {
      sfx.burp();
      this.tweens.add({ targets: c.bg, x: c.bg.x + 14, duration: 50, yoyo: true, repeat: 3 });
    } else if (pay(this, this.wallet, w.price)) {
      huntSave.owned.push(w.id);
      huntSave.weapon = w.id;
      sfx.coin(); sfx.chest();
      this.tweens.add({ targets: c.bg, scaleX: 1.06, scaleY: 1.03, duration: 120, yoyo: true });
    }
    saveHunt();
    this.refresh();
  }

  private go(): void {
    saveHunt();
    this.fadeToScene('HuntLookout');
  }
}
