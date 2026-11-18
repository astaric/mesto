import Phaser from 'phaser';
import { W, H } from '../main';
import { progress } from '../core/stages';
import { sfx } from '../core/sfx';
import { text, tapButton } from '../core/touch';
import { t } from '../i18n';

export class Finale extends Phaser.Scene {
  constructor() { super('Finale'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xd9f2ff);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    const monster = this.add.image(W / 2, 700, 'monster');
    this.tweens.add({ targets: monster, scaleX: { from: 1, to: 1.08 }, scaleY: { from: 1, to: 0.94 }, duration: 250, yoyo: true, repeat: 3 });
    sfx.chomp();
    this.time.delayedCall(900, () => sfx.burp());
    text(this, W / 2, 200, t('finale.food'), 140);
    for (let i = 0; i < progress.stars; i++) this.add.image(W / 2 + (i - (progress.stars - 1) / 2) * 150, 1120, 'star');
    for (let i = 0; i < 40; i++) {
      const c = this.add.rectangle(Phaser.Math.Between(0, W), -50, 24, 40, Phaser.Utils.Array.GetRandom([0xff5d5d, 0xffd23f, 0x5dd39e, 0x8f7bff]));
      this.tweens.add({ targets: c, y: H + 80, angle: 720, delay: Phaser.Math.Between(0, 1500), duration: Phaser.Math.Between(1800, 3200), repeat: -1 });
    }
    tapButton(this, W / 2, 1380, t('common.again'), () => this.scene.start('Title'));
  }
}
