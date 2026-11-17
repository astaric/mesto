import Phaser from 'phaser';
import { W, H } from '../main';
import { progress } from '../core/stages';
import { sfx } from '../core/sfx';
import { text, tapButton } from '../core/touch';

/** Reward: the finished octopus salad on the table, with a chef hat. */
export class HobotnicaFinale extends Phaser.Scene {
  constructor() { super('HobotnicaFinale'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xfff1c9);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    this.add.rectangle(0, 1000, W, H - 1000, 0xc98a4b).setOrigin(0);
    this.add.rectangle(0, 990, W, 30, 0xa0693a).setOrigin(0);
    text(this, W / 2, 200, 'Dober tek!', 190);

    const salad = this.add.image(W / 2, 1150, 'salad').setOrigin(0.5, 1).setScale(1.2);
    const hat = this.add.image(W / 2, 700, 'chef-hat').setScale(0.7);
    this.tweens.add({ targets: [salad, hat], y: '-=60', duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    sfx.yay();
    this.time.delayedCall(700, () => sfx.boing());

    for (let i = 0; i < progress.stars; i++) this.add.image(W / 2 + (i - (progress.stars - 1) / 2) * 150, 430, 'star');

    for (let i = 0; i < 40; i++) {
      const c = this.add.rectangle(Phaser.Math.Between(0, W), -50, 24, 40, Phaser.Utils.Array.GetRandom([0xff5d5d, 0xffd23f, 0x5dd39e, 0x8f7bff]));
      this.tweens.add({ targets: c, y: H + 80, angle: 720, delay: Phaser.Math.Between(0, 1500), duration: Phaser.Math.Between(1800, 3200), repeat: -1 });
    }
    tapButton(this, W / 2, 1400, 'Še enkrat!', () => this.scene.start('GameSelect'));
  }
}
