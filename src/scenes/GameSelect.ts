import Phaser from 'phaser';
import { W, H } from '../core/layout';
import { sfx } from '../core/sfx';
import { journeys, startSolo, type Stage } from '../core/stages';
import { text } from '../core/touch';
import { circleButton } from '../core/ui';
import { GameScene } from '../core/GameScene';
import { CREAM, INK } from '../core/theme';
import { t } from '../i18n';

// Every stage of the city, in the order of the town, each one the same as walking into its door (`startSolo`), so the
// shops, the forest gate and the series (octopus, hen house, funny food) behave exactly as they do there.
const stages = journeys.city.stages;
const COLORS = [0xfff6e0, 0xd9f2ff, 0xdcf5d0, 0xcdeccf, 0xffe1c4, 0xf3e0ff, 0xffe9a8];
const COLS = 5;
const CARD_W = 340;
const CARD_H = 480;
const GAP = 40;
const ICON = 260; // the icon is scaled to fit this square
const HEADER = 320; // the title band that stays put while the cards scroll under it
const DRAG_PX = 20; // a finger that moved further than this scrolled; it did not tap

/** The minigame list: one card per building of the city. The cards wrap into rows; when they do not fit, the list scrolls by dragging. */
export class GameSelect extends GameScene {
  constructor() { super('GameSelect'); }

  create(): void {
    this.fadeInScene();

    const rows = Math.ceil(stages.length / COLS);
    const gridH = rows * CARD_H + (rows - 1) * GAP;
    const view = H - HEADER;
    const scrolls = gridH + 2 * GAP > view;
    const top = scrolls ? HEADER + GAP : HEADER + (view - gridH) / 2; // a short list is centred below the header
    const worldH = scrolls ? top + gridH + GAP : H;
    this.cameras.main.setBounds(0, 0, W, worldH);

    stages.forEach((st, i) => {
      const inRow = Math.min(COLS, stages.length - Math.floor(i / COLS) * COLS); // the last row is centred
      const col = i % COLS;
      const x = W / 2 + (col - (inRow - 1) / 2) * (CARD_W + GAP);
      const y = top + CARD_H / 2 + Math.floor(i / COLS) * (CARD_H + GAP);
      this.addCard(st, i, x, y);
    });

    // The header covers the cards that scroll under it; it and its buttons do not move with the camera.
    this.add.rectangle(0, 0, W, HEADER, CREAM).setOrigin(0).setScrollFactor(0).setDepth(10);
    text(this, W / 2, 170, t('select.title'), 130).setScrollFactor(0).setDepth(11);
    circleButton(this, '◀', () => this.fadeToScene('Title')).setScrollFactor(0).setDepth(11);

    if (scrolls) this.enableScroll(worldH - H);
  }

  private addCard(stage: Stage, i: number, x: number, y: number): void {
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS[i % COLORS.length]).setStrokeStyle(10, INK);
    const frame = this.textures.getFrame(stage.icon);
    const icon = this.add.image(0, -50, stage.icon).setScale(Math.min(ICON / frame.width, ICON / frame.height));
    const label = text(this, 0, CARD_H / 2 - 70, t(stage.label), 50).setWordWrapWidth(CARD_W - 30);
    const card = this.add.container(x, y, [bg, icon, label]);
    card.setSize(CARD_W, CARD_H).setInteractive();
    this.tweens.add({ targets: icon, y: -75, duration: 600 + (i % 7) * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // On release, not on press, so that starting a scroll on a card does not start the game.
    card.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) > DRAG_PX) return;
      card.disableInteractive();
      sfx.pop();
      this.tweens.add({
        targets: card, scale: 0.92, duration: 90, yoyo: true,
        onComplete: () => { const to = startSolo(stage); this.fadeToScene(to.scene, to.data); },
      });
    });
  }

  /** Drag up/down (or use the mouse wheel) to move the camera over the cards. */
  private enableScroll(max: number): void {
    const cam = this.cameras.main;
    const clamp = (v: number): number => Phaser.Math.Clamp(v, 0, max);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) cam.scrollY = clamp(cam.scrollY - (p.y - p.prevPosition.y) / cam.zoom);
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => { cam.scrollY = clamp(cam.scrollY + dy); });
  }
}
