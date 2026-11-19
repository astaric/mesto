import Phaser from 'phaser';
import { W, H } from './core/layout';
import { CREAM_CSS } from './core/theme';
import { scenes } from './scenes/registry';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: CREAM_CSS,
  input: { activePointers: 3 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: Object.values(scenes),
});

if (import.meta.env.DEV) (window as any).__game = game;

// Mobile browsers report the new window size late after a rotation, so the FIT
// scale is computed from the old size and the canvas ends up too big (looks zoomed
// in). Re-fit now and a few times after every resize/rotation.
const refit = () => {
  game.scale.getParentBounds();
  game.scale.refresh();
};
const refitSoon = () => {
  refit();
  [50, 150, 300, 600, 1000].forEach((ms) => window.setTimeout(refit, ms));
};
window.addEventListener('resize', refitSoon);
window.addEventListener('orientationchange', refitSoon);
screen.orientation?.addEventListener?.('change', refitSoon);
window.visualViewport?.addEventListener('resize', refitSoon);

// The game used to register an offline service worker. Remove any left over from
// older installs and drop their caches (public/sw.js also does this on update).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
  if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}
