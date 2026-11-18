import Phaser from 'phaser';
import { W } from '../main';
import { sfx } from '../core/sfx';
import { startJourney, type JourneyId } from '../core/stages';
import { text } from '../core/touch';

interface Card { id: JourneyId; icon: string; label: string; color: number; scale: number }

const cards: Card[] = [
  { id: 'food', icon: 'chicken-body', label: 'Smešna hrana!', color: 0xfff6e0, scale: 1.1 },
  { id: 'mesto', icon: 'city-icon', label: 'Mesto', color: 0xd9f2ff, scale: 1.1 },
  { id: 'farm', icon: 'farm-icon', label: 'Lov!', color: 0xdcf5d0, scale: 1 },
  { id: 'hobotnica', icon: 'octopus-icon', label: 'Hobotnica', color: 0xd4e8ff, scale: 1.1 },
  { id: 'gozd', icon: 'gozd-ikona', label: 'Gozd', color: 0xcdeccf, scale: 1 },
  { id: 'pica', icon: 'pizza-icon', label: 'Pica', color: 0xffe1c4, scale: 1.1 },
];
const CARD_W = 300;
const FIT = 0.43; // icons were drawn for 600px-wide cards

/** Pick which game (journey) to play. */
export class GameSelect extends Phaser.Scene {
  constructor() { super('GameSelect'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xffe8a3);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    text(this, W / 2, 200, 'Izberi igro!', 130);
    cards.forEach((c, i) => {
      const x = W / (2 * cards.length) + (i * W) / cards.length;
      const bg = this.add.rectangle(0, 0, CARD_W, 920, c.color).setStrokeStyle(10, 0x5a3a22);
      const icon = this.add.image(0, -60, c.icon).setScale(c.scale * FIT);
      const label = text(this, 0, 340, c.label, 46).setWordWrapWidth(CARD_W - 20);
      const card = this.add.container(x, 800, [bg, icon, label]);
      card.setSize(CARD_W, 920).setInteractive();
      this.tweens.add({ targets: icon, y: -90, duration: 600 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      card.once('pointerdown', () => {
        sfx.pop();
        this.tweens.add({
          targets: card, scale: 0.92, duration: 90, yoyo: true,
          onComplete: () => { startJourney(c.id); this.scene.start('StageMap'); },
        });
      });
    });
  }
}
