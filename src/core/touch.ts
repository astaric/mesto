import Phaser from 'phaser';
import { FONT, INK_CSS } from './theme';

/** Make an object horizontally draggable (finger-follow) within bounds. */
export function dragX(scene: Phaser.Scene, obj: Phaser.GameObjects.Container, minX: number, maxX: number): void {
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (p.isDown) obj.x = Phaser.Math.Clamp(p.x, minX, maxX);
  });
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    obj.x = Phaser.Math.Clamp(p.x, minX, maxX);
  });
}

/** Big, forgiving tap target: image with squash feedback. */
export function tapButton(
  scene: Phaser.Scene, x: number, y: number, label: string, onTap: () => void,
): Phaser.GameObjects.Container {
  const bg = scene.add.image(0, 0, 'button');
  const txt = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffffff', stroke: '#2c6b4f', strokeThickness: 10 }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, txt]);
  c.setSize(bg.width + 40, bg.height + 40).setInteractive();
  c.on('pointerdown', () => scene.tweens.add({ targets: c, scale: 0.9, duration: 80, yoyo: true, onComplete: onTap }));
  scene.tweens.add({ targets: c, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  return c;
}

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 80): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: INK_CSS, align: 'center' }).setOrigin(0.5);
}
