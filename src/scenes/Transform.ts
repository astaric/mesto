import { W } from '../core/layout';
import { StageScene } from '../core/MiniGame';
import { sfx } from '../core/sfx';
import { hudTitle } from '../core/ui';
import { t } from '../i18n';

export class Transform extends StageScene {
  constructor() { super('Transform'); }

  create(): void {
    this.backdrop();
    hudTitle(this, t('transform.tap'));
    const chicken = this.add.container(W / 2, 800, [
      this.add.image(0, 0, 'chicken-body'),
      this.add.image(0, -20, 'eyes-surprised'),
      this.add.image(0, 90, 'mouth-smile').setScale(0.8),
    ]);
    chicken.setSize(560, 560).setInteractive();
    this.tweens.add({ targets: chicken, angle: { from: -6, to: 6 }, duration: 120, yoyo: true, repeat: -1 });

    chicken.once('pointerdown', () => {
      sfx.poof();
      this.tweens.killTweensOf(chicken);
      chicken.destroy();
      for (let i = 0; i < 14; i++) {
        const puff = this.add.circle(W / 2, 800, 10, 0xffffff, 0.95);
        const a = (i / 14) * Math.PI * 2;
        this.tweens.add({ targets: puff, x: W / 2 + Math.cos(a) * 420, y: 800 + Math.sin(a) * 420, scale: 14, alpha: 0, duration: 800, onComplete: () => puff.destroy() });
      }
      this.time.delayedCall(500, () => {
        const nugget = this.add.container(W / 2, 800, [
          this.add.image(0, 0, 'nugget'),
          this.add.image(0, -10, 'eyes-happy').setScale(0.9),
          this.add.image(0, 80, 'mouth-smile').setScale(0.8),
          this.add.image(0, -190, 'chef-hat').setScale(0.8),
        ]).setScale(0);
        this.tweens.add({ targets: nugget, scale: 1, duration: 500, ease: 'Back.out' });
        sfx.pop();
        this.win(3, { message: 'transform.done', ms: 2000 }); // nothing to get wrong here
      });
    });
  }
}
