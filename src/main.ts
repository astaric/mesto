import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { StageMap } from './scenes/StageMap';
import { CrumbCatch } from './scenes/minigames/CrumbCatch';
import { Transform } from './scenes/Transform';
import { FeedMonster } from './scenes/minigames/FeedMonster';
import { Finale } from './scenes/Finale';
import { GameSelect } from './scenes/GameSelect';
import { CityWalk } from './scenes/minigames/CityWalk';
import { Checkout } from './scenes/minigames/Checkout';
import { PetShop } from './scenes/minigames/PetShop';
import { MestoFinale } from './scenes/MestoFinale';
import { FarmShoot } from './scenes/minigames/FarmShoot';
import { FarmFinale } from './scenes/FarmFinale';
import { SweetShop } from './scenes/minigames/SweetShop';
import { FishShop } from './scenes/minigames/FishShop';
import { EggCollect } from './scenes/minigames/EggCollect';
import { FishCut } from './scenes/minigames/FishCut';

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
  scene: [Boot, Title, GameSelect, StageMap, CrumbCatch, Transform, FeedMonster, Finale, CityWalk, Checkout, PetShop, MestoFinale, FarmShoot, FarmFinale, SweetShop, FishShop, EggCollect, FishCut],
});

if (import.meta.env.DEV) (window as any).__game = game;

// Offline support: the service worker (emitted by vite.config.ts) precaches the
// whole build. Needs HTTPS (or localhost); only registered in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
