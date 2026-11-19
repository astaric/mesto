import Phaser from 'phaser';
import type { SceneKey } from '../scenes/registry';
import { CREAM, FADE_RGB } from './theme';

/** Base for the scenes that fade in and out: one place for the fade colour and the fade-then-start sequence. */
export abstract class GameScene extends Phaser.Scene {
  /** Set the background and fade in. Call first in `create()`. */
  protected fadeInScene(background = CREAM, ms = 300): void {
    this.cameras.main.setBackgroundColor(background);
    this.cameras.main.fadeIn(ms, ...FADE_RGB);
  }

  /** Fade out, then start scene `key` (a function is called after the fade, for when the target depends on state
   *  that changes meanwhile). */
  protected fadeToScene(key: SceneKey | (() => SceneKey), data?: object, ms = 400): void {
    this.cameras.main.fadeOut(ms, ...FADE_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(typeof key === 'function' ? key() : key, data));
  }
}
