import Phaser from 'phaser';
import { H, W } from '../../../core/layout';
import { StageScene } from '../../../core/MiniGame';
import { idleSave, saveIdle } from '../../../core/idleSave';
import { earn } from '../../../core/profile';
import { text } from '../../../core/touch';
import { circleButton, coinCounter, hudTitle, outlined, pay, type CoinCounter } from '../../../core/ui';
import { INK } from '../../../core/theme';
import { t, type Key } from '../../../i18n';
import { buildStaticWorld } from './idleDraw';
import { WORLD_H, WORLD_W, toWorld } from './idleIso';
import { LABELS, ROW_IDS, type RowId, type SlotIndex } from './idleLayout';
import { UpgradeDialog } from './idleDialog';
import { applyUpgrades, buy, buyMachine, lastRow, machineItem, newIdle, offer, slotOffer, tapHauler, tapPlot, tapPlanter, tapTruck, tapWorker, tick, upgradesOf, type IdleState, type UpgradeItem } from './idleLogic';
import { IdleView } from './idleView';

// The idle sawmill: the isometric world drawn with placeholder blocks, a camera you drag around, an overview button, and the HUD. The line
// runs (idleLogic.ts) from a tapped lumberjack to a sold square log; idleView.ts draws what moves. Two cameras: the main one shows the
// world (it scrolls and zooms), a second one, added on top, shows only the HUD, so the HUD neither scrolls nor scales.

const GROUND_COLOR = 0xcfe6ab;
const TOP_BAND = 190;
const BOTTOM_BAND = 1260;
/** What the player sees first: the first lumberjack, the landing, the ingress road, the pile and the debarker (world px, centre of the part between the bands). */
const START_VIEW = { x: 1500, y: 690 };
/** The world can scroll this far beyond its edges: room above, and below so the last row can leave the bottom band. */
const BOUNDS = { x: 0, y: -100, w: WORLD_W, h: WORLD_H + 400 };
const DRAG_START = 18;
/** Zone labels are drawn over everything that stands (the world's depths are tile sums, up to about 80), under the bars and hints. */
const LABEL_DEPTH = 4000;
const FIT_ZOOM = Math.min(W / BOUNDS.w, H / BOUNDS.h);
const STOCKS: readonly Key[] = ['idle.stock.trunks', 'idle.stock.pile', 'idle.stock.peeled', 'idle.stock.logs', 'idle.stock.planks', 'idle.stock.planed'];
/** Longest a frame may be taken as: a tab that was in the background does not fast-forward the line. */
const MAX_FRAME_MS = 250;
/** The labels of the three rows of machines, in row order: a tap on one opens that row's upgrade dialog. */
const ROW_LABEL_KEYS: readonly Key[] = ['idle.zone.row1', 'idle.zone.row2', 'idle.zone.row3'];

export class IdleMill extends StageScene {
  private overview = false;
  private drag: { id: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  private state: IdleState = newIdle();
  private view!: IdleView;
  private crew!: UpgradeDialog;
  private factory!: UpgradeDialog;
  /** One dialog per row of machines (rows 1 - 3), opened by a tap on the row's label: it upgrades every machine of the row at once. */
  private machineDialogs: UpgradeDialog[] = [];
  private coins!: CoinCounter;
  private counters: Phaser.GameObjects.Text[] = [];
  /** Time runs this many times faster (for looking at the late stages of the line while testing from the console). */
  speed = 1;
  private clockMs = 0;

  constructor() { super('IdleMill'); }

  create(): void {
    this.overview = false;
    this.drag = null;
    this.state = newIdle();
    applyUpgrades(this.state, idleSave); // what was bought on an earlier visit
    this.counters = [];
    this.speed = 1;
    this.clockMs = 0;

    const hud: Phaser.GameObjects.GameObject[] = [];
    const collect = (build: () => void): void => {
      const before = this.children.list.length;
      build();
      hud.push(...this.children.list.slice(before));
    };

    // ---- the world ----
    const world = this.add.layer();
    buildStaticWorld(this, world);
    this.view = new IdleView(this, world, this.state);
    for (const l of LABELS) {
      const p = toWorld(l.gx, l.gy, l.z);
      world.add(outlined(text(this, p.x, p.y, t(l.key), 52).setDepth(LABEL_DEPTH), '#ffffff', 10));
    }
    this.view.setRowLabels(LABELS.filter((l) => ROW_LABEL_KEYS.includes(l.key)).map((l) => ({ row: ROW_LABEL_KEYS.indexOf(l.key) + 1 as RowId, ...toWorld(l.gx, l.gy, l.z) })));

    // ---- the HUD ----
    collect(() => {
      this.backdrop(GROUND_COLOR);
      this.add.rectangle(W / 2, TOP_BAND / 2, W, TOP_BAND, 0xffffff, 0.3);
      this.add.rectangle(W / 2, (BOTTOM_BAND + H) / 2, W, H - BOTTOM_BAND, 0xffffff, 0.35);
      hudTitle(this, t('idle.title'));
      this.coins = coinCounter(this);
      STOCKS.forEach((key, i) => {
        const x = (W - 260) / 2 + (i - 2.5) * 290, y = 1395;
        this.add.rectangle(x, y, 272, 190, 0xffffff, 0.8).setStrokeStyle(6, INK);
        text(this, x, y - 55, t(key), 40).setWordWrapWidth(250);
        this.counters.push(text(this, x, y + 30, '0', 90));
      });
      circleButton(this, '🗺', () => this.toggleOverview(), { x: W - 120, y: 1395 }).setDepth(9000);
    });

    // ---- the cameras ----
    const cam = this.cameras.main;
    const ui = this.cameras.add(0, 0, W, H);
    ui.ignore(world);
    cam.ignore(hud);
    // the two upgrade dialogs (the forest crew on the landing, the factory on a machine) are drawn by the HUD camera only
    this.crew = new UpgradeDialog(this, cam, 'idle.crew.title', ['cutter', 'planter', 'manager'], () => this.state, (item) => this.buyUpgrade(item));
    this.factory = new UpgradeDialog(this, cam, 'idle.factory.title', ['forklift', 'forkliftManager', 'truck', 'deliveryTruck', 'truckManager', 'debarker'], () => this.state, (item) => this.buyUpgrade(item));
    this.machineDialogs = ROW_IDS.map((row) => new UpgradeDialog(this, cam, `idle.zone.row${row}`, [machineItem(row)], () => this.state, (item) => this.buyUpgrade(item)));
    cam.setBounds(BOUNDS.x, BOUNDS.y, BOUNDS.w, BOUNDS.h);
    cam.setZoom(1);
    // the part between the two bands is a little above the middle of the screen
    cam.centerOn(START_VIEW.x, START_VIEW.y + H / 2 - (TOP_BAND + BOTTOM_BAND) / 2);

    // ---- dragging the world around; a drag starts only after a small movement, so a tap is still a tap ----
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const dialog = [this.crew, this.factory, ...this.machineDialogs].find((d) => d.isOpen);
      if (dialog) { dialog.tap(p.x, p.y); return; } // the dialog takes the tap, the world does nothing
      if (!this.drag) this.drag = { id: p.id, x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || d.id !== p.id || !p.isDown) return;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < DRAG_START) return;
      d.moved = true;
      cam.setScroll(d.sx - (p.x - d.x) / cam.zoom, d.sy - (p.y - d.y) / cam.zoom);
    });
    // a finger that went up without having dragged is a tap; one on the HUD bands is not a tap on the world
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (d?.id !== p.id) return;
      this.drag = null;
      if (d.moved || p.y < TOP_BAND || p.y > BOTTOM_BAND) return;
      const w = cam.getWorldPoint(p.x, p.y);
      const hit = this.view.hit(w.x, w.y);
      if (!hit) return;
      const st = this.state;
      if (hit.kind === 'landing') this.crew.open();
      else if (hit.kind === 'machine') this.factory.open(); // the debarker; a saw or planer, like its row's label, opens the row's dialog (`row`)
      else if (hit.kind === 'row') this.machineDialogs[hit.row - 1].open();
      else if (hit.kind === 'lot') this.buyLot(hit.row, hit.slot);
      else if (hit.kind === 'worker') tapWorker(st, hit.i);
      else if (hit.kind === 'planter') tapPlanter(st, hit.i);
      else if (hit.kind === 'plot') tapPlot(st, hit.i);
      else if (hit.kind === 'hauler') tapHauler(st, hit.i);
      else tapTruck(st);
    });
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => { if (this.drag?.id === p.id) this.drag = null; });
  }

  update(_time: number, delta: number): void {
    const ms = Math.min(delta, MAX_FRAME_MS) * this.speed;
    this.clockMs += ms;
    for (const e of tick(this.state, ms / 1000)) {
      if (e.coins <= 0) continue;
      earn(e.coins);
      this.coins.refresh();
      this.view.popup(e.at, e.coins);
    }
    this.view.update(this.state, this.clockMs);
    this.crew.update();
    this.factory.update();
    for (const d of this.machineDialogs) d.update();
    const st = this.state.stock, last = lastRow(this.state);
    // what waits in the loading yard is what the last built row makes: logs, planks or planed planks
    [st.landing, st.pile, st.storage, last === 1 ? st.yard : 0, last === 2 ? st.yard : 0, last === 3 ? st.yard : 0].forEach((n, i) => {
      const label = String(n);
      if (this.counters[i].text !== label) this.counters[i].setText(label);
    });
  }

  /** A buy button of a dialog: the coins first, then the purchase (nothing is taken for a locked or bought item). */
  private buyUpgrade(item: UpgradeItem): void {
    const o = offer(this.state, item);
    if (o.state === 'offer' && pay(this, this.coins, o.price) && buy(this.state, item)) {
      Object.assign(idleSave, upgradesOf(this.state));
      saveIdle();
    }
  }

  /** A tap on the plus of an empty lot: the coins first, then the machine (nothing is taken while the lot is not open yet). */
  private buyLot(row: RowId, slot: SlotIndex): void {
    const o = slotOffer(this.state, row, slot);
    if (o.state === 'offer' && pay(this, this.coins, o.price) && buyMachine(this.state, row, slot)) {
      Object.assign(idleSave, upgradesOf(this.state));
      saveIdle();
    }
  }

  /** Zoom out to see the whole factory, or back in. */
  private toggleOverview(): void {
    this.overview = !this.overview;
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    this.tweens.add({ targets: cam, zoom: this.overview ? FIT_ZOOM : 1, duration: 450, ease: 'Sine.inOut' });
  }
}
