import Phaser from 'phaser';
import { H, W } from '../../../core/layout';
import { profile } from '../../../core/profile';
import { INK, INK_CSS, FONT } from '../../../core/theme';
import { text } from '../../../core/touch';
import { t, type Key } from '../../../i18n';
import { deliveryTrucksAt, forkliftCapacity, machineFactor } from './idleData';
import { formatNumber } from '../../../core/format';
import { offer, rowMachines, type IdleState, type MachineItem, type Offer, type UpgradeItem } from './idleLogic';
import { ROW_KIND, type RowId } from './idleLayout';

// The upgrade dialogs: the crew dialog that opens when the log depot (the landing) is tapped (one row each for the cutters: their level and the price of the next one, the planters: their own level, locked until the
// cutters are at level 10, and the manager: locked the same way, bought once, no levels) and the factory dialog that opens on a machine (the forklifts and the machines, a level each and the price of the next). It is drawn on the HUD camera, over everything, and takes its own taps (`tap()`), so the scene does not need interactive objects:
// while it is open the scene hands it every pointer-down and does nothing else with it. The rows are rebuilt whenever what they show changes.

const PANEL_W = 1640;
/** Up to four rows have room to breathe; more are packed closer, so the panel still fits the screen. */
const layout = (n: number): { top: number; step: number; rowH: number } => (n <= 4 ? { top: 270, step: 230, rowH: 200 } : { top: 100, step: 195, rowH: 176 });
const ROW_FIRST = 240;

const BUTTON = { w: 400, h: 150, x: W / 2 + PANEL_W / 2 - 300 };
const CLOSE_R = 64;

/** The texts of a row: its name, and the line under its level (`{n}`: what the level gives, e.g. how many pieces a forklift carries). */
const ROW: Record<Exclude<UpgradeItem, MachineItem>, { name: Key; info: Key | null; /** a manager has no level: this line stands where the level would be */ plain?: Key }> = {
  cutter: { name: 'idle.crew.cutter', info: 'idle.crew.cutter.info' },
  planter: { name: 'idle.crew.planter', info: 'idle.crew.planter.info' },
  truck: { name: 'idle.factory.truck', info: 'idle.factory.truck.info' },
  deliveryTruck: { name: 'idle.factory.deliveryTruck', info: 'idle.factory.deliveryTruck.info' },
  forklift: { name: 'idle.factory.forklift', info: 'idle.factory.forklift.info' },
  debarker: { name: 'idle.factory.debarker', info: 'idle.factory.debarker.info' },
};
const MACHINE_NAME = { saw1: 'idle.machine.saw1', saw2: 'idle.machine.saw2', planer: 'idle.machine.planer' } as const satisfies Record<(typeof ROW_KIND)[RowId], Key>;
const isMachine = (item: UpgradeItem): item is MachineItem => item.length === 2 && item[0] === 'm';

export class UpgradeDialog {
  private readonly scene: Phaser.Scene;
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private readonly state: () => IdleState;
  private readonly onBuy: (item: UpgradeItem) => void;
  private readonly title: Key;
  private readonly items: readonly UpgradeItem[];
  private readonly panel: { x: number; y: number; w: number; h: number };
  private readonly lay: { top: number; step: number; rowH: number };
  private readonly box: Phaser.GameObjects.Container;
  private key = '';
  /** Where the buy buttons are this moment: the rows that can be bought. */
  private buttons: { item: UpgradeItem; y: number }[] = [];
  isOpen = false;

  /** `cam` is the camera that must not show the dialog (the world camera): everything that is added to it is hidden from `cam`. */
  constructor(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera, title: Key, items: readonly UpgradeItem[], state: () => IdleState, onBuy: (item: UpgradeItem) => void) {
    this.title = title;
    this.items = items;
    this.lay = layout(items.length);
    const h = ROW_FIRST + this.lay.step * (items.length - 1) + 170;
    this.panel = { x: W / 2, y: this.lay.top + h / 2, w: PANEL_W, h };
    this.scene = scene;
    this.cam = cam;
    this.state = state;
    this.onBuy = onBuy;
    this.box = scene.add.container(0, 0).setDepth(8500).setVisible(false);
    cam.ignore(this.box);
  }

  open(): void {
    this.isOpen = true;
    this.key = '';
    this.box.setVisible(true);
    this.update();
  }

  close(): void {
    this.isOpen = false;
    this.box.setVisible(false);
  }

  private get crossAt(): { x: number; y: number } { return { x: this.panel.x + this.panel.w / 2 - 80, y: this.panel.y - this.panel.h / 2 + 80 }; }
  private rowY(i: number): number { return this.lay.top + ROW_FIRST + this.lay.step * i; }

  /** A pointer went down at (x, y) of the screen while the dialog is open: a buy button buys, the cross or the dim outside the panel closes it. */
  tap(x: number, y: number): void {
    const s = this.state(), p = this.panel, c = this.crossAt;
    if (Math.hypot(x - c.x, y - c.y) < CLOSE_R * 1.3 || Math.abs(x - p.x) > p.w / 2 || Math.abs(y - p.y) > p.h / 2) { this.close(); return; }
    for (const b of this.buttons) {
      if (Math.abs(x - BUTTON.x) < BUTTON.w / 2 && Math.abs(y - b.y) < BUTTON.h / 2 + 20 && offer(s, b.item).state === 'offer') { this.onBuy(b.item); return; }
    }
  }

  /** Rebuilds the rows when something they show has changed (a level, the wallet being enough or not). */
  update(): void {
    if (!this.isOpen) return;
    const s = this.state(), p = this.panel, c = this.crossAt;
    const key = this.items.map((item) => { const o = offer(s, item); return `${o.state}${o.level}${o.price}${profile.coins >= o.price}`; }).join('|');
    if (key === this.key) return;
    this.key = key;
    this.box.removeAll(true);
    this.buttons = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.box.add(o); this.cam.ignore(o); return o; };

    add(this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5));
    add(this.scene.add.rectangle(p.x, p.y, p.w, p.h, 0xfff6dc, 1).setStrokeStyle(10, INK));
    add(text(this.scene, p.x, p.y - p.h / 2 + 90, t(this.title), 80));
    add(this.scene.add.circle(c.x, c.y, CLOSE_R, 0xffffff, 0.9).setStrokeStyle(8, INK));
    add(this.scene.add.text(c.x, c.y, '✕', { fontFamily: FONT, fontSize: '64px', color: INK_CSS }).setOrigin(0.5));

    this.items.forEach((item, i) => this.row(add, item, offer(s, item), this.rowY(i), s));
  }

  private row(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T, item: UpgradeItem, o: Offer, y: number, s: IdleState): void {
    const left = this.panel.x - this.panel.w / 2 + 70;
    const locked = o.state === 'locked';
    const names = isMachine(item) ? { name: MACHINE_NAME[ROW_KIND[Number(item[1]) as RowId]], info: 'idle.machine.info' as Key, plain: undefined } : ROW[item];
    add(this.scene.add.rectangle(this.panel.x, y, this.panel.w - 100, this.lay.rowH, locked ? 0xd9d2c0 : 0xffffff, locked ? 0.7 : 1).setStrokeStyle(6, INK, locked ? 0.4 : 1));
    const name = add(text(this.scene, left, y - 52, isMachine(item) ? `${t(names.name)} ×${rowMachines(s, Number(item[1]) as RowId).length}` : t(names.name), 64).setOrigin(0, 0.5));
    // the line under the name: why it is locked, that it is bought, what the manager does, or the level
    const sub = locked ? t('idle.crew.locked', { n: o.needs }) : o.state === 'owned' ? t('idle.crew.hired') : names.plain ? t(names.plain) : t('idle.crew.level', { n: o.level });
    add(text(this.scene, left, y + 4, sub, 46).setOrigin(0, 0.5));
    const info = locked || o.state === 'owned' || !names.info ? '' : t(names.info, { n: item === 'forklift' ? forkliftCapacity(s.forkliftLevel) : item === 'deliveryTruck' ? deliveryTrucksAt(s.deliveryLevel) : formatNumber(machineFactor(o.level)) });
    add(text(this.scene, left, y + 58, info, 34).setOrigin(0, 0.5).setAlpha(0.7).setWordWrapWidth(BUTTON.x - BUTTON.w / 2 - left - 20));
    name.setAlpha(locked ? 0.5 : 1);
    if (o.state !== 'offer') {
      if (locked) add(this.scene.add.text(BUTTON.x, y, '🔒', { fontFamily: FONT, fontSize: '90px' }).setOrigin(0.5).setAlpha(0.7));
      return;
    }
    const can = profile.coins >= o.price;
    const bg = add(this.scene.add.rectangle(BUTTON.x, y, BUTTON.w, BUTTON.h, can ? 0x9be08a : 0xeeeeee, 1).setStrokeStyle(8, INK, can ? 1 : 0.5));
    bg.setAlpha(can ? 1 : 0.7);
    // the coin and the price side by side, from the left of the button (a long price like 1551 still fits)
    add(this.scene.add.image(BUTTON.x - 150, y, 'coin').setScale(76 / 114));
    add(text(this.scene, BUTTON.x - 90, y, formatNumber(o.price), 76).setOrigin(0, 0.5));
    this.buttons.push({ item, y });
  }
}
