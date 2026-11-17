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
    // Long journeys wrap onto two rows.
    const rows = stages.length > 6 ? 2 : 1;
    const perRow = Math.ceil(stages.length / rows);
    const iconScale = rows === 2 ? 0.36 : 0.5;
    stages.forEach((s, i) => {
      const row = Math.floor(i / perRow);
      const inRow = i - row * perRow;
      const count = row === rows - 1 ? stages.length - perRow * row : perRow;
      const gap = W / (count + 1);
      const x = gap * (inRow + 1);
      const y = rows === 2 ? 500 + row * 400 : 760;
      const done = i < progress.index;
      const current = i === progress.index;
      const img = this.add.image(x, y, s.icon).setScale(s.icon === 'monster' ? iconScale * 0.8 : iconScale).setAlpha(done ? 0.5 : current ? 1 : 0.35);
      if (current) this.tweens.add({ targets: img, y: y - 30, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (done) this.add.image(x + 80, y - 100, 'star').setScale(rows === 2 ? 0.7 : 0.9);
      text(this, x, y + (rows === 2 ? 170 : 250), s.label, rows === 2 ? 54 : 64).setAlpha(current ? 1 : 0.5);
    });
    const next = stages[progress.index];
    if (!next) { this.scene.start('Title'); return; }
    tapButton(this, W / 2, 1320, 'Go!', () => { sfx.whoosh(); this.scene.start(next.scene, next.data); });
  }
}
