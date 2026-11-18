import Phaser from 'phaser';
import { W, H } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { text, tapButton } from '../../core/touch';
import { sfx } from '../../core/sfx';
import { forestSave, saveForest } from '../../core/forestSave';
import { DEFS, UNLOCK, makeTask, demonTask, taskText, type Kind, type Metric, type Task } from './forestData';
import { BIOMES, BOSS_AT_M, biomeAt, type Biome, type PathColors } from './biomes';
import { weaponById, type Weapon } from './weapons';
import { t, type Key } from '../../i18n';

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
const STRAFE = 650;
const JOY = { x: 300, y: 1290, r: 140 };

// ---- demon boss ---------------------------------------------------------------
const BOSS_Z = 2000;                          // the demon hovers at this distance
const LANES = [-330, 0, 330];                 // fireball lanes (the player can strafe to +-MAX_CAM)

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
  throwT: number;         // throw / attack cooldown
  flash: number;
  flashed: boolean;
  counted: boolean;       // bunny already saved
  atk: number;            // demon: attacks made so far
  windup: boolean;        // demon: about to attack
}

interface Decor { img: Phaser.GameObjects.Image; x: number; z: number; w: number }

const clamp = Phaser.Math.Clamp;

const mixColor = (a: number, b: number, k: number): number => {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export class ForestRun extends StageScene {
  private ents: Ent[] = [];
  private decor: Decor[] = [];
  private tasks: Task[] = [];

  private biome: Biome = BIOMES[0];
  private biomeIdx = -1;
  private pathNow: PathColors = { ...BIOMES[0].path };
  private weapon: Weapon = weaponById('pistol');
  private startM = 0;

  private camX = 0;
  private distU = 0;
  private metAcc = 0;
  private bendAmt = 0;
  private hearts = MAX_HEARTS;
  private ammo = 0;
  private reloadT = 0;
  private nextShot = 0;
  private score = 0;
  private tasksDone = 0;
  private spawnT = 1;
  private over = false;
  private noHit = 0;
  private bossSpawned = false;

  private joyId: number | null = null;
  private joyX = 0;
  private holdId: number | null = null;     // pointer that is shooting (auto weapons keep firing)
  private holdX = 0;
  private holdY = 0;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'A' | 'D', Phaser.Input.Keyboard.Key>;

  private ground!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private ammoBar!: Phaser.GameObjects.Graphics;
  private ammoText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private skyImg?: Phaser.GameObjects.Image;
  private groundImg?: Phaser.GameObjects.Image;
  private ceilingImg!: Phaser.GameObjects.Image;
  private ambientEvt?: Phaser.Time.TimerEvent;
  private gun!: Phaser.GameObjects.Image;
  private gunBaseY = 0;
  private recoil = 0;
  private heartImgs: Phaser.GameObjects.Image[] = [];
  private joyKnob!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;
  private taskTexts: Phaser.GameObjects.Text[] = [];
  private treeLine: { img: Phaser.GameObjects.Image; x: number; k: number }[] = [];
  private hills: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];

  constructor() { super('ForestRun'); }

  init(): void {
    // Dev helper: `?m=1000` starts the run that many metres in (to look at the later worlds).
    const m = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('m')) : 0;
    this.startM = Number.isFinite(m) && m > 0 ? m : 0;
  }

  create(): void {
    this.ents = []; this.decor = []; this.tasks = []; this.heartImgs = [];
    this.taskTexts = []; this.treeLine = []; this.clouds = []; this.hills = [];
    this.weapon = weaponById(forestSave.weapon);
    this.camX = 0; this.distU = this.startM * 100; this.metAcc = 0; this.bendAmt = 0;
    this.hearts = MAX_HEARTS; this.ammo = this.weapon.mag; this.reloadT = 0; this.nextShot = 0;
    this.score = 0; this.tasksDone = 0; this.spawnT = 1.2; this.over = false; this.noHit = 0; this.bossSpawned = false;
    this.joyId = null; this.joyX = 0; this.recoil = 0; this.holdId = null;
    this.skyImg = undefined; this.groundImg = undefined; this.ambientEvt = undefined;
    this.biomeIdx = -1; this.biome = BIOMES[biomeAt(this.startM)]; this.pathNow = { ...this.biome.path };

    this.backdrop(this.biome.bg);
    this.buildBackdrop();
    this.ground = this.add.graphics().setDepth(-15000);
    this.bossBar = this.add.graphics().setDepth(1100);
    this.buildDecor();
    this.setBiome(biomeAt(this.startM), true);
    this.buildGun();
    this.buildHud();

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('A,D') as typeof this.wasd;
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.time.addEvent({ delay: 5000, loop: true, callback: saveForest });
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
      saveForest();
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

  /** Things that stay in every world; `setBiome` gives them their colours and textures. */
  private buildBackdrop(): void {
    this.ceilingImg = this.add.image(0, 0, 'cave-stalactites').setOrigin(0).setDisplaySize(W, 290).setDepth(-19200).setAlpha(0);
    for (let i = 0; i < 3; i++) {
      const c = this.add.image(300 + i * 700, 150 + (i % 2) * 120, 'cloud').setDepth(-19500).setAlpha(0.9).setScale(0.9 + i * 0.15);
      this.clouds.push(c);
    }
    [[250, 0.9], [980, 1.1], [1750, 0.95]].forEach(([x, k]) => {
      this.hills.push(this.add.image(x, HORIZON + 12, 'hill').setOrigin(0.5, 1).setScale(k).setDepth(-19000));
    });
    for (let i = 0; i < 20; i++) {
      const x = 40 + i * 104 + Phaser.Math.Between(-30, 30);
      const img = this.add.image(x, HORIZON + 50, 'forest-pine').setOrigin(0.5, 1).setDepth(-18000);
      this.treeLine.push({ img, x, k: Math.random() });
    }
  }

  /** Switch the whole look to world `i`: crossfade sky and ground, recolour the path, change scenery and weather. */
  private setBiome(i: number, instant: boolean): void {
    const b = BIOMES[i];
    this.biome = b; this.biomeIdx = i;
    const fade = instant ? 0 : 1500;

    this.gradient(`${b.id}-sky`, 256, b.sky);
    this.gradient(`${b.id}-ground`, 256, b.ground);
    const swap = (old: Phaser.GameObjects.Image | undefined, key: string, y: number, h: number, depth: number): Phaser.GameObjects.Image => {
      const img = this.add.image(0, y, key).setOrigin(0).setDisplaySize(W, h).setDepth(depth);
      if (fade > 0 && old) {
        img.setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, duration: fade, onComplete: () => old.destroy() });
      } else old?.destroy();
      return img;
    };
    this.skyImg = swap(this.skyImg, `${b.id}-sky`, 0, HORIZON + 40, -20000);
    this.groundImg = swap(this.groundImg, `${b.id}-ground`, HORIZON, H - HORIZON, -16000);
    this.cameras.main.setBackgroundColor(b.bg);

    this.tweens.add({ targets: this.ceilingImg, alpha: b.ceiling ? 1 : 0, duration: fade || 1 });
    this.clouds.forEach((c) => c.setVisible(b.clouds));
    this.hills.forEach((h) => { h.setVisible(b.hills !== null); if (b.hills !== null) h.setTint(b.hills); });
    this.treeLine.forEach((tl) => {
      tl.img.setTexture(b.horizon.tex).setTint(b.horizon.tint);
      tl.img.setScale(Phaser.Math.Linear(b.horizon.h[0], b.horizon.h[1], tl.k) / tl.img.height);
    });

    if (fade > 0) {
      const from = { ...this.pathNow };
      this.tweens.addCounter({
        from: 0, to: 1, duration: fade,
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 1;
          (Object.keys(from) as (keyof PathColors)[]).forEach((key) => { this.pathNow[key] = mixColor(from[key], b.path[key], k); });
        },
      });
    } else this.pathNow = { ...b.path };

    this.ambientEvt?.remove();
    this.ambientEvt = undefined;
    if (b.ambient !== 'none') {
      const kind = b.ambient;
      this.ambientEvt = this.time.addEvent({ delay: 90, loop: true, callback: () => this.ambientBit(kind) });
    }

    if (!instant) {
      this.toast(t(`biome.${b.id}` as Key));
      // quests about monsters that live in another world could never be finished
      const kept = this.tasks.filter((tk) => tk.metric === 'troll' || b.quests.includes(tk.metric));
      this.tasks = this.tasks.map((tk) => (kept.includes(tk) ? tk : makeTask(this.tasksDone, kept.map((x) => x.metric), b)));
      this.refreshTasks();
    }
  }

  /** Snowflake or ember drifting across the screen. */
  private ambientBit(kind: 'snow' | 'embers'): void {
    const x = Phaser.Math.Between(0, W);
    const snow = kind === 'snow';
    const r = snow ? Phaser.Math.Between(5, 11) : Phaser.Math.Between(4, 9);
    const color = snow ? 0xffffff : [0xff9a3a, 0xffd23f, 0xff5a1e][Phaser.Math.Between(0, 2)];
    const c = this.add.circle(x, snow ? -20 : H + 20, r, color, snow ? 0.85 : 0.9).setDepth(600);
    this.tweens.add({
      targets: c, y: snow ? H + 20 : -20, x: x + Phaser.Math.Between(-160, 160),
      duration: Phaser.Math.Between(4000, 6500), onComplete: () => c.destroy(),
    });
  }

  private pickDecor(): { tex: string; w: number } {
    const list = this.biome.decor;
    const total = list.reduce((a, d) => a + d.weight, 0);
    let r = Math.random() * total;
    for (const d of list) { r -= d.weight; if (r <= 0) return d; }
    return list[0];
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
    this.gun = this.add.image(W / 2, this.gunBaseY, this.weapon.tex).setOrigin(0.5, 1).setDepth(900);
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
      this.heartImgs.push(this.add.image(80 + i * 92, 80, 'forest-heart').setScale(0.8).setDepth(1000));
    }
    this.hud = this.label(W / 2, 40, '', 64).setOrigin(0.5, 0);
    this.coinText = this.label(W - 190, 40, '', 64).setOrigin(1, 0);
    this.add.rectangle(24, 170, 840, 200, 0x1d3b2a, 0.5).setOrigin(0).setDepth(999).setStrokeStyle(6, 0xffffff, 0.5);
    for (let i = 0; i < 2; i++) this.taskTexts.push(this.label(48, 188 + i * 84, '', 50));

    this.ammoBar = this.add.graphics().setDepth(1000);
    this.ammoText = this.label(W - 310, H - 150, '', 54).setOrigin(0.5);

    this.add.circle(JOY.x, JOY.y, JOY.r + 20, 0xffffff, 0.18).setStrokeStyle(8, 0xffffff, 0.45).setDepth(1000);
    this.label(JOY.x, JOY.y, '◀   ▶', 70).setOrigin(0.5).setAlpha(0.6);
    this.joyKnob = this.add.circle(JOY.x, JOY.y, 64, 0xffffff, 0.55).setDepth(1001);

    const hint = this.label(W / 2, 420, t('forest.hint'), 56).setOrigin(0.5).setAlign('center');
    this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 800 });
  }

  private refreshHud(): void {
    this.heartImgs.forEach((h, i) => h.setAlpha(i < this.hearts ? 1 : 0.2));
    this.hud.setText(`${Math.floor(this.distU / 100)} m   ⭐ ${this.score}`);
    this.coinText.setText(`🪙 ${forestSave.coins}`);

    const w = this.weapon;
    const reloading = this.reloadT > 0;
    const f = reloading ? 1 - this.reloadT / w.reload : this.ammo / w.mag;
    const g = this.ammoBar;
    g.clear();
    g.fillStyle(0x000000, 0.45).fillRoundedRect(W - 560, H - 110, 500, 44, 16);
    g.fillStyle(reloading ? 0x9aa5b1 : 0xffe27a, 1).fillRoundedRect(W - 554, H - 104, 488 * clamp(f, 0, 1), 32, 12);
    if (w.mag <= 12) {
      g.lineStyle(4, 0x5a3a22, 0.8);
      for (let i = 1; i < w.mag; i++) g.lineBetween(W - 554 + (488 * i) / w.mag, H - 104, W - 554 + (488 * i) / w.mag, H - 72);
    }
    this.ammoText.setText(reloading ? '⟳' : `${this.ammo}/${w.mag}`);
  }

  private refreshTasks(): void {
    this.taskTexts.forEach((t, i) => t.setText(this.tasks[i] ? taskText(this.tasks[i]) : ''));
  }

  // ---------- quests ----------

  private addTask(): void {
    this.tasks.push(makeTask(this.tasksDone, this.tasks.map((t) => t.metric), this.biome));
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

  private earn(n: number): void { forestSave.coins += n; }

  private completeTask(task: Task): void {
    this.tasks = this.tasks.filter((x) => x !== task);
    this.tasksDone++;
    sfx.ding();
    let msg = t('forest.questDone');
    if (task.reward === 'heart') {
      if (this.hearts < MAX_HEARTS) { this.hearts++; msg += '  +❤️'; } else { this.score += 100; msg += '  +100'; }
    } else if (task.reward === 'coins') {
      this.earn(10); this.score += 50; msg += '  +10 🪙';
    } else {
      this.score += 100; msg += '  +100';
    }
    this.toast(msg);
    this.time.delayedCall(700, () => { if (!this.over && !this.bossSpawned) this.addTask(); });
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
    this.holdId = p.id; this.holdX = p.x; this.holdY = p.y;
    this.shoot(p.x, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id === this.holdId) { this.holdX = p.x; this.holdY = p.y; }
    if (p.id !== this.joyId) return;
    this.joyX = clamp((p.x - JOY.x) / JOY.r, -1, 1);
    this.joyKnob.x = JOY.x + this.joyX * JOY.r;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.holdId) this.holdId = null;
    if (p.id !== this.joyId) return;
    this.joyId = null; this.joyX = 0;
    this.joyKnob.x = JOY.x;
  }

  // ---------- shooting ----------

  private shoot(px: number, py: number): void {
    const w = this.weapon;
    if (this.time.now < this.nextShot) return;
    if (this.reloadT > 0 || this.ammo <= 0) { if (!w.auto) sfx.click(); return; }
    this.nextShot = this.time.now + w.cooldown;
    this.ammo--;
    sfx[w.sound]();
    this.recoil = 1;

    const rot = clamp(Math.atan2(px - W / 2, H - py) * 0.6, -0.5, 0.5);
    this.gun.setRotation(rot);
    const gl = 600;
    const mx = W / 2 + Math.sin(rot) * gl, my = this.gunBaseY - Math.cos(rot) * gl;
    const flash = this.add.image(mx, my, 'forest-flash').setDepth(950).setScale(0.7).setRotation(Math.random() * 6);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.1, duration: 120, onComplete: () => flash.destroy() });
    const tracer = this.add.graphics().setDepth(949);
    tracer.lineStyle(w.id === 'laser' ? 14 : 6, w.tracer, 0.9);
    for (let i = 0; i < w.pellets; i++) {
      const spread = w.pellets > 1 ? w.radius * 0.8 : 0;
      tracer.lineBetween(mx, my, px + Phaser.Math.Between(-spread, spread), py + Phaser.Math.Between(-spread, spread));
    }
    this.tweens.add({ targets: tracer, alpha: 0, duration: 120, onComplete: () => tracer.destroy() });
    const ch = this.add.image(px, py, 'crosshair').setScale(0.5).setDepth(1200);
    this.tweens.add({ targets: ch, alpha: 0, scale: 0.8, duration: 300, onComplete: () => ch.destroy() });
    if (w.id === 'rocket') this.explosion(px, py, w.radius);

    // who is hit? solid things (fireballs) can only be dodged
    const hits: Ent[] = [];
    for (const e of this.ents) {
      const def = DEFS[e.kind];
      if (def.solid) continue;
      const p = this.proj(e.x, e.z);
      const cy = p.sy - e.lift * p.s - e.img.displayHeight * 0.5;
      const r = Math.max(p.s * def.w * def.hitK, 70);
      const d2 = (p.sx - px) ** 2 + (cy - py) ** 2;
      const reach = w.mode === 'splash' && e.kind !== 'bunny' ? r + w.radius : r;
      if (d2 < reach * reach) hits.push(e);
    }
    if (w.mode === 'nearest' && hits.length > 1) {
      const nearest = hits.reduce((a, b) => (b.z < a.z ? b : a));
      hits.length = 0; hits.push(nearest);
    }
    for (const e of hits) this.damage(e, w.dmg);

    if (this.ammo <= 0) { this.reloadT = w.reload; sfx.reload(); }
  }

  private explosion(x: number, y: number, r: number): void {
    const c = this.add.circle(x, y, r, 0xff9a3a, 0.55).setDepth(940).setStrokeStyle(10, 0xffe27a, 0.9);
    this.tweens.add({ targets: c, scale: 1.25, alpha: 0, duration: 320, ease: 'Cubic.out', onComplete: () => c.destroy() });
    this.puff(x, y, 0xff8a1f, 14, 1.8);
    this.cameras.main.shake(180, 0.006);
  }

  private damage(e: Ent, dmg: number): void {
    e.hp -= dmg;
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
        sfx.coin(); this.earn(1); this.score += def.pts;
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
        if (shot) { sfx.hurt(); this.score = Math.max(0, this.score - 50); this.puff(q.x, q.y, def.puff); this.float(q.x, q.y, t('forest.noBunny')); }
        return;
      case 'chest':
        sfx.chest(); this.score += def.pts;
        this.puff(q.x, q.y, def.puff, 12, 1.2); this.float(q.x, q.y, '+50 ⭐');
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 70, () => { sfx.coin(); this.earn(1); });
        }
        this.onMetric('chest');
        return;
      case 'demon':
        this.score += def.pts;
        this.puff(q.x, q.y, def.puff, 40, 3);
        this.cameras.main.shake(700, 0.02);
        sfx.roar();
        this.earn(50);
        this.victory();
        return;
      default:
        break;
    }
    // enemies
    sfx.poof();
    this.score += def.pts;
    this.puff(q.x, q.y, def.puff, def.boss ? 26 : 10, def.boss ? 2.2 : e.kind === 'bear' || e.kind === 'golem' || e.kind === 'polar' ? 1.4 : 1);
    this.float(q.x, q.y, `+${def.pts}`);
    if (e.kind === 'rock' || e.kind === 'fireball') return;
    if (e.kind === 'troll') { this.cameras.main.shake(300, 0.012); this.earn(10); }
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
    if (this.hearts <= 0) this.endRun(false);
  }

  // ---------- spawning ----------

  private spawn(kind: Kind, z = ZFAR, x?: number): Ent {
    const def = DEFS[kind];
    const px = x ?? Phaser.Math.Between(-PATH_HW + 60, PATH_HW - 60);
    const img = this.add.image(0, 0, def.tex[0]).setOrigin(0.5, 0.96);
    if (def.tint !== undefined) img.setTint(def.tint);
    const shadow = this.add.ellipse(0, 0, 100, 30, def.solid ? 0xff3b1f : 0x000000, 0.25);
    const e: Ent = {
      kind, img, shadow, x: px, z, lift: def.lift, baseX: px, hp: def.hp, vx: 0, t: Math.random() * 6,
      bs: def.w / img.width, throwT: 1.5, flash: 0, flashed: false, counted: false, atk: 0, windup: false,
    };
    if (kind === 'spider') e.lift = 650;
    if (kind === 'bunny') { const side = Math.random() < 0.5 ? -1 : 1; e.x = e.baseX = side * (PATH_HW + 230); e.vx = -side * Phaser.Math.Between(110, 190); }
    this.ents.push(e);
    return e;
  }

  private director(dt: number): void {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const km = this.distU / 100;
    this.spawnT = Math.max(0.65, 1.5 - this.tasksDone * 0.04 - km * 0.0008) * Phaser.Math.FloatBetween(0.8, 1.2) * (this.bossSpawned ? 1.8 : 1);

    // the hell ends with the demon: it replaces all other quests
    if (this.biome.id === 'hell' && !this.bossSpawned && km >= BOSS_AT_M) {
      this.bossSpawned = true;
      this.spawn('demon', ZFAR, 0);
      this.tasks = [demonTask()];
      this.refreshTasks();
      sfx.roar();
      this.toast(t('forest.boss'));
      return;
    }
    // a boss quest summons the troll once
    if (this.tasks.some((t) => t.metric === 'troll') && !this.ents.some((e) => e.kind === 'troll')) {
      sfx.growl(); this.spawn('troll', ZFAR, 0);
      return;
    }
    const isFoe = (k: Kind): boolean => DEFS[k].foe && !DEFS[k].solid && !DEFS[k].boss && k !== 'rock';
    const foes = this.ents.filter((e) => isFoe(e.kind)).length;
    const want = (k: Kind): number => (this.tasks.some((t) => t.metric === k) ? 3 : 1);
    const forest = this.biome.id === 'forest';
    const big: Kind[] = ['bear', 'polar', 'golem', 'wolf'];
    const bag = this.biome.bag.filter(([k]) => {
      const u = UNLOCK[k];
      if (forest && u !== undefined && this.tasksDone < u) return false;
      if (isFoe(k) && foes >= (this.bossSpawned ? 2 : 8)) return false;
      if (big.includes(k) && this.ents.filter((e) => e.kind === k).length >= 2) return false;
      return true;
    }).map(([k, w]) => [k, (k === 'honey' && this.hearts >= MAX_HEARTS ? w * 0.3 : w) * want(k)] as [Kind, number]);
    if (bag.length === 0) return;
    const total = bag.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    let kind: Kind = bag[0][0];
    for (const [k, w] of bag) { r -= w; if (r <= 0) { kind = k; break; } }

    if (kind === 'coin') {
      const x0 = Phaser.Math.Between(-300, 300);
      const dx = Phaser.Math.Between(-60, 60);
      for (let i = 0; i < 4; i++) this.spawn('coin', ZFAR + i * 230, clamp(x0 + dx * i, -PATH_HW + 60, PATH_HW - 60));
      return;
    }
    if (kind === 'bat' && Math.random() < 0.5) { this.spawn('bat'); this.spawn('bat', ZFAR + 350); return; }
    if (big.includes(kind)) sfx.growl();
    this.spawn(kind);
  }

  // ---------- per-frame ----------

  private runSpeed(): number { return 250 + Math.min(250, (this.distU / 100) * 0.8); }
  private spd(): number { return 1 + Math.min(0.6, this.tasksDone * 0.03); }

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

    const bi = biomeAt(this.distU / 100);
    if (bi !== this.biomeIdx) this.setBiome(bi, false);

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
      if (this.reloadT <= 0) { this.reloadT = 0; this.ammo = this.weapon.mag; }
    }
    if (this.holdId !== null && this.weapon.auto) this.shoot(this.holdX, this.holdY);

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
    if (e.kind === 'demon') { this.updateDemon(e, dt, run); return; }
    e.z -= (run + def.v * this.spd()) * dt;
    const homing = (rate: number): void => { if (e.z > 700) e.baseX += clamp(this.camX - e.baseX, -rate * dt, rate * dt); };

    switch (e.kind) {
      case 'mushroom': homing(45); e.x = e.baseX + Math.sin(e.t * 2) * 30; break;
      case 'bat': homing(70); e.x = e.baseX + Math.sin(e.t * 3) * 260; e.lift = def.lift + Math.sin(e.t * 5) * 50; break;
      case 'spider':
        homing(50); e.x = e.baseX + Math.sin(e.t * 2.2) * 200;
        e.lift = Math.max(0, e.lift - 420 * dt);
        break;
      case 'bear': homing(95); e.x = e.baseX + Math.sin(e.t * 1.5) * 40; break;
      case 'polar': homing(95); e.x = e.baseX + Math.sin(e.t * 1.5) * 40; break;
      case 'slime': homing(40); e.x = e.baseX + Math.sin(e.t * 1.6) * 40; e.lift = Math.abs(Math.sin(e.t * 4)) * 70; break;
      case 'golem': homing(85); e.x = e.baseX + Math.sin(e.t * 1.2) * 30; break;
      case 'snowman': homing(55); e.x = e.baseX + Math.sin(e.t * 1.8) * 60; break;
      case 'wolf': homing(120); e.x = e.baseX + Math.sin(e.t * 4) * 70; break;
      case 'imp': homing(80); e.x = e.baseX + Math.sin(e.t * 2.5) * 280; e.lift = def.lift + Math.sin(e.t * 4) * 60; break;
      case 'skull': homing(150); e.x = e.baseX + Math.sin(e.t * 3) * 100; e.lift = def.lift + Math.sin(e.t * 6) * 30; break;
      case 'troll':
        homing(35); e.x = e.baseX;
        e.throwT -= dt;
        if (e.throwT <= 0 && e.z > 900 && e.z < 3400) {
          e.throwT = 2.4; sfx.growl();
          const r = this.spawn('rock', e.z, e.x);
          r.lift = 330;
          r.vx = (this.camX - e.x) / Math.max(0.5, e.z / (run + DEFS.rock.v));
        }
        break;
      case 'rock': e.x += e.vx * dt; break;
      case 'fireball': e.x += e.vx * dt; break;
      case 'bunny': e.x += e.vx * dt; e.lift = Math.abs(Math.sin(e.t * 7)) * 70; break;
      case 'coin': e.lift = def.lift + Math.sin(e.t * 4) * 14; break;
      default: break;
    }

    const near = Math.abs(e.x - this.camX);
    if (def.foe) {
      if (e.z < 110) {
        if (near < (e.kind === 'troll' ? 460 : e.kind === 'rock' ? 230 : e.kind === 'fireball' ? 160 : 300)) {
          const q = this.pos(e);
          this.puff(q.x, q.y, def.puff, 8, 1.3);
          this.remove(e);
          this.hurt(e.kind === 'troll' ? 2 : 1);
          return;
        }
        if (e.z < -300) { this.remove(e); return; }
      }
    } else if (e.kind === 'coin' || e.kind === 'honey') {
      if (e.z < 90 && near < 250) { this.kill(e, false); return; }
      if (e.z < -300) { this.remove(e); return; }
    } else if (e.kind === 'bunny') {
      if (e.z < 100 && !e.counted) { e.counted = true; sfx.pop(); this.float(this.proj(e.x, e.z).sx, 900, t('forest.saved')); this.onMetric('bunny'); }
      if (e.z < -300) { this.remove(e); return; }
    } else if (e.z < -300) { this.remove(e); }
  }

  /** The demon flies in, then hovers and swings left and right, hurling fireballs the player must dodge. */
  private updateDemon(e: Ent, dt: number, run: number): void {
    const arriving = e.z > BOSS_Z;
    e.z = arriving ? Math.max(BOSS_Z, e.z - 700 * dt) : BOSS_Z;
    e.x = Math.sin(e.t * 0.7) * 330;
    e.lift = 40 + Math.sin(e.t * 2.2) * 30;
    if (arriving) { e.throwT = 2; return; }

    e.throwT -= dt;
    if (e.throwT > 0 || e.windup) return;
    const enraged = e.hp <= DEFS.demon.hp / 2;
    e.windup = true;
    sfx.roar();
    e.img.setTint(0xff5050);   // the warning: it turns red just before it attacks
    this.time.delayedCall(550, () => {
      e.windup = false;
      if (this.over || !this.ents.includes(e)) return;
      e.img.clearTint();
      this.demonAttack(e, enraged, run);
      e.throwT = enraged ? 1.7 : 2.6;
    });
  }

  private demonAttack(e: Ent, enraged: boolean, run: number): void {
    e.atk++;
    sfx.fireball();
    /** A fireball that starts at the demon and arrives at `lane` (world x) when it reaches the player. */
    const fire = (lane: number): void => {
      const f = this.spawn('fireball', e.z - 30, e.x);
      f.vx = (lane - e.x) / Math.max(0.5, f.z / (run + DEFS.fireball.v * this.spd()));
    };
    /** Two of the three lanes are covered, one is free: the player strafes into the gap. */
    const wall = (): void => {
      const free = Phaser.Math.Between(0, LANES.length - 1);
      LANES.forEach((x, i) => { if (i !== free) fire(x); });
    };
    const pattern = enraged ? [1, 2, 0][e.atk % 3] : [0, 1][e.atk % 2];
    if (pattern === 0) fire(this.camX);
    else if (pattern === 1) wall();
    else {
      wall();
      this.time.delayedCall(900, () => { if (!this.over && this.ents.includes(e)) { sfx.fireball(); wall(); } });
    }
  }

  /** Draw ground, scenery and entities for the current camera state. */
  private render(): void {
    this.drawGround();
    const dist = this.distU;
    this.treeLine.forEach((t) => t.img.setX(t.x - this.camX * 0.04 + this.bendAmt * 90));
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
      } else if (e.flashed) {
        e.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
        if (def.tint !== undefined) e.img.setTint(def.tint);
        e.flashed = false;
      }
      const p = this.proj(e.x, e.z);
      e.shadow.setPosition(p.sx, p.sy).setDisplaySize(def.w * p.s * 0.7, 40 * p.s).setDepth(-e.z - 0.1)
        .setVisible(e.z > -380 && e.kind !== 'coin').setAlpha(clamp((ZFAR + 200 - e.z) / 1000, 0, def.solid ? 0.6 : 0.25));
      if (def.boss) boss = e;
    }

    this.bossBar.clear();
    if (boss) {
      const b = boss as Ent;
      const f = clamp(b.hp / DEFS[b.kind].hp, 0, 1);
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
    const col = this.pathNow;
    g.clear();
    const k0 = Math.floor(this.distU / STEP) - 3;
    const k1 = Math.ceil((this.distU + 9000) / STEP);
    const Zmin = -450;
    const zs: number[] = [];
    for (let k = k0; k <= k1; k++) zs.push(Math.max(Zmin, k * STEP - this.distU));
    const yAt = (z: number): number => HORIZON + CAMH * (FOCAL / (FOCAL + z));

    // lighter stripes across the ground
    g.fillStyle(col.grass, 0.2);
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
    poly(PATH_HW + 50, col.edge);
    poly(PATH_HW, col.main);
    g.fillStyle(col.stripe, 1);
    for (let i = 0; i < zs.length - 1; i++) {
      if (((k0 + i) & 1) === 0 || zs[i + 1] <= zs[i]) continue;
      poly(PATH_HW, col.stripe, i);
    }
  }

  // ---------- end of run ----------

  private victory(): void {
    // the demon is gone: so are its fireballs and servants
    for (const o of [...this.ents]) {
      if (!DEFS[o.kind].foe) continue;
      const q = this.pos(o);
      this.puff(q.x, q.y, DEFS[o.kind].puff, 6, 1.2);
      this.remove(o);
    }
    this.time.delayedCall(900, () => this.endRun(true));
    this.over = true;
    this.joyX = 0; this.holdId = null;
  }

  private endRun(win: boolean): void {
    this.over = true;
    this.joyX = 0; this.holdId = null;
    this.refreshHud();
    if (!win) sfx.poof(); else sfx.yay();
    saveForest();
    const meters = Math.floor(this.distU / 100);
    let best = 0;
    try { best = Number(localStorage.getItem('forest-best') ?? localStorage.getItem('gozd-best')) || 0; } catch { /* storage is optional */ }
    const record = meters > best && this.startM === 0;
    if (record) { best = meters; try { localStorage.setItem('forest-best', String(best)); } catch { /* optional */ } }
    const stars = win ? 3 : Math.min(3, Math.ceil(this.tasksDone / 2));

    this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setDepth(1900);
    text(this, W / 2, 330, t(win ? 'forest.victory' : 'forest.gameOver'), 150).setColor('#ffffff').setStroke('#5a3a22', 16).setDepth(2000);
    for (let i = 0; i < 3; i++) {
      this.add.image(W / 2 + (i - 1) * 190, 560, 'star').setScale(1.1).setAlpha(i < stars ? 1 : 0.2).setDepth(2000);
    }
    text(this, W / 2, 760, t('forest.distance', { n: meters }), 90).setColor('#ffffff').setStroke('#2c4a33', 12).setDepth(2000);
    text(this, W / 2, 880, t('forest.quests', { done: this.tasksDone, score: this.score }), 80).setColor('#ffffff').setStroke('#2c4a33', 12).setDepth(2000);
    text(this, W / 2, 1000, record ? t('forest.newRecord') : t('forest.record', { n: best }), 70).setColor('#fff6a8').setStroke('#5a3a22', 12).setDepth(2000);
    text(this, W - 60, 70, `🪙 ${forestSave.coins}`, 70).setOrigin(1, 0.5).setColor('#ffffff').setStroke('#5a3a22', 12).setDepth(2000);
    tapButton(this, W / 2 - 340, 1170, t('common.again'), () => this.scene.restart()).setDepth(2001);
    tapButton(this, W / 2 + 340, 1170, t('forest.finish'), () => this.finish(stars)).setDepth(2001);
    tapButton(this, W / 2, 1360, `🪙 ${t('forest.shop')}`, () => this.scene.start('ForestShop', { from: 'run' })).setDepth(2001);
  }
}
