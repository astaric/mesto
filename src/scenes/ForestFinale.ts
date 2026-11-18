import Phaser from 'phaser';
import { W, H } from '../main';
import { progress } from '../core/stages';
import { sfx } from '../core/sfx';
import { text, tapButton } from '../core/touch';

/** Reward: the forest animals cheer for the hunter. */
export class ForestFinale extends Phaser.Scene {
  constructor() { super('ForestFinale'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xbfe6ff);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    this.add.rectangle(0, 1000, W, H - 1000, 0x4f9f45).setOrigin(0);
    for (let i = 0; i < 5; i++) this.add.image(150 + i * 440, 1010, 'forest-pine').setOrigin(0.5, 1).setScale(0.8);
    text(this, W / 2, 200, 'Bravo, gozdar!', 170);

    ['bunny', 'forest-mushroom', 'bunny', 'forest-mushroom', 'bunny'].forEach((k, i) => {
      const img = this.add.image(250 + i * 387, 1250, k).setOrigin(0.5, 1).setScale(k === 'bunny' ? 1 : 0.9);
      this.tweens.add({ targets: img, y: 1160, duration: 380, delay: i * 120, yoyo: true, repeat: -1, ease: 'Sine.out' });
    });
    sfx.yay();

    for (let i = 0; i < progress.stars; i++) this.add.image(W / 2 + (i - (progress.stars - 1) / 2) * 150, 430, 'star');
    this.add.image(W / 2 - 90, 600, 'coin').setScale(0.8);
    text(this, W / 2 + 20, 600, String(progress.coins), 90);
    tapButton(this, W / 2, 1420, 'Še enkrat!', () => this.scene.start('GameSelect'));
  }
}
