import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { StageMap } from './scenes/StageMap';
import { CrumbCatch } from './scenes/minigames/CrumbCatch';
import { Transform } from './scenes/Transform';
import { FeedMonster } from './scenes/minigames/FeedMonster';
import { GameSelect } from './scenes/GameSelect';
import { CityHub } from './scenes/CityHub';
import { Checkout } from './scenes/minigames/Checkout';
import { PetShop } from './scenes/minigames/PetShop';
import { FarmShoot } from './scenes/minigames/FarmShoot';
import { SweetShop } from './scenes/minigames/SweetShop';
import { FishShop } from './scenes/minigames/FishShop';
import { EggCollect } from './scenes/minigames/EggCollect';
import { FishCut } from './scenes/minigames/FishCut';
import { OctopusCatch } from './scenes/minigames/OctopusCatch';
import { Cook } from './scenes/minigames/Cook';
import { ForestRun } from './scenes/minigames/ForestRun';
import { ForestShop } from './scenes/minigames/ForestShop';
import { PizzaMaker } from './scenes/minigames/PizzaMaker';

export const W = 2048;
export const H = 1536;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#ffe8a3',
  input: { activePointers: 3 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Title, GameSelect, StageMap, CrumbCatch, Transform, FeedMonster, CityHub, Checkout, PetShop, FarmShoot, SweetShop, FishShop, EggCollect, FishCut, OctopusCatch, Cook, ForestShop, ForestRun, PizzaMaker],
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
