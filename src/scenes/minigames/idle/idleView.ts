import Phaser from 'phaser';
import { profile } from '../../../core/profile';
import { text } from '../../../core/touch';
import { t } from '../../../i18n';
import { outlined, priceTag } from '../../../core/ui';
import { CAP, PLANKS_PER_LOG, TUNING, cutterChopS, type StockId } from './idleData';
import { MACHINE_COLOR, PAD_H, PILE_PAD_X, PIECE_COLOR, PIECE_D, PIECE_L, drawBox, drawMachine, drawPiece, drawPieces, lumberjack, rectDepth, stump, tree, type PieceKind } from './idleDraw';
import { DEPTH as DEB_DEPTH, OUT_Y, RING_Y0, RING_Y1, TRUNK_X, buildDebarker, drawBlades, trunkY } from './idleDebarker';
import { drawForklift } from './idleForklift';
import { X_OUT } from './idleSawPose';
import { sawBladesAt } from './idleSawPose';
import { drawSawBase, drawSawRest, drawSawWorking, type SawParts } from './idleSaw';
import { drawPlankBase, drawPlankFront, drawPlankRest, drawPlankWorking, type PlankParts } from './idlePlank';
import { plankPose, bladesAt } from './idlePlankPose';
import { buildBridge, bridgeKey, destroyBridge, type Bridge } from './idleBridge';
import { TRANSFER_SPEED, routeLength, routePoint, transferRoute } from './idleTransfer';
import { drawTruck } from './idleTruck';
import { toWorld, type Point, type Tile } from './idleIso';
import { DEBARKER, LANDING, PILE, LOADING_YARD, ROW_IDS, STORAGE, centre, slotRect, type RowId, type SlotIndex, type TileRect } from './idleLayout';
import { hasForkliftManager, hasManager, hasTruckManager, haulerHasJob, lastRow, machineItem, offer, planterHasJob, slotOffer, workerHasJob, type UpgradeItem, type Hauler, type Machine, type MachineId, type IdleState, type Plot, type Truck } from './idleLogic';

// What moves in the idle sawmill, drawn from the state (idleLogic.ts): the lumberjack and his tree, the forklifts, the trucks, the pieces
// waiting in their places and the machines' progress bars. Placeholder blocks like the rest of the world (idleDraw.ts). Everything is
// created inside `world` (the scrolling layer), with the depth `x + y` of its tile (plus a bit for how far it reaches), the key the static
// blocks are sorted by.

const TRUCK_COLOR = { logging: 0x4f9f6a, delivery: 0x5b8fd0 } as const;
/** What the output forklift and the loading yard hold: what the last built row makes. */
const PRODUCT_KIND: Record<1 | 2 | 3, PieceKind> = { 1: 'cant', 2: 'board', 3: 'planed' };
const PLUS_COLOR = 0x58c46a;
const BAR_W = 150;
const PLANTER_SHIRT = 0x3f7fcf;

/** The piece a machine works on and the one it has finished. */
const PIECES: Record<MachineId, { working: PieceKind; done: PieceKind }> = {
  debarker: { working: 'trunk', done: 'peeled' },
  saw1: { working: 'peeled', done: 'cant' },
  saw2: { working: 'cant', done: 'board' },
  planer: { working: 'board', done: 'planed' },
};

const STACKS: readonly { id: StockId; rect: TileRect; kind: PieceKind; pad: number; padX?: number }[] = [
  { id: 'landing', rect: LANDING, kind: 'trunk', pad: 0.15 },
  { id: 'pile', rect: PILE, kind: 'trunk', pad: 0.1, padX: PILE_PAD_X },
  { id: 'storage', rect: STORAGE, kind: 'peeled', pad: 0.12 },
  { id: 'yard', rect: LOADING_YARD, kind: 'cant', pad: 0.2 },
];

/** A thing that drives: its Graphics, the way it faces and what it was last drawn as. */
interface Mover { g: Phaser.GameObjects.Graphics; last: Tile; dx: number; dy: number; key: string }
const mover = (g: Phaser.GameObjects.Graphics, p: Tile, dx: number, dy: number): Mover => ({ g, last: { gx: p.gx, gy: p.gy }, dx, dy, key: '' });
/** Turns the mover the way it has just moved along its axis. */
function face(m: Mover, pos: Tile, axis: 'x' | 'y'): void {
  const d = axis === 'x' ? pos.gx - m.last.gx : pos.gy - m.last.gy;
  if (Math.abs(d) > 1e-6) { m.dx = axis === 'x' ? Math.sign(d) : 0; m.dy = axis === 'y' ? Math.sign(d) : 0; }
  m.last = { gx: pos.gx, gy: pos.gy };
}

/** What a tap landed on. */
export type Hit = { kind: 'worker'; i: number } | { kind: 'planter'; i: number } | { kind: 'landing' } | { kind: 'machine'; row: 0 | RowId; slot: SlotIndex } | { kind: 'row'; row: RowId } | { kind: 'lot'; row: RowId; slot: SlotIndex } | { kind: 'plot'; i: number } | { kind: 'hauler'; i: number } | { kind: 'truck' };

/** Everything drawn for one machine: its body (not the debarker's, which is part of the static world), the piece it holds, the progress bar, its level and the arrow shown when the next level is affordable. */
interface MachineView {
  m: Machine; rect: TileRect; at: Point;
  piece: Phaser.GameObjects.Graphics; pieceKey: string;
  /** The debarker only: the dark half of the trunk (behind the ring) and the blades and chips. */
  back: Phaser.GameObjects.Graphics | null; fx: Phaser.GameObjects.Graphics | null;
  /** The log saw only (idleSaw.ts): the graphics under the trunk. */
  saw: SawParts | null;
  /** The plank saw only (idlePlank.ts): the graphics between its posts and in front of them. */
  plank: PlankParts | null;
  bar: { g: Phaser.GameObjects.Graphics; at: Tile; step: number };
  level: Phaser.GameObjects.Text | null; levelShown: number; badge: Phaser.GameObjects.Text | null;
}
/** An empty lot for a machine: the plus (and the price) shown while it can be bought. */
interface LotView { row: RowId; slot: SlotIndex; rect: TileRect; at: Point; plus: Phaser.GameObjects.Graphics | null; tag: Phaser.GameObjects.Container | null; tagPrice: number; shown: boolean }

interface PlotView { tree: Phaser.GameObjects.Graphics; stump: Phaser.GameObjects.Graphics; at: Point; phase: Plot['phase'] }
/** A bar that follows a vehicle and shows how long it will still work. */
interface ActiveBar { g: Phaser.GameObjects.Graphics; step: number }
const HINT_HAULER = 0;
const HINT_TRUCK = 4;
const HINT_SIZE = 90;

export class IdleView {
  private readonly scene: Phaser.Scene;
  private readonly world: Phaser.GameObjects.Layer;
  private readonly plots: PlotView[];
  /** One per cutter and per planter, made as the levels hire them. */
  private readonly cutters: { g: Phaser.GameObjects.Graphics; carry: boolean; hint: Phaser.GameObjects.Text }[] = [];
  private readonly planters: { g: Phaser.GameObjects.Graphics; hint: Phaser.GameObjects.Text }[] = [];
  /** A bobbing arrow over the landing while something in the crew dialog can be bought. */
  private readonly badge: Phaser.GameObjects.Text;
  private readonly landingAt: Point;
  /** The debarker's place, for the arrow over it while something in the factory dialog can be bought. */
  private readonly debarkerAt: Point;
  private readonly machines = new Map<Machine, MachineView>();
  /** The conveyor across the aisle between row 1 and row 2, once there is a saw 2. */
  private bridge: Bridge | null = null;
  private readonly lots: LotView[];
  /** The row labels (world points): a tap on one opens that row's upgrade dialog. */
  private rowLabels: { row: RowId; x: number; y: number }[] = [];
  private readonly factoryBadge: Phaser.GameObjects.Text;
  /** The finger over something that is waiting for a tap: the three forklifts, the logging truck (the cutters have their own). */
  private readonly hints: Phaser.GameObjects.Text[];
  private readonly activeBars: ActiveBar[];
  private readonly haulers: Mover[];
  private readonly addHauler: () => void;
  /** The logging truck first, then the exit trucks (more come as the exit trucks' levels buy them). */
  private readonly trucks: Mover[];
  private readonly stacks = new Map<StockId, { g: Phaser.GameObjects.Graphics; key: string }>();

  constructor(scene: Phaser.Scene, world: Phaser.GameObjects.Layer, s: IdleState) {
    this.scene = scene;
    this.world = world;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { world.add(o); return o; };

    // every tree of the forest is a plot: a tree and a stump each (the stump shows when the tree is gone), same size, on the grid
    this.plots = s.plots.map((plot) => {
      const at = toWorld(plot.tree.gx, plot.tree.gy);
      const tr = add(scene.add.graphics().setPosition(at.x, at.y).setDepth(plot.tree.gx + plot.tree.gy + 0.2));
      const st = add(scene.add.graphics().setPosition(at.x, at.y).setDepth(plot.tree.gx + plot.tree.gy + 0.1));
      tree(tr, { x: 0, y: 0 });
      stump(st, { x: 0, y: 0 });
      st.setVisible(false);
      return { tree: tr, stump: st, at, phase: plot.phase };
    });
    const lc = centre(LANDING);
    this.landingAt = toWorld(lc.gx, lc.gy, 30);
    const dc = centre(DEBARKER);
    this.debarkerAt = toWorld(dc.gx, dc.gy, 55);
    this.lots = ROW_IDS.flatMap((row) => ([0, 1, 2] as const).map((slot): LotView => {
      const rect = slotRect(row, slot), c = centre(rect);
      return { row, slot, rect, at: toWorld(c.gx, c.gy, 20), plus: null, tag: null, tagPrice: -1, shown: false };
    }));
    this.factoryBadge = add(text(scene, 0, 0, '⬆️', HINT_SIZE).setDepth(5001).setVisible(false));
    this.badge = add(text(scene, this.landingAt.x, this.landingAt.y - 150, '⬆️', HINT_SIZE).setDepth(5001).setVisible(false));

    this.haulers = s.haulers.map((h) => mover(add(scene.add.graphics()), h.pos, h.id === 'f2' ? -1 : 1, 0)); // F2 waits at the belt's output end, facing the machine
    this.addHauler = () => this.haulers.push(mover(add(scene.add.graphics()), s.haulers[this.haulers.length].pos, 1, 0));
    // the logging truck stands facing up the road (it drives its loop from there); the delivery truck faces down
    this.trucks = s.trucks.map((truck) => mover(add(scene.add.graphics().setVisible(false)), truck.pos, 0, truck.id === 'logging' ? -1 : 1));

    for (const st of STACKS) this.stacks.set(st.id, { g: add(scene.add.graphics().setDepth(st.rect.gx1 + 1 - st.pad + st.rect.gy1 + 1 - st.pad + 0.5)), key: '' });
    this.hints = [0, 1, 2, 3, 4].map(() => add(text(scene, 0, 0, '👆', HINT_SIZE).setDepth(5001).setVisible(false)));
    this.activeBars = [0, 1, 2, 3, 4].map(() => ({ g: add(scene.add.graphics().setDepth(5000)), step: -1 }));
  }

  private drawCutter(c: { g: Phaser.GameObjects.Graphics; carry: boolean }, carrying: boolean): void {
    c.carry = carrying;
    c.g.clear();
    lumberjack(c.g, { x: 0, y: 0 });
    if (carrying) c.g.fillStyle(PIECE_COLOR.trunk, 1).fillRoundedRect(-46, -62, 92, 24, 10);
  }

  setRowLabels(labels: { row: RowId; x: number; y: number }[]): void { this.rowLabels = labels; }

  /** What is under a finger at world point (x, y): the vehicles and the workers first (they are small), then the trees and the stumps (a stump sends a planter). The targets are generous. */
  hit(x: number, y: number): Hit | null {
    let best: Hit | null = null, bestD = Infinity;
    const consider = (h: Hit, cx: number, cy: number, r: number): void => {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r && d < bestD) { best = h; bestD = d; }
    };
    this.haulers.forEach((m, i) => consider({ kind: 'hauler', i }, m.g.x, m.g.y - 60, 135));
    if (this.trucks[0].g.visible) consider({ kind: 'truck' }, this.trucks[0].g.x, this.trucks[0].g.y - 50, 190);
    this.cutters.forEach((c, i) => consider({ kind: 'worker', i }, c.g.x, c.g.y - 70, 100));
    this.planters.forEach((c, i) => consider({ kind: 'planter', i }, c.g.x, c.g.y - 70, 100));
    if (best) return best;
    // the log depot: a tap on its pad opens the crew dialog (the trees and the workers come first, they stand around it)
    if (Math.hypot(x - this.landingAt.x, (y - this.landingAt.y) * 1.6) < 150) return { kind: 'landing' };
    // an empty lot that can be bought (the plus), or a machine (its dialog; trees and workers are far away from them, and the forklifts and trucks took theirs above)
    const lot = this.lots.find((l) => l.shown && Math.hypot((x - l.at.x) / 1.4, (y - l.at.y) * 1.3) < 170);
    if (lot) return { kind: 'lot', row: lot.row, slot: lot.slot };
    const label = this.rowLabels.find((l) => Math.abs(x - l.x) < 170 && Math.abs(y - l.y) < 60);
    if (label) return { kind: 'row', row: label.row };
    for (const v of this.machines.values()) if (Math.hypot((x - v.at.x) / 1.4, (y - v.at.y) * 1.3) < 170) return v.m.row === 0 ? { kind: 'machine', row: 0, slot: v.m.slot } : { kind: 'row', row: v.m.row };
    this.plots.forEach((p, i) => { if (p.phase === 'ready' || p.phase === 'stump') consider({ kind: 'plot', i }, p.at.x, p.at.y - (p.phase === 'ready' ? 60 : 15), 70); });
    return best;
  }

  /** A coin and an amount that float up from `p` and fade. */
  popup(p: Tile, n: number): void {
    const w = toWorld(p.gx, p.gy, 260);
    const tag = priceTag(this.scene, w.x, w.y, n, 90).setDepth(6000);
    this.world.add(tag);
    this.scene.tweens.add({ targets: tag, y: w.y - 200, alpha: 0, duration: 1600, ease: 'Cubic.out', onComplete: () => tag.destroy() });
  }

  update(s: IdleState, ms: number): void {
    s.plots.forEach((p, i) => this.updatePlot(p, this.plots[i], ms, cutterChopS(s.level)));
    this.updateWorkers(s, ms);
    this.updateBadge(s, ms);
    while (this.haulers.length < s.haulers.length) this.addHauler(); // F3 joins at forklift level 40
    s.haulers.forEach((h, i) => this.updateHauler(h, this.haulers[i], i, s, ms));
    while (this.trucks.length < s.trucks.length) { // a new exit truck
      const g = this.scene.add.graphics().setVisible(false);
      this.world.add(g);
      this.trucks.push(mover(g, s.trucks[this.trucks.length].pos, 0, 1));
    }
    s.trucks.forEach((tr, i) => this.updateTruck(tr, this.trucks[i], s, ms));
    for (const st of STACKS) this.updateStack(st, s.stock[st.id], st.id === 'yard' ? PRODUCT_KIND[lastRow(s)] : st.kind);
    this.syncBridge(s);
    for (const m of s.machines) this.updateMachine(this.machineView(m), ms, s);
    for (const lot of this.lots) this.updateLot(lot, s);
  }

  /** The conveyor has a belt in every column that has a saw 1 and a saw 2; it is rebuilt when one is bought. */
  private syncBridge(s: IdleState): void {
    const slots = (row: RowId): SlotIndex[] => s.machines.filter((m) => m.row === row).map((m) => m.slot);
    const both = slots(1).filter((i) => slots(2).includes(i)).sort(), key = bridgeKey(both);
    if ((this.bridge?.key ?? '') === key) return;
    if (this.bridge) destroyBridge(this.bridge);
    this.bridge = key ? buildBridge(this.scene, this.world, both) : null;
  }

  /** The view of a machine, made when it first shows up in the state (the debarker and the first saw at the start, the rest as they are bought). */
  private machineView(m: Machine): MachineView {
    let v = this.machines.get(m);
    if (v) return v;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.world.add(o); return o; };
    const rect = m.id === 'debarker' ? DEBARKER : slotRect(m.row as RowId, m.slot), c = centre(rect);
    if (m.id !== 'debarker') {
      const body = add(this.scene.add.graphics().setDepth(rectDepth(rect)));
      if (m.id === 'saw1') drawSawBase(body.setDepth(rectDepth(rect) - 1), rect);
      else if (m.id === 'saw2') drawPlankBase(body.setDepth(rectDepth(rect) - 1.2), rect);
      else drawMachine(body, rect, MACHINE_COLOR[m.id]);
    } else buildDebarker(this.scene, this.world);
    v = {
      m, rect, at: toWorld(c.gx, c.gy, 55),
      piece: add(this.scene.add.graphics()), pieceKey: '',
      saw: m.id === 'saw1' ? { under: add(this.scene.add.graphics().setDepth(rectDepth(rect) - 0.9)), front: add(this.scene.add.graphics().setDepth(rectDepth(rect) + 0.5)), key: '' } : null,
      plank: m.id === 'saw2' ? { mid: add(this.scene.add.graphics().setDepth(rectDepth(rect) - 0.9)), front: add(this.scene.add.graphics().setDepth(rectDepth(rect) - 0.5)), key: '' } : null,
      back: m.id === 'debarker' ? add(this.scene.add.graphics().setDepth(DEB_DEPTH.dark)) : null,
      fx: m.id === 'debarker' ? add(this.scene.add.graphics().setDepth(DEB_DEPTH.fx)) : null,
      bar: { g: add(this.scene.add.graphics().setDepth(5000)), at: { gx: c.gx, gy: c.gy }, step: -1 },
      level: m.row === 0 ? null : add(outlined(text(this.scene, 0, 0, '', 44).setDepth(4100), '#ffffff', 8)), levelShown: 0,
      badge: m.row === 0 ? null : add(text(this.scene, 0, 0, '⬆️', HINT_SIZE).setDepth(5001).setVisible(false)),
    };
    if (v.level) { const p = toWorld(c.gx, c.gy, 165); v.level.setPosition(p.x, p.y); }
    this.machines.set(m, v);
    return v;
  }

  /** The progress bar, the piece lying on the machine, its level and the arrow over it. */
  private updateMachine(v: MachineView, ms: number, s: IdleState): void {
    const m = v.m;
    // the debarker and the log saw show how far they are by their animation; the others get a bar
    this.updateBar(v.bar, m.state === 'working' && !v.saw && !v.plank && m.id !== 'debarker' ? Math.floor((m.t / m.workS) * 20) : -1);
    if (m.id === 'debarker') this.updateDebarker(v, ms); else if (v.saw) this.updateSaw(v, v.saw, ms); else if (v.plank) this.updatePlank(v, v.plank, ms); else this.updatePiece(v);
    if (v.level && v.levelShown !== m.level) { v.levelShown = m.level; v.level.setText(t('idle.crew.level', { n: m.level })); }
    if (v.badge) {
      const p = toWorld(centre(v.rect).gx, centre(v.rect).gy, 235);
      v.badge.setVisible(profile.coins >= offer(s, machineItem(m.row as RowId)).price).setPosition(p.x, p.y + Math.sin(ms / 220) * 14);
    }
  }

  /** An empty lot: a plus and its price while it can be bought (an earlier machine has reached the level that opens it), nothing otherwise, and nothing once a machine stands there. */
  private updateLot(lot: LotView, s: IdleState): void {
    const o = slotOffer(s, lot.row, lot.slot), show = o.state === 'offer';
    if (show && !lot.plus) {
      const c = centre(lot.rect), add = <T extends Phaser.GameObjects.GameObject>(g: T): T => { this.world.add(g); return g; };
      lot.plus = add(this.scene.add.graphics().setDepth(rectDepth(lot.rect)));
      drawBox(lot.plus, toWorld, c.gx - 0.95, c.gy - 0.3, 1.9, 0.6, 8, PLUS_COLOR);
      drawBox(lot.plus, toWorld, c.gx - 0.3, c.gy - 0.95, 0.6, 1.9, 8, PLUS_COLOR);
    }
    if (show && lot.tagPrice !== o.price) { // the price of a second or third machine follows the row's level
      lot.tag?.destroy();
      const p = toWorld(centre(lot.rect).gx, centre(lot.rect).gy, 130);
      lot.tag = priceTag(this.scene, p.x, p.y, o.price, 64).setDepth(4600);
      this.world.add(lot.tag);
      lot.tagPrice = o.price;
    }
    lot.shown = show;
    lot.plus?.setVisible(show).setAlpha(profile.coins >= o.price ? 1 : 0.55);
    lot.tag?.setVisible(show).setAlpha(profile.coins >= o.price ? 1 : 0.6);
  }

  private updatePlot(p: Plot, v: PlotView, ms: number, chopS: number): void {
    // the tree: standing, shaking and falling while he chops, then a stump, a sapling and a tree again
    let scale = 1, angle = 0, treeShown = true;
    switch (p.phase) {
      case 'ready': break;
      case 'chopping': {
        const f = p.t / chopS;
        angle = f < 0.7 ? Math.sin(ms / 40) * 2.5 : ((f - 0.7) / 0.3) * 80;
        break;
      }
      case 'planting': scale = 0.15 + 0.15 * Math.min(1, p.t / TUNING.plantS); break;
      case 'growing': scale = 0.3 + 0.7 * Math.min(1, p.t / TUNING.growS); break;
      default: treeShown = false;
    }
    v.phase = p.phase;
    v.tree.setVisible(treeShown).setScale(scale).setAngle(angle);
    v.stump.setVisible(!treeShown || p.phase === 'chopping');
  }

  /** The cutters and planters: a new one is made when the levels hire one. */
  private updateWorkers(s: IdleState, ms: number): void {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.world.add(o); return o; };
    while (this.cutters.length < s.cutters.length) {
      const c = { g: add(this.scene.add.graphics()), carry: false, hint: add(text(this.scene, 0, 0, '👆', HINT_SIZE).setDepth(5001).setVisible(false)) };
      this.drawCutter(c, false);
      this.cutters.push(c);
    }
    while (this.planters.length < s.planters.length) {
      const g = add(this.scene.add.graphics());
      lumberjack(g, { x: 0, y: 0 }, PLANTER_SHIRT);
      this.planters.push({ g, hint: add(text(this.scene, 0, 0, '👆', HINT_SIZE).setDepth(5001).setVisible(false)) });
    }
    s.cutters.forEach((w, k) => {
      const c = this.cutters[k];
      if (c.carry !== w.carrying) this.drawCutter(c, w.carrying);
      const at = toWorld(w.pos.gx, w.pos.gy);
      c.g.setPosition(at.x, at.y).setDepth(w.pos.gx + w.pos.gy + 0.5);
      c.hint.setVisible(workerHasJob(s, k) && !hasManager(s)).setPosition(at.x, at.y - 170 + Math.sin(ms / 220 + k) * 14);
    });
    s.planters.forEach((p, k) => {
      const at = toWorld(p.pos.gx, p.pos.gy);
      const v = this.planters[k];
      v.g.setPosition(at.x, at.y).setDepth(p.pos.gx + p.pos.gy + 0.5);
      v.hint.setVisible(planterHasJob(s, k) && !hasManager(s)).setPosition(at.x, at.y - 170 + Math.sin(ms / 220 + k) * 14);
    });
  }

  /** The arrow over the landing: on while the wallet can pay for something in the crew dialog. */
  private updateBadge(s: IdleState, ms: number): void {
    const can = (items: UpgradeItem[]): boolean => items.some((item) => {
      const o = offer(s, item);
      return o.state === 'offer' && profile.coins >= o.price;
    });
    const bob = Math.sin(ms / 220) * 14;
    this.badge.setVisible(can(['cutter', 'planter'])).setPosition(this.landingAt.x, this.landingAt.y - 150 + bob);
    this.factoryBadge.setVisible(can(['forklift', 'truck', 'deliveryTruck', 'debarker'])).setPosition(this.debarkerAt.x, this.debarkerAt.y - 190 + bob);
  }

  /** The bobbing finger over something that waits for a tap. */
  private showHint(i: number, on: boolean, x: number, y: number, ms: number): void {
    this.hints[i].setVisible(on).setPosition(x, y + Math.sin(ms / 220 + i) * 14);
  }

  /** The bar of the time a vehicle still works, over it; gone when it is not working. */
  private updateActive(i: number, active: number, x: number, y: number): void {
    const b = this.activeBars[i];
    const step = active > 0 ? Math.ceil((active / TUNING.activeS) * 20) : -1;
    b.g.setPosition(x, y);
    if (step === b.step) return;
    b.step = step;
    b.g.clear();
    if (step < 0) return;
    b.g.fillStyle(0xffffff, 0.9).fillRect(-BAR_W / 2 - 4, -14, BAR_W + 8, 28);
    b.g.fillStyle(0xffc83d, 1).fillRect(-BAR_W / 2, -10, (BAR_W * step) / 20, 20);
  }

  private updateHauler(h: Hauler, m: Mover, i: number, s: IdleState, ms: number): void {
    face(m, h.pos, h.axis);
    // waiting at a saw's belt (stopped, nothing left to drive) it looks straight at the saw, towards the machine's left (-gx)
    if (h.path.length === 0 && h.at.startsWith('out1')) { m.dx = -1; m.dy = 0; }
    const kind: PieceKind = h.id === 'f1' ? 'trunk' : h.id === 'f2' ? 'peeled' : PRODUCT_KIND[lastRow(s)];
    const key = `${m.dx},${m.dy},${h.carrying},${kind}`;
    if (key !== m.key) { m.key = key; drawForklift(m.g, m.dx, m.dy, Math.min(h.carrying, 4), kind); }
    const w = toWorld(h.pos.gx, h.pos.gy);
    // a forklift is always drawn above the log saw it works at (its trunk, disc and frame), wherever it stands round it
    const sawDepth = s.machines.reduce((d, mc) => {
      if (mc.id !== 'saw1') return d;
      const r = slotRect(mc.row as RowId, mc.slot);
      return h.pos.gx > r.gx0 - 1.5 && h.pos.gx < r.gx1 + 3.5 && h.pos.gy > r.gy0 - 0.8 && h.pos.gy < r.gy1 + 1.8 ? Math.max(d, rectDepth(r) + 0.6) : d;
    }, 0);
    m.g.setPosition(w.x, w.y).setDepth(Math.max(h.pos.gx + h.pos.gy + 0.8, sawDepth));
    // with the forklift manager they are always on: no time bar, no finger
    this.updateActive(i, hasForkliftManager(s) ? 0 : h.active, w.x, w.y - 130);
    this.showHint(HINT_HAULER + i, !hasForkliftManager(s) && h.active <= 0 && haulerHasJob(s, i), w.x, w.y - 150, ms);
  }

  private updateTruck(tr: Truck, m: Mover, s: IdleState, ms: number): void {
    if (tr.phase === 'away') { m.g.setVisible(false); m.last = { gx: tr.pos.gx, gy: tr.pos.gy }; return; }
    m.g.setVisible(true);
    face(m, tr.pos, tr.axis);
    const kind: PieceKind = tr.id === 'logging' ? 'trunk' : PRODUCT_KIND[lastRow(s)];
    const key = `${m.dx},${m.dy},${tr.cargo},${kind}`;
    if (key !== m.key) { m.key = key; drawTruck(m.g, m.dx, m.dy, TRUCK_COLOR[tr.id], kind, tr.cargo); }
    const w = toWorld(tr.pos.gx, tr.pos.gy);
    m.g.setPosition(w.x, w.y).setDepth(tr.pos.gx + tr.pos.gy + 1.5);
    if (tr.id === 'logging') {
      this.updateActive(4, hasTruckManager(s) ? 0 : tr.active, w.x, w.y - 190);
      this.showHint(HINT_TRUCK, !hasTruckManager(s) && tr.active <= 0 && tr.phase === 'parked' && s.stock.landing >= 1, w.x, w.y - 210, ms);
    }
  }

  /** The pieces waiting in a place, as a pile on its pad: lying along gx where the pad is long enough for one, else along gy, layer by layer. */
  private updateStack(st: (typeof STACKS)[number], n: number, kind: PieceKind): void {
    const o = this.stacks.get(st.id)!, key = `${n},${kind}`;
    if (o.key === key) return;
    o.key = key;
    o.g.clear();
    const px = st.padX ?? st.pad, r = st.rect, w = r.gx1 - r.gx0 + 1 - 2 * px, d = r.gy1 - r.gy0 + 1 - 2 * st.pad;
    const axis = w >= PIECE_L ? 'x' : 'y', cw = axis === 'x' ? PIECE_L : PIECE_D, cd = axis === 'x' ? PIECE_D : PIECE_L;
    const nx = Math.max(1, Math.floor(w / cw)), ny = Math.max(1, Math.floor(d / cd));
    const x0 = r.gx0 + px + (w - nx * cw) / 2, y0 = r.gy0 + st.pad + (d - ny * cd) / 2;
    drawPieces(o.g, toWorld, kind, Math.min(n, CAP[st.id] * PLANKS_PER_LOG), x0, y0, PAD_H, nx, ny, axis); // the yard holds more of them where the line makes boards
  }

  /** The debarker: a trunk slides along the belt into the ring (the dark half behind it) and out of it peeled (in front) while the blades turn and chips fall. */
  private updateDebarker(v: MachineView, ms: number): void {
    const m = v.m, working = m.state === 'working', f = working ? m.t / m.workS : 0;
    const frame = Math.floor(ms / 110) % 4, step = working ? Math.floor(f * 30) : -1;
    const key = `${m.state}${m.out}${step}${working ? frame : 0}`;
    if (v.pieceKey === key) return;
    v.pieceKey = key;
    v.piece.clear().setDepth(DEB_DEPTH.peeled);
    v.back!.clear();
    if (working) {
      const y0 = trunkY(f);
      if (y0 < RING_Y0) drawPiece(v.back!, toWorld, 'trunk', TRUNK_X, y0, 16, 'y', Math.min(y0 + PIECE_L, RING_Y0) - y0);
      if (y0 + PIECE_L > RING_Y1) { const s = Math.max(y0, RING_Y1); drawPiece(v.piece, toWorld, 'peeled', TRUNK_X, s, 16, 'y', y0 + PIECE_L - s); }
    } else if (m.out > 0 && m.state === 'done') {
      drawPieces(v.piece, toWorld, PIECES.debarker.done, Math.min(m.out, PLANKS_PER_LOG), TRUNK_X, OUT_Y, 16, 1, 1, 'y');
    }
    drawBlades(v.fx!, working ? frame : 0, working);
  }

  /** The log saw: while it works the trunk shuttles through the disc (idleSaw.ts, redrawn about every 70 ms); otherwise the saw rests and the finished square log lies at the output end like any machine's piece. */
  private updateSaw(v: MachineView, saw: SawParts, ms: number): void {
    const m = v.m;
    const blades = sawBladesAt(m.level);
    if (m.state !== 'working') {
      if (saw.key !== `rest${blades}`) { saw.key = `rest${blades}`; v.pieceKey = ''; drawSawRest(saw, v.rect, blades); }
      this.updatePiece(v);
      return;
    }
    const key = `${Math.floor(ms / 70)}`;
    if (saw.key === key) return;
    saw.key = key;
    v.pieceKey = '';
    v.piece.setDepth(rectDepth(v.rect) + 0.2);
    drawSawWorking(saw, v.piece, v.rect, m.t / m.workS, ms, blades);
  }

  /** The plank saw: while it works the blades slide across the still log (idlePlank.ts, redrawn about every 70 ms), the pass and the number of blades follow the work and the level; otherwise the blades rest and the finished planks lie at the output end like any machine's piece. */
  private updatePlank(v: MachineView, plank: PlankParts, ms: number): void {
    const m = v.m;
    if (plank.key === '') drawPlankFront(plank.front, v.rect);
    if (m.state === 'working' && (m.feed ?? 0) > 0) { // the log is still riding the conveyor from the saw 1: the blades wait, the log is drawn on its way
      if (plank.key !== `rest${bladesAt(m.level)}`) { plank.key = `rest${bladesAt(m.level)}`; drawPlankRest(plank, v.rect, m.level); }
      const route = transferRoute(m.slot), at = routePoint(route, routeLength(route) - m.feed! * TRANSFER_SPEED);
      v.pieceKey = '';
      // on the conveyor the log is drawn above its belts; once its front end is on the saw 2's own belt it is also above that (the belt is part of the machine's base), but still under the blades and posts
      const onSaw = at.gx + PIECE_L > v.rect.gx0 - 0.7, bridgeDepth = this.bridge?.depth ?? 0;
      v.piece.clear().setDepth(onSaw ? Math.max(bridgeDepth, rectDepth(v.rect) - 0.95) : bridgeDepth || rectDepth(v.rect) + 0.3);
      drawPiece(v.piece, toWorld, 'cant', at.gx, at.gy, 16);
      return;
    }
    if (m.state !== 'working') {
      const key = `rest${bladesAt(m.level)}`;
      if (plank.key !== key) { plank.key = key; drawPlankRest(plank, v.rect, m.level); }
      this.updatePiece(v);
      return;
    }
    const pose = plankPose(m.t / m.workS, m.level), key = `${Math.floor(ms / 70)}`;
    if (plank.key === key) return;
    plank.key = key;
    v.pieceKey = '';
    v.piece.clear();
    drawPlankWorking(plank, v.rect, pose, ms);
  }

  /** A piece being worked lies on top of its machine; the finished ones lie on the belt at the machine's output end, where the forklift takes them (a plank saw's four planks are stacked). */
  private updatePiece(v: MachineView): void {
    const m = v.m, def = PIECES[m.id], r = v.rect, key = `${m.state}${m.out}`;
    if (v.pieceKey === key) return;
    v.pieceKey = key;
    v.piece.clear();
    if (m.state === 'working' && m.id !== 'saw2') {
      v.piece.setDepth(rectDepth(r) + 0.2);
      drawPiece(v.piece, toWorld, def.working, r.gx0 + 0.7, r.gy0 + 1.2 + (0.6 - PIECE_D) / 2, 110);
    }
    if (m.out > 0 && (m.state === 'done' || m.id === 'planer')) {
      v.piece.setDepth(rectDepth(r) + 0.3);
      // finished pieces lie stacked at the output end: a saw 2's four boards, or the boards a planer has made so far
      drawPieces(v.piece, toWorld, def.done, Math.min(m.out, PLANKS_PER_LOG), m.id === 'saw1' ? r.gx0 + X_OUT : r.gx1 + 0.8, r.gy0 + 1.15 + (0.7 - PIECE_D) / 2, 16, 1, 1);
    }
  }

  private updateBar(b: { g: Phaser.GameObjects.Graphics; at: Tile; step: number }, step: number): void {
    if (b.step === step) return;
    b.step = step;
    b.g.clear();
    if (step < 0) return;
    const p = toWorld(b.at.gx, b.at.gy, 150);
    b.g.fillStyle(0xffffff, 0.9).fillRect(p.x - BAR_W / 2 - 4, p.y - 14, BAR_W + 8, 28);
    b.g.fillStyle(0x58ab5f, 1).fillRect(p.x - BAR_W / 2, p.y - 10, (BAR_W * step) / 20, 20);
  }
}
