import Phaser from 'phaser';
import { W, H } from '../../../core/layout';
import { StageScene } from '../../../core/MiniGame';
import { sfx } from '../../../core/sfx';
import { forestSave, saveForest } from '../../../core/forestSave';
import { Joystick } from '../../../core/Joystick';
import { t } from '../../../i18n';
import { DEFS, type Kind, type Metric, type Task } from './forestData';
import { BIOMES, biomeAt } from './biomes';
import { weaponById, type Weapon } from './weapons';
import { MAX_CAM, PATH_HW, ZFAR, placeImage, proj } from './projection';
import { MAX_HEARTS, newRun, type Ent, type RunState } from './state';
import { QuestLog } from './quests';
import { chooseSpawn, isBig, spawnInterval } from './director';
import { stepMotion } from './motion';
import { updateDemon, type BossHost } from './boss';
import { ForestBackdrop } from './backdrop';
import { ForestHud } from './hud';
import { showEndScreen } from './endScreen';

// ForestRun: the endless first-person shooter. This file wires the pieces together and holds what touches both
// the scene and the run: input, shooting, the update loop, entities and the end of the run.
//   state.ts       the numbers that change during a run        projection.ts  the pseudo-3D camera and the path
//   quests.ts      quest log                                   director.ts    what spawns next
//   motion.ts      how things move (from `Def.move`)           boss.ts        the demon
//   backdrop.ts    sky, ground, worlds, weather                hud.ts / endScreen.ts  the overlay and result screen

const STRAFE = 650;
const JOY = { x: 300, y: 1290, r: 140 };
const clamp = Phaser.Math.Clamp;

export class ForestRun extends StageScene {
  private s!: RunState;
  private quests = new QuestLog();
  private weapon: Weapon = weaponById('pistol');
  private startM = 0;
  private bossHost!: BossHost;

  private joy!: Joystick;
  private scenery!: ForestBackdrop;
  private hud!: ForestHud;
  private gun!: Phaser.GameObjects.Image;
  private gunBaseY = 0;

  constructor() { super('ForestRun'); }

  init(): void {
    // Dev helper: `?m=1000` starts the run that many metres in (to look at the later worlds).
    const m = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('m')) : 0;
    this.startM = Number.isFinite(m) && m > 0 ? m : 0;
  }

  create(): void {
    this.weapon = weaponById(forestSave.weapon);
    this.s = newRun(this.startM, this.weapon);
    this.quests = new QuestLog();
    this.bossHost = { time: this.time, run: this.s, spawn: (k, z, x) => this.spawn(k, z, x), speedUp: () => this.spd() };

    const start = biomeAt(this.startM);
    this.backdrop(BIOMES[start].bg);
    this.scenery = new ForestBackdrop(this, start);
    this.buildGun();
    this.hud = new ForestHud(this, this.hudInset);
    this.joy = new Joystick(this, { ...JOY, zone: { maxX: 640, minY: 960 }, axis: 'x' });
    this.hud.label(JOY.x, JOY.y, '◀   ▶', 70).setOrigin(0.5).setAlpha(0.6);

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

    this.quests.add(this.scenery.biome);
    this.quests.add(this.scenery.biome);
    this.hud.setTasks(this.quests.tasks);
  }

  private buildGun(): void {
    this.gunBaseY = H + 30;
    this.gun = this.add.image(W / 2, this.gunBaseY, this.weapon.tex).setOrigin(0.5, 1).setDepth(900);
    this.gun.setScale(640 / this.gun.height);
  }

  // ---------- worlds and quests ----------

  private enterBiome(i: number): void {
    this.scenery.setBiome(i, false);
    const b = this.scenery.biome;
    this.hud.toast(t(`biome.${b.id}`));
    this.quests.adaptTo(b);   // quests about monsters that live in another world could never be finished
    this.hud.setTasks(this.quests.tasks);
  }

  private onMetric(metric: Metric, n = 1): void {
    this.payQuests(this.quests.report(metric, n));
  }

  /** Reward the quests that were just completed and show the quest list. */
  private payQuests(completed: Task[]): void {
    for (const task of completed) this.completeTask(task);
    this.hud.setTasks(this.quests.tasks);
  }

  private earn(n: number): void { forestSave.coins += n; }

  private completeTask(task: Task): void {
    const s = this.s;
    sfx.ding();
    let msg = t('forest.questDone');
    if (task.reward === 'heart') {
      if (s.hearts < MAX_HEARTS) { s.hearts++; msg += '  +❤️'; } else { s.score += 100; msg += '  +100'; }
    } else if (task.reward === 'coins') {
      this.earn(10); s.score += 50; msg += '  +10 🪙';
    } else {
      s.score += 100; msg += '  +100';
    }
    this.hud.toast(msg);
    this.time.delayedCall(700, () => {
      if (this.s.over || this.s.bossSpawned) return;
      this.quests.add(this.scenery.biome);
      this.hud.setTasks(this.quests.tasks);
    });
  }

  // ---------- input ----------

  private onDown(p: Phaser.Input.Pointer): void {
    const s = this.s;
    if (s.over) return;
    if (this.joy.owns(p)) return;
    s.holdId = p.id; s.holdX = p.x; s.holdY = p.y;
    this.shoot(p.x, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id === this.s.holdId) { this.s.holdX = p.x; this.s.holdY = p.y; }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.s.holdId) this.s.holdId = null;
  }

  // ---------- shooting ----------

  private shoot(px: number, py: number): void {
    const s = this.s;
    const w = this.weapon;
    if (this.time.now < s.nextShot) return;
    if (s.reloadT > 0 || s.ammo <= 0) { if (!w.auto) sfx.click(); return; }
    s.nextShot = this.time.now + w.cooldown;
    s.ammo--;
    sfx[w.sound]();
    s.recoil = 1;

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
    for (const e of s.ents) {
      const def = DEFS[e.kind];
      if (def.solid) continue;
      const p = proj(s, e.x, e.z);
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

    if (s.ammo <= 0) { s.reloadT = w.reload; sfx.reload(); }
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

  /** Screen position and scale of the middle of an entity. */
  private pos(e: Ent): { x: number; y: number; s: number } {
    const p = proj(this.s, e.x, e.z);
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

  private remove(e: Ent): void {
    this.s.ents = this.s.ents.filter((x) => x !== e);
    e.img.destroy(); e.shadow.destroy();
  }

  /** Destroyed by the player's shot (or collected). */
  private kill(e: Ent, shot: boolean): void {
    const s = this.s;
    const def = DEFS[e.kind];
    const q = this.pos(e);
    this.remove(e);
    switch (e.kind) {
      case 'coin':
        sfx.coin(); this.earn(1); s.score += def.pts;
        this.puff(q.x, q.y, def.puff, 5, 0.6); this.hud.float(q.x, q.y, '+1 🪙');
        this.onMetric('coin');
        return;
      case 'honey':
        sfx.chest();
        if (s.hearts < MAX_HEARTS) { s.hearts++; this.hud.float(q.x, q.y, '+❤️'); } else { s.score += 25; this.hud.float(q.x, q.y, '+25'); }
        this.puff(q.x, q.y, def.puff, 7, 0.8);
        this.onMetric('honey');
        return;
      case 'bunny':
        if (shot) { sfx.hurt(); s.score = Math.max(0, s.score - 50); this.puff(q.x, q.y, def.puff); this.hud.float(q.x, q.y, t('forest.noBunny')); }
        return;
      case 'chest':
        sfx.chest(); s.score += def.pts;
        this.puff(q.x, q.y, def.puff, 12, 1.2); this.hud.float(q.x, q.y, '+50 ⭐');
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 70, () => { sfx.coin(); this.earn(1); });
        }
        this.onMetric('chest');
        return;
      case 'demon':
        s.score += def.pts;
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
    s.score += def.pts;
    this.puff(q.x, q.y, def.puff, def.boss ? 26 : 10, def.boss ? 2.2 : e.kind === 'bear' || e.kind === 'golem' || e.kind === 'polar' ? 1.4 : 1);
    this.hud.float(q.x, q.y, `+${def.pts}`);
    if (e.kind === 'rock' || e.kind === 'fireball') return;
    if (e.kind === 'troll') { this.cameras.main.shake(300, 0.012); this.earn(10); }
    this.onMetric(e.kind as Metric);
  }

  private hurt(n: number): void {
    const s = this.s;
    s.hearts = Math.max(0, s.hearts - n);
    s.noHit = 0;
    this.payQuests(this.quests.setProgress('nohit', 0));
    sfx.hurt();
    this.cameras.main.shake(220, 0.014);
    this.cameras.main.flash(200, 255, 40, 40);
    if (s.hearts <= 0) this.endRun(false);
  }

  // ---------- spawning ----------

  private spawn(kind: Kind, z = ZFAR, x?: number): Ent {
    const def = DEFS[kind];
    const px = x ?? Phaser.Math.Between(-PATH_HW + 60, PATH_HW - 60);
    const img = this.add.image(0, 0, def.tex[0]).setOrigin(0.5, 0.96);
    if (def.tint !== undefined) img.setTint(def.tint);
    const shadow = this.add.ellipse(0, 0, 100, 30, def.solid ? 0xff3b1f : 0x000000, 0.25);
    const e: Ent = {
      kind, img, shadow, x: px, z, lift: def.move?.drop?.from ?? def.lift, baseX: px, hp: def.hp, vx: 0, t: Math.random() * 6,
      bs: def.w / img.width, throwT: 1.5, flash: 0, flashed: false, counted: false, atk: 0, windup: false,
    };
    if (kind === 'bunny') { const side = Math.random() < 0.5 ? -1 : 1; e.x = e.baseX = side * (PATH_HW + 230); e.vx = -side * Phaser.Math.Between(110, 190); }
    this.s.ents.push(e);
    return e;
  }

  private director(dt: number): void {
    const s = this.s;
    s.spawnT -= dt;
    if (s.spawnT > 0) return;
    const km = s.distU / 100;
    s.spawnT = spawnInterval(this.quests.done, km, s.bossSpawned);

    const pick = chooseSpawn({
      biome: this.scenery.biome, km, tasks: this.quests.tasks, tasksDone: this.quests.done,
      hearts: s.hearts, maxHearts: MAX_HEARTS, bossSpawned: s.bossSpawned, alive: s.ents.map((e) => e.kind),
    });
    if (!pick) return;
    if (pick.type === 'demon') {
      s.bossSpawned = true;
      this.spawn('demon', ZFAR, 0);
      this.quests.startBossQuest();
      this.hud.setTasks(this.quests.tasks);
      sfx.roar();
      this.hud.toast(t('forest.boss'));
      return;
    }
    if (pick.type === 'troll') { sfx.growl(); this.spawn('troll', ZFAR, 0); return; }

    const kind = pick.kind;
    if (kind === 'coin') {
      const x0 = Phaser.Math.Between(-300, 300);
      const dx = Phaser.Math.Between(-60, 60);
      for (let i = 0; i < 4; i++) this.spawn('coin', ZFAR + i * 230, clamp(x0 + dx * i, -PATH_HW + 60, PATH_HW - 60));
      return;
    }
    if (kind === 'bat' && Math.random() < 0.5) { this.spawn('bat'); this.spawn('bat', ZFAR + 350); return; }
    if (isBig(kind)) sfx.growl();
    this.spawn(kind);
  }

  // ---------- per-frame ----------

  private runSpeed(): number { return 250 + Math.min(250, (this.s.distU / 100) * 0.8); }
  /** Enemies get a little faster with every quest done. */
  private spd(): number { return 1 + Math.min(0.6, this.quests.done * 0.03); }

  update(_t: number, delta: number): void {
    const s = this.s;
    const dt = Math.min(delta, 50) / 1000;
    if (s.over) { this.render(); return; }

    // strafing: joystick or keys
    s.camX = clamp(s.camX + this.joy.read().x * STRAFE * dt, -MAX_CAM, MAX_CAM);

    const run = this.runSpeed();
    s.distU += run * dt;
    s.bendAmt = Math.sin(s.distU * 0.0006) * 0.9 + Math.sin(s.distU * 0.00023) * 0.5;

    const bi = biomeAt(s.distU / 100);
    if (bi !== this.scenery.biomeIdx) this.enterBiome(bi);

    // metres run: quests
    s.metAcc += (run * dt) / 100;
    if (s.metAcc >= 1) {
      const m = Math.floor(s.metAcc);
      s.metAcc -= m;
      s.noHit += m;
      this.onMetric('meters', m);
      this.payQuests(this.quests.setProgress('nohit', s.noHit));
    }

    if (s.reloadT > 0) {
      s.reloadT -= dt;
      if (s.reloadT <= 0) { s.reloadT = 0; s.ammo = this.weapon.mag; }
    }
    if (s.holdId !== null && this.weapon.auto) this.shoot(s.holdX, s.holdY);

    this.director(dt);
    for (const e of [...s.ents]) this.updateEnt(e, dt, run);
    if (s.over) return;

    this.scenery.scroll(run * dt);
    this.render();
    this.hud.update({ hearts: s.hearts, distU: s.distU, score: s.score, coins: forestSave.coins, weapon: this.weapon, ammo: s.ammo, reloadT: s.reloadT });
  }

  private updateEnt(e: Ent, dt: number, run: number): void {
    const s = this.s;
    const def = DEFS[e.kind];
    e.t += dt;
    if (e.kind === 'demon') { updateDemon(this.bossHost, e, dt, run); return; }
    e.z -= (run + def.v * this.spd()) * dt;
    stepMotion(e, def, dt, s.camX);

    if (e.kind === 'troll') {
      e.throwT -= dt;
      if (e.throwT <= 0 && e.z > 900 && e.z < 3400) {
        e.throwT = 2.4; sfx.growl();
        const r = this.spawn('rock', e.z, e.x);
        r.lift = 330;
        r.vx = (s.camX - e.x) / Math.max(0.5, e.z / (run + DEFS.rock.v));
      }
    }

    const near = Math.abs(e.x - s.camX);
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
      if (e.z < 100 && !e.counted) { e.counted = true; sfx.pop(); this.hud.float(proj(s, e.x, e.z).sx, 900, t('forest.saved')); this.onMetric('bunny'); }
      if (e.z < -300) { this.remove(e); return; }
    } else if (e.z < -300) { this.remove(e); }
  }

  /** Draw the scenery, the entities and the gun for the current camera state. */
  private render(): void {
    const s = this.s;
    this.scenery.render(s, s.distU);

    let boss: Ent | null = null;
    for (const e of s.ents) {
      const def = DEFS[e.kind];
      const frame = def.tex.length > 1 ? def.tex[Math.floor(e.t * 7) % def.tex.length] : def.tex[0];
      if (e.img.texture.key !== frame) e.img.setTexture(frame);
      placeImage(e.img, s, e.x, e.z, e.lift, def.w);
      if (e.flash > 0) {
        e.flash -= 1 / 60;
        if (!e.flashed) { e.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); e.flashed = true; }
      } else if (e.flashed) {
        e.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
        if (def.tint !== undefined) e.img.setTint(def.tint);
        e.flashed = false;
      }
      const p = proj(s, e.x, e.z);
      e.shadow.setPosition(p.sx, p.sy).setDisplaySize(def.w * p.s * 0.7, 40 * p.s).setDepth(-e.z - 0.1)
        .setVisible(e.z > -380 && e.kind !== 'coin').setAlpha(clamp((ZFAR + 200 - e.z) / 1000, 0, def.solid ? 0.6 : 0.25));
      if (def.boss) boss = e;
    }
    const b = boss as Ent | null;
    this.hud.drawBossBar(b ? b.hp / DEFS[b.kind].hp : null);

    // gun: bob while running, kick on recoil
    s.recoil = Math.max(0, s.recoil - 0.1);
    this.gun.setY(this.gunBaseY + Math.sin(s.distU * 0.012) * 8 + s.recoil * 40);
    this.gun.setRotation(this.gun.rotation * 0.9);
    this.gun.setScale((640 / this.gun.height) * (1 + s.recoil * 0.05));
  }

  // ---------- end of run ----------

  private victory(): void {
    const s = this.s;
    // the demon is gone: so are its fireballs and servants
    for (const o of [...s.ents]) {
      if (!DEFS[o.kind].foe) continue;
      const q = this.pos(o);
      this.puff(q.x, q.y, DEFS[o.kind].puff, 6, 1.2);
      this.remove(o);
    }
    this.time.delayedCall(900, () => this.endRun(true));
    s.over = true;
    this.joy.reset(); s.holdId = null;
  }

  private endRun(win: boolean): void {
    const s = this.s;
    s.over = true;
    this.joy.reset(); s.holdId = null;
    this.hud.update({ hearts: s.hearts, distU: s.distU, score: s.score, coins: forestSave.coins, weapon: this.weapon, ammo: s.ammo, reloadT: s.reloadT });
    if (!win) sfx.poof(); else sfx.yay();
    const meters = Math.floor(s.distU / 100);
    const record = meters > forestSave.best && this.startM === 0;
    if (record) forestSave.best = meters;
    saveForest();
    const stars = win ? 3 : Math.min(3, Math.ceil(this.quests.done / 2));
    showEndScreen(this, { win, meters, score: s.score, quests: this.quests.done, stars, record, best: forestSave.best }, {
      again: () => this.scene.restart(),
      finish: () => this.finish(stars),
      shop: () => this.scene.start('ForestShop', { from: 'run' }),
    });
  }
}
