import Phaser from 'phaser';
import { W, H } from '../core/layout';
import { sfx } from '../core/sfx';
import { startJourney, hubScene, type JourneyId } from '../core/stages';
import { text } from '../core/touch';
import { circleButton } from '../core/ui';
import { GameScene } from '../core/GameScene';
import { CREAM, INK } from '../core/theme';
import { t, type Key } from '../i18n';

interface Card { id: JourneyId; icon: string; label: Key; color: number; scale: number }

// The city is not here: the Play button on the title goes straight into it.
const cards: Card[] = [
  { id: 'food', icon: 'chicken-body', label: 'select.food', color: 0xfff6e0, scale: 1.1 },
  { id: 'farm', icon: 'farm-icon', label: 'select.farm', color: 0xdcf5d0, scale: 1 },
  { id: 'forest', icon: 'forest-icon', label: 'select.forest', color: 0xcdeccf, scale: 1 },
  { id: 'pizza', icon: 'pizza-icon', label: 'select.pizza', color: 0xffe1c4, scale: 1.1 },
];
const COLS = 4;
const CARD_W = 420;
const CARD_H = 560;
const GAP = 50;
const FIT = 0.6; // icons were drawn for 600px-wide cards
const HEADER = 320; // the title band that stays put while the cards scroll under it
const DRAG_PX = 20; // a finger that moved further than this scrolled; it did not tap

/** Pick which game (journey) to play. The cards wrap into rows; when they do not fit, the list scrolls by dragging. */
export class GameSelect extends GameScene {
  constructor() { super('GameSelect'); }

  create(): void {
    this.fadeInScene();

    const rows = Math.ceil(cards.length / COLS);
    const gridH = rows * CARD_H + (rows - 1) * GAP;
    const view = H - HEADER;
    const scrolls = gridH + 2 * GAP > view;
    const top = scrolls ? HEADER + GAP : HEADER + (view - gridH) / 2; // a short list is centred below the header
    const worldH = scrolls ? top + gridH + GAP : H;
    this.cameras.main.setBounds(0, 0, W, worldH);

    cards.forEach((c, i) => {
      const inRow = Math.min(COLS, cards.length - Math.floor(i / COLS) * COLS); // the last row is centred
      const col = i % COLS;
      const x = W / 2 + (col - (inRow - 1) / 2) * (CARD_W + GAP);
      const y = top + CARD_H / 2 + Math.floor(i / COLS) * (CARD_H + GAP);
      this.addCard(c, i, x, y);
    });

    // The header covers the cards that scroll under it; it and its buttons do not move with the camera.
    this.add.rectangle(0, 0, W, HEADER, CREAM).setOrigin(0).setScrollFactor(0).setDepth(10);
    text(this, W / 2, 170, t('select.title'), 130).setScrollFactor(0).setDepth(11);
    circleButton(this, '◀', () => this.fadeToScene('Title')).setScrollFactor(0).setDepth(11);

    if (scrolls) this.enableScroll(worldH - H);
  }

  private addCard(c: Card, i: number, x: number, y: number): void {
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, c.color).setStrokeStyle(10, INK);
    const icon = this.add.image(0, -50, c.icon).setScale(c.scale * FIT);
    const label = text(this, 0, CARD_H / 2 - 70, t(c.label), 58).setWordWrapWidth(CARD_W - 30);
    const card = this.add.container(x, y, [bg, icon, label]);
    card.setSize(CARD_W, CARD_H).setInteractive();
    this.tweens.add({ targets: icon, y: -80, duration: 600 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // On release, not on press, so that starting a scroll on a card does not start the game.
    card.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) > DRAG_PX) return;
      card.disableInteractive();
      sfx.pop();
      this.tweens.add({
        targets: card, scale: 0.92, duration: 90, yoyo: true,
        onComplete: () => { startJourney(c.id); this.fadeToScene(hubScene()); },
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
