import Phaser from 'phaser';
import { text } from '../../../core/touch';
import { priceTag } from '../../../core/ui';
import { CAP, TUNING, type StockId } from './idleData';
import { PAD_H, PIECE_COLOR, drawBox, lumberjack, rel, rectDepth, stump, tree } from './idleDraw';
import { toWorld, type Point, type Tile } from './idleIso';
import { ACTIVE_PLOTS, DEBARKER, FOREST_PLOTS, LANDING, PILE, LOADING_YARD, SLOTS, STARTING_SLOT, STORAGE, centre, type TileRect } from './idleLayout';
import { haulerHasJob, workerHasJob, type Hauler, type Machine, type IdleState, type Plot, type Truck } from './idleLogic';

// What moves in the idle sawmill, drawn from the state (idleLogic.ts): the lumberjack and his tree, the forklifts, the trucks, the pieces
// waiting in their places and the machines' progress bars. Placeholder blocks like the rest of the world (idleDraw.ts). Everything is
// created inside `world` (the scrolling layer), with the depth `x + y` of its tile (plus a bit for how far it reaches), the key the static
// blocks are sorted by.

const FORKLIFT_COLOR = 0xffc83d;
const TRUCK_COLOR = { logging: 0x4f9f6a, delivery: 0x5b8fd0 } as const;
const PIECE_OF_HAULER = { f1: PIECE_COLOR.trunk, f2: PIECE_COLOR.peeled, out: PIECE_COLOR.square } as const;
const BAR_W = 150;

const SAW_SLOT = SLOTS.find((s) => s.row === 1 && s.index === STARTING_SLOT)!.rect;
/** The machines of the line, in the order of `IdleState.machines`: where each stands, and the colour of the piece it works on and of the one it has finished. */
const MACHINES = [
  { rect: DEBARKER, working: PIECE_COLOR.trunk, done: PIECE_COLOR.peeled },
  { rect: SAW_SLOT, working: PIECE_COLOR.peeled, done: PIECE_COLOR.square },
] as const;

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

function drawForklift(g: Phaser.GameObjects.Graphics, dx: number, dy: number, cargo: number | null): void {
  g.clear();
  const front: Part[] = [
    { a0: 0.2, a1: 0.35, b0: -0.2, b1: 0.2, h: 75, color: 0x8a8a8a },
    { a0: 0.35, a1: 0.8, b0: -0.17, b1: 0.17, h: 5, z0: 3, color: 0x4a4a4a },
  ];
  if (cargo !== null) front.push({ a0: 0.38, a1: 0.78, b0: -0.14, b1: 0.14, h: 20, z0: 8, color: cargo });
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
export type Hit = { kind: 'worker' } | { kind: 'plot'; i: number } | { kind: 'hauler'; i: number } | { kind: 'truck' };

interface PlotView { tree: Phaser.GameObjects.Graphics; stump: Phaser.GameObjects.Graphics; at: Point }
/** A bar that follows a vehicle and shows how long it will still work. */
interface ActiveBar { g: Phaser.GameObjects.Graphics; step: number }
const HINT_WORKER = 0;
const HINT_HAULER = 1;
const HINT_TRUCK = 4;

export class IdleView {
  private readonly scene: Phaser.Scene;
  private readonly world: Phaser.GameObjects.Layer;
  private readonly plots: PlotView[];
  private readonly workerG: Phaser.GameObjects.Graphics;
  private workerCarry = false;
  /** The finger over something that is waiting for a tap: the worker, the three forklifts, the logging truck. */
  private readonly hints: Phaser.GameObjects.Text[];
  private readonly activeBars: ActiveBar[];
  private readonly haulers: Mover[];
  private readonly trucks: Mover[];
  private readonly stacks = new Map<StockId, { g: Phaser.GameObjects.Graphics; n: number }>();
  private readonly bars: { g: Phaser.GameObjects.Graphics; at: Tile; step: number }[];
  /** The piece a machine works on, or has finished and holds for a forklift. */
  private readonly machineLogs: { g: Phaser.GameObjects.Graphics; key: string }[];

  constructor(scene: Phaser.Scene, world: Phaser.GameObjects.Layer, s: IdleState) {
    this.scene = scene;
    this.world = world;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { world.add(o); return o; };

    // the trees the worker tends: a tree and a stump each (the stump shows when the tree is gone)
    this.plots = FOREST_PLOTS.slice(0, ACTIVE_PLOTS).map((plot) => {
      const c = { gx: (plot.gx0 + plot.gx1 + 1) / 2, gy: (plot.gy0 + plot.gy1 + 1) / 2 };
      const at = toWorld(c.gx + 0.4, c.gy - 0.4);
      const tr = add(scene.add.graphics().setPosition(at.x, at.y).setDepth(c.gx + c.gy + 0.4));
      const st = add(scene.add.graphics().setPosition(at.x, at.y).setDepth(c.gx + c.gy + 0.3));
      tree(tr, { x: 0, y: 0 }, 1.15);
      stump(st, { x: 0, y: 0 }, 1.15);
      return { tree: tr, stump: st, at };
    });
    this.workerG = add(scene.add.graphics());
    this.drawWorker(false);

    this.haulers = s.haulers.map((h) => mover(add(scene.add.graphics()), h.pos, 1, 0));
    // the logging truck stands facing up the road (it drives its loop from there); the delivery truck faces down
    this.trucks = s.trucks.map((truck) => mover(add(scene.add.graphics().setVisible(false)), truck.pos, 0, truck.id === 'logging' ? -1 : 1));

    for (const st of STACKS) this.stacks.set(st.id, { g: add(scene.add.graphics().setDepth(st.rect.gx1 + 1 - st.pad + st.rect.gy1 + 1 - st.pad + 0.5)), n: -1 });
    this.bars = [centre(DEBARKER), centre(SAW_SLOT)].map((p) => ({ g: add(scene.add.graphics().setDepth(5000)), at: { gx: p.gx, gy: p.gy }, step: -1 }));
    this.machineLogs = MACHINES.map(() => ({ g: add(scene.add.graphics()), key: '' }));
    this.hints = [0, 1, 2, 3, 4].map(() => add(text(scene, 0, 0, '👆', 90).setDepth(5001).setVisible(false)));
    this.activeBars = [0, 1, 2, 3].map(() => ({ g: add(scene.add.graphics().setDepth(5000)), step: -1 }));
  }

  private drawWorker(carrying: boolean): void {
    this.workerCarry = carrying;
    this.workerG.clear();
    lumberjack(this.workerG, { x: 0, y: 0 });
    if (carrying) this.workerG.fillStyle(PIECE_COLOR.trunk, 1).fillRoundedRect(-46, -62, 92, 24, 10);
  }

  /** What is under a finger at world point (x, y): the vehicles and the worker first (they are small), then the trees. The targets are generous. */
  hit(x: number, y: number): Hit | null {
    let best: Hit | null = null, bestD = Infinity;
    const consider = (h: Hit, cx: number, cy: number, r: number): void => {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r && d < bestD) { best = h; bestD = d; }
    };
    this.haulers.forEach((m, i) => consider({ kind: 'hauler', i }, m.g.x, m.g.y - 60, 135));
    if (this.trucks[0].g.visible) consider({ kind: 'truck' }, this.trucks[0].g.x, this.trucks[0].g.y - 50, 190);
    consider({ kind: 'worker' }, this.workerG.x, this.workerG.y - 70, 100);
    if (best) return best;
    this.plots.forEach((p, i) => { if (p.tree.visible) consider({ kind: 'plot', i }, p.at.x, p.at.y - 120, 120); });
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
    s.plots.forEach((p, i) => this.updatePlot(p, this.plots[i], ms));
    this.updateWorker(s, ms);
    s.haulers.forEach((h, i) => this.updateHauler(h, this.haulers[i], i, s, ms));
    s.trucks.forEach((tr, i) => this.updateTruck(tr, this.trucks[i], s, ms));
    for (const st of STACKS) this.updateStack(st, s.stock[st.id]);
    s.machines.forEach((m, i) => { this.updateBar(this.bars[i], m.state === 'working' ? Math.floor((m.t / m.workS) * 20) : -1); this.updateMachineLog(m, i); });
  }

  private updatePlot(p: Plot, v: PlotView, ms: number): void {
    // the tree: standing, shaking and falling while he chops, then a stump, a sapling and a tree again
    let scale = 1, angle = 0, treeShown = true;
    switch (p.phase) {
      case 'ready': break;
      case 'chopping': {
        const f = p.t / TUNING.chopS;
        angle = f < 0.7 ? Math.sin(ms / 40) * 2.5 : ((f - 0.7) / 0.3) * 80;
        break;
      }
      case 'planting': scale = 0.15 + 0.15 * Math.min(1, p.t / TUNING.plantS); break;
      case 'growing': scale = 0.3 + 0.7 * Math.min(1, p.t / TUNING.growS); break;
      default: treeShown = false;
    }
    v.tree.setVisible(treeShown).setScale(scale).setAngle(angle);
    v.stump.setVisible(!treeShown || p.phase === 'chopping');
  }

  private updateWorker(s: IdleState, ms: number): void {
    const w = s.worker;
    if (this.workerCarry !== w.carrying) this.drawWorker(w.carrying);
    const at = toWorld(w.pos.gx, w.pos.gy);
    this.workerG.setPosition(at.x, at.y).setDepth(w.pos.gx + w.pos.gy + 0.5);
    this.showHint(HINT_WORKER, workerHasJob(s), at.x, at.y - 170, ms);
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
    const key = `${m.dx},${m.dy},${h.carrying}`;
    if (key !== m.key) { m.key = key; drawForklift(m.g, m.dx, m.dy, h.carrying ? PIECE_OF_HAULER[h.id] : null); }
    const w = toWorld(h.pos.gx, h.pos.gy);
    m.g.setPosition(w.x, w.y).setDepth(h.pos.gx + h.pos.gy + 0.8);
    this.updateActive(i, h.active, w.x, w.y - 130);
    this.showHint(HINT_HAULER + i, h.active <= 0 && haulerHasJob(s, i), w.x, w.y - 150, ms);
  }

  private updateTruck(tr: Truck, m: Mover, s: IdleState, ms: number): void {
    if (tr.phase === 'away') { m.g.setVisible(false); m.last = { gx: tr.pos.gx, gy: tr.pos.gy }; return; }
    m.g.setVisible(true);
    face(m, tr.pos, tr.axis);
    const key = `${m.dx},${m.dy},${tr.cargo}`;
    if (key !== m.key) { m.key = key; drawTruck(m.g, m.dx, m.dy, TRUCK_COLOR[tr.id], tr.cargo, tr.id === 'logging' ? PIECE_COLOR.trunk : PIECE_COLOR.square); }
    const w = toWorld(tr.pos.gx, tr.pos.gy);
    m.g.setPosition(w.x, w.y).setDepth(tr.pos.gx + tr.pos.gy + 1.5);
    if (tr.id === 'logging') {
      this.updateActive(3, tr.active, w.x, w.y - 190);
      this.showHint(HINT_TRUCK, tr.active <= 0 && tr.phase === 'parked' && s.stock.landing >= 1, w.x, w.y - 210, ms);
    }
  }

  /** The pieces waiting in a place, as logs on its pad, in layers: lengthwise along gx, side by side along gy. */
  private updateStack(st: (typeof STACKS)[number], n: number): void {
    const o = this.stacks.get(st.id)!;
    if (o.n === n) return;
    o.n = n;
    o.g.clear();
    const r = st.rect, w = r.gx1 - r.gx0 + 1 - 2 * st.pad, d = r.gy1 - r.gy0 + 1 - 2 * st.pad;
    const len = Math.min(1.6, w - 0.2), thick = 0.42;
    const cols = Math.max(1, Math.floor(w / len)), rows = Math.max(1, Math.floor(d / thick)), per = cols * rows;
    const x0 = r.gx0 + st.pad + (w - cols * len) / 2, y0 = r.gy0 + st.pad + (d - rows * thick) / 2;
    for (let i = 0; i < Math.min(n, CAP[st.id]); i++) {
      const layer = Math.floor(i / per), k = i % per;
      drawBox(o.g, toWorld, x0 + (k % cols) * len, y0 + Math.floor(k / cols) * thick, len, thick * 0.9, 20, st.color, PAD_H + layer * 20);
    }
  }

  /** A piece being worked lies on top of its machine; a finished one lies on the belt at the machine's output end, where the forklift takes it. */
  private updateMachineLog(m: Machine, i: number): void {
    const o = this.machineLogs[i], def = MACHINES[i], r = def.rect;
    if (o.key === m.state) return;
    o.key = m.state;
    o.g.clear();
    if (m.state === 'empty') return;
    if (m.state === 'working') {
      o.g.setDepth(rectDepth(r) + 0.2);
      drawBox(o.g, toWorld, r.gx0 + 0.7, r.gy0 + 1.2, 1.6, 0.6, 22, def.working, 110);
    } else {
      o.g.setDepth(rectDepth(r) + 0.3);
      drawBox(o.g, toWorld, r.gx1 + 0.8, r.gy0 + 1.15, 1.0, 0.7, 22, def.done, 16);
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
