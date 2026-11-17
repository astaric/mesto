import Phaser from 'phaser';
import { W } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { progress } from '../../core/stages';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';

const CUTS = [0.25, 0.5, 0.75];
const CX = 1024; // W / 2 (W can't be read at module load: circular import with main.ts)
const CY = 860;
const GAP = 46;

/** At home in the kitchen: swipe a finger across the dashed lines to cut the fish or octopus on the board. */
export class FishCut extends StageScene {
  private pieces: Phaser.GameObjects.Image[] = [];
  private lines: { x: number; dashes: Phaser.GameObjects.Rectangle[]; cut: boolean }[] = [];
  private knife!: Phaser.GameObjects.Image;
  private prev: Phaser.Math.Vector2 | null = null;
  private top = 0;
  private bottom = 0;
  private done = false;

  constructor() { super('FishCut'); }

  create(): void {
    this.pieces = []; this.lines = []; this.prev = null; this.done = false;
    this.backdrop(0xfff1c9);
    // Kitchen: tiles on the wall, worktop.
    for (let y = 0; y < 760; y += 128) for (let x = 0; x < W; x += 128) {
      this.add.rectangle(x, y, 128, 128, ((x / 128 + y / 128) % 2) ? 0xfff8e1 : 0xffefc2).setOrigin(0);
    }
    this.add.rectangle(0, 760, W, 776, 0xc98a4b).setOrigin(0);
    this.add.rectangle(0, 740, W, 40, 0xa0693a).setOrigin(0);
    this.add.image(CX, CY + 40, 'board').setScale(0.85);
    text(this, CX, 150, 'Potegni čez črte!', 110);

    const key = progress.fish;
    const scale = key === 'fish' ? 1.2 : 1.1;
    const probe = this.add.image(0, 0, key).setVisible(false);
    const tw = probe.width;
    const th = probe.height;
    probe.destroy();
    const left = CX - (tw * scale) / 2;
    this.top = CY - (th * scale) / 2;
    this.bottom = CY + (th * scale) / 2;

    // One cropped copy of the same texture per slice.
    const edges = [0, ...CUTS, 1];
    for (let p = 0; p < edges.length - 1; p++) {
      const x0 = Math.floor(edges[p] * tw);
      const x1 = Math.ceil(edges[p + 1] * tw);
      const img = this.add.image(CX, CY, key).setScale(scale).setDepth(1);
      img.setCrop(x0, 0, x1 - x0, th);
      this.pieces.push(img);
    }

    // Dashed cut lines.
    for (const f of CUTS) {
      const x = left + f * tw * scale;
      const dashes: Phaser.GameObjects.Rectangle[] = [];
      for (let y = this.top - 70; y < this.bottom + 70; y += 70) {
        dashes.push(this.add.rectangle(x, y + 20, 14, 40, 0xff3b3b).setDepth(3).setStrokeStyle(3, 0xffffff));
      }
      this.tweens.add({ targets: dashes, alpha: 0.4, duration: 450, yoyo: true, repeat: -1 });
      this.lines.push({ x, dashes, cut: false });
    }

    this.knife = this.add.image(-300, -300, 'knife').setScale(0.5).setOrigin(0.5, 0.3).setAngle(25).setDepth(10).setVisible(false);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.prev = new Phaser.Math.Vector2(p.x, p.y);
      this.knife.setPosition(p.x, p.y).setVisible(true);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.done) return;
      this.knife.setPosition(p.x, p.y);
      if (this.prev) this.checkCuts(this.prev.x, this.prev.y, p.x, p.y);
      this.prev = new Phaser.Math.Vector2(p.x, p.y);
    });
    this.input.on('pointerup', () => { this.prev = null; this.knife.setVisible(false); });
  }

  /** Did the finger path (x0,y0)->(x1,y1) cross an uncut line within the fish's height? */
  private checkCuts(x0: number, y0: number, x1: number, y1: number): void {
    this.lines.forEach((l, i) => {
      if (l.cut) return;
      if ((x0 - l.x) * (x1 - l.x) > 0) return;
      const t = x1 === x0 ? 0.5 : (l.x - x0) / (x1 - x0);
      const y = y0 + (y1 - y0) * t;
      if (y < this.top - 80 || y > this.bottom + 80) return;
      this.cut(i);
    });
  }

  private cut(i: number): void {
    const l = this.lines[i];
    l.cut = true;
    sfx.chop();
    this.tweens.killTweensOf(l.dashes);
    this.tweens.add({ targets: l.dashes, alpha: 0, scaleY: 0.2, duration: 200, onComplete: () => l.dashes.forEach(d => d.destroy()) });
    this.cameras.main.shake(80, 0.004);
    // Pieces in the same joined group move together; spread the groups apart.
    this.pieces.forEach((img, p) => {
      const leftCuts = this.lines.slice(0, p).filter(x => x.cut).length;
      const rightCuts = this.lines.slice(p).filter(x => x.cut).length;
      this.tweens.add({ targets: img, x: CX + (GAP * (leftCuts - rightCuts)) / 2, duration: 200, ease: 'Back.out' });
    });
    if (this.lines.every(x => x.cut)) {
      this.done = true;
      this.knife.setVisible(false);
      this.time.delayedCall(500, () => {
        sfx.yay();
        text(this, CX, 1380, 'Narezano!', 130).setDepth(12);
        this.pieces.forEach((img, p) => this.tweens.add({ targets: img, y: CY - 50, duration: 200, delay: p * 90, yoyo: true }));
      });
      this.time.delayedCall(2200, () => this.finish(3));
    }
  }
}
