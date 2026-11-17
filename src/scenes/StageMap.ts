import Phaser from 'phaser';
import { W } from '../main';
import { progress, currentJourney } from '../core/stages';
import { sfx } from '../core/sfx';
import { text, tapButton } from '../core/touch';

export class StageMap extends Phaser.Scene {
  constructor() { super('StageMap'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xffe8a3);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    const { title, stages } = currentJourney();
    text(this, W / 2, 200, title, 120);
    const gap = W / (stages.length + 1);
    stages.forEach((s, i) => {
      const x = gap * (i + 1);
      const done = i < progress.index;
      const current = i === progress.index;
      const img = this.add.image(x, 760, s.icon).setScale(s.icon === 'monster' ? 0.4 : 0.5).setAlpha(done ? 0.5 : current ? 1 : 0.35);
      if (current) this.tweens.add({ targets: img, y: 730, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (done) this.add.image(x + 90, 640, 'star').setScale(0.9);
      text(this, x, 1010, s.label, 64).setAlpha(current ? 1 : 0.5);
    });
    const next = stages[progress.index];
    if (!next) { this.scene.start('Title'); return; }
    tapButton(this, W / 2, 1320, 'Go!', () => { sfx.whoosh(); this.scene.start(next.scene, next.data); });
  }
}
