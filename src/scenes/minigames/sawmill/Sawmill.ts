import Phaser from 'phaser';
import { H, W } from '../../../core/layout';
import { Joystick } from '../../../core/Joystick';
import { StageScene } from '../../../core/MiniGame';
import { millSave, saveMill } from '../../../core/millSave';
import { earn } from '../../../core/profile';
import { sfx } from '../../../core/sfx';
import { bankStars } from '../../../core/stages';
import { INK } from '../../../core/theme';
import { text } from '../../../core/touch';
import { coinCounter, hudTitle, outlined, pay, type CoinCounter } from '../../../core/ui';
import { t, type Key } from '../../../i18n';
import { AXES, GEAR, PRODUCTS, SAWS, TOOLS, TREE_HP, WORKERS, WORKER_LEVELS, productOf, type GearKind, type Product, type WorkerKind } from './millData';
import {
  buyGear, buyWorker, cancelJob, chopHit, closeBench, gearCost, goalsReached, hammerTap, loadBench, millStars, newBench, newClocks,
  newJob, newTree, sawTap, sellAll, sellOne, startJob, workNeeded, workerCost, workersTick,
  type Bench, type Job, type Tree,
} from './millLogic';
import {
  BASE, BUILDINGS, FOREST_X1, HIT_COOLDOWN, REGROW, START, TREE_HIT_RADIUS, WORLD_W,
  axeStats, bladePoints, doorAt, exitPoint, isBlocked, touches, treeSpots, type Place,
} from './millWorld';

const TAB_KEY: Record<Place, Key> = { saw: 'mill.tab.saw', work: 'mill.tab.work', sell: 'mill.tab.sell', shop: 'mill.tab.shop' };
const GOAL_KEY: readonly Key[] = ['mill.goal.sell', 'mill.goal.hire', 'mill.goal.make'];
const COLORS: Record<Place, { wall: number; roof: number }> = {
  saw: { wall: 0xf6d8a8, roof: 0xc0623a }, work: { wall: 0xdff0c8, roof: 0x4fa06a },
  sell: { wall: 0xffe0e0, roof: 0xe8453c }, shop: { wall: 0xdfd3ff, roof: 0x7a6bd6 },
};

// Depths: the world sorts by its ground y (0..1540); the inside of a building covers it; the HUD is on top of both.
const INTERIOR = 3000, PANEL = 3010, HUD = 5000;
const STOCK_Y = 250;
const LOG_ICON = { x: W / 2 - 330, y: STOCK_Y };
const PLANK_ICON = { x: W / 2 + 110, y: STOCK_Y };
const WALLET_POS = { x: W - 330, y: 90 };
const GREEN = 0x2f9e5b;
const SPEED = 520;
const WALL_H = 380, ROOF_H = 100;
const AXE_TILT = 0.907; // the axe picture's blade points up and to the right; this turns it to the spin angle
const CHEST = 110;      // how far above the player's feet the axe spins
const TREE_SCALE = 0.55;

const CARD = { w: 350, h: 360, gapX: 390 };
const gridX = (i: number): number => W / 2 + ((i % 5) - 2) * CARD.gapX;

interface Tr { x: number; y: number; hp: Tree; img: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Rectangle; standing: boolean; cool: number }
interface TownWorker { img: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Image }

/** The sawmill as a little town: the forest on the left, the shop at the right end, the sawing house, the workshop and the market
 *  between them. You walk with the stick and an axe spins around you, chopping every tree it touches; walking into a door takes
 *  you inside to saw, make things, sell or shop. Money buys better axes, saws and tools and hires workers, who do the same jobs
 *  by themselves while the mill is open. */
export class Sawmill extends StageScene {
  private s = millSave;
  private bench: Bench = newBench();
  private job: Job = newJob();
  private clocks = newClocks();
  /** The building the player is inside, or null while on the street. */
  private tab: Place | null = null;
  private panel!: Phaser.GameObjects.Container;
  private interior: Phaser.GameObjects.GameObject[] = [];
  private title!: Phaser.GameObjects.Text;
  private wallet!: CoinCounter;
  private logLabel!: Phaser.GameObjects.Text;
  private plankLabel!: Phaser.GameObjects.Text;
  private shown = { logs: 0, planks: 0 };
  private workerImgs: Partial<Record<WorkerKind, Phaser.GameObjects.Image>> = {};
  private goalsSeen: boolean[] = [];
  // the street
  private worldObjs = new Set<unknown>();
  private joy!: Joystick;
  private player!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Image;
  private axe!: Phaser.GameObjects.Image;
  private axeTier = -1;
  private axeAngle = 0;
  private trees: Tr[] = [];
  private signIcons: Partial<Record<Place, Phaser.GameObjects.Image>> = {};
  private townWorkers: Partial<Record<WorkerKind, TownWorker>> = {};
  private townSig = '';
  private lastChop = 0;
  // inside the sawing house and the workshop
  private benchLog?: Phaser.GameObjects.Image;
  private sawImg?: Phaser.GameObjects.Image;
  private sawHint?: Phaser.GameObjects.Text;
  private overlay?: { box: Phaser.GameObjects.Container; ghost: Phaser.GameObjects.Image; hammer: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Rectangle; busy: boolean };

  constructor() { super('Sawmill'); }

  create(): void {
    // Every bit of state is reset here: the same scene object is reused when the player comes back.
    this.s = millSave;
    this.bench = newBench(); this.job = newJob(); this.clocks = newClocks();
    this.tab = null; this.workerImgs = {}; this.interior = []; this.worldObjs = new Set();
    this.trees = []; this.signIcons = {}; this.townWorkers = {}; this.townSig = ''; this.axeTier = -1; this.axeAngle = 0; this.lastChop = 0;
    this.benchLog = this.sawImg = this.sawHint = undefined; this.overlay = undefined;
    this.goalsSeen = goalsReached(this.s);
    this.shown = { logs: this.s.logs, planks: this.s.planks };

    this.backdrop(0xbfe9ff);
    this.drawWorld();
    this.buildTrees();
    this.buildBuildings();
    this.buildPlayer();
    this.buildTownWorkers();

    this.title = hudTitle(this, t('mill.hint.town'), { fade: true }).setDepth(HUD);
    this.wallet = coinCounter(this);
    this.wallet.icon.setDepth(HUD); this.wallet.label.setDepth(HUD);
    this.buildStock();
    this.buildInterior();
    this.panel = this.add.container(0, 0).setDepth(PANEL);
    this.joy = new Joystick(this, { r: 140, x: 300, y: 1250, zone: { maxX: 640, minY: 900 }, depth: HUD });

    // Everything that is not part of the street stays where it is on the screen.
    for (const o of this.children.list) if (!this.worldObjs.has(o) && 'setScrollFactor' in o) (o as Phaser.GameObjects.Image).setScrollFactor(0);
    this.cameras.main.setBounds(0, 0, WORLD_W, H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.centerOn(START.x, START.y);
    this.events.once('shutdown', () => this.leave());
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const r = workersTick(this.s, this.clocks, dt);
    if (r.done.length > 0) {
      if (r.coins > 0) { earn(r.coins); this.wallet.refresh(); }
      for (const kind of r.done) this.workerDone(kind);
      this.sync();
    }
    if (this.tab) return;
    this.walk(dt);
    this.spin(dt);
    const door = doorAt(this.player.x, this.player.y);
    if (door) this.enterBuilding(door);
  }

  /** Leaving (◀ or any other way out): put a log on the bench and a half-made product back, keep the stars, save. */
  private leave(): void {
    closeBench(this.s, this.bench);
    cancelJob(this.s, this.job);
    saveMill();
    bankStars(millStars(this.s));
  }

  /** ◀ inside a building steps back out onto the street; on the street it leaves the mill. */
  protected onBack(): void {
    if (this.tab) { this.exitBuilding(); return; }
    this.leave();
    super.onBack();
  }

  // ---------- the street ----------

  private w<T>(o: T): T { this.worldObjs.add(o); return o; }

  private drawWorld(): void {
    this.w(this.add.rectangle(0, 0, WORLD_W, BASE, 0xbfe9ff).setOrigin(0).setDepth(-10));
    for (let i = 0; i < 7; i++) this.w(this.add.image(260 + i * 560, 150 + (i % 3) * 80, 'cloud').setScale(0.7).setAlpha(0.9).setDepth(-9));
    this.w(this.add.rectangle(0, BASE, WORLD_W, H - BASE, 0x7fd69a).setOrigin(0).setDepth(-9));
    this.w(this.add.rectangle(0, BASE, FOREST_X1, H - BASE, 0x62b87a).setOrigin(0).setDepth(-8));
    this.w(this.add.rectangle(FOREST_X1, BASE, WORLD_W - FOREST_X1, H - BASE, 0xe2c88c).setOrigin(0).setDepth(-8));
    this.w(this.add.rectangle(FOREST_X1 - 10, BASE, 20, H - BASE, 0xc9a56b).setOrigin(0).setDepth(-7));
    for (let x = 40; x < FOREST_X1; x += 130) this.w(this.add.image(x, BASE + 15, 'forest-pine').setOrigin(0.5, 1).setScale(0.62).setDepth(BASE + 15));
  }

  private buildTrees(): void {
    for (const p of treeSpots()) {
      const img = this.w(this.add.image(p.x, p.y, 'tree').setOrigin(0.5, 1).setScale(TREE_SCALE).setDepth(p.y));
      const bar = this.w(this.add.rectangle(p.x - 45, p.y - 360, 90, 14, 0xe8453c).setOrigin(0, 0.5).setStrokeStyle(4, INK).setDepth(p.y + 1).setVisible(false));
      this.trees.push({ x: p.x, y: p.y, hp: newTree(), img, bar, standing: true, cool: 0 });
    }
  }

  private signTexture(id: Place): string {
    return id === 'saw' ? SAWS[this.s.gear.saw].tex : id === 'work' ? TOOLS[this.s.gear.tools].tex : id === 'sell' ? 'coin' : 'star';
  }

  /** The four buildings: a front wall, a roof, a door and a sign with the picture and name. */
  private buildBuildings(): void {
    for (const b of BUILDINGS) {
      const col = COLORS[b.id], hw = b.w / 2;
      const c = this.w(this.add.container(b.x, BASE).setDepth(BASE));
      const g = this.add.graphics();
      g.lineStyle(8, INK);
      g.fillStyle(col.wall).fillRect(-hw, -WALL_H, b.w, WALL_H).strokeRect(-hw, -WALL_H, b.w, WALL_H);
      const roof = [new Phaser.Math.Vector2(-hw - 20, -WALL_H), new Phaser.Math.Vector2(hw + 20, -WALL_H), new Phaser.Math.Vector2(hw - 40, -WALL_H - ROOF_H), new Phaser.Math.Vector2(-hw + 40, -WALL_H - ROOF_H)];
      g.fillStyle(col.roof).fillPoints(roof, true).strokePoints(roof, true);
      for (const cx of [-hw + 70, hw - 70]) {
        g.fillStyle(0xbfe8ff).fillRect(cx - 40, -170, 80, 80).lineStyle(6, INK).strokeRect(cx - 40, -170, 80, 80);
        g.lineBetween(cx, -170, cx, -90).lineBetween(cx - 40, -130, cx + 40, -130);
      }
      g.fillStyle(0xa0693a).fillRoundedRect(-55, -210, 110, 210, { tl: 40, tr: 40, bl: 0, br: 0 });
      g.lineStyle(8, INK).strokeRoundedRect(-55, -210, 110, 210, { tl: 40, tr: 40, bl: 0, br: 0 });
      g.fillStyle(0xffd23f).fillCircle(30, -105, 8);
      const sw = b.w - 60, cy = -300;
      const sign = this.add.graphics();
      sign.fillStyle(0xffffff).fillRoundedRect(-sw / 2, cy - 44, sw, 88, 24).lineStyle(8, INK).strokeRoundedRect(-sw / 2, cy - 44, sw, 88, 24);
      const icon = this.add.image(-sw / 2 + 55, cy, this.signTexture(b.id));
      icon.setScale(66 / Math.max(icon.width, icon.height));
      const label = text(this, 28, cy, t(TAB_KEY[b.id]), 46);
      label.setScale(Math.min(1, (sw - 130) / label.width));
      c.add([g, sign, icon, label]);
      this.signIcons[b.id] = icon;
    }
  }

  private paintSigns(): void {
    for (const b of BUILDINGS) {
      const icon = this.signIcons[b.id];
      if (!icon) continue;
      icon.setTexture(this.signTexture(b.id));
      icon.setScale(66 / Math.max(icon.width, icon.height));
    }
  }

  private buildPlayer(): void {
    const shadow = this.add.ellipse(0, 0, 110, 36, 0x000000, 0.22);
    this.body = this.add.image(0, 0, 'person').setOrigin(0.5, 1).setScale(0.5);
    this.player = this.w(this.add.container(START.x, START.y, [shadow, this.body]).setDepth(START.y));
    this.axe = this.w(this.add.image(START.x, START.y - CHEST, AXES[0].tex).setOrigin(0.26, 0.86));
    this.updateAxe();
  }

  /** The axe on you is the one you own: bigger and faster with every tier. */
  private updateAxe(): void {
    if (this.axeTier === this.s.gear.axe) return;
    this.axeTier = this.s.gear.axe;
    this.axe.setTexture(AXES[this.axeTier].tex).setScale(axeStats(this.axeTier).scale);
  }

  private walk(dt: number): void {
    const v = this.joy.read();
    if (v.lengthSq() > 0.01) {
      // Slide along the edges: try each axis on its own.
      const nx = this.player.x + v.x * SPEED * dt;
      if (!isBlocked(nx, this.player.y)) this.player.x = nx;
      const ny = this.player.y + v.y * SPEED * dt;
      if (!isBlocked(this.player.x, ny)) this.player.y = ny;
      if (Math.abs(v.x) > 0.1) this.body.setFlipX(v.x < 0);
      this.body.setAngle(Math.sin(this.time.now / 70) * 4);
    } else {
      this.body.setAngle(0);
    }
    this.player.setDepth(this.player.y);
  }

  /** The axe goes round you; every tree it touches takes a hit (a tree can be hit again after a moment). */
  private spin(dt: number): void {
    this.updateAxe();
    const st = axeStats(this.axeTier);
    this.axeAngle += st.spin * dt;
    const cx = this.player.x, cy = this.player.y - CHEST;
    this.axe.setPosition(cx, cy).setRotation(this.axeAngle + AXE_TILT).setDepth(this.player.y + 1);
    const pts = bladePoints(cx, cy, this.axeAngle, st.reach);
    for (const tr of this.trees) {
      tr.cool -= dt;
      if (tr.standing && tr.cool <= 0 && touches(pts, tr.x, tr.y - 110, TREE_HIT_RADIUS)) this.hitTree(tr);
    }
  }

  private hitTree(tr: Tr): void {
    tr.cool = HIT_COOLDOWN;
    if (this.time.now - this.lastChop > 90) { sfx.chop(); this.lastChop = this.time.now; }
    this.tweens.add({ targets: tr.img, angle: 2.5, duration: 40, yoyo: true, repeat: 1, onComplete: () => tr.img.setAngle(0) });
    for (let i = 0; i < 3; i++) {
      const chip = this.w(this.add.rectangle(tr.x, tr.y - 110, 18, 10, 0xe6b873).setStrokeStyle(3, INK).setDepth(tr.y + 2));
      this.tweens.add({ targets: chip, x: tr.x + Phaser.Math.Between(-140, 140), y: tr.y - 110 + Phaser.Math.Between(-120, 60), angle: Phaser.Math.Between(-180, 180), alpha: 0, duration: 450, onComplete: () => chip.destroy() });
    }
    const felled = chopHit(this.s, tr.hp);
    tr.bar.setVisible(!felled).setScale(Math.max(0, tr.hp.hp) / TREE_HP, 1);
    if (felled) { this.fellTree(tr, true); this.sync(); }
  }

  /** A tree falls and grows back after a while; `fly`: its log flies to the stock bar (the log is already counted). */
  private fellTree(tr: Tr, fly: boolean): void {
    if (!tr.standing) return;
    tr.standing = false;
    tr.bar.setVisible(false);
    sfx.crack();
    if (fly && !this.tab) this.fly('log', this.screenOf(tr.x, tr.y - 120), LOG_ICON, 0.5, 250);
    this.tweens.add({
      targets: tr.img, angle: -80, alpha: 0, duration: 500, ease: 'Quad.in',
      onComplete: () => this.time.delayedCall(REGROW * 1000, () => {
        if (!tr.img.active) return;
        tr.img.setAngle(0).setScale(0.1);
        this.tweens.add({ targets: tr.img, alpha: 1, scale: TREE_SCALE, duration: 600, ease: 'Back.out', onComplete: () => { tr.standing = true; } });
      }),
    });
  }

  private screenOf(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: x - cam.scrollX, y: y - cam.scrollY };
  }

  /** The hired workers standing outside: the lumberjack in the forest, the others by their workplace. Rebuilt when something changes. */
  private buildTownWorkers(): void {
    this.townSig = this.signature();
    for (const w of Object.values(this.townWorkers)) { this.tweens.killTweensOf([w.img, w.badge]); w.img.destroy(); w.badge.destroy(); }
    this.townWorkers = {};
    const at: Record<WorkerKind, { x: number; y: number }> = {
      lumberjack: { x: FOREST_X1 - 120, y: 1060 },
      sawyer: { x: BUILDINGS[0].x - 150, y: BASE + 120 },
      carpenter: { x: BUILDINGS[1].x - 150, y: BASE + 120 },
      seller: { x: BUILDINGS[2].x - 150, y: BASE + 120 },
    };
    for (const wd of WORKERS) {
      if (this.s.workers[wd.kind] === 0) continue;
      const p = at[wd.kind];
      const img = this.w(this.add.image(p.x, p.y, 'worker').setOrigin(0.5, 1).setScale(0.36).setDepth(p.y));
      const badge = this.w(this.add.image(p.x, p.y - img.displayHeight - 30, this.badgeTexture(wd.kind)).setDepth(p.y));
      this.fit(badge, 80);
      this.tweens.add({ targets: [img, badge], angle: 3, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.townWorkers[wd.kind] = { img, badge };
    }
  }

  private signature(): string { return `${Object.values(this.s.workers).join('')}${Object.values(this.s.gear).join('')}`; }

  private badgeTexture(kind: WorkerKind): string {
    return kind === 'lumberjack' ? AXES[this.s.gear.axe].tex : kind === 'sawyer' ? SAWS[this.s.gear.saw].tex : kind === 'carpenter' ? TOOLS[this.s.gear.tools].tex : 'coin';
  }

  // ---------- going in and out ----------

  private buildInterior(): void {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.interior.push(o); return o; };
    add(this.add.rectangle(0, 0, W, H, 0xf1e0c0).setOrigin(0).setDepth(INTERIOR));
    for (let x = 60; x < W; x += 170) add(this.add.rectangle(x, 300, 10, 990, 0xe4cfa6, 0.6).setOrigin(0).setDepth(INTERIOR));
    add(this.add.rectangle(0, 1290, W, 250, 0xb98b57).setOrigin(0).setDepth(INTERIOR));
    add(this.add.rectangle(0, 1290, W, 14, 0x8b5a2b).setOrigin(0).setDepth(INTERIOR));
    for (const o of this.interior) (o as Phaser.GameObjects.Rectangle).setVisible(false);
  }

  private enterBuilding(id: Place): void {
    sfx.whoosh();
    this.joy.setEnabled(false);
    // Taps on things inside a Container are matched against the camera's scroll, so the inside needs an unscrolled camera.
    this.cameras.main.stopFollow().setScroll(0, 0);
    this.title.setText(t(TAB_KEY[id])).setAlpha(1);
    for (const o of this.interior) (o as Phaser.GameObjects.Rectangle).setVisible(true);
    this.showTab(id);
  }

  private exitBuilding(): void {
    closeBench(this.s, this.bench);
    cancelJob(this.s, this.job);
    this.clearPanel();
    const id = this.tab!;
    this.tab = null;
    for (const o of this.interior) (o as Phaser.GameObjects.Rectangle).setVisible(false);
    const p = exitPoint(id);
    this.player.setPosition(p.x, p.y);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.centerOn(p.x, p.y);
    this.joy.setEnabled(true);
    this.title.setText(t('mill.hint.town')).setAlpha(0.45);
    this.paintSigns();
    this.sync();
  }

  private showTab(tab: Place): void {
    this.tab = tab;
    this.clearPanel();
    switch (tab) {
      case 'saw': this.buildSaw(); break;
      case 'work': this.buildWork(); break;
      case 'sell': this.buildSell(); break;
      case 'shop': this.buildShop(); break;
    }
  }

  private clearPanel(): void {
    for (const o of this.panel.list) this.tweens.killTweensOf(o);
    this.panel.removeAll(true);
    this.workerImgs = {};
    this.benchLog = this.sawImg = this.sawHint = undefined;
    this.overlay = undefined;
  }

  // ---------- the stock bar ----------

  private buildStock(): void {
    this.add.rectangle(W / 2, STOCK_Y, 1000, 120, 0xffffff, 0.75).setStrokeStyle(8, INK).setDepth(HUD);
    this.add.image(LOG_ICON.x, LOG_ICON.y, 'log').setScale(0.42).setDepth(HUD + 1);
    this.add.image(PLANK_ICON.x, PLANK_ICON.y, 'plank').setScale(0.4).setDepth(HUD + 1);
    this.logLabel = text(this, LOG_ICON.x + 200, STOCK_Y, String(this.s.logs), 76).setDepth(HUD + 1);
    this.plankLabel = text(this, PLANK_ICON.x + 230, STOCK_Y, String(this.s.planks), 76).setDepth(HUD + 1);
  }

  /** Something changed in the stock or the money: update the numbers, the open building, the workers outside, the stars, and save. */
  private sync(): void {
    const { logs, planks } = this.s;
    if (logs !== this.shown.logs) { if (logs > this.shown.logs) this.pulse(this.logLabel); this.shown.logs = logs; }
    if (planks !== this.shown.planks) { if (planks > this.shown.planks) this.pulse(this.plankLabel); this.shown.planks = planks; }
    this.logLabel.setText(String(logs));
    this.plankLabel.setText(String(planks));
    if (this.tab === 'work' && !this.job.id) this.showTab('work');
    else if (this.tab === 'sell' || this.tab === 'shop') this.showTab(this.tab);
    else if (this.tab === 'saw') this.updateSaw();
    if (this.signature() !== this.townSig) this.buildTownWorkers();
    saveMill();
    this.checkGoals();
  }

  private pulse(o: Phaser.GameObjects.Text): void {
    this.tweens.add({ targets: o, scale: 1.3, duration: 90, yoyo: true });
  }

  /** A goal reached for the first time: a star and its name pop up, and it is banked at once. */
  private checkGoals(): void {
    const now = goalsReached(this.s);
    const fresh = now.findIndex((v, i) => v && !this.goalsSeen[i]);
    this.goalsSeen = now;
    if (fresh < 0) return;
    bankStars(millStars(this.s));
    sfx.ding();
    const star = this.add.image(W / 2, 560, 'star').setDepth(7000).setScale(0).setScrollFactor(0);
    const label = outlined(text(this, W / 2, 720, t(GOAL_KEY[fresh]), 72).setDepth(7000)).setScale(0).setScrollFactor(0);
    this.tweens.add({ targets: [star, label], scale: 1, duration: 350, ease: 'Back.out' });
    this.tweens.add({ targets: [star, label], alpha: 0, delay: 1700, duration: 500, onComplete: () => { star.destroy(); label.destroy(); } });
  }

  // ---------- small helpers ----------

  private put<T extends Phaser.GameObjects.GameObject>(o: T): T { this.panel.add(o); return o; }

  /** A coin and an amount side by side, centred on (x, y) however many digits it has (the shared `priceTag` is made for bigger sizes). */
  private price(x: number, y: number, amount: number, size: number): Phaser.GameObjects.Container {
    const label = text(this, 0, 0, String(amount), size);
    const coin = this.add.image(0, 0, 'coin').setScale(size / 120);
    const gap = 8, total = coin.displayWidth + gap + label.width;
    coin.setX(-total / 2 + coin.displayWidth / 2);
    label.setX(total / 2 - label.width / 2);
    return this.put(this.add.container(x, y, [coin, label]));
  }

  private fit(img: Phaser.GameObjects.Image, size: number): Phaser.GameObjects.Image {
    return img.setScale(size / Math.max(img.width, img.height));
  }

  /** A picture flies across the screen (a log to the stock bar, a coin to the wallet); both ends are screen positions. */
  private fly(tex: string, from: { x: number; y: number }, to: { x: number; y: number }, scale: number, delay = 0, onDone?: () => void): void {
    const img = this.add.image(from.x, from.y, tex).setScale(scale).setDepth(HUD + 100).setScrollFactor(0).setVisible(delay === 0);
    this.tweens.add({
      targets: img, x: to.x, y: to.y, scale: scale * 0.6, delay, duration: 480, ease: 'Quad.in',
      onStart: () => img.setVisible(true), onComplete: () => { img.destroy(); onDone?.(); },
    });
  }

  private shake(o: Phaser.GameObjects.GameObject & { x: number }): void {
    this.tweens.add({ targets: o, x: o.x + 14, duration: 55, yoyo: true, repeat: 3 });
  }

  /** The worker in a panel, with the badge of what they work with above their head. */
  private worker(kind: WorkerKind, x: number, y: number, scale = 0.42): void {
    if (this.s.workers[kind] === 0) return;
    const img = this.put(this.add.image(x, y, 'worker').setOrigin(0.5, 1).setScale(scale));
    const badge = this.put(this.add.image(x, y - img.displayHeight - 40, this.badgeTexture(kind)));
    this.fit(badge, 90);
    this.tweens.add({ targets: [img, badge], y: '-=10', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.workerImgs[kind] = img;
  }

  /** A worker finished a job: a hop, and the thing they made shows up. The lumberjack really fells a tree in the forest. */
  private workerDone(kind: WorkerKind): void {
    const outside = this.townWorkers[kind];
    if (outside) this.tweens.add({ targets: outside.img, scaleY: outside.img.scaleY * 1.12, duration: 110, yoyo: true });
    const inside = this.workerImgs[kind];
    if (inside?.active) this.tweens.add({ targets: inside, scaleY: inside.scaleY * 1.12, duration: 110, yoyo: true });
    if (kind === 'lumberjack') this.lumberjackFells();
    if (kind === 'sawyer' && this.tab === 'saw') for (let i = 0; i < 4; i++) this.fly('plank', { x: W / 2 - 300, y: 900 }, PLANK_ICON, 0.3, i * 90);
    if (kind === 'seller') {
      sfx.coin();
      if (this.tab !== 'sell') this.fly('coin', outside ? this.screenOf(outside.img.x, outside.img.y - 120) : { x: W / 2, y: 700 }, WALLET_POS, 0.5);
    }
  }

  /** The lumberjack walks to the nearest standing tree and fells it (his log is already counted). */
  private lumberjackFells(): void {
    const me = this.townWorkers.lumberjack;
    const standing = this.trees.filter((tr) => tr.standing);
    if (!me || standing.length === 0) return;
    standing.sort((a, b) => Math.hypot(a.x - me.img.x, a.y - me.img.y) - Math.hypot(b.x - me.img.x, b.y - me.img.y));
    const tr = standing[0];
    const home = { x: me.img.x, y: me.img.y };
    this.tweens.add({
      targets: me.img, x: tr.x + 110, y: tr.y + 4, duration: 600,
      onUpdate: () => { me.img.setDepth(me.img.y); me.badge.setPosition(me.img.x, me.img.y - me.img.displayHeight - 30).setDepth(me.img.y); },
      onComplete: () => {
        sfx.chop();
        this.fellTree(tr, true);
        this.tweens.add({ targets: me.img, x: home.x, y: home.y, delay: 500, duration: 700, onUpdate: () => { me.img.setDepth(me.img.y); me.badge.setPosition(me.img.x, me.img.y - me.img.displayHeight - 30).setDepth(me.img.y); } });
      },
    });
  }

  // ---------- saw ----------

  private buildSaw(): void {
    this.put(this.add.rectangle(380, 1010, 1290, 50, 0xc99358).setOrigin(0).setStrokeStyle(8, INK));
    this.put(this.add.rectangle(430, 1060, 40, 200, 0xa0693a).setOrigin(0).setStrokeStyle(8, INK));
    this.put(this.add.rectangle(1580, 1060, 40, 200, 0xa0693a).setOrigin(0).setStrokeStyle(8, INK));
    this.benchLog = this.put(this.add.image(W / 2 - 360, 1010, 'log').setOrigin(0, 1).setScale(1.9, 1.9));
    this.sawImg = this.put(this.add.image(W / 2 + 180, 700, SAWS[this.s.gear.saw].tex).setScale(1.3));
    this.sawHint = this.put(text(this, W / 2, 400, '', 64));
    this.worker('sawyer', W / 2 - 700, 1200);
    const zone = this.put(this.add.rectangle(W / 2, 800, 1500, 800, 0xffffff, 0.001).setInteractive());
    zone.on('pointerdown', () => this.sawTapped());
    this.updateSaw();
  }

  /** The log on the bench shrinks as planks come off it; the hint says what to do next. */
  private updateSaw(): void {
    const left = this.bench.on ? (4 - this.bench.cuts) / 4 : 0;
    this.benchLog?.setVisible(this.bench.on).setScale(1.9 * Math.max(left, 0.05), 1.9);
    this.sawHint?.setText(!this.bench.on && this.s.logs < 1 ? t('mill.hint.nolog') : t('mill.hint.saw'));
  }

  private sawTapped(): void {
    if (!this.bench.on && !loadBench(this.s, this.bench)) {
      sfx.burp();
      if (this.sawHint) this.shake(this.sawHint);
      return;
    }
    const n = sawTap(this.s, this.bench);
    sfx.saw();
    if (this.sawImg) this.tweens.add({ targets: this.sawImg, y: 790, duration: 110, yoyo: true });
    const from = { x: W / 2 - 360 + 190, y: 900 };
    for (let i = 0; i < n; i++) this.fly('plank', from, PLANK_ICON, 0.32, i * 90);
    this.sync();
  }

  // ---------- workshop ----------

  private buildWork(): void {
    this.put(text(this, W / 2, 365, t('mill.hint.work'), 52));
    PRODUCTS.forEach((p, i) => {
      const x = gridX(i), y = 590 + Math.floor(i / 5) * 400;
      const can = this.s.planks >= p.planks;
      const picked = this.s.pick === p.id && this.s.workers.carpenter > 0;
      const bg = this.put(this.add.rectangle(x, y, CARD.w, CARD.h, picked ? 0xc9f2b4 : 0xffffff, 0.92).setStrokeStyle(picked ? 14 : 8, picked ? GREEN : INK));
      const img = this.put(this.fit(this.add.image(x, y - 78, p.tex), 170));
      this.put(text(this, x, y + 32, t(p.name), 38).setWordWrapWidth(CARD.w - 30));
      this.put(this.add.image(x - 50, y + 88, 'plank').setScale(0.2));
      this.put(text(this, x + 50, y + 88, `×${p.planks}`, 48));
      this.price(x, y + 138, p.price, 48);
      if (!can) { img.setAlpha(0.45); bg.setAlpha(0.6); }
      bg.setInteractive().on('pointerdown', () => this.pick(p, bg));
    });
    this.worker('carpenter', 130, 1290, 0.3);
    if (this.job.id) this.openOverlay();
  }

  private pick(p: Product, card: Phaser.GameObjects.Rectangle): void {
    if (this.job.id) return;
    if (!startJob(this.s, this.job, p.id)) { sfx.burp(); this.shake(card); return; }
    sfx.pop();
    this.sync();
    this.openOverlay();
  }

  /** The bench: the product appears (faintly) and every hammer tap makes it more real. */
  private openOverlay(): void {
    const id = this.job.id;
    if (!id) return;
    const p = productOf(id);
    const box = this.put(this.add.container(0, 0));
    box.add(this.add.rectangle(0, 330, W, 960, 0xf1e0c0).setOrigin(0));
    box.add(this.add.rectangle(W / 2, 900, 800, 60, 0xc99358).setStrokeStyle(8, INK));
    box.add(text(this, W / 2, 400, t('mill.hint.hammer'), 64));
    const ghost = this.fit(this.add.image(W / 2, 650, p.tex), 420);
    const hammer = this.add.image(W / 2 + 380, 900, TOOLS[this.s.gear.tools].tex).setOrigin(0.3, 0.86).setScale(1.2);
    box.add(this.add.rectangle(W / 2, 1010, 600, 40, 0xffffff, 0.8).setStrokeStyle(6, INK));
    const bar = this.add.rectangle(W / 2 - 294, 1010, 588, 28, GREEN).setOrigin(0, 0.5).setScale(0, 1);
    box.add([ghost, hammer, bar]);
    const zone = this.add.rectangle(W / 2, 800, W, 1000, 0xffffff, 0.001).setInteractive();
    box.add(zone);
    this.overlay = { box, ghost, hammer, bar, busy: false };
    this.paintOverlay();
    zone.on('pointerdown', () => this.hammer());
  }

  private paintOverlay(): void {
    const o = this.overlay;
    if (!o || !this.job.id) return;
    const f = this.job.taps / workNeeded(this.s, this.job.id);
    o.ghost.setAlpha(0.25 + 0.75 * f);
    o.bar.setScale(f, 1);
  }

  private hammer(): void {
    const o = this.overlay;
    if (!o || o.busy || !this.job.id) return;
    sfx.bang();
    this.tweens.add({ targets: o.hammer, angle: -60, duration: 80, yoyo: true });
    this.tweens.add({ targets: o.ghost, scale: o.ghost.scale * 1.06, duration: 60, yoyo: true });
    if (!hammerTap(this.s, this.job)) { this.paintOverlay(); return; }
    o.busy = true;
    o.ghost.setAlpha(1);
    o.bar.setScale(1, 1);
    sfx.chest();
    this.tweens.add({ targets: o.ghost, scale: o.ghost.scale * 1.25, duration: 220, yoyo: true, ease: 'Back.out' });
    this.time.delayedCall(700, () => this.sync());
  }

  // ---------- sell ----------

  private buildSell(): void {
    const any = PRODUCTS.some((p) => this.s.goods[p.id] > 0);
    this.put(text(this, W / 2, any ? 380 : 700, any ? '' : t('mill.sell.empty'), 70));
    PRODUCTS.forEach((p, i) => {
      const n = this.s.goods[p.id];
      const x = gridX(i), y = 560 + Math.floor(i / 5) * 360;
      const bg = this.put(this.add.rectangle(x, y, CARD.w, 330, 0xffffff, n > 0 ? 0.92 : 0.45).setStrokeStyle(8, INK));
      this.put(this.fit(this.add.image(x, y - 50, p.tex), 170).setAlpha(n > 0 ? 1 : 0.4));
      this.put(text(this, x, y + 70, t(p.name), 36).setWordWrapWidth(CARD.w - 30));
      this.price(x, y + 125, p.price, 46);
      if (n > 0) {
        this.put(this.add.circle(x - 130, y - 130, 40, 0xffd23f).setStrokeStyle(7, INK));
        this.put(text(this, x - 130, y - 130, String(n), 46));
        bg.setInteractive().on('pointerdown', () => this.sellOneOf(p.id, x, y));
      }
    });
    if (any) {
      const total = PRODUCTS.reduce((sum, p) => sum + this.s.goods[p.id] * p.price, 0);
      const btn = this.put(this.add.rectangle(W / 2, 1225, 620, 100, 0x5dd39e).setStrokeStyle(8, INK).setInteractive());
      this.put(text(this, W / 2 - 40, 1225, t('mill.sell.all'), 52));
      this.price(W / 2 + 200, 1225, total, 46);
      btn.on('pointerdown', () => {
        const coins = sellAll(this.s);
        earn(coins); this.wallet.refresh(); sfx.coin();
        for (let i = 0; i < 5; i++) this.fly('coin', { x: W / 2, y: 1000 }, WALLET_POS, 0.5, i * 70);
        this.sync();
      });
    }
    this.worker('seller', 130, 1290, 0.3);
  }

  private sellOneOf(id: Product['id'], x: number, y: number): void {
    const coins = sellOne(this.s, id);
    if (coins === 0) return;
    earn(coins); this.wallet.refresh(); sfx.coin();
    this.fly('coin', { x, y }, WALLET_POS, 0.5);
    this.sync();
  }

  // ---------- shop ----------

  private buildShop(): void {
    const reached = goalsReached(this.s);
    GOAL_KEY.forEach((k, i) => this.put(text(this, 380 + i * 640, 365, `${reached[i] ? '⭐' : '☆'} ${t(k)}`, 40)));
    this.put(text(this, 520, 445, t('mill.shop.gear'), 56));
    this.put(text(this, 1530, 445, t('mill.shop.workers'), 56));
    (Object.keys(GEAR) as GearKind[]).forEach((kind, i) => this.gearRow(kind, 600 + i * 240));
    WORKERS.forEach((w, i) => this.workerRow(w.kind, 570 + i * 190));
  }

  private gearRow(kind: GearKind, y: number): void {
    const tiers = GEAR[kind], cur = this.s.gear[kind], next = tiers[cur + 1];
    const cost = gearCost(this.s, kind);
    const bg = this.put(this.add.rectangle(520, y, 940, 215, 0xffffff, 0.92).setStrokeStyle(8, INK));
    this.put(this.fit(this.add.image(150, y - 10, tiers[cur].tex), 150));
    this.put(text(this, 150, y + 80, t(tiers[cur].name), 30).setWordWrapWidth(210));
    if (!next || cost === null) { this.put(text(this, 640, y, t('mill.max'), 64)); return; }
    this.put(text(this, 330, y, '➜', 70));
    this.put(this.fit(this.add.image(510, y - 10, next.tex), 150));
    this.put(text(this, 510, y + 80, t(next.name), 30).setWordWrapWidth(210));
    this.price(770, y, cost, 56);
    bg.setInteractive().on('pointerdown', () => {
      if (!pay(this, this.wallet, cost)) { this.shake(bg); return; }
      buyGear(this.s, kind);
      sfx.coin(); sfx.chest();
      this.sync();
    });
  }

  private workerRow(kind: WorkerKind, y: number): void {
    const def = WORKERS.find((w) => w.kind === kind)!;
    const level = this.s.workers[kind], cost = workerCost(this.s, kind);
    const bg = this.put(this.add.rectangle(1530, y, 940, 170, 0xffffff, 0.92).setStrokeStyle(8, level > 0 ? def.tint : INK));
    const img = this.put(this.add.image(1130, y + 78, 'worker').setOrigin(0.5, 1).setScale(0.3));
    if (level === 0) img.setAlpha(0.45);
    this.put(text(this, 1360, y - 30, t(def.name), 44).setWordWrapWidth(300));
    for (let i = 0; i < WORKER_LEVELS; i++) {
      this.put(this.add.circle(1290 + i * 50, y + 38, 17, i < level ? def.tint : 0xffffff).setStrokeStyle(5, INK));
    }
    if (cost === null) { this.put(text(this, 1750, y, t('mill.max'), 52)); return; }
    this.price(1760, y, cost, 52);
    bg.setInteractive().on('pointerdown', () => {
      if (!pay(this, this.wallet, cost)) { this.shake(bg); return; }
      buyWorker(this.s, kind);
      sfx.coin(); sfx.chest();
      this.sync();
    });
  }
}
