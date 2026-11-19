import Phaser from 'phaser';
import { INK, INK_CSS, FONT } from './theme';

/** The round white button used for back / home: a glyph on a disc, 160 px hit area, `(x, y)` is its centre. */
export function circleButton(
  scene: Phaser.Scene, glyph: string, onTap: () => void,
  opts: { x?: number; y?: number; fontSize?: number; dy?: number } = {},
): Phaser.GameObjects.Container {
  const { x = 100, y = 100, fontSize = 60, dy = 0 } = opts;
  const bg = scene.add.circle(0, 0, 64, 0xffffff, 0.75).setStrokeStyle(8, INK);
  const label = scene.add.text(glyph === '◀' ? -4 : 0, dy, glyph, { fontFamily: FONT, fontSize: `${fontSize}px`, color: INK_CSS }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, label]).setSize(160, 160).setInteractive();
  c.on('pointerdown', onTap);
  return c;
}

/** White (or `color`) text with the ink outline, for HUD text that must read over any background. */
export function outlined(t: Phaser.GameObjects.Text, color = '#ffffff', thickness = 12): Phaser.GameObjects.Text {
  return t.setColor(color).setStroke(INK_CSS, thickness);
}
