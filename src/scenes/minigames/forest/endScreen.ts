import Phaser from 'phaser';
import { W, H } from '../../../core/layout';
import { forestSave } from '../../../core/forestSave';
import { text, tapButton } from '../../../core/touch';
import { outlined } from '../../../core/ui';
import { t } from '../../../i18n';

export interface EndInfo { win: boolean; meters: number; score: number; quests: number; stars: number; record: boolean; best: number }

/** The result screen laid over the frozen run: stars, distance, quests, record and the three buttons. */
export function showEndScreen(
  scene: Phaser.Scene, i: EndInfo, on: { again: () => void; finish: () => void; shop: () => void },
): void {
  scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setDepth(1900);
  outlined(text(scene, W / 2, 330, t(i.win ? 'forest.victory' : 'forest.gameOver'), 150), '#ffffff', 16).setDepth(2000);
  for (let k = 0; k < 3; k++) {
    scene.add.image(W / 2 + (k - 1) * 190, 560, 'star').setScale(1.1).setAlpha(k < i.stars ? 1 : 0.2).setDepth(2000);
  }
  text(scene, W / 2, 760, t('forest.distance', { n: i.meters }), 90).setColor('#ffffff').setStroke('#2c4a33', 12).setDepth(2000);
  text(scene, W / 2, 880, t('forest.quests', { done: i.quests, score: i.score }), 80).setColor('#ffffff').setStroke('#2c4a33', 12).setDepth(2000);
  outlined(text(scene, W / 2, 1000, i.record ? t('forest.newRecord') : t('forest.record', { n: i.best }), 70), '#fff6a8', 12).setDepth(2000);
  outlined(text(scene, W - 60, 70, `🪙 ${forestSave.coins}`, 70).setOrigin(1, 0.5), '#ffffff', 12).setDepth(2000);
  tapButton(scene, W / 2 - 340, 1170, t('common.again'), on.again).setDepth(2001);
  tapButton(scene, W / 2 + 340, 1170, t('forest.finish'), on.finish).setDepth(2001);
  tapButton(scene, W / 2, 1360, `🪙 ${t('forest.shop')}`, on.shop).setDepth(2001);
}
