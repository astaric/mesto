import Phaser from 'phaser';
import { progress } from './stages';
import { sfx } from './sfx';

/** Base for stage scenes: finish() advances to the map. */
export abstract class StageScene extends Phaser.Scene {
  protected finish(stars = 0): void {
    progress.stars += stars;
    progress.index += 1;
    sfx.yay();
    this.cameras.main.fadeOut(400, 255, 232, 163);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('StageMap'));
  }

  protected backdrop(color = 0xffe8a3): void {
    this.cameras.main.setBackgroundColor(color);
    this.cameras.main.fadeIn(300, 255, 232, 163);
  }
}
