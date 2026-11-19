import { W, H } from './layout';
import { progress, currentJourney, hubScene, advanceFlow, bankStars } from './stages';
import { sfx } from './sfx';
import { GameScene } from './GameScene';
import { CREAM } from './theme';
import { circleButton, outlined, starRow } from './ui';
import { earn } from './profile';
import { payoutFor } from './stars';
import { text } from './touch';
import { t, type Key } from '../i18n';

/** How long the "well done" banner stays before the scene fades out (a scene with its own wrap-up animation passes more). */
export const WIN_MS = 1400;

/** Base for stage scenes. A scene ends a successful play with `win()`; `finish()` goes back to the map (or the
 *  journey's hub, or out of a finished journey). Every stage has the ◀ button, so a child can always get out. */
export abstract class StageScene extends GameScene {
  /** Leave the stage: record the stars (a replay can only improve them) and move on. Prefer `win()`. */
  protected finish(stars = 0): void {
    bankStars(stars);
    // Hub journeys are free roaming: any stage can be replayed, so nothing advances.
    if (!currentJourney().hub) progress.index += 1;
    this.fadeToNext(true);
  }

  /** The one way to celebrate: a banner and the earned stars, one jingle, then `finish()`. */
  protected win(stars: number, opts: { message?: Key; ms?: number; pay?: boolean } = {}): void {
    const { message = 'common.bravo', ms = WIN_MS, pay = false } = opts;
    sfx.yay();
    const banner = outlined(text(this, W / 2, H * 0.3, t(message), 130).setDepth(8000), '#ffffff', 16).setScale(0);
    this.tweens.add({ targets: banner, scale: 1, duration: 300, ease: 'Back.out' });
    starRow(this, W / 2, H * 0.3 + 230, stars).forEach((s, i) => {
      s.setDepth(8000).setScale(0);
      this.tweens.add({ targets: s, scale: 0.9, duration: 300, delay: 250 + i * 150, ease: 'Back.out', onStart: () => { if (i < stars) sfx.coin(); } });
    });
    // `pay`: the stage pays coins for its stars, shown under them.
    const coins = pay ? payoutFor(stars) : 0;
    if (coins > 0) {
      earn(coins);
      const y = H * 0.3 + 230 + 190;
      const label = outlined(text(this, W / 2 + 70, y, `+${coins}`, 110).setDepth(8000)).setScale(0);
      const icon = this.add.image(W / 2 - 110, y, 'coin').setDepth(8000).setScale(0);
      this.tweens.add({ targets: label, scale: 1, duration: 300, delay: 900, ease: 'Back.out' });
      this.tweens.add({ targets: icon, scale: 0.8, duration: 300, delay: 900, ease: 'Back.out', onStart: () => sfx.coin() });
    }
    this.time.delayedCall(coins > 0 ? Math.max(ms, 2000) : ms, () => this.finish(stars));
  }

  /** Fade out to the next scene: after finish() that is `advanceFlow()`, from the back button the hub. */
  protected fadeToNext(finished: boolean): void {
    this.fadeToScene(finished ? advanceFlow : hubScene);
  }

  /** What the ◀ button does: back to the map or the hub without finishing. A scene may bank what it has first. */
  protected onBack(): void { this.fadeToNext(false); }

  protected backdrop(color = CREAM): void {
    this.fadeInScene(color);
    circleButton(this, '◀', () => this.onBack()).setDepth(9000);
  }

  /** Left inset for a HUD that starts in the top-left corner, which the back button covers. */
  protected get hudInset(): number { return 140; }
}
