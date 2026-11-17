import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { StageMap } from './scenes/StageMap';
import { CrumbCatch } from './scenes/minigames/CrumbCatch';
import { Transform } from './scenes/Transform';
import { FeedMonster } from './scenes/minigames/FeedMonster';
import { Finale } from './scenes/Finale';

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
  scene: [Boot, Title, StageMap, CrumbCatch, Transform, FeedMonster, Finale],
});

if (import.meta.env.DEV) (window as any).__game = game;
