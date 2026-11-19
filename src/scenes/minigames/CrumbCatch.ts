import Phaser from 'phaser';
import { W, H } from '../../core/layout';
import { StageScene } from '../../core/MiniGame';
import { dragX } from '../../core/touch';
import { sfx } from '../../core/sfx';
import { starsFor } from '../../core/stars';
import { counter, hudTitle, type Counter } from '../../core/ui';
import { t } from '../../i18n';

const GOAL = 12;
/** Crumbs fall past a lot even when you play well, so the star limits are looser than the usual ones. */
const MISS_LIMITS = [4, 9] as const;

export class CrumbCatch extends StageScene {
  private caught!: Counter;
  private missed = 0;
  private done = false;
  private crumbs: Phaser.GameObjects.Image[] = [];
  private chicken!: Phaser.GameObjects.Container;
  constructor() { super('CrumbCatch'); }

  create(): void {
    this.missed = 0; this.done = false; this.crumbs = [];
    this.backdrop();
    hudTitle(this, t('crumbs.title'), { fade: true });
    this.caught = counter(this, GOAL);

    this.chicken = this.add.container(W / 2, H - 330, [
      this.add.image(0, 0, 'chicken-body').setScale(0.9),
      this.add.image(0, -20, 'eyes-giggle').setScale(0.9),
      this.add.image(0, 80, 'mouth-smile').setScale(0.7),
    ]).setDepth(5);
    this.tweens.add({ targets: this.chicken, scaleY: { from: 1, to: 1.04 }, duration: 300, yoyo: true, repeat: -1 });
    dragX(this, this.chicken, 230, W - 230);

    this.time.addEvent({
      delay: 650, loop: true, callback: () => {
        if (this.done) return;
        const c = this.add.image(Phaser.Math.Between(120, W - 120), -80, 'crumb').setScale(Phaser.Math.FloatBetween(0.7, 1.1));
        this.crumbs.push(c);
        this.tweens.add({ targets: c, angle: 360, duration: 1500, repeat: -1 });
        this.tweens.add({
          targets: c, y: H + 100, duration: Phaser.Math.Between(2200, 3200),
          onComplete: () => { this.crumbs = this.crumbs.filter((o) => o !== c); c.destroy(); if (!this.done) this.missed++; },
        });
      },
    });
  }

  update(): void {
    if (this.done) return;
    const chicken = this.chicken;
    for (const c of [...this.crumbs]) {
      if (Math.abs(c.x - chicken.x) < 220 && c.y > chicken.y - 200 && c.y < chicken.y + 150) {
        this.tweens.killTweensOf(c);
        this.crumbs = this.crumbs.filter((o) => o !== c);
        c.destroy();
        this.caught.add();
        sfx.pop();
        this.tweens.add({ targets: chicken, scaleX: 1.15, scaleY: 0.9, duration: 80, yoyo: true });
        if (this.caught.reached) {
          this.done = true;
          this.win(starsFor(this.missed, MISS_LIMITS), { message: 'common.yum' });
          return;
        }
      }
    }
  }
}
