import Phaser from 'phaser';
import { W, H } from '../../../core/layout';
import { INK, FONT } from '../../../core/theme';
import { text } from '../../../core/touch';
import { coinCounter, outlined, type CoinCounter } from '../../../core/ui';
import { t } from '../../../i18n';
import { taskText, type Task } from './forestData';
import { MAX_HEARTS } from './state';
import type { Weapon } from './weapons';

const clamp = Phaser.Math.Clamp;

export interface HudValues { hearts: number; distU: number; score: number; coins: number; weapon: Weapon; ammo: number; reloadT: number }

/** The overlay of ForestRun: hearts, distance and score, quests, ammo bar, boss health, and the floating messages. */
export class ForestHud {
  private readonly hearts: Phaser.GameObjects.Image[] = [];
  private readonly summary: Phaser.GameObjects.Text;
  private readonly wallet: CoinCounter;
  private readonly taskTexts: Phaser.GameObjects.Text[] = [];
  private readonly ammoBar: Phaser.GameObjects.Graphics;
  private readonly ammoText: Phaser.GameObjects.Text;
  private readonly bossBar: Phaser.GameObjects.Graphics;

  /** `inset`: left margin for the hearts, to clear the back button. */
  constructor(private readonly scene: Phaser.Scene, inset: number, early = false) {
    for (let i = 0; i < MAX_HEARTS; i++) {
      this.hearts.push(scene.add.image(80 + inset + i * 92, 80, 'forest-heart').setScale(0.8).setDepth(1000));
    }
    this.summary = this.label(W / 2, 40, '', 64).setOrigin(0.5, 0);
    this.wallet = coinCounter(scene); // the same coin, place and look as in the shops
    scene.add.rectangle(24, 200, 840, 200, 0x1d3b2a, 0.5).setOrigin(0).setDepth(999).setStrokeStyle(6, 0xffffff, 0.5);
    for (let i = 0; i < 2; i++) this.taskTexts.push(this.label(48, 218 + i * 84, '', 50));

    this.ammoBar = scene.add.graphics().setDepth(1000);
    this.ammoText = this.label(W - 310, H - 150, '', 54).setOrigin(0.5);
    this.bossBar = scene.add.graphics().setDepth(1100);

    // The first few runs also explain what not to shoot and what to dodge, and keep the hint up longer.
    const hint = this.label(W / 2, 650, early ? `${t('forest.hint')}\n${t('forest.hintMore')}` : t('forest.hint'), 56).setOrigin(0.5).setAlign('center');
    scene.tweens.add({ targets: hint, alpha: 0, delay: early ? 10000 : 5000, duration: 800 });
  }

  label(x: number, y: number, s: string, size = 46): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, s, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#ffffff',
      stroke: '#2c4a33', strokeThickness: 8,
    }).setScrollFactor(0).setDepth(1000);
  }

  update(v: HudValues): void {
    this.hearts.forEach((h, i) => h.setAlpha(i < v.hearts ? 1 : 0.2));
    this.summary.setText(`${Math.floor(v.distU / 100)} m   🎯 ${v.score}`);
    this.wallet.label.setText(String(v.coins));

    const w = v.weapon;
    const reloading = v.reloadT > 0;
    const f = reloading ? 1 - v.reloadT / w.reload : v.ammo / w.mag;
    const g = this.ammoBar;
    g.clear();
    g.fillStyle(0x000000, 0.45).fillRoundedRect(W - 560, H - 110, 500, 44, 16);
    g.fillStyle(reloading ? 0x9aa5b1 : 0xffe27a, 1).fillRoundedRect(W - 554, H - 104, 488 * clamp(f, 0, 1), 32, 12);
    if (w.mag <= 12) {
      g.lineStyle(4, INK, 0.8);
      for (let i = 1; i < w.mag; i++) g.lineBetween(W - 554 + (488 * i) / w.mag, H - 104, W - 554 + (488 * i) / w.mag, H - 72);
    }
    this.ammoText.setText(reloading ? '⟳' : `${v.ammo}/${w.mag}`);
  }

  setTasks(tasks: Task[]): void {
    this.taskTexts.forEach((tx, i) => tx.setText(tasks[i] ? taskText(tasks[i]) : ''));
  }

  /** Health bar at the top for a boss, or nothing (`null`). `frac` is 0..1. */
  drawBossBar(frac: number | null): void {
    const g = this.bossBar;
    g.clear();
    if (frac === null) return;
    g.fillStyle(0x000000, 0.5).fillRoundedRect(W / 2 - 360, 150, 720, 40, 14);
    g.fillStyle(0xe63946, 1).fillRoundedRect(W / 2 - 354, 156, 708 * clamp(frac, 0, 1), 28, 10);
  }

  /** Big message in the middle that floats up and fades. */
  toast(msg: string): void {
    const tx = outlined(text(this.scene, W / 2, 560, msg, 96), '#fff6a8', 14).setDepth(1500).setScrollFactor(0);
    this.scene.tweens.add({ targets: tx, y: 440, alpha: 0, delay: 900, duration: 700, onComplete: () => tx.destroy() });
  }

  /** Small message at a point on the screen that floats up and fades. */
  float(x: number, y: number, msg: string): void {
    const tx = outlined(text(this.scene, x, y, msg, 60), '#fff6a8', 10).setDepth(1300);
    this.scene.tweens.add({ targets: tx, y: y - 130, alpha: 0, duration: 800, onComplete: () => tx.destroy() });
  }
}
