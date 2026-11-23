import Phaser from 'phaser';
import { profile } from '../../../core/profile';
import { text } from '../../../core/touch';
import { t } from '../../../i18n';
import { outlined, priceTag } from '../../../core/ui';
import { CAP, PLANKS_PER_LOG, SLOT_PRICE, TUNING, cutterChopS, type StockId } from './idleData';
import { MACHINE_COLOR, PAD_H, PIECE_COLOR, drawBox, drawMachine, lumberjack, rel, rectDepth, stump, tree } from './idleDraw';
import { toWorld, type Point, type Tile } from './idleIso';
import { DEBARKER, LANDING, PILE, LOADING_YARD, ROW_IDS, STORAGE, MANAGER_HOME, FORKLIFT_MANAGER_HOME, TRUCK_MANAGER_HOME, centre, slotRect, type RowId, type SlotIndex, type TileRect } from './idleLayout';
import { haulerHasJob, lastRow, levelCost, offer, planterHasJob, slotOffer, workerHasJob, type UpgradeItem, type Hauler, type Machine, type MachineId, type IdleState, type Plot, type Truck } from './idleLogic';

// What moves in the idle sawmill, drawn from the state (idleLogic.ts): the lumberjack and his tree, the forklifts, the trucks, the pieces
// waiting in their places and the machines' progress bars. Placeholder blocks like the rest of the world (idleDraw.ts). Everything is
// created inside `world` (the scrolling layer), with the depth `x + y` of its tile (plus a bit for how far it reaches), the key the static
// blocks are sorted by.

const FORKLIFT_COLOR = 0xffc83d;
const TRUCK_COLOR = { logging: 0x4f9f6a, delivery: 0x5b8fd0 } as const;
/** What the output forklift and the loading yard hold: what the last built row makes. */
const PRODUCT_COLOR = { 1: PIECE_COLOR.square, 2: PIECE_COLOR.plank, 3: PIECE_COLOR.planed } as const;
const PLUS_COLOR = 0x58c46a;
const BAR_W = 150;
const PLANTER_SHIRT = 0x3f7fcf;
const MANAGER_SHIRT = 0xf4f4f4;
const FORKLIFT_MANAGER_SHIRT = 0x8e7cc3;
const TRUCK_MANAGER_SHIRT = 0x4fa88a;

/** The colour of the piece a machine works on and of the one it has finished. */
const PIECES: Record<MachineId, { working: number; done: number }> = {
  debarker: { working: PIECE_COLOR.trunk, done: PIECE_COLOR.peeled },
  saw1: { working: PIECE_COLOR.peeled, done: PIECE_COLOR.square },
  saw2: { working: PIECE_COLOR.square, done: PIECE_COLOR.plank },
  planer: { working: PIECE_COLOR.plank, done: PIECE_COLOR.planed },
};

const STACKS: readonly { id: StockId; rect: TileRect; color: number; pad: number }[] = [
  { id: 'landing', rect: LANDING, color: PIECE_COLOR.trunk, pad: 0.15 },
  { id: 'pile', rect: PILE, color: PIECE_COLOR.trunk, pad: 0.1 },
  { id: 'storage', rect: STORAGE, color: PIECE_COLOR.peeled, pad: 0.12 },
  { id: 'yard', rect: LOADING_YARD, color: PIECE_COLOR.square, pad: 0.2 },
];

interface Part { a0: number; a1: number; b0: number; b1: number; h: number; color: number; z0?: number }

/** Draws parts given along (`a`, the heading) and across (`b`) a vehicle that faces (dx, dy), group by group from the back of the screen to the front. */
function drawParts(g: Phaser.GameObjects.Graphics, dx: number, dy: number, groups: Part[][]): void {
  const range = (a0: number, a1: number, b0: number, b1: number) => (dx !== 0
    ? { x0: Math.min(dx * a0, dx * a1), x1: Math.max(dx * a0, dx * a1), y0: b0, y1: b1 }
    : { x0: b0, x1: b1, y0: Math.min(dy * a0, dy * a1), y1: Math.max(dy * a0, dy * a1) });
  const depthOf = (grp: Part[]): number => grp.reduce((sum, p) => { const r = range(p.a0, p.a1, p.b0, p.b1); return sum + (r.x0 + r.x1 + r.y0 + r.y1) / 2; }, 0) / grp.length;
  for (const grp of [...groups].sort((p, q) => depthOf(p) - depthOf(q))) {
    for (const p of grp) {
      const r = range(p.a0, p.a1, p.b0, p.b1);
      drawBox(g, rel, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, p.h, p.color, p.z0 ?? 0);
    }
  }
}

/** `cargo` pieces of `color` are on its forks, stacked. */
function drawForklift(g: Phaser.GameObjects.Graphics, dx: number, dy: number, cargo: number, color: number): void {
  g.clear();
  const front: Part[] = [
    { a0: 0.2, a1: 0.35, b0: -0.2, b1: 0.2, h: 75, color: 0x8a8a8a },
    { a0: 0.35, a1: 0.8, b0: -0.17, b1: 0.17, h: 5, z0: 3, color: 0x4a4a4a },
  ];
  for (let i = 0; i < cargo; i++) front.push({ a0: 0.38, a1: 0.78, b0: -0.14, b1: 0.14, h: 14, z0: 8 + i * 15, color });
  drawParts(g, dx, dy, [
    [{ a0: -0.45, a1: 0.2, b0: -0.3, b1: 0.3, h: 28, color: FORKLIFT_COLOR }, { a0: -0.4, a1: -0.05, b0: -0.28, b1: 0.28, h: 28, z0: 28, color: 0xd9a21f }],
    front,
  ]);
}

function drawTruck(g: Phaser.GameObjects.Graphics, dx: number, dy: number, color: number, cargo: number, cargoColor: number): void {
  g.clear();
  const bed: Part[] = [{ a0: -2.1, a1: 1, b0: -0.6, b1: 0.6, h: 36, color: 0x6b6b6b }];
  for (let i = 0; i < Math.min(cargo, 6); i++) bed.push({ a0: -1.95 + i * 0.5, a1: -1.95 + i * 0.5 + 0.42, b0: -0.5, b1: 0.5, h: 24, z0: 36, color: cargoColor });
  drawParts(g, dx, dy, [bed, [{ a0: 1, a1: 2.1, b0: -0.6, b1: 0.6, h: 80, color }]]);
}

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
export type Hit = { kind: 'worker'; i: number } | { kind: 'planter'; i: number } | { kind: 'landing' } | { kind: 'machine'; row: 0 | RowId; slot: SlotIndex } | { kind: 'lot'; row: RowId; slot: SlotIndex } | { kind: 'plot'; i: number } | { kind: 'hauler'; i: number } | { kind: 'truck' };

/** Everything drawn for one machine: its body (not the debarker's, which is part of the static world), the piece it holds, the progress bar, its level and the arrow shown when the next level is affordable. */
interface MachineView {
  m: Machine; rect: TileRect; at: Point;
  piece: Phaser.GameObjects.Graphics; pieceKey: string;
  bar: { g: Phaser.GameObjects.Graphics; at: Tile; step: number };
  level: Phaser.GameObjects.Text | null; levelShown: number; badge: Phaser.GameObjects.Text | null;
}
/** An empty lot for a machine: the plus (and the price) shown while it can be bought. */
interface LotView { row: RowId; slot: SlotIndex; rect: TileRect; at: Point; plus: Phaser.GameObjects.Graphics | null; tag: Phaser.GameObjects.Container | null; shown: boolean }

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
  private manager: Phaser.GameObjects.Graphics | null = null;
  private forkliftManager: Phaser.GameObjects.Graphics | null = null;
  private truckManager: Phaser.GameObjects.Graphics | null = null;
  /** A bobbing arrow over the landing while something in the crew dialog can be bought. */
  private readonly badge: Phaser.GameObjects.Text;
  private readonly landingAt: Point;
  /** The debarker's place, for the arrow over it while something in the factory dialog can be bought. */
  private readonly debarkerAt: Point;
  private readonly machines = new Map<Machine, MachineView>();
  private readonly lots: LotView[];
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
      return { row, slot, rect, at: toWorld(c.gx, c.gy, 20), plus: null, tag: null, shown: false };
    }));
    this.factoryBadge = add(text(scene, 0, 0, '⬆️', HINT_SIZE).setDepth(5001).setVisible(false));
    this.badge = add(text(scene, this.landingAt.x, this.landingAt.y - 150, '⬆️', HINT_SIZE).setDepth(5001).setVisible(false));

    this.haulers = s.haulers.map((h) => mover(add(scene.add.graphics()), h.pos, 1, 0));
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
    for (const v of this.machines.values()) if (Math.hypot((x - v.at.x) / 1.4, (y - v.at.y) * 1.3) < 170) return { kind: 'machine', row: v.m.row, slot: v.m.slot };
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
    for (const st of STACKS) this.updateStack(st, s.stock[st.id], st.id === 'yard' ? PRODUCT_COLOR[lastRow(s)] : st.color);
    for (const m of s.machines) this.updateMachine(this.machineView(m), ms);
    for (const lot of this.lots) this.updateLot(lot, s);
  }

  /** The view of a machine, made when it first shows up in the state (the debarker and the first saw at the start, the rest as they are bought). */
  private machineView(m: Machine): MachineView {
    let v = this.machines.get(m);
    if (v) return v;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.world.add(o); return o; };
    const rect = m.id === 'debarker' ? DEBARKER : slotRect(m.row as RowId, m.slot), c = centre(rect);
    if (m.id !== 'debarker') {
      const body = add(this.scene.add.graphics().setDepth(rectDepth(rect)));
      drawMachine(body, rect, MACHINE_COLOR[m.id]);
    }
    v = {
      m, rect, at: toWorld(c.gx, c.gy, 55),
      piece: add(this.scene.add.graphics()), pieceKey: '',
      bar: { g: add(this.scene.add.graphics().setDepth(5000)), at: { gx: c.gx, gy: c.gy }, step: -1 },
      level: m.row === 0 ? null : add(outlined(text(this.scene, 0, 0, '', 44).setDepth(4100), '#ffffff', 8)), levelShown: 0,
      badge: m.row === 0 ? null : add(text(this.scene, 0, 0, '⬆️', HINT_SIZE).setDepth(5001).setVisible(false)),
    };
    if (v.level) { const p = toWorld(c.gx, c.gy, 165); v.level.setPosition(p.x, p.y); }
    this.machines.set(m, v);
    return v;
  }

  /** The progress bar, the piece lying on the machine, its level and the arrow over it. */
  private updateMachine(v: MachineView, ms: number): void {
    const m = v.m;
    this.updateBar(v.bar, m.state === 'working' ? Math.floor((m.t / m.workS) * 20) : -1);
    this.updatePiece(v);
    if (v.level && v.levelShown !== m.level) { v.levelShown = m.level; v.level.setText(t('idle.crew.level', { n: m.level })); }
    if (v.badge) {
      const p = toWorld(centre(v.rect).gx, centre(v.rect).gy, 235);
      v.badge.setVisible(profile.coins >= levelCost(m)).setPosition(p.x, p.y + Math.sin(ms / 220) * 14);
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
      const p = toWorld(c.gx, c.gy, 130);
      lot.tag = add(priceTag(this.scene, p.x, p.y, SLOT_PRICE[lot.row - 1][lot.slot], 64).setDepth(4600));
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
      c.hint.setVisible(workerHasJob(s, k) && !s.manager).setPosition(at.x, at.y - 170 + Math.sin(ms / 220 + k) * 14);
    });
    if (s.manager && !this.manager) {
      this.manager = add(this.scene.add.graphics());
      lumberjack(this.manager, { x: 0, y: 0 }, MANAGER_SHIRT);
      const at = toWorld(MANAGER_HOME.gx, MANAGER_HOME.gy);
      this.manager.setPosition(at.x, at.y).setDepth(MANAGER_HOME.gx + MANAGER_HOME.gy + 0.5);
    }
    if (s.forkliftManager && !this.forkliftManager) {
      this.forkliftManager = add(this.scene.add.graphics());
      lumberjack(this.forkliftManager, { x: 0, y: 0 }, FORKLIFT_MANAGER_SHIRT);
      const at = toWorld(FORKLIFT_MANAGER_HOME.gx, FORKLIFT_MANAGER_HOME.gy);
      this.forkliftManager.setPosition(at.x, at.y).setDepth(FORKLIFT_MANAGER_HOME.gx + FORKLIFT_MANAGER_HOME.gy + 0.5);
    }
    if (s.truckManager && !this.truckManager) {
      this.truckManager = add(this.scene.add.graphics());
      lumberjack(this.truckManager, { x: 0, y: 0 }, TRUCK_MANAGER_SHIRT);
      const at = toWorld(TRUCK_MANAGER_HOME.gx, TRUCK_MANAGER_HOME.gy);
      this.truckManager.setPosition(at.x, at.y).setDepth(TRUCK_MANAGER_HOME.gx + TRUCK_MANAGER_HOME.gy + 0.5);
    }
    s.planters.forEach((p, k) => {
      const at = toWorld(p.pos.gx, p.pos.gy);
      const v = this.planters[k];
      v.g.setPosition(at.x, at.y).setDepth(p.pos.gx + p.pos.gy + 0.5);
      v.hint.setVisible(planterHasJob(s, k) && !s.manager).setPosition(at.x, at.y - 170 + Math.sin(ms / 220 + k) * 14);
    });
  }

  /** The arrow over the landing: on while the wallet can pay for something in the crew dialog. */
  private updateBadge(s: IdleState, ms: number): void {
    const can = (items: UpgradeItem[]): boolean => items.some((item) => {
      const o = offer(s, item);
      return o.state === 'offer' && profile.coins >= o.price;
    });
    const bob = Math.sin(ms / 220) * 14;
    this.badge.setVisible(can(['cutter', 'planter', 'manager'])).setPosition(this.landingAt.x, this.landingAt.y - 150 + bob);
    this.factoryBadge.setVisible(can(['forklift', 'forkliftManager', 'truck', 'deliveryTruck', 'truckManager', 'debarker'])).setPosition(this.debarkerAt.x, this.debarkerAt.y - 190 + bob);
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
    const color = h.id === 'f1' ? PIECE_COLOR.trunk : h.id === 'f2' ? PIECE_COLOR.peeled : PRODUCT_COLOR[lastRow(s)];
    const key = `${m.dx},${m.dy},${h.carrying},${color}`;
    if (key !== m.key) { m.key = key; drawForklift(m.g, m.dx, m.dy, Math.min(h.carrying, 4), color); }
    const w = toWorld(h.pos.gx, h.pos.gy);
    m.g.setPosition(w.x, w.y).setDepth(h.pos.gx + h.pos.gy + 0.8);
    // with the forklift manager they are always on: no time bar, no finger
    this.updateActive(i, s.forkliftManager ? 0 : h.active, w.x, w.y - 130);
    this.showHint(HINT_HAULER + i, !s.forkliftManager && h.active <= 0 && haulerHasJob(s, i), w.x, w.y - 150, ms);
  }

  private updateTruck(tr: Truck, m: Mover, s: IdleState, ms: number): void {
    if (tr.phase === 'away') { m.g.setVisible(false); m.last = { gx: tr.pos.gx, gy: tr.pos.gy }; return; }
    m.g.setVisible(true);
    face(m, tr.pos, tr.axis);
    const cargoColor = tr.id === 'logging' ? PIECE_COLOR.trunk : PRODUCT_COLOR[lastRow(s)];
    const key = `${m.dx},${m.dy},${tr.cargo},${cargoColor}`;
    if (key !== m.key) { m.key = key; drawTruck(m.g, m.dx, m.dy, TRUCK_COLOR[tr.id], tr.cargo, cargoColor); }
    const w = toWorld(tr.pos.gx, tr.pos.gy);
    m.g.setPosition(w.x, w.y).setDepth(tr.pos.gx + tr.pos.gy + 1.5);
    if (tr.id === 'logging') {
      this.updateActive(4, s.truckManager ? 0 : tr.active, w.x, w.y - 190);
      this.showHint(HINT_TRUCK, !s.truckManager && tr.active <= 0 && tr.phase === 'parked' && s.stock.landing >= 1, w.x, w.y - 210, ms);
    }
  }

  /** The pieces waiting in a place, as logs on its pad, in layers: lengthwise along gx, side by side along gy. */
  private updateStack(st: (typeof STACKS)[number], n: number, color: number): void {
    const o = this.stacks.get(st.id)!, key = `${n},${color}`;
    if (o.key === key) return;
    o.key = key;
    o.g.clear();
    const r = st.rect, w = r.gx1 - r.gx0 + 1 - 2 * st.pad, d = r.gy1 - r.gy0 + 1 - 2 * st.pad;
    const len = Math.min(1.6, w - 0.2), thick = 0.42;
    const cols = Math.max(1, Math.floor(w / len)), rows = Math.max(1, Math.floor(d / thick)), per = cols * rows;
    const x0 = r.gx0 + st.pad + (w - cols * len) / 2, y0 = r.gy0 + st.pad + (d - rows * thick) / 2;
    for (let i = 0; i < Math.min(n, CAP[st.id] * PLANKS_PER_LOG); i++) { // the yard holds more of them where the line makes planks
      const layer = Math.floor(i / per), k = i % per;
      drawBox(o.g, toWorld, x0 + (k % cols) * len, y0 + Math.floor(k / cols) * thick, len, thick * 0.9, 20, color, PAD_H + layer * 20);
    }
  }

  /** A piece being worked lies on top of its machine; the finished ones lie on the belt at the machine's output end, where the forklift takes them (a plank saw's four planks are stacked). */
  private updatePiece(v: MachineView): void {
    const m = v.m, def = PIECES[m.id], r = v.rect, key = `${m.state}${m.out}`;
    if (v.pieceKey === key) return;
    v.pieceKey = key;
    v.piece.clear();
    if (m.state === 'working') {
      v.piece.setDepth(rectDepth(r) + 0.2);
      drawBox(v.piece, toWorld, r.gx0 + 0.7, r.gy0 + 1.2, 1.6, 0.6, 22, def.working, 110);
    }
    if (m.out > 0 && (m.state === 'done' || m.id === 'planer')) {
      v.piece.setDepth(rectDepth(r) + 0.3);
      // finished pieces lie stacked at the output end: a saw 2's four planks, or the planks a planer has made so far
      const n = Math.min(m.out, PLANKS_PER_LOG), h = n > 1 || m.id === 'planer' ? 10 : 22;
      for (let i = 0; i < n; i++) drawBox(v.piece, toWorld, r.gx1 + 0.8, r.gy0 + 1.15, 1.0, 0.7, h, def.done, 16 + i * h);
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
