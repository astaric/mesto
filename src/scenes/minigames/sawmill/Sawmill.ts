import Phaser from 'phaser';
import { W } from '../../../core/layout';
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

type Tab = 'chop' | 'saw' | 'work' | 'sell' | 'shop';
const TABS: readonly Tab[] = ['chop', 'saw', 'work', 'sell', 'shop'];
const TAB_KEY: Record<Tab, Key> = { chop: 'mill.tab.chop', saw: 'mill.tab.saw', work: 'mill.tab.work', sell: 'mill.tab.sell', shop: 'mill.tab.shop' };
const GOAL_KEY: readonly Key[] = ['mill.goal.sell', 'mill.goal.hire', 'mill.goal.make'];

const TAB_Y = 1425;
const STOCK_Y = 250;
const LOG_ICON = { x: W / 2 - 330, y: STOCK_Y };
const PLANK_ICON = { x: W / 2 + 110, y: STOCK_Y };
const WALLET_POS = { x: W - 330, y: 90 };
const GREEN = 0x2f9e5b;

const CARD = { w: 350, h: 360, gapX: 390 };
const gridX = (i: number): number => W / 2 + ((i % 5) - 2) * CARD.gapX;

/** The sawmill: chop trees into logs, saw logs into 4 planks each, make products of planks and sell them. The money buys
 *  better axes, saws and tools and hires workers, who do the same jobs by themselves while the mill is open. */
export class Sawmill extends StageScene {
  private s = millSave;
  private tree: Tree = newTree();
  private bench: Bench = newBench();
  private job: Job = newJob();
  private clocks = newClocks();
  private tab: Tab = 'chop';
  private panel!: Phaser.GameObjects.Container;
  private wallet!: CoinCounter;
  private logLabel!: Phaser.GameObjects.Text;
  private plankLabel!: Phaser.GameObjects.Text;
  private shown = { logs: 0, planks: 0 };
  private tabBtns: { tab: Tab; bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image }[] = [];
  private workerImgs: Partial<Record<WorkerKind, Phaser.GameObjects.Image>> = {};
  private goalsSeen: boolean[] = [];
  private felling = false;
  // the chop panel
  private treeImg?: Phaser.GameObjects.Image;
  private axeImg?: Phaser.GameObjects.Image;
  private hpBar?: Phaser.GameObjects.Rectangle;
  // the saw panel
  private benchLog?: Phaser.GameObjects.Image;
  private sawImg?: Phaser.GameObjects.Image;
  private sawHint?: Phaser.GameObjects.Text;
  // the workshop's hammering
  private overlay?: { box: Phaser.GameObjects.Container; ghost: Phaser.GameObjects.Image; hammer: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Rectangle; busy: boolean };

  constructor() { super('Sawmill'); }

  create(): void {
    // Every bit of state is reset here: the same scene object is reused when the player comes back.
    this.s = millSave;
    this.tree = newTree(); this.bench = newBench(); this.job = newJob(); this.clocks = newClocks();
    this.tab = 'chop'; this.tabBtns = []; this.workerImgs = {}; this.felling = false;
    this.treeImg = this.axeImg = this.hpBar = this.benchLog = this.sawImg = this.sawHint = undefined; this.overlay = undefined;
    this.goalsSeen = goalsReached(this.s);
    this.shown = { logs: this.s.logs, planks: this.s.planks };

    this.backdrop(0xf1e0c0);
    this.add.rectangle(0, 1290, W, 250, 0xb98b57).setOrigin(0).setDepth(-5);
    this.add.rectangle(0, 1290, W, 14, 0x8b5a2b).setOrigin(0).setDepth(-5);
    for (let x = 60; x < W; x += 170) this.add.rectangle(x, 300, 10, 990, 0xe4cfa6, 0.6).setOrigin(0).setDepth(-6);
    hudTitle(this, t('mill.title'), { fade: true });
    this.wallet = coinCounter(this);
    this.buildStock();
    this.panel = this.add.container(0, 0).setDepth(10);
    this.buildTabs();
    this.showTab('chop');
    this.events.once('shutdown', () => this.leave());
  }

  update(_time: number, delta: number): void {
    const r = workersTick(this.s, this.clocks, delta / 1000);
    if (r.done.length === 0) return;
    if (r.coins > 0) { earn(r.coins); this.wallet.refresh(); }
    for (const kind of r.done) this.workerDone(kind);
    this.sync();
  }

  /** Leaving (◀ or any other way out): put a log on the bench and a half-made product back, keep the stars, save. */
  private leave(): void {
    closeBench(this.s, this.bench);
    cancelJob(this.s, this.job);
    saveMill();
    bankStars(millStars(this.s));
  }

  protected onBack(): void {
    this.leave();
    super.onBack();
  }

  // ---------- the stock bar and the tabs ----------

  private buildStock(): void {
    this.add.rectangle(W / 2, STOCK_Y, 1000, 120, 0xffffff, 0.6).setStrokeStyle(8, INK).setDepth(5);
    this.add.image(LOG_ICON.x, LOG_ICON.y, 'log').setScale(0.42).setDepth(6);
    this.add.image(PLANK_ICON.x, PLANK_ICON.y, 'plank').setScale(0.4).setDepth(6);
    this.logLabel = text(this, LOG_ICON.x + 200, STOCK_Y, String(this.s.logs), 76).setDepth(6);
    this.plankLabel = text(this, PLANK_ICON.x + 230, STOCK_Y, String(this.s.planks), 76).setDepth(6);
  }

  private tabTexture(tab: Tab): string {
    switch (tab) {
      case 'chop': return AXES[this.s.gear.axe].tex;
      case 'saw': return SAWS[this.s.gear.saw].tex;
      case 'work': return TOOLS[this.s.gear.tools].tex;
      case 'sell': return 'coin';
      case 'shop': return 'star';
    }
  }

  private buildTabs(): void {
    TABS.forEach((tab, i) => {
      const x = W / 2 + (i - 2) * 400;
      const bg = this.add.rectangle(x, TAB_Y, 370, 170, 0xffffff, 0.92).setStrokeStyle(8, INK).setDepth(20).setInteractive();
      const icon = this.add.image(x, TAB_Y - 30, this.tabTexture(tab)).setDepth(21);
      icon.setScale(86 / Math.max(icon.width, icon.height));
      text(this, x, TAB_Y + 54, t(TAB_KEY[tab]), 42).setDepth(21);
      bg.on('pointerdown', () => { if (this.tab !== tab) { sfx.pop(); this.showTab(tab); } });
      this.tabBtns.push({ tab, bg, icon });
    });
  }

  private paintTabs(): void {
    for (const b of this.tabBtns) {
      const on = b.tab === this.tab;
      b.bg.setFillStyle(on ? 0xc9f2b4 : 0xffffff, 0.92).setStrokeStyle(on ? 14 : 8, on ? GREEN : INK);
      b.icon.setTexture(this.tabTexture(b.tab));
      b.icon.setScale(86 / Math.max(b.icon.width, b.icon.height));
    }
  }

  private showTab(tab: Tab): void {
    this.tab = tab;
    this.paintTabs();
    this.clearPanel();
    switch (tab) {
      case 'chop': this.buildChop(); break;
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
    this.treeImg = this.axeImg = this.hpBar = this.benchLog = this.sawImg = this.sawHint = undefined;
    this.overlay = undefined;
  }

  /** Something changed in the stock or the money: update the numbers, the open tab, the stars, and save. */
  private sync(): void {
    const { logs, planks } = this.s;
    if (logs !== this.shown.logs) { if (logs > this.shown.logs) this.pulse(this.logLabel); this.shown.logs = logs; }
    if (planks !== this.shown.planks) { if (planks > this.shown.planks) this.pulse(this.plankLabel); this.shown.planks = planks; }
    this.logLabel.setText(String(logs));
    this.plankLabel.setText(String(planks));
    if (this.tab === 'work' && !this.job.id) this.showTab('work');
    else if (this.tab === 'sell' || this.tab === 'shop') this.showTab(this.tab);
    else if (this.tab === 'saw') this.updateSaw();
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
    const star = this.add.image(W / 2, 560, 'star').setDepth(7000).setScale(0);
    const label = outlined(text(this, W / 2, 720, t(GOAL_KEY[fresh]), 72).setDepth(7000)).setScale(0);
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

  /** A picture flies from one spot to another (a log to the stock bar, a coin to the wallet). */
  private fly(tex: string, from: { x: number; y: number }, to: { x: number; y: number }, scale: number, delay = 0, onDone?: () => void): void {
    const img = this.add.image(from.x, from.y, tex).setScale(scale).setDepth(500).setVisible(delay === 0);
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
    const tex = kind === 'lumberjack' ? AXES[this.s.gear.axe].tex : kind === 'sawyer' ? SAWS[this.s.gear.saw].tex : kind === 'carpenter' ? TOOLS[this.s.gear.tools].tex : 'coin';
    const badge = this.put(this.add.image(x, y - img.displayHeight - 40, tex));
    this.fit(badge, 90);
    this.tweens.add({ targets: [img, badge], y: '-=10', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.workerImgs[kind] = img;
  }

  /** A worker finished a job: a hop, and the thing they made shows up in the open tab. */
  private workerDone(kind: WorkerKind): void {
    const img = this.workerImgs[kind];
    if (img?.active) this.tweens.add({ targets: img, scaleY: img.scaleY * 1.12, duration: 110, yoyo: true });
    if (kind === 'lumberjack' && this.tab === 'chop' && !this.felling) this.fell();
    if (kind === 'sawyer' && this.tab === 'saw') for (let i = 0; i < 4; i++) this.fly('plank', { x: W / 2 - 300, y: 900 }, PLANK_ICON, 0.3, i * 90);
    if (kind === 'seller' && this.tab !== 'sell') this.fly('coin', { x: W / 2, y: 700 }, WALLET_POS, 0.5);
    if (kind === 'seller') sfx.coin();
  }

  // ---------- chop ----------

  private buildChop(): void {
    this.put(this.add.rectangle(0, 1090, W, 200, 0x73bf86).setOrigin(0));
    this.put(this.add.rectangle(0, 1090, W, 14, 0x5fae74).setOrigin(0));
    this.put(text(this, W / 2, 400, t('mill.hint.chop'), 64));
    this.treeImg = this.put(this.add.image(W / 2, 1130, 'tree').setOrigin(0.5, 1).setScale(1.05));
    this.axeImg = this.put(this.add.image(W / 2 + 330, 1110, AXES[this.s.gear.axe].tex).setOrigin(0.26, 0.86).setScale(1.1));
    this.put(this.add.rectangle(W / 2, 1230, 400, 30, 0xffffff, 0.8).setStrokeStyle(6, INK));
    this.hpBar = this.put(this.add.rectangle(W / 2 - 197, 1230, 394, 22, 0xe8453c).setOrigin(0, 0.5));
    this.updateHp();
    this.worker('lumberjack', W / 2 - 560, 1200);
    const zone = this.put(this.add.rectangle(W / 2, 800, 900, 800, 0xffffff, 0.001).setInteractive());
    zone.on('pointerdown', () => this.chop());
  }

  private updateHp(): void {
    this.hpBar?.setScale(Math.max(0, this.tree.hp) / TREE_HP, 1);
  }

  private chop(): void {
    if (this.felling || !this.treeImg?.active) return;
    sfx.chop();
    if (this.axeImg) this.tweens.add({ targets: this.axeImg, angle: -55, duration: 90, yoyo: true });
    this.tweens.add({ targets: this.treeImg, angle: 2, duration: 40, yoyo: true, repeat: 2, onComplete: () => this.treeImg?.setAngle(0) });
    for (let i = 0; i < 4; i++) {
      const chip = this.add.rectangle(W / 2 + 120, 900, 18, 10, 0xe6b873).setStrokeStyle(3, INK).setDepth(400);
      this.tweens.add({ targets: chip, x: chip.x + Phaser.Math.Between(60, 240), y: chip.y + Phaser.Math.Between(-140, 80), angle: Phaser.Math.Between(-180, 180), alpha: 0, duration: 450, onComplete: () => chip.destroy() });
    }
    if (chopHit(this.s, this.tree)) { this.fell(); this.sync(); } else this.updateHp();
  }

  /** The tree falls, a log flies to the stock bar and a new tree grows. (The log itself is already counted.) */
  private fell(): void {
    const img = this.treeImg;
    if (!img?.active) return;
    this.felling = true;
    sfx.crack();
    this.updateHp();
    this.fly('log', { x: W / 2, y: 900 }, LOG_ICON, 0.5, 250);
    this.tweens.add({
      targets: img, angle: -80, alpha: 0, duration: 500, ease: 'Quad.in',
      onComplete: () => {
        this.felling = false;
        if (!img.active) return;
        img.setAngle(0).setScale(0.2);
        this.tweens.add({ targets: img, alpha: 1, scale: 1.05, duration: 400, ease: 'Back.out' });
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
      this.paintTabs();
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
