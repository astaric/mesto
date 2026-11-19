import Phaser from 'phaser';
import { W, H } from '../core/layout';
import { unlockAudio, sfx } from '../core/sfx';
import { text, tapButton } from '../core/touch';
import { CREAM, INK, INK_CSS, FONT } from '../core/theme';
import { startJourney, hubScene } from '../core/stages';
import { circleButton } from '../core/ui';
import { t, getLang, setLang, LANGS } from '../i18n';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create(): void {
    this.cameras.main.setBackgroundColor(CREAM);
    text(this, W / 2, 260, 'Mesto', 190);
    const skyline = this.add.image(W / 2, 590, 'city-icon').setScale(0.95);
    this.tweens.add({ targets: skyline, angle: { from: -2, to: 2 }, scaleY: { from: 0.95, to: 0.99 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.languageToggle();
    // Build version (latest commit), small and unobtrusive at the bottom.
    if (__BUILD_COMMIT__) {
      text(this, W / 2, H - 60, __BUILD_COMMIT__, 30).setAlpha(0.45).setWordWrapWidth(W - 100);
    }
    // Play goes straight into the city and is the one big button; the other journeys sit under a small "Minigames" pill.
    // Either tap unlocks iOS audio.
    const play = tapButton(this, W / 2, 1090, t('title.play'), () => {
      unlockAudio();
      startJourney('city');
      this.scene.start(hubScene());
    });
    play.setScale(1.3);
    this.tweens.killTweensOf(play); // tapButton pulses around scale 1; pulse around the bigger size instead
    this.tweens.add({ targets: play, scale: { from: 1.3, to: 1.37 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.minigamesButton(W / 2, 1345);
  }

  /** The quiet second choice: a small outlined pill, no pulse. */
  private minigamesButton(x: number, y: number): void {
    const bg = this.add.rectangle(0, 0, 440, 96, 0xffffff, 0.6).setStrokeStyle(6, INK);
    const label = this.add.text(0, 0, t('title.minigames'), { fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color: INK_CSS }).setOrigin(0.5);
    const c = this.add.container(x, y, [bg, label]).setSize(500, 150).setInteractive();
    let busy = false;
    c.on('pointerdown', () => {
      if (busy) return;
      busy = true;
      unlockAudio();
      sfx.pop();
      this.scene.start('GameSelect');
    });
  }

  /** Small corner button that switches to the other language and rebuilds the screen. */
  private languageToggle(): void {
    const next = LANGS[(LANGS.indexOf(getLang()) + 1) % LANGS.length];
    circleButton(this, next.toUpperCase(), () => { setLang(next); this.scene.restart(); }, { fontSize: 52 });
  }
}
