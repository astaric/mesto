import Phaser from 'phaser';
import { W } from '../main';
import { sfx, unlockAudio } from '../core/sfx';
import { resetProgress } from '../core/stages';
import { text, tapButton } from '../core/touch';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xffe8a3);
    text(this, W / 2, 260, 'Silly Food!', 190);
    const chicken = this.add.container(W / 2, 800, [
      this.add.image(0, 0, 'chicken-body'),
      this.add.image(0, -20, 'eyes-happy'),
      this.add.image(0, 90, 'mouth-smile').setScale(0.8),
    ]);
    this.tweens.add({ targets: chicken, angle: { from: -4, to: 4 }, scaleY: { from: 1, to: 1.05 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // First tap unlocks iOS audio.
    tapButton(this, W / 2, 1300, 'Play!', () => {
      unlockAudio();
      sfx.pop();
      resetProgress();
      this.scene.start('StageMap');
    });
  }
}
