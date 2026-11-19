import Phaser from 'phaser';
import { progress, currentJourney, hubScene } from './stages';
import { sfx } from './sfx';

/** Base for stage scenes: finish() goes back to the map (or the journey's hub). */
export abstract class StageScene extends Phaser.Scene {
  protected finish(stars = 0): void {
    progress.stars += stars;
    // Hub journeys are free roaming: any stage can be replayed, so nothing advances.
    if (!currentJourney().hub) progress.index += 1;
    sfx.yay();
    this.returnToHub();
  }

  private returnToHub(): void {
    this.cameras.main.fadeOut(400, 255, 232, 163);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(hubScene()));
  }

  protected backdrop(color = 0xffe8a3): void {
    this.cameras.main.setBackgroundColor(color);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    if (currentJourney().hub) this.backButton();
  }

  /** Left inset for a HUD that starts in the top-left corner, which the back button covers in hub journeys. */
  protected get hudInset(): number { return currentJourney().hub ? 140 : 0; }

  /** Hub journeys let you step back out of any stage without finishing it. */
  private backButton(): void {
    const bg = this.add.circle(0, 0, 64, 0xffffff, 0.75).setStrokeStyle(8, 0x5a3a22);
    const arrow = this.add.text(-4, 0, '◀', { fontFamily: 'system-ui, sans-serif', fontSize: '60px', color: '#5a3a22' }).setOrigin(0.5);
    const c = this.add.container(100, 100, [bg, arrow]).setDepth(9000).setSize(160, 160).setInteractive();
    c.on('pointerdown', () => { sfx.pop(); this.returnToHub(); });
  }
}
