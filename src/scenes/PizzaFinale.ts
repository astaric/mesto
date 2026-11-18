import Phaser from 'phaser';
import { W, H } from '../main';
import { progress } from '../core/stages';
import { sfx } from '../core/sfx';
import { text, tapButton } from '../core/touch';
import { t } from '../i18n';

const LAYERS = ['dough', 'sauce', 'cheese', 'ham', 'mushrooms', 'olives'];

/** Reward: a fully loaded pizza on the table, with a chef hat. */
export class PizzaFinale extends Phaser.Scene {
  constructor() { super('PizzaFinale'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xfff1c9);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    this.add.rectangle(0, 1000, W, H - 1000, 0xc98a4b).setOrigin(0);
    this.add.rectangle(0, 990, W, 30, 0xa0693a).setOrigin(0);
    text(this, W / 2, 200, t('finale.meal'), 190);

    const pizza = this.add.container(W / 2, 800, LAYERS.map(k => this.add.image(0, 0, `pizza-${k === 'cheese' ? 'cheese-baked' : k}`).setScale(0.8)));
    const hat = this.add.image(W / 2, 480, 'chef-hat').setScale(0.6);
    this.tweens.add({ targets: [pizza, hat], y: '-=50', duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    sfx.yay();
    this.time.delayedCall(700, () => sfx.boing());

    for (let i = 0; i < progress.stars; i++) this.add.image(W / 2 + (i - (progress.stars - 1) / 2) * 150, 1180, 'star');

    for (let i = 0; i < 40; i++) {
      const c = this.add.rectangle(Phaser.Math.Between(0, W), -50, 24, 40, Phaser.Utils.Array.GetRandom([0xff5d5d, 0xffd23f, 0x5dd39e, 0x8f7bff]));
      this.tweens.add({ targets: c, y: H + 80, angle: 720, delay: Phaser.Math.Between(0, 1500), duration: Phaser.Math.Between(1800, 3200), repeat: -1 });
    }
    tapButton(this, W / 2, 1400, t('common.again'), () => this.scene.start('GameSelect'));
  }
}
