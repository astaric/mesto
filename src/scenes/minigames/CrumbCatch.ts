import Phaser from 'phaser';
import { W, H } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { dragX, text } from '../../core/touch';
import { sfx } from '../../core/sfx';

const GOAL = 12;

export class CrumbCatch extends StageScene {
  private caught = 0;
  private done = false;
  constructor() { super('CrumbCatch'); }

  create(): void {
    this.caught = 0; this.done = false;
    this.backdrop();
    const title = text(this, W / 2, 120, 'Ujemi drobtine!', 90);
    const score = text(this, W / 2, 230, `0 / ${GOAL}`, 80);
    this.tweens.add({ targets: title, alpha: 0.4, delay: 2500, duration: 600 });

    const chicken = this.add.container(W / 2, H - 330, [
      this.add.image(0, 0, 'chicken-body').setScale(0.9),
      this.add.image(0, -20, 'eyes-giggle').setScale(0.9),
      this.add.image(0, 80, 'mouth-smile').setScale(0.7),
    ]).setDepth(5);
    this.tweens.add({ targets: chicken, scaleY: { from: 1, to: 1.04 }, duration: 300, yoyo: true, repeat: -1 });
    dragX(this, chicken, 230, W - 230);

    this.time.addEvent({
      delay: 650, loop: true, callback: () => {
        if (this.done) return;
        const c = this.add.image(Phaser.Math.Between(120, W - 120), -80, 'crumb').setScale(Phaser.Math.FloatBetween(0.7, 1.1));
        this.tweens.add({ targets: c, angle: 360, duration: 1500, repeat: -1 });
        this.tweens.add({ targets: c, y: H + 100, duration: Phaser.Math.Between(2200, 3200), onComplete: () => c.destroy() });
        c.setData('crumb', true);
      },
    });

    this.events.on('update', () => {
      if (this.done) return;
      this.children.list.forEach((o) => {
        if (!o.getData?.('crumb')) return;
        const c = o as Phaser.GameObjects.Image;
        if (Math.abs(c.x - chicken.x) < 220 && c.y > chicken.y - 200 && c.y < chicken.y + 150) {
          this.tweens.killTweensOf(c);
          c.destroy();
          this.caught++;
          score.setText(`${this.caught} / ${GOAL}`);
          sfx.pop();
          this.tweens.add({ targets: chicken, scaleX: 1.15, scaleY: 0.9, duration: 80, yoyo: true });
          if (this.caught >= GOAL) {
            this.done = true;
            title.setText('Mmm! 🎉').setAlpha(1);
            this.time.delayedCall(900, () => this.finish(1));
          }
        }
      });
    });
  }
}
