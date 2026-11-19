import { progress, currentJourney, hubScene, advanceFlow } from './stages';
import { sfx } from './sfx';
import { GameScene } from './GameScene';
import { CREAM } from './theme';
import { circleButton } from './ui';

/** Base for stage scenes: finish() goes back to the map (or the journey's hub, or out of a finished journey). */
export abstract class StageScene extends GameScene {
  protected finish(stars = 0): void {
    progress.stars += stars;
    // Hub journeys are free roaming: any stage can be replayed, so nothing advances.
    if (!currentJourney().hub) progress.index += 1;
    sfx.yay();
    this.fadeToNext(true);
  }

  /** Fade out to the next scene: after finish() that is `advanceFlow()`, from the back button the hub. */
  private fadeToNext(finished: boolean): void {
    this.fadeToScene(finished ? advanceFlow : hubScene);
  }

  protected backdrop(color = CREAM): void {
    this.fadeInScene(color);
    if (currentJourney().hub) circleButton(this, '◀', () => { sfx.pop(); this.fadeToNext(false); }).setDepth(9000);
  }

  /** Left inset for a HUD that starts in the top-left corner, which the back button covers in hub journeys. */
  protected get hudInset(): number { return currentJourney().hub ? 140 : 0; }
}
