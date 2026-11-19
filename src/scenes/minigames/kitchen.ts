import Phaser from 'phaser';
import { W } from '../../core/layout';

/** A chequered tile wall from the top of the screen down to `height` (kitchen and pizzeria share it). */
export function tiledWall(scene: Phaser.Scene, height: number, light: number, dark: number, tileH = 128): void {
  for (let y = 0; y < height; y += tileH) {
    for (let x = 0; x < W; x += 128) {
      scene.add.rectangle(x, y, 128, tileH, ((x / 128 + y / tileH) % 2) ? light : dark).setOrigin(0);
    }
  }
}

/** A puff of steam that rises and fades. */
export function puff(scene: Phaser.Scene, x: number, y: number, delay = 0): void {
  const p = scene.add.circle(x, y, Phaser.Math.Between(22, 44), 0xffffff, 0.8).setStrokeStyle(4, 0xdddddd).setDepth(4).setAlpha(0);
  scene.tweens.add({ targets: p, alpha: { from: 0.9, to: 0 }, y: y - 210, scale: 1.8, duration: 900, delay, onComplete: () => p.destroy() });
}
