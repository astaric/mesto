import Phaser from 'phaser';
import { W, H } from '../main';
import { progress, type Pet } from '../core/stages';
import { sfx } from '../core/sfx';
import { text, tapButton } from '../core/touch';

/** Reward: the meadow at the end of the city. */
export class MestoFinale extends Phaser.Scene {
  constructor() { super('MestoFinale'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xbfe6ff);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    this.add.rectangle(0, 1000, W, H - 1000, 0x6cd38a).setOrigin(0);
    for (let i = 0; i < 5; i++) this.add.image(150 + i * 440, 1010, 'fence').setOrigin(0.5, 1).setScale(0.9);
    text(this, W / 2, 200, 'Bravo!', 190);

    const pets: Pet[] = ['dog', 'cat', 'bunny'];
    const others = pets.filter(p => p !== progress.pet);
    const lineup: { pet: Pet; x: number; s: number }[] = [
      { pet: others[0], x: 420, s: 0.7 }, { pet: progress.pet, x: W / 2, s: 1.1 }, { pet: others[1], x: W - 420, s: 0.7 },
    ];
    lineup.forEach((l, i) => {
      const img = this.add.image(l.x, 1180, l.pet).setOrigin(0.5, 1).setScale(l.s);
      this.tweens.add({ targets: img, y: 1180 - 90 * l.s, duration: 380, delay: i * 130, yoyo: true, repeat: -1, ease: 'Sine.out' });
    });
    // Your treat and the cut-up catch.
    const treat = this.add.image(280, 800, progress.treat).setOrigin(0.5, 1).setScale(0.45);
    this.tweens.add({ targets: treat, y: 760, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const fishScale = 0.5;
    const tex = this.textures.get(progress.fish).getSourceImage();
    [0, 1, 2, 3].forEach(p => {
      const x0 = Math.floor((p / 4) * tex.width);
      const x1 = Math.ceil(((p + 1) / 4) * tex.width);
      const piece = this.add.image(W - 330 + (p - 1.5) * 34, 800, progress.fish).setScale(fishScale).setOrigin(0.5, 1);
      piece.setCrop(x0, 0, x1 - x0, tex.height);
      this.tweens.add({ targets: piece, y: 760, duration: 420, delay: p * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    sfx.yay();
    this.time.delayedCall(700, () => sfx.boing());

    for (let i = 0; i < progress.stars; i++) this.add.image(W / 2 + (i - (progress.stars - 1) / 2) * 150, 430, 'star');
    this.add.image(W / 2 - 90, 600, 'coin').setScale(0.8);
    text(this, W / 2 + 20, 600, String(progress.coins), 90);

    for (let i = 0; i < 40; i++) {
      const c = this.add.rectangle(Phaser.Math.Between(0, W), -50, 24, 40, Phaser.Utils.Array.GetRandom([0xff5d5d, 0xffd23f, 0x5dd39e, 0x8f7bff]));
      this.tweens.add({ targets: c, y: H + 80, angle: 720, delay: Phaser.Math.Between(0, 1500), duration: Phaser.Math.Between(1800, 3200), repeat: -1 });
    }
    tapButton(this, W / 2, 1400, 'Še enkrat!', () => this.scene.start('GameSelect'));
  }
}
