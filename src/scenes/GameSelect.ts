import { W } from '../core/layout';
import { sfx } from '../core/sfx';
import { startJourney, hubScene, type JourneyId } from '../core/stages';
import { text } from '../core/touch';
import { GameScene } from '../core/GameScene';
import { INK } from '../core/theme';
import { t, type Key } from '../i18n';

interface Card { id: JourneyId; icon: string; label: Key; color: number; scale: number }

const cards: Card[] = [
  { id: 'food', icon: 'chicken-body', label: 'select.food', color: 0xfff6e0, scale: 1.1 },
  { id: 'city', icon: 'city-icon', label: 'select.city', color: 0xd9f2ff, scale: 1.1 },
  { id: 'farm', icon: 'farm-icon', label: 'select.farm', color: 0xdcf5d0, scale: 1 },
  { id: 'forest', icon: 'forest-icon', label: 'select.forest', color: 0xcdeccf, scale: 1 },
  { id: 'pizza', icon: 'pizza-icon', label: 'select.pizza', color: 0xffe1c4, scale: 1.1 },
];
const CARD_W = 300;
const FIT = 0.43; // icons were drawn for 600px-wide cards

/** Pick which game (journey) to play. */
export class GameSelect extends GameScene {
  constructor() { super('GameSelect'); }

  create(): void {
    this.fadeInScene();
    text(this, W / 2, 200, t('select.title'), 130);
    cards.forEach((c, i) => {
      const x = W / (2 * cards.length) + (i * W) / cards.length;
      const bg = this.add.rectangle(0, 0, CARD_W, 920, c.color).setStrokeStyle(10, INK);
      const icon = this.add.image(0, -60, c.icon).setScale(c.scale * FIT);
      const label = text(this, 0, 340, t(c.label), 46).setWordWrapWidth(CARD_W - 20);
      const card = this.add.container(x, 800, [bg, icon, label]);
      card.setSize(CARD_W, 920).setInteractive();
      this.tweens.add({ targets: icon, y: -90, duration: 600 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      card.once('pointerdown', () => {
        sfx.pop();
        this.tweens.add({
          targets: card, scale: 0.92, duration: 90, yoyo: true,
          onComplete: () => { startJourney(c.id); this.scene.start(hubScene()); },
        });
      });
    });
  }
}
