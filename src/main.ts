import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { StageMap } from './scenes/StageMap';
import { CrumbCatch } from './scenes/minigames/CrumbCatch';
import { Transform } from './scenes/Transform';
import { FeedMonster } from './scenes/minigames/FeedMonster';
import { Finale } from './scenes/Finale';
import { GameSelect } from './scenes/GameSelect';
import { CityHub } from './scenes/CityHub';
import { Checkout } from './scenes/minigames/Checkout';
import { PetShop } from './scenes/minigames/PetShop';
import { FarmShoot } from './scenes/minigames/FarmShoot';
import { FarmFinale } from './scenes/FarmFinale';
import { SweetShop } from './scenes/minigames/SweetShop';
import { FishShop } from './scenes/minigames/FishShop';
import { EggCollect } from './scenes/minigames/EggCollect';
import { FishCut } from './scenes/minigames/FishCut';
import { OctopusCatch } from './scenes/minigames/OctopusCatch';
import { Cook } from './scenes/minigames/Cook';
import { OctopusFinale } from './scenes/OctopusFinale';
import { ForestRun } from './scenes/minigames/ForestRun';
import { ForestShop } from './scenes/minigames/ForestShop';
import { ForestFinale } from './scenes/ForestFinale';
import { PizzaMaker } from './scenes/minigames/PizzaMaker';
import { PizzaFinale } from './scenes/PizzaFinale';

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
  scene: [Boot, Title, GameSelect, StageMap, CrumbCatch, Transform, FeedMonster, Finale, CityHub, Checkout, PetShop, FarmShoot, FarmFinale, SweetShop, FishShop, EggCollect, FishCut, OctopusCatch, Cook, OctopusFinale, ForestShop, ForestRun, ForestFinale, PizzaMaker, PizzaFinale],
});

if (import.meta.env.DEV) (window as any).__game = game;

// The game used to register an offline service worker. Remove any left over from
// older installs and drop their caches (public/sw.js also does this on update).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
  if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}
