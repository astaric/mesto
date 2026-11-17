import Phaser from 'phaser';
import { W, H } from '../main';
import { progress } from '../core/stages';
import { sfx } from '../core/sfx';
import { text, tapButton } from '../core/touch';

/** Reward: dancing hens and pigs. */
export class FarmFinale extends Phaser.Scene {
  constructor() { super('FarmFinale'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xbfe6ff);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    this.add.rectangle(0, 1000, W, H - 1000, 0x6cd38a).setOrigin(0);
    for (let i = 0; i < 5; i++) this.add.image(150 + i * 440, 1010, 'fence').setOrigin(0.5, 1).setScale(0.9);
    text(this, W / 2, 200, 'Bravo, lovec!', 170);

    const line = ['hen', 'pig', 'hen-gold', 'pig', 'hen'];
    line.forEach((k, i) => {
      const img = this.add.image(250 + i * 387, 1250, k).setOrigin(0.5, 1).setScale(1.1);
      this.tweens.add({ targets: img, y: 1160, duration: 380, delay: i * 120, yoyo: true, repeat: -1, ease: 'Sine.out' });
    });
    sfx.yay();

    for (let i = 0; i < progress.stars; i++) this.add.image(W / 2 + (i - (progress.stars - 1) / 2) * 150, 430, 'star');
    this.add.image(W / 2 - 90, 600, 'coin').setScale(0.8);
    text(this, W / 2 + 20, 600, String(progress.coins), 90);

    for (let i = 0; i < 40; i++) {
      const c = this.add.rectangle(Phaser.Math.Between(0, W), -50, 24, 40, Phaser.Utils.Array.GetRandom([0xff5d5d, 0xffd23f, 0x5dd39e, 0x8f7bff]));
      this.tweens.add({ targets: c, y: H + 80, angle: 720, delay: Phaser.Math.Between(0, 1500), duration: Phaser.Math.Between(1800, 3200), repeat: -1 });
    }
    tapButton(this, W / 2, 1420, 'Še enkrat!', () => this.scene.start('GameSelect'));
  }
}
