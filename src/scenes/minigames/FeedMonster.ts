import Phaser from 'phaser';
import { W } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { sfx } from '../../core/sfx';
import { starsFor } from '../../core/stars';
import { hudTitle } from '../../core/ui';
import { t, type Key } from '../../i18n';

interface Data { food?: string; title?: Key }

export class FeedMonster extends StageScene {
  private open = false;
  private fed = false;
  private misses = 0;
  private cfg: Data = {};
  constructor() { super('FeedMonster'); }

  init(d: Data): void { this.cfg = d ?? {}; }

  create(): void {
    this.open = false; this.fed = false; this.misses = 0;
    this.backdrop(0xd9f2ff);
    hudTitle(this, t(this.cfg.title ?? 'feed.nugget'));
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
    const parts = this.cfg.food
      ? [this.add.image(0, 0, this.cfg.food).setScale(0.55)]
      : [
        this.add.image(0, 0, 'nugget').setScale(0.6),
        this.add.image(0, -5, 'eyes-happy').setScale(0.5),
        this.add.image(0, 45, 'mouth-smile').setScale(0.45),
        this.add.image(0, -110, 'chef-hat').setScale(0.45),
      ];
    const nugget = this.add.container(home.x, home.y, parts).setSize(320, 300).setInteractive({ draggable: true });
    this.input.setDraggable(nugget);
    nugget.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { nugget.setPosition(x, y); });
    nugget.on('dragend', () => {
      if (this.fed) return;
      const inMouth = Math.abs(nugget.x - mouth.x) < 300 && Math.abs(nugget.y - mouth.y) < 260;
      if (inMouth && this.open) {
        this.fed = true;
        this.tweens.add({ targets: nugget, x: mouth.x, y: mouth.y, scale: 0, duration: 250, onComplete: () => {
          sfx.chomp();
          this.time.delayedCall(300, () => this.win(starsFor(this.misses)));
        } });
      } else {
        sfx.boing();
        this.misses++;
        this.tweens.add({ targets: nugget, x: home.x, y: home.y, duration: 400, ease: 'Bounce.out' });
      }
    });
  }
}
