import Phaser from 'phaser';
import { W } from '../main';
import { sfx } from '../core/sfx';
import { startJourney, type JourneyId } from '../core/stages';
import { text } from '../core/touch';

interface Card { id: JourneyId; icon: string; label: string; color: number; scale: number }

const cards: Card[] = [
  { id: 'food', icon: 'chicken-body', label: 'Silly Food!', color: 0xfff6e0, scale: 1.1 },
  { id: 'mesto', icon: 'city-icon', label: 'Mesto', color: 0xd9f2ff, scale: 1.1 },
];

/** Pick which game (journey) to play. */
export class GameSelect extends Phaser.Scene {
  constructor() { super('GameSelect'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xffe8a3);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    text(this, W / 2, 200, 'Izberi igro!', 130);
    cards.forEach((c, i) => {
      const x = W / 4 + (i * W) / 2;
      const bg = this.add.rectangle(0, 0, 820, 920, c.color).setStrokeStyle(10, 0x5a3a22);
      const icon = this.add.image(0, -60, c.icon).setScale(c.scale);
      const label = text(this, 0, 340, c.label, 110);
      const card = this.add.container(x, 800, [bg, icon, label]);
      card.setSize(820, 920).setInteractive();
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
