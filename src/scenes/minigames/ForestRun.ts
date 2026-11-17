import Phaser from 'phaser';
import { W, H } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { text, tapButton } from '../../core/touch';
import { sfx } from '../../core/sfx';
import { progress } from '../../core/stages';
import { DEFS, UNLOCK, makeTask, taskText, type Kind, type Metric, type Task } from './forestData';

// ---- pseudo-3D camera -------------------------------------------------------
const HORIZON = 620;       // screen y of the vanishing line
const FOCAL = 1000;        // s = FOCAL / (FOCAL + z)
const CAMH = 600;          // ground y = HORIZON + CAMH * s
const ZFAR = 4200;         // spawn distance
const STEP = 250;          // length of one path stripe
const PATH_HW = 520;       // half width of the path
const MAX_CAM = 400;       // how far the player can strafe from the path centre
const BEND = 600;          // max sideways shift of the far path (px)

// ---- player -----------------------------------------------------------------
const MAX_HEARTS = 5;
const MAG = 8;
const RELOAD = 1.0;
const STRAFE = 650;
const JOY = { x: 300, y: 1290, r: 140 };

interface Ent {
  kind: Kind;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; z: number;
  lift: number;
  baseX: number;
  hp: number;
  vx: number;
  t: number;
  bs: number;             // base scale (display width at s=1 / texture width)
  throwT: number;
  flash: number;
  flashed: boolean;
  counted: boolean;       // bunny already saved
}

interface Decor { img: Phaser.GameObjects.Image; x: number; z: number; w: number }

const DECOR: { tex: string; w: number; weight: number }[] = [
  { tex: 'tree', w: 520, weight: 3 },
  { tex: 'gozd-bor', w: 470, weight: 4 },
  { tex: 'gozd-grm', w: 340, weight: 3 },
  { tex: 'gozd-panj', w: 220, weight: 1 },
  { tex: 'rock', w: 300, weight: 1 },
];

const clamp = Phaser.Math.Clamp;

export class ForestRun extends StageScene {
  private ents: Ent[] = [];
  private decor: Decor[] = [];
  private tasks: Task[] = [];

  private camX = 0;
  private distU = 0;
  private metAcc = 0;
  private bendAmt = 0;
  private hearts = MAX_HEARTS;
  private ammo = MAG;
  private reloadT = 0;
  private nextShot = 0;
  private score = 0;
  private tasksDone = 0;
  private spawnT = 1;
  private over = false;
  private noHit = 0;

  private joyId: number | null = null;
  private joyX = 0;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'A' | 'D', Phaser.Input.Keyboard.Key>;

  private ground!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private gun!: Phaser.GameObjects.Image;
  private gunBaseY = 0;
  private recoil = 0;
  private heartImgs: Phaser.GameObjects.Image[] = [];
  private pips: Phaser.GameObjects.Arc[] = [];
  private joyKnob!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;
  private taskTexts: Phaser.GameObjects.Text[] = [];
  private treeLine: { img: Phaser.GameObjects.Image; x: number }[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];

  constructor() { super('ForestRun'); }

  create(): void {
    this.ents = []; this.decor = []; this.tasks = []; this.heartImgs = []; this.pips = [];
    this.taskTexts = []; this.treeLine = []; this.clouds = [];
    this.camX = 0; this.distU = 0; this.metAcc = 0; this.bendAmt = 0;
    this.hearts = MAX_HEARTS; this.ammo = MAG; this.reloadT = 0; this.nextShot = 0;
    this.score = 0; this.tasksDone = 0; this.spawnT = 1.2; this.over = false; this.noHit = 0;
    this.joyId = null; this.joyX = 0; this.recoil = 0;

    this.backdrop(0x9fd4f5);
    this.buildBackdrop();
    this.ground = this.add.graphics().setDepth(-15000);
    this.bossBar = this.add.graphics().setDepth(1100);
    this.buildDecor();
    this.buildGun();
    this.buildHud();

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('A,D') as typeof this.wasd;
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
    });

    this.addTask(); this.addTask();
    this.refreshTasks();
  }

  // ---------- projection ----------

  private proj(x: number, z: number): { sx: number; sy: number; s: number } {
    const s = FOCAL / (FOCAL + z);
    const far = Math.max(0, 1 - s);
    return { sx: W / 2 + (x - this.camX) * s + this.bendAmt * BEND * far * far, sy: HORIZON + CAMH * s, s };
  }

  // ---------- static scenery ----------

  private gradient(key: string, h: number, stops: [number, string][]): void {
    if (this.textures.exists(key)) return;
    const t = this.textures.createCanvas(key, 4, h)!;
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, h);
    t.refresh();
  }

  private buildBackdrop(): void {
    this.gradient('forest-sky', 256, [[0, '#4a9be0'], [0.65, '#a9dcf7'], [1, '#e8f7e4']]);
    this.gradient('forest-ground', 256, [[0, '#8ed17a'], [0.4, '#4f9f45'], [1, '#2a6e30']]);
    this.add.image(0, 0, 'forest-sky').setOrigin(0).setDisplaySize(W, HORIZON + 40).setDepth(-20000);
    this.add.image(0, HORIZON, 'forest-ground').setOrigin(0).setDisplaySize(W, H - HORIZON).setDepth(-16000);
    for (let i = 0; i < 3; i++) {
      const c = this.add.image(300 + i * 700, 150 + (i % 2) * 120, 'cloud').setDepth(-19500).setAlpha(0.9).setScale(0.9 + i * 0.15);
      this.clouds.push(c);
    }
    [[250, 0.9], [980, 1.1], [1750, 0.95]].forEach(([x, k]) => {
      this.add.image(x, HORIZON + 12, 'hill').setOrigin(0.5, 1).setScale(k).setTint(0x4d9e6b).setDepth(-19000);
    });
    for (let i = 0; i < 20; i++) {
      const x = 40 + i * 104 + Phaser.Math.Between(-30, 30);
      const img = this.add.image(x, HORIZON + 50, 'gozd-bor').setOrigin(0.5, 1).setScale(Phaser.Math.FloatBetween(0.2, 0.34))
        .setTint(0x2f7a52).setDepth(-18000);
      this.treeLine.push({ img, x });
    }
  }

  private pickDecor(): { tex: string; w: number } {
    const total = DECOR.reduce((a, d) => a + d.weight, 0);
    let r = Math.random() * total;
    for (const d of DECOR) { r -= d.weight; if (r <= 0) return d; }
    return DECOR[0];
  }

  private placeDecor(d: Decor, z: number): void {
    const def = this.pickDecor();
    d.img.setTexture(def.tex);
    d.w = def.w * Phaser.Math.FloatBetween(0.85, 1.25);
    d.img.setOrigin(0.5, 0.97);
    d.z = z;
    const side = Math.random() < 0.5 ? -1 : 1;
    d.x = side * Phaser.Math.Between(PATH_HW + 140, PATH_HW + 1700);
  }

  private buildDecor(): void {
    const n = 46;
    for (let i = 0; i < n; i++) {
      const d: Decor = { img: this.add.image(0, 0, 'tree'), x: 0, z: 0, w: 400 };
      this.placeDecor(d, -400 + (i * (ZFAR + 400)) / n + Phaser.Math.Between(0, 60));
      this.decor.push(d);
    }
  }

  private buildGun(): void {
    this.gunBaseY = H + 30;
    this.gun = this.add.image(W / 2, this.gunBaseY, 'gozd-puska').setOrigin(0.5, 1).setDepth(900);
    this.gun.setScale(640 / this.gun.height);
  }

  // ---------- HUD ----------

  private label(x: number, y: number, s: string, size = 46): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: '#ffffff',
      stroke: '#2c4a33', strokeThickness: 8,
    }).setScrollFactor(0).setDepth(1000);
  }

  private buildHud(): void {
    for (let i = 0; i < MAX_HEARTS; i++) {
      this.heartImgs.push(this.add.image(80 + i * 92, 80, 'gozd-srce').setScale(0.8).setDepth(1000));
    }
    this.hud = this.label(W / 2, 40, '', 64).setOrigin(0.5, 0);
    this.add.rectangle(24, 170, 840, 200, 0x1d3b2a, 0.5).setOrigin(0).setDepth(999).setStrokeStyle(6, 0xffffff, 0.5);
    for (let i = 0; i < 2; i++) this.taskTexts.push(this.label(48, 188 + i * 84, '', 50));

    for (let i = 0; i < MAG; i++) {
      this.pips.push(this.add.circle(W - 90 - i * 60, H - 70, 20, 0xffe27a).setStrokeStyle(6, 0x5a3a22).setDepth(1000));
    }

    this.add.circle(JOY.x, JOY.y, JOY.r + 20, 0xffffff, 0.18).setStrokeStyle(8, 0xffffff, 0.45).setDepth(1000);
    this.label(JOY.x, JOY.y, '◀   ▶', 70).setOrigin(0.5).setAlpha(0.6);
    this.joyKnob = this.add.circle(JOY.x, JOY.y, 64, 0xffffff, 0.55).setDepth(1001);

    const hint = this.label(W / 2, 420, '👆 Tapni sovražnika za strel\n◀ ▶ spodaj levo: premikaj se', 56).setOrigin(0.5).setAlign('center');
    this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 800 });
  }

  private refreshHud(): void {
    this.heartImgs.forEach((h, i) => h.setAlpha(i < this.hearts ? 1 : 0.2));
    this.hud.setText(`${Math.floor(this.distU / 100)} m   ⭐ ${this.score}`);
    const filled = this.reloadT > 0 ? Math.floor((1 - this.reloadT / RELOAD) * MAG) : this.ammo;
    this.pips.forEach((p, i) => p.setFillStyle(i < filled ? 0xffe27a : 0x555555, i < filled ? 1 : 0.5));
  }

  private refreshTasks(): void {
    this.taskTexts.forEach((t, i) => t.setText(this.tasks[i] ? taskText(this.tasks[i]) : ''));
  }

  // ---------- quests ----------

  private addTask(): void {
    this.tasks.push(makeTask(this.tasksDone, this.tasks.map((t) => t.metric)));
    this.refreshTasks();
  }

  private onMetric(metric: Metric, n = 1): void {
    for (const t of [...this.tasks]) {
      if (t.metric !== metric) continue;
      t.have += n;
      if (t.have >= t.goal) this.completeTask(t);
    }
    this.refreshTasks();
  }

  private completeTask(t: Task): void {
    this.tasks = this.tasks.filter((x) => x !== t);
    this.tasksDone++;
    sfx.ding();
    let msg = 'Naloga opravljena! ⭐';
    if (t.reward === 'heart') {
      if (this.hearts < MAX_HEARTS) { this.hearts++; msg += '  +❤️'; } else { this.score += 100; msg += '  +100'; }
    } else if (t.reward === 'coins') {
      progress.coins += 10; this.score += 50; msg += '  +10 🪙';
    } else {
      this.score += 100; msg += '  +100';
    }
    this.toast(msg);
    this.time.delayedCall(700, () => { if (!this.over) this.addTask(); });
  }

  private toast(msg: string): void {
    const t = text(this, W / 2, 560, msg, 96).setColor('#fff6a8').setStroke('#5a3a22', 14).setDepth(1500).setScrollFactor(0);
    this.tweens.add({ targets: t, y: 440, alpha: 0, delay: 900, duration: 700, onComplete: () => t.destroy() });
  }

  // ---------- input ----------

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.over) return;
    if (p.x < 640 && p.y > 960 && this.joyId === null) {
      this.joyId = p.id;
      this.onMove(p);
      return;
    }
    this.shoot(p.x, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyId) return;
    this.joyX = clamp((p.x - JOY.x) / JOY.r, -1, 1);
    this.joyKnob.x = JOY.x + this.joyX * JOY.r;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyId) return;
    this.joyId = null; this.joyX = 0;
    this.joyKnob.x = JOY.x;
  }

  // ---------- shooting ----------

  private shoot(px: number, py: number): void {
    if (this.time.now < this.nextShot) return;
    if (this.reloadT > 0 || this.ammo <= 0) { sfx.click(); return; }
    this.nextShot = this.time.now + 150;
    this.ammo--;
    sfx.bang();
    this.recoil = 1;

    const rot = clamp(Math.atan2(px - W / 2, H - py) * 0.6, -0.5, 0.5);
    this.gun.setRotation(rot);
    const gl = 600;
    const mx = W / 2 + Math.sin(rot) * gl, my = this.gunBaseY - Math.cos(rot) * gl;
    const flash = this.add.image(mx, my, 'gozd-blisk').setDepth(950).setScale(0.7).setRotation(Math.random() * 6);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.1, duration: 120, onComplete: () => flash.destroy() });
    const tracer = this.add.graphics().setDepth(949);
    tracer.lineStyle(6, 0xfff3a0, 0.9).lineBetween(mx, my, px, py);
    this.tweens.add({ targets: tracer, alpha: 0, duration: 120, onComplete: () => tracer.destroy() });
    const ch = this.add.image(px, py, 'crosshair').setScale(0.5).setDepth(1200);
    this.tweens.add({ targets: ch, alpha: 0, scale: 0.8, duration: 300, onComplete: () => ch.destroy() });

    // nearest enemy under the finger wins
    let best: Ent | null = null;
    for (const e of this.ents) {
      const def = DEFS[e.kind];
      const p = this.proj(e.x, e.z);
      const w = def.w * p.s;
      const cy = p.sy - e.lift * p.s - e.img.displayHeight * 0.5;
      const r = Math.max(w * def.hitK, 70);
      if ((p.sx - px) ** 2 + (cy - py) ** 2 < r * r && (!best || e.z < best.z)) best = e;
    }
    if (best) this.damage(best);

    if (this.ammo <= 0) { this.reloadT = RELOAD; sfx.reload(); }
  }

  private damage(e: Ent): void {
    e.hp--;
    e.flash = 0.1;
    if (e.hp > 0) { sfx.pop(); return; }
    this.kill(e, true);
  }

  private pos(e: Ent): { x: number; y: number; s: number } {
    const p = this.proj(e.x, e.z);
    return { x: p.sx, y: p.sy - e.lift * p.s - e.img.displayHeight * 0.5, s: p.s };
  }

  private puff(x: number, y: number, color: number, n = 9, size = 1): void {
    for (let i = 0; i < n; i++) {
      const c = this.add.circle(x, y, Phaser.Math.Between(14, 30) * size, i % 3 === 0 ? 0xffffff : color).setDepth(600);
      this.tweens.add({
        targets: c, x: x + Phaser.Math.Between(-150, 150) * size, y: y + Phaser.Math.Between(-150, 70) * size,
        alpha: 0, scale: 0.3, duration: Phaser.Math.Between(350, 600), ease: 'Cubic.out', onComplete: () => c.destroy(),
      });
    }
  }

  private float(x: number, y: number, msg: string): void {
    const t = text(this, x, y, msg, 60).setColor('#fff6a8').setStroke('#5a3a22', 10).setDepth(1300);
    this.tweens.add({ targets: t, y: y - 130, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  private remove(e: Ent): void {
    this.ents = this.ents.filter((x) => x !== e);
    e.img.destroy(); e.shadow.destroy();
  }

  /** Destroyed by the player's shot (or collected). */
  private kill(e: Ent, shot: boolean): void {
    const def = DEFS[e.kind];
    const q = this.pos(e);
    this.remove(e);
    switch (e.kind) {
      case 'coin':
        sfx.coin(); progress.coins++; this.score += def.pts;
        this.puff(q.x, q.y, def.puff, 5, 0.6); this.float(q.x, q.y, '+1 🪙');
        this.onMetric('coin');
        return;
      case 'honey':
        sfx.chest();
        if (this.hearts < MAX_HEARTS) { this.hearts++; this.float(q.x, q.y, '+❤️'); } else { this.score += 25; this.float(q.x, q.y, '+25'); }
        this.puff(q.x, q.y, def.puff, 7, 0.8);
        this.onMetric('honey');
        return;
      case 'bunny':
        if (shot) { sfx.hurt(); this.score = Math.max(0, this.score - 50); this.puff(q.x, q.y, def.puff); this.float(q.x, q.y, 'Ne zajčka! −50'); }
        return;
      case 'chest':
        sfx.chest(); this.score += def.pts;
        this.puff(q.x, q.y, def.puff, 12, 1.2); this.float(q.x, q.y, '+50 ⭐');
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 70, () => { sfx.coin(); progress.coins++; });
        }
        this.onMetric('chest');
        return;
      default:
        break;
    }
    // enemies
    sfx.poof();
    this.score += def.pts;
    this.puff(q.x, q.y, def.puff, e.kind === 'trol' ? 26 : 10, e.kind === 'trol' ? 2.2 : e.kind === 'medved' ? 1.4 : 1);
    this.float(q.x, q.y, `+${def.pts}`);
    if (e.kind === 'kamen') return;
    if (e.kind === 'trol') { this.cameras.main.shake(300, 0.012); progress.coins += 10; }
    this.onMetric(e.kind as Metric);
  }

  private hurt(n: number): void {
    this.hearts = Math.max(0, this.hearts - n);
    this.noHit = 0;
    for (const t of this.tasks) if (t.metric === 'nohit') t.have = 0;
    this.refreshTasks();
    sfx.hurt();
    this.cameras.main.shake(220, 0.014);
    this.cameras.main.flash(200, 255, 40, 40);
    if (this.hearts <= 0) this.gameOver();
  }

  // ---------- spawning ----------

  private spawn(kind: Kind, z = ZFAR, x?: number): Ent {
    const def = DEFS[kind];
    const px = x ?? Phaser.Math.Between(-PATH_HW + 60, PATH_HW - 60);
    const img = this.add.image(0, 0, def.tex[0]).setOrigin(0.5, 0.96);
    const shadow = this.add.ellipse(0, 0, 100, 30, 0x000000, 0.25);
    const e: Ent = {
      kind, img, shadow, x: px, z, lift: def.lift, baseX: px, hp: def.hp, vx: 0, t: Math.random() * 6,
      bs: def.w / img.width, throwT: 1.5, flash: 0, flashed: false, counted: false,
    };
    if (kind === 'pajek') e.lift = 650;
    if (kind === 'bunny') { const side = Math.random() < 0.5 ? -1 : 1; e.x = e.baseX = side * (PATH_HW + 230); e.vx = -side * Phaser.Math.Between(110, 190); }
    this.ents.push(e);
    return e;
  }

  private director(dt: number): void {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const km = this.distU / 100;
    this.spawnT = Math.max(0.65, 1.5 - this.tasksDone * 0.04 - km * 0.0008) * Phaser.Math.FloatBetween(0.8, 1.2);

    // a boss quest summons the troll once
    if (this.tasks.some((t) => t.metric === 'trol') && !this.ents.some((e) => e.kind === 'trol')) {
      sfx.growl(); this.spawn('trol', ZFAR, 0);
      return;
    }
    const foes = this.ents.filter((e) => DEFS[e.kind].foe && e.kind !== 'kamen').length;
    const want = (k: Kind): number => (this.tasks.some((t) => t.metric === k) ? 3 : 1);
    const base: [Kind, number][] = [
      ['gobec', 5], ['netopir', 3], ['pajek', 2.5], ['medved', 1.5],
      ['coin', 3], ['chest', 1], ['bunny', 1], ['honey', this.hearts < MAX_HEARTS ? 1 : 0.3],
    ];
    const bag = base.filter(([k]) => {
      const u = UNLOCK[k];
      if (u !== undefined && this.tasksDone < u) return false;
      if (DEFS[k].foe && foes >= 8) return false;
      if (k === 'medved' && this.ents.filter((e) => e.kind === 'medved').length >= 2) return false;
      return true;
    }).map(([k, w]) => [k, w * want(k)] as [Kind, number]);
    const total = bag.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    let kind: Kind = 'gobec';
    for (const [k, w] of bag) { r -= w; if (r <= 0) { kind = k; break; } }

    if (kind === 'coin') {
      const x0 = Phaser.Math.Between(-300, 300);
      const dx = Phaser.Math.Between(-60, 60);
      for (let i = 0; i < 4; i++) this.spawn('coin', ZFAR + i * 230, clamp(x0 + dx * i, -PATH_HW + 60, PATH_HW - 60));
      return;
    }
    if (kind === 'netopir' && Math.random() < 0.5) { this.spawn('netopir'); this.spawn('netopir', ZFAR + 350); return; }
    if (kind === 'medved') sfx.growl();
    this.spawn(kind);
  }

  // ---------- per-frame ----------

  private runSpeed(): number { return 250 + Math.min(250, (this.distU / 100) * 0.8); }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    if (this.over) { this.render(); return; }

    // strafing: joystick or keys
    let ix = this.joyX;
    if (this.keys.left.isDown || this.wasd.A.isDown) ix -= 1;
    if (this.keys.right.isDown || this.wasd.D.isDown) ix += 1;
    this.camX = clamp(this.camX + clamp(ix, -1, 1) * STRAFE * dt, -MAX_CAM, MAX_CAM);

    const run = this.runSpeed();
    this.distU += run * dt;
    this.bendAmt = Math.sin(this.distU * 0.0006) * 0.9 + Math.sin(this.distU * 0.00023) * 0.5;

    // metres run: quests
    this.metAcc += (run * dt) / 100;
    if (this.metAcc >= 1) {
      const m = Math.floor(this.metAcc);
      this.metAcc -= m;
      this.noHit += m;
      this.onMetric('meters', m);
      for (const t of [...this.tasks]) {
        if (t.metric === 'nohit') { t.have = this.noHit; if (t.have >= t.goal) this.completeTask(t); }
      }
      this.refreshTasks();
    }

    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.reloadT = 0; this.ammo = MAG; }
    }

    this.director(dt);
    for (const e of [...this.ents]) this.updateEnt(e, dt, run);
    if (this.over) return;

    for (const d of this.decor) {
      d.z -= run * dt;
      if (d.z < -420) this.placeDecor(d, ZFAR + Phaser.Math.Between(0, 400));
    }
    this.render();
    this.refreshHud();
  }

  private updateEnt(e: Ent, dt: number, run: number): void {
    const def = DEFS[e.kind];
    e.t += dt;
    const spd = 1 + Math.min(0.6, this.tasksDone * 0.03);
    e.z -= (run + def.v * spd) * dt;
    const homing = (rate: number): void => { if (e.z > 700) e.baseX += clamp(this.camX - e.baseX, -rate * dt, rate * dt); };

    switch (e.kind) {
      case 'gobec': homing(45); e.x = e.baseX + Math.sin(e.t * 2) * 30; break;
      case 'netopir': homing(70); e.x = e.baseX + Math.sin(e.t * 3) * 260; e.lift = def.lift + Math.sin(e.t * 5) * 50; break;
      case 'pajek':
        homing(50); e.x = e.baseX + Math.sin(e.t * 2.2) * 200;
        e.lift = Math.max(0, e.lift - 420 * dt);
        break;
      case 'medved': homing(95); e.x = e.baseX + Math.sin(e.t * 1.5) * 40; break;
      case 'trol':
        homing(35); e.x = e.baseX;
        e.throwT -= dt;
        if (e.throwT <= 0 && e.z > 900 && e.z < 3400) {
          e.throwT = 2.4; sfx.growl();
          const r = this.spawn('kamen', e.z, e.x);
          r.lift = 330;
          r.vx = (this.camX - e.x) / Math.max(0.5, e.z / (run + DEFS.kamen.v));
        }
        break;
      case 'kamen': e.x += e.vx * dt; break;
      case 'bunny': e.x += e.vx * dt; e.lift = Math.abs(Math.sin(e.t * 7)) * 70; break;
      case 'coin': e.lift = def.lift + Math.sin(e.t * 4) * 14; break;
      default: break;
    }

    const near = Math.abs(e.x - this.camX);
    if (def.foe) {
      if (e.z < 110) {
        if (near < (e.kind === 'trol' ? 460 : e.kind === 'kamen' ? 230 : 300)) {
          const q = this.pos(e);
          this.puff(q.x, q.y, def.puff, 8, 1.3);
          this.remove(e);
          this.hurt(e.kind === 'trol' ? 2 : 1);
          return;
        }
        if (e.z < -300) { this.remove(e); return; }
      }
    } else if (e.kind === 'coin' || e.kind === 'honey') {
      if (e.z < 90 && near < 250) { this.kill(e, false); return; }
      if (e.z < -300) { this.remove(e); return; }
    } else if (e.kind === 'bunny') {
      if (e.z < 100 && !e.counted) { e.counted = true; sfx.pop(); this.float(this.proj(e.x, e.z).sx, 900, '🐰 Rešen!'); this.onMetric('bunny'); }
      if (e.z < -300) { this.remove(e); return; }
    } else if (e.z < -300) { this.remove(e); }
  }

  /** Draw ground, scenery and entities for the current camera state. */
  private render(): void {
    this.drawGround();
    const dist = this.distU;
    this.treeLine.forEach((t, i) => t.img.setX(t.x - this.camX * 0.04 + this.bendAmt * 90 + Math.sin(i) * 0));
    this.clouds.forEach((c, i) => { c.x += 0.15 + i * 0.05; if (c.x > W + 300) c.x = -300; });

    const place = (img: Phaser.GameObjects.Image, x: number, z: number, lift: number, w: number): void => {
      const p = this.proj(x, z);
      const k = (w / img.width) * p.s;
      img.setPosition(p.sx, p.sy - lift * p.s).setScale(k).setDepth(-z).setVisible(z > -380)
        .setAlpha(clamp((ZFAR + 200 - z) / 1000, 0, 1));
    };
    for (const d of this.decor) place(d.img, d.x, d.z, 0, d.w);

    let boss: Ent | null = null;
    for (const e of this.ents) {
      const def = DEFS[e.kind];
      const frame = def.tex.length > 1 ? def.tex[Math.floor(e.t * 7) % def.tex.length] : def.tex[0];
      if (e.img.texture.key !== frame) e.img.setTexture(frame);
      place(e.img, e.x, e.z, e.lift, def.w);
      if (e.flash > 0) {
        e.flash -= 1 / 60;
        if (!e.flashed) { e.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); e.flashed = true; }
      } else if (e.flashed) { e.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY); e.flashed = false; }
      const p = this.proj(e.x, e.z);
      e.shadow.setPosition(p.sx, p.sy).setDisplaySize(def.w * p.s * 0.7, 40 * p.s).setDepth(-e.z - 0.1)
        .setVisible(e.z > -380 && e.kind !== 'coin').setAlpha(clamp((ZFAR + 200 - e.z) / 1000, 0, 0.25));
      if (e.kind === 'trol') boss = e;
    }

    this.bossBar.clear();
    if (boss) {
      const b = boss as Ent;
      const f = clamp(b.hp / DEFS.trol.hp, 0, 1);
      this.bossBar.fillStyle(0x000000, 0.5).fillRoundedRect(W / 2 - 360, 150, 720, 40, 14);
      this.bossBar.fillStyle(0xe63946, 1).fillRoundedRect(W / 2 - 354, 156, 708 * f, 28, 10);
    }

    // gun: bob while running, kick on recoil
    this.recoil = Math.max(0, this.recoil - 0.1);
    this.gun.setY(this.gunBaseY + Math.sin(dist * 0.012) * 8 + this.recoil * 40);
    this.gun.setRotation(this.gun.rotation * 0.9);
    this.gun.setScale((640 / this.gun.height) * (1 + this.recoil * 0.05));
  }

  private drawGround(): void {
    const g = this.ground;
    g.clear();
    const k0 = Math.floor(this.distU / STEP) - 3;
    const k1 = Math.ceil((this.distU + 9000) / STEP);
    const Zmin = -450;
    const zs: number[] = [];
    for (let k = k0; k <= k1; k++) zs.push(Math.max(Zmin, k * STEP - this.distU));
    const yAt = (z: number): number => HORIZON + CAMH * (FOCAL / (FOCAL + z));

    // lighter grass stripes
    g.fillStyle(0x9be07c, 0.2);
    for (let i = 0; i < zs.length - 1; i++) {
      if (((k0 + i) & 1) === 0 || zs[i + 1] <= zs[i]) continue;
      const yN = yAt(zs[i]), yF = yAt(zs[i + 1]);
      g.fillRect(0, yF, W, yN - yF);
    }

    const poly = (hw: number, color: number, only?: number): void => {
      g.fillStyle(color, 1);
      const from = only ?? 0, to = only !== undefined ? only + 1 : zs.length - 1;
      const pts: { x: number; y: number }[] = [];
      for (let i = from; i <= to; i++) { const p = this.proj(-hw, zs[i]); pts.push({ x: p.sx, y: p.sy }); }
      for (let i = to; i >= from; i--) { const p = this.proj(hw, zs[i]); pts.push({ x: p.sx, y: p.sy }); }
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.closePath();
      g.fillPath();
    };
    poly(PATH_HW + 50, 0x8a5a2b);
    poly(PATH_HW, 0xc79a5b);
    g.fillStyle(0xb98a4d, 1);
    for (let i = 0; i < zs.length - 1; i++) {
      if (((k0 + i) & 1) === 0 || zs[i + 1] <= zs[i]) continue;
      poly(PATH_HW, 0xb98a4d, i);
    }
  }

  // ---------- end of run ----------

  private gameOver(): void {
    this.over = true;
    this.joyX = 0;
    this.refreshHud();
    sfx.poof();
    const meters = Math.floor(this.distU / 100);
    let best = 0;
    try { best = Number(localStorage.getItem('gozd-best')) || 0; } catch { /* storage is optional */ }
    const record = meters > best;
    if (record) { best = meters; try { localStorage.setItem('gozd-best', String(best)); } catch { /* optional */ } }
    const stars = Math.min(3, Math.ceil(this.tasksDone / 2));

    this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setDepth(1900);
    text(this, W / 2, 330, 'Konec poti!', 150).setColor('#ffffff').setStroke('#5a3a22', 16).setDepth(2000);
    for (let i = 0; i < 3; i++) {
      this.add.image(W / 2 + (i - 1) * 190, 560, 'star').setScale(1.1).setAlpha(i < stars ? 1 : 0.2).setDepth(2000);
    }
    text(this, W / 2, 760, `Razdalja: ${meters} m`, 90).setColor('#ffffff').setStroke('#2c4a33', 12).setDepth(2000);
    text(this, W / 2, 880, `Naloge: ${this.tasksDone}    ⭐ ${this.score}`, 80).setColor('#ffffff').setStroke('#2c4a33', 12).setDepth(2000);
    text(this, W / 2, 1000, record ? '🏆 Nov rekord!' : `Rekord: ${best} m`, 70).setColor('#fff6a8').setStroke('#5a3a22', 12).setDepth(2000);
    tapButton(this, W / 2 - 340, 1220, 'Še enkrat!', () => this.scene.restart()).setDepth(2001);
    tapButton(this, W / 2 + 340, 1220, 'Končaj', () => this.finish(stars)).setDepth(2001);
  }
}
