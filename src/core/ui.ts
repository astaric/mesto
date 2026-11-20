import Phaser from 'phaser';
import { W } from './layout';
import { INK, INK_CSS, FONT } from './theme';
import { sfx } from './sfx';
import { text } from './touch';
import { profile, spend } from './profile';
import { formatNumber } from './format';

/** A tap that already did its job is ignored for this long, so a double tap cannot start a scene twice. */
export const TAP_GUARD_MS = 700;

/** Wrap a tap handler: pop sound, and ignored while a previous tap is still being handled. */
export function guardedTap(scene: Phaser.Scene, onTap: () => void): () => void {
  let busy = false;
  return () => {
    if (busy) return;
    busy = true;
    sfx.pop();
    scene.time.delayedCall(TAP_GUARD_MS, () => { busy = false; });
    onTap();
  };
}

/** The round white button used for back / home: a glyph on a disc, 160 px hit area, `(x, y)` is its centre. */
export function circleButton(
  scene: Phaser.Scene, glyph: string, onTap: () => void,
  opts: { x?: number; y?: number; fontSize?: number; dy?: number } = {},
): Phaser.GameObjects.Container {
  const { x = 100, y = 100, fontSize = 60, dy = 0 } = opts;
  const bg = scene.add.circle(0, 0, 64, 0xffffff, 0.75).setStrokeStyle(8, INK);
  const label = scene.add.text(glyph === '◀' ? -4 : 0, dy, glyph, { fontFamily: FONT, fontSize: `${fontSize}px`, color: INK_CSS }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, label]).setSize(160, 160).setInteractive();
  c.on('pointerdown', guardedTap(scene, onTap));
  return c;
}

/** White (or `color`) text with the ink outline, for HUD text that must read over any background. */
export function outlined(t: Phaser.GameObjects.Text, color = '#ffffff', thickness = 12): Phaser.GameObjects.Text {
  return t.setColor(color).setStroke(INK_CSS, thickness);
}

// ---------- the HUD every minigame shares ----------

/** Where the HUD sits: the title across the top, the counter under it, the coin wallet in the top-right corner. */
export const HUD = { titleY: 120, counterY: 240, coinY: 90 } as const;
/** Titles of busy games fade after this long, so they do not cover the play field. */
export const TITLE_FADE_MS = 3000;

/** What to do, at the top of the screen. `fade`: dim it after a moment (for games with things moving about). */
export function hudTitle(scene: Phaser.Scene, s: string, opts: { fade?: boolean } = {}): Phaser.GameObjects.Text {
  const title = text(scene, W / 2, HUD.titleY, s, 90).setWordWrapWidth(W - 400);
  if (opts.fade) scene.tweens.add({ targets: title, alpha: 0.45, delay: TITLE_FADE_MS, duration: 600 });
  return title;
}

export interface Counter { readonly value: number; readonly goal: number; readonly reached: boolean; set(n: number): void; add(n?: number): number; label: Phaser.GameObjects.Text }

/** "n / goal" under the title, with a little pulse whenever it changes. */
export function counter(scene: Phaser.Scene, goal: number): Counter {
  const label = outlined(text(scene, W / 2, HUD.counterY, `0 / ${goal}`, 80));
  let n = 0;
  const c: Counter = {
    get value() { return n; },
    goal,
    get reached() { return n >= goal; },
    set(v: number) {
      n = v;
      label.setText(`${n} / ${goal}`);
      scene.tweens.add({ targets: label, scale: 1.25, duration: 90, yoyo: true });
    },
    add(d = 1) { c.set(n + d); return n; },
    label,
  };
  return c;
}

export interface CoinCounter { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; refresh(): void }

/** The wallet in the top-right corner: the same coin, place and style in every shop and game. */
export function coinCounter(scene: Phaser.Scene): CoinCounter {
  const icon = scene.add.image(W - 330, HUD.coinY, 'coin').setScale(0.7).setDepth(1000);
  const label = outlined(text(scene, W - 200, HUD.coinY, formatNumber(profile.coins), 80)).setDepth(1000);
  return {
    icon, label,
    refresh() {
      label.setText(formatNumber(profile.coins));
      scene.tweens.add({ targets: label, scale: 1.3, duration: 100, yoyo: true });
    },
  };
}

/** A row of three stars, `n` of them lit. Centered on (x, y). */
export function starRow(scene: Phaser.Scene, x: number, y: number, n: number, scale = 0.9): Phaser.GameObjects.Image[] {
  return [0, 1, 2].map((i) => {
    const img = scene.add.image(x + (i - 1) * 190 * scale, y - (i === 1 ? 20 * scale : 0), 'star').setScale(scale);
    if (i >= n) img.setAlpha(0.3).setTint(0x888888);
    return img;
  });
}

/** A coin and a price, centred on (x, y): what a shop shows under something that costs coins. */
export function priceTag(scene: Phaser.Scene, x: number, y: number, price: number, size = 80): Phaser.GameObjects.Container {
  const coin = scene.add.image(-size * 0.8, 0, 'coin').setScale(size / 114);
  const label = text(scene, size * 0.35, 0, formatNumber(price), size);
  return scene.add.container(x, y, [coin, label]);
}

/** Take `price` from the wallet for a purchase. Without enough coins nothing is taken, the wallet shakes and it is false. */
export function pay(scene: Phaser.Scene, wallet: CoinCounter, price: number): boolean {
  if (!spend(price)) {
    sfx.burp();
    scene.tweens.add({ targets: wallet.label, x: wallet.label.x + 14, duration: 60, yoyo: true, repeat: 3 });
    return false;
  }
  wallet.refresh();
  return true;
}
