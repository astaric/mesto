import Phaser from 'phaser';
import { W, H } from '../core/layout';
import { unlockAudio } from '../core/sfx';
import { text, tapButton } from '../core/touch';
import { CREAM } from '../core/theme';
import { circleButton } from '../core/ui';
import { t, getLang, setLang, LANGS } from '../i18n';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create(): void {
    this.cameras.main.setBackgroundColor(CREAM);
    text(this, W / 2, 260, 'Mesto', 190);
    const chicken = this.add.container(W / 2, 800, [
      this.add.image(0, 0, 'chicken-body'),
      this.add.image(0, -20, 'eyes-happy'),
      this.add.image(0, 90, 'mouth-smile').setScale(0.8),
    ]);
    this.tweens.add({ targets: chicken, angle: { from: -4, to: 4 }, scaleY: { from: 1, to: 1.05 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.languageToggle();
    // Build version (latest commit), small and unobtrusive at the bottom.
    if (__BUILD_COMMIT__) {
      text(this, W / 2, H - 60, __BUILD_COMMIT__, 30).setAlpha(0.45).setWordWrapWidth(W - 100);
    }
    // First tap unlocks iOS audio.
    tapButton(this, W / 2, 1300, t('title.play'), () => {
      unlockAudio();
      this.scene.start('GameSelect');
    });
  }

  /** Small corner button that switches to the other language and rebuilds the screen. */
  private languageToggle(): void {
    const next = LANGS[(LANGS.indexOf(getLang()) + 1) % LANGS.length];
    circleButton(this, next.toUpperCase(), () => { setLang(next); this.scene.restart(); }, { fontSize: 52 });
  }
}
