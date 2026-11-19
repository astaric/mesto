import type Phaser from 'phaser';
import { H, W } from '../../../core/layout';

/** The inside of a barn: a wooden wall down to `floorY`, then a floor of hay. */
export function barnInterior(scene: Phaser.Scene, floorY: number): void {
  scene.add.rectangle(0, 180, W, floorY - 180, 0xe9965a).setOrigin(0);
  for (let x = 0; x < W; x += 160) scene.add.rectangle(x, 180, 12, floorY - 180, 0xc77a45).setOrigin(0);
  scene.add.rectangle(0, floorY, W, H - floorY, 0xe8c27a).setOrigin(0);
  scene.add.rectangle(0, floorY - 20, W, 36, 0xc99a55).setOrigin(0);
}

/** Open air: pale sky, grass from `horizonY` down. */
export function meadow(scene: Phaser.Scene, horizonY: number, grass = 0x6cd38a, edge = 0x58bf76): void {
  scene.add.rectangle(0, horizonY, W, H - horizonY, grass).setOrigin(0);
  scene.add.rectangle(0, horizonY - 20, W, 40, edge).setOrigin(0);
}

/** A plank under a row of things that have been collected. */
export function shelf(scene: Phaser.Scene, cx: number, y: number, width: number): void {
  scene.add.rectangle(cx, y, width, 26, 0xa0693a).setStrokeStyle(6, 0x5a3a22).setDepth(1);
}
