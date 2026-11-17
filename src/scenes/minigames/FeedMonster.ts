import Phaser from 'phaser';
import { W } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';

export class FeedMonster extends StageScene {
  private open = false;
  private fed = false;
  constructor() { super('FeedMonster'); }

  create(): void {
    this.open = false; this.fed = false;
    this.backdrop(0xd9f2ff);
    text(this, W / 2, 130, 'Flick the nugget into the mouth!', 80);
    const monster = this.add.image(W / 2, 640, 'monster').setScale(1.1);
    const mouth = this.add.image(W / 2, 780, 'monster-mouth-closed');
    this.tweens.add({ targets: [monster, mouth], y: '+=14', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.time.addEvent({
      delay: 1100, loop: true, callback: () => {
        this.open = !this.open;
        mouth.setTexture(this.open ? 'monster-mouth-open' : 'monster-mouth-closed');
      },
    });

    const home = { x: W / 2, y: 1300 };
    const nugget = this.add.container(home.x, home.y, [
      this.add.image(0, 0, 'nugget').setScale(0.6),
      this.add.image(0, -5, 'eyes-happy').setScale(0.5),
      this.add.image(0, 45, 'mouth-smile').setScale(0.45),
      this.add.image(0, -110, 'chef-hat').setScale(0.45),
    ]).setSize(320, 300).setInteractive({ draggable: true });
    this.input.setDraggable(nugget);
    nugget.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { nugget.setPosition(x, y); });
    nugget.on('dragend', () => {
      if (this.fed) return;
      const inMouth = Math.abs(nugget.x - mouth.x) < 300 && Math.abs(nugget.y - mouth.y) < 260;
      if (inMouth && this.open) {
        this.fed = true;
        this.tweens.add({ targets: nugget, x: mouth.x, y: mouth.y, scale: 0, duration: 250, onComplete: () => {
          sfx.chomp();
          this.time.delayedCall(500, () => this.finish(1));
        } });
      } else {
        sfx.boing();
        this.tweens.add({ targets: nugget, x: home.x, y: home.y, duration: 400, ease: 'Bounce.out' });
      }
    });
  }
}
