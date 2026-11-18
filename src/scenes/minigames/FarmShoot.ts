import Phaser from 'phaser';
import { W, H } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { text } from '../../core/touch';
import { sfx } from '../../core/sfx';
import { progress } from '../../core/stages';
import { t } from '../../i18n';

interface Data { animals: ('hen' | 'pig')[]; goal: number; speed: number; gold?: boolean }

type Kind = 'hen' | 'pig' | 'gold';
interface Animal {
  kind: Kind;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number;
  tx: number; ty: number;
  wait: number;
  phase: number;
  fleeing: boolean;
  moving: boolean;
  vx: number;
}

const WORLD_MULT = 3;          // meadow is 3 screens wide
const HORIZON = 700;           // y of the far edge of the grass
const FRONT = 1480;            // y of the near edge
const JOY_R = 130;
const FLEE_DIST = 650;
const BASE: Record<Kind, number> = { hen: 0.62, pig: 0.6, gold: 0.62 };
const HUNTER_K = 0.55;
const FEET = 0.96;             // origin y: where the feet are in the sprites

/** Perspective scale of things standing at depth y. */
const sc = (y: number): number => 0.45 + ((y - HORIZON) / (FRONT - HORIZON)) * 0.8;

export class FarmShoot extends StageScene {
  private cfg!: Data;
  private hits = 0;
  private done = false;
  private animals: Animal[] = [];
  private worldW = 0;

  private hunter!: Phaser.GameObjects.Image;
  private hunterShadow!: Phaser.GameObjects.Ellipse;
  private hx = 0; private hy = 0;
  private facing = 1;
  private faceLock = 0;
  private recoil = 0;
  private walkPhase = 0;

  private joyId: number | null = null;
  private joyBase!: Phaser.GameObjects.Arc;
  private joyKnob!: Phaser.GameObjects.Arc;
  private joyOrigin = new Phaser.Math.Vector2();
  private joyVec = new Phaser.Math.Vector2();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

  private score!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private arrowL!: Phaser.GameObjects.Text;
  private arrowR!: Phaser.GameObjects.Text;
  private soundCooldown = 0;

  constructor() { super('FarmShoot'); }

  init(d: Data): void { this.cfg = d; }

  create(): void {
    this.hits = 0; this.done = false; this.animals = [];
    this.joyId = null; this.joyVec.set(0, 0);
    this.faceLock = 0; this.recoil = 0; this.walkPhase = 0; this.soundCooldown = 0;
    this.worldW = W * WORLD_MULT;
    this.backdrop(0x9fd4f5);
    this.buildWorld();

    // hunter
    this.hx = this.worldW / 2; this.hy = 1250; this.facing = 1;
    this.hunterShadow = this.add.ellipse(this.hx, this.hy, 200, 50, 0x000000, 0.3);
    this.hunter = this.add.image(this.hx, this.hy, 'hunter-1').setOrigin(0.5, FEET);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldW, H);
    cam.startFollow(this.hunter, true, 0.12, 1);

    // HUD (screen-fixed)
    this.title = text(this, W / 2, 110, t('farm.shoot'), 90).setScrollFactor(0).setDepth(1000);
    this.score = text(this, W / 2, 220, `0 / ${this.cfg.goal}`, 80).setScrollFactor(0).setDepth(1000);
    this.tweens.add({ targets: this.title, alpha: 0.4, delay: 2500, duration: 600 });
    this.arrowL = text(this, 90, 760, '◀', 130).setScrollFactor(0).setDepth(1000).setAlpha(0);
    this.arrowR = text(this, W - 90, 760, '▶', 130).setScrollFactor(0).setDepth(1000).setAlpha(0);
    for (const a of [this.arrowL, this.arrowR]) {
      this.tweens.add({ targets: a, scale: 1.2, duration: 450, yoyo: true, repeat: -1 });
    }
    const hint = text(this, 330, H - 130, t('farm.hint'), 50).setScrollFactor(0).setDepth(1000).setAlpha(0.7);
    this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 800 });

    this.joyBase = this.add.circle(0, 0, JOY_R + 30, 0xffffff, 0.25).setStrokeStyle(8, 0xffffff, 0.6)
      .setScrollFactor(0).setDepth(1000).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 70, 0xffffff, 0.55).setScrollFactor(0).setDepth(1001).setVisible(false);

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    // initial herd, away from the hunter
    const n = this.targetCount();
    for (let i = 0; i < n; i++) this.spawn();
    this.time.addEvent({ delay: 800, loop: true, callback: () => { if (this.animals.length < this.targetCount()) this.spawn(); } });

    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
    });
  }

  private targetCount(): number { return Math.min(10, 6 + Math.round(this.cfg.speed * 2)); }

  // ---------- world ----------

  private gradient(key: string, h: number, stops: [number, string][]): void {
    if (this.textures.exists(key)) return;
    const t = this.textures.createCanvas(key, 4, h)!;
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, h);
    t.refresh();
  }

  private buildWorld(): void {
    const WW = this.worldW;
    this.gradient('sky-grad', 256, [[0, '#4a9be0'], [0.6, '#a9dcf7'], [1, '#e6f6ff']]);
    this.gradient('ground-grad', 256, [[0, '#7fc46a'], [0.5, '#4f9f45'], [1, '#2f7a34']]);

    this.add.image(0, 0, 'sky-grad').setOrigin(0).setDisplaySize(W, HORIZON + 40).setScrollFactor(0).setDepth(-100);
    for (let i = 0; i < 6; i++) {
      this.add.image(i * 520 + Phaser.Math.Between(0, 200), Phaser.Math.Between(60, 340), 'cloud')
        .setScale(Phaser.Math.FloatBetween(0.5, 1.1)).setScrollFactor(0.08).setDepth(-90);
    }
    for (let i = 0; i < 5; i++) {
      this.add.image(i * 1100 - 100, HORIZON + 30, 'hill').setOrigin(0, 1).setScrollFactor(0.3).setDepth(-80);
    }
    this.add.image(0, HORIZON, 'ground-grad').setOrigin(0).setDisplaySize(WW, H - HORIZON).setDepth(-50);

    // fence along the horizon
    for (let x = 60; x < WW; x += 210) {
      this.add.image(x, HORIZON + 30, 'fence').setOrigin(0.5, 1).setScale(0.35).setDepth(HORIZON + 30);
    }
    // barns and trees standing on the meadow (depth-sorted with animals)
    for (const bx of [800, WW - 900]) {
      this.add.image(bx, HORIZON + 110, 'barn').setOrigin(0.5, 1).setScale(0.6).setDepth(HORIZON + 110);
    }
    for (let i = 0; i < 14; i++) {
      const y = Phaser.Math.Between(HORIZON + 50, 1000);
      this.add.image(Phaser.Math.Between(150, WW - 150), y, 'tree').setOrigin(0.5, 1)
        .setScale(sc(y) * 0.7).setDepth(y);
    }
    // grass tufts for a sense of motion
    for (let i = 0; i < 220; i++) {
      const y = Phaser.Math.Between(HORIZON + 30, FRONT + 40);
      const t = this.add.image(Phaser.Math.Between(0, WW), y, 'grass-tuft').setOrigin(0.5, 1)
        .setScale(sc(y) * Phaser.Math.FloatBetween(0.5, 1)).setDepth(y - 3);
      if (Math.random() < 0.4) t.setTint(0xd8f0a0);
    }
  }

  // ---------- input ----------

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    if (this.joyId === null && p.x < 750 && p.y > 700) {
      this.joyId = p.id;
      this.joyOrigin.set(p.x, p.y);
      this.joyBase.setPosition(p.x, p.y).setVisible(true);
      this.joyKnob.setPosition(p.x, p.y).setVisible(true);
      this.joyVec.set(0, 0);
      return;
    }
    this.shoot(p.x + this.cameras.main.scrollX, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyId) return;
    const v = new Phaser.Math.Vector2(p.x - this.joyOrigin.x, p.y - this.joyOrigin.y);
    if (v.length() > JOY_R) v.setLength(JOY_R);
    this.joyVec.copy(v);
    this.joyKnob.setPosition(this.joyOrigin.x + v.x, this.joyOrigin.y + v.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyId) return;
    this.joyId = null;
    this.joyVec.set(0, 0);
    this.joyBase.setVisible(false);
    this.joyKnob.setVisible(false);
  }

  // ---------- shooting ----------

  private muzzle(): { x: number; y: number } {
    const s = this.hunter.scaleX;
    return {
      x: this.hunter.x + this.facing * (0.97 - 0.5) * this.hunter.width * s,
      y: this.hunter.y - (FEET - 0.31) * this.hunter.height * s,
    };
  }

  private shoot(wx: number, wy: number): void {
    // turn towards the shot
    this.facing = wx >= this.hx ? 1 : -1;
    this.faceLock = 0.45;
    this.recoil = 1;
    this.hunter.setFlipX(this.facing < 0);
    sfx.bang();

    const m = this.muzzle();
    const flash = this.add.circle(m.x, m.y, 45, 0xfff3a0).setDepth(3000);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 130, onComplete: () => flash.destroy() });
    const tracer = this.add.graphics().setDepth(2999);
    tracer.lineStyle(6, 0xfff3a0, 0.9).lineBetween(m.x, m.y, wx, wy);
    this.tweens.add({ targets: tracer, alpha: 0, duration: 140, onComplete: () => tracer.destroy() });
    const ch = this.add.image(wx, wy, 'crosshair').setScale(0.5).setDepth(3000);
    this.tweens.add({ targets: ch, alpha: 0, scale: 0.8, duration: 350, onComplete: () => ch.destroy() });

    let best: Animal | null = null;
    let bestD = Infinity;
    for (const a of this.animals) {
      const r = Math.max(100, 190 * sc(a.y));
      const cy = a.y - a.img.displayHeight * 0.4;
      const d = (a.x - wx) ** 2 + (cy - wy) ** 2;
      if (d < r * r && d < bestD) { bestD = d; best = a; }
    }
    if (best) this.hit(best);
  }

  private hit(a: Animal): void {
    this.animals = this.animals.filter((x) => x !== a);
    const { x, y } = a;
    const h = a.img.displayHeight;
    const dir = x >= this.hx ? 1 : -1;
    (a.kind === 'pig' ? sfx.oink : sfx.cluck)();

    // fall over, then fade
    this.tweens.add({ targets: a.img, angle: dir * 85, duration: 260, ease: 'Quad.in' });
    this.tweens.add({
      targets: [a.img, a.shadow], alpha: 0, delay: 1600, duration: 600,
      onComplete: () => { a.img.destroy(); a.shadow.destroy(); },
    });
    a.shadow.setDepth(y - 2);

    // blood pool grows under the body
    const pool = this.add.image(x + dir * 40, y - 6, 'blood-pool').setScale(0).setDepth(y - 1).setAlpha(0.9);
    this.tweens.add({ targets: pool, scale: sc(y) * 0.85, duration: 700, ease: 'Quad.out' });
    this.tweens.add({ targets: pool, alpha: 0, delay: 2400, duration: 800, onComplete: () => pool.destroy() });

    // blood spray in a ballistic arc
    const cy = y - h * 0.5;
    for (let i = 0; i < 14; i++) {
      const d = this.add.image(x, cy, 'blood-drop').setScale(Phaser.Math.FloatBetween(0.3, 0.7) * Math.max(0.6, sc(y))).setDepth(y + 5);
      const vx = dir * Phaser.Math.Between(-120, 380), vy = Phaser.Math.Between(-420, -120);
      const ground = y + Phaser.Math.Between(-20, 30);
      this.tweens.addCounter({
        from: 0, to: 1, duration: Phaser.Math.Between(500, 800),
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          d.x = x + vx * t * 1.6;
          d.y = Math.min(ground, cy + vy * t * 1.6 + 900 * t * t);
        },
        onComplete: () => this.tweens.add({ targets: d, alpha: 0, delay: 1200, duration: 600, onComplete: () => d.destroy() }),
      });
    }
    if (a.kind !== 'pig') {
      for (let i = 0; i < 7; i++) {
        const f = this.add.image(x, cy, 'feather').setScale(0.35).setDepth(y + 6);
        this.tweens.add({
          targets: f, x: x + Phaser.Math.Between(-240, 240), y: cy + Phaser.Math.Between(-220, 80),
          angle: Phaser.Math.Between(-360, 360), alpha: 0, duration: Phaser.Math.Between(700, 1100),
          ease: 'Cubic.out', onComplete: () => f.destroy(),
        });
      }
    }
    if (a.kind === 'gold') {
      progress.coins += 1;
      sfx.coin();
      const c = this.add.image(x, cy, 'coin').setDepth(y + 7);
      this.tweens.add({ targets: c, y: c.y - 220, alpha: 0, duration: 900, onComplete: () => c.destroy() });
    }

    this.hits++;
    this.score.setText(`${this.hits} / ${this.cfg.goal}`);
    if (this.hits >= this.cfg.goal && !this.done) {
      this.done = true;
      this.title.setText(`${t('common.bravo')} 🎉`).setAlpha(1);
      this.joyVec.set(0, 0);
      this.time.delayedCall(1200, () => this.finish(1));
    }
  }

  // ---------- animals ----------

  private spawn(): void {
    const kinds: Kind[] = [...this.cfg.animals];
    if (this.cfg.gold && Math.random() < 0.15) kinds.push('gold');
    const kind = Phaser.Utils.Array.GetRandom(kinds);
    let x = 0, y = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = Phaser.Math.Between(200, this.worldW - 200);
      y = Phaser.Math.Between(HORIZON + 60, FRONT - 40);
      if (Math.abs(x - this.hx) > 900) break;
    }
    const tex = kind === 'gold' ? 'hen-gold-1' : kind === 'hen' ? 'hen-real-1' : 'pig-real-1';
    const shadow = this.add.ellipse(x, y, 160, 40, 0x000000, 0.28);
    const img = this.add.image(x, y, tex).setOrigin(0.5, FEET);
    const a: Animal = {
      kind, img, shadow, x, y, tx: x, ty: y, wait: Math.random() * 2,
      phase: Math.random() * 4, fleeing: false, moving: false, vx: 1,
    };
    this.animals.push(a);
  }

  private frameKey(a: Animal): string {
    const f = (Math.floor(a.phase) % 2) + 1;
    return a.kind === 'gold' ? `hen-gold-${f}` : a.kind === 'hen' ? `hen-real-${f}` : `pig-real-${f}`;
  }

  private updateAnimal(a: Animal, dt: number): void {
    const dx = a.x - this.hx;
    const dy = (a.y - this.hy) * 2;       // depth distance counts double
    const dist = Math.hypot(dx, dy);
    const speedMul = this.cfg.speed;

    let vx = 0, vy = 0;
    if (dist < FLEE_DIST) {
      if (!a.fleeing) {
        a.fleeing = true;
        if (this.time.now > this.soundCooldown) {
          this.soundCooldown = this.time.now + 700;
          (a.kind === 'pig' ? sfx.oink : sfx.cluck)();
        }
      }
      let ax = dx / (dist || 1), ay = dy / (dist || 1) / 2;
      // do not get pinned against the world edge: slide along it
      if ((a.x < 260 && ax < 0) || (a.x > this.worldW - 260 && ax > 0)) { ax = 0; ay = ay >= 0 ? 1 : -1; }
      if ((a.y < HORIZON + 90 && ay < 0) || (a.y > FRONT - 60 && ay > 0)) { ay = 0; ax = ax >= 0 ? 1 : -1; }
      const sp = (a.kind === 'pig' ? 420 : 520) * speedMul * sc(a.y);
      vx = ax * sp; vy = ay * sp * 0.6;
      a.moving = true;
    } else {
      a.fleeing = false;
      if (a.wait > 0) {
        a.wait -= dt;
        a.moving = false;
        if (a.wait <= 0) {
          a.tx = Phaser.Math.Clamp(a.x + Phaser.Math.Between(-450, 450), 200, this.worldW - 200);
          a.ty = Phaser.Math.Clamp(a.y + Phaser.Math.Between(-200, 200), HORIZON + 60, FRONT - 40);
        }
      } else {
        const ex = a.tx - a.x, ey = a.ty - a.y;
        const d = Math.hypot(ex, ey);
        if (d < 12) { a.wait = Phaser.Math.FloatBetween(1, 3.5); a.moving = false; }
        else {
          const sp = (a.kind === 'pig' ? 80 : 100) * sc(a.y);
          vx = (ex / d) * sp; vy = (ey / d) * sp * 0.6; a.moving = true;
        }
      }
    }

    a.x = Phaser.Math.Clamp(a.x + vx * dt, 120, this.worldW - 120);
    a.y = Phaser.Math.Clamp(a.y + vy * dt, HORIZON + 40, FRONT - 20);
    if (Math.abs(vx) > 5) a.vx = Math.sign(vx);

    if (a.moving) a.phase += dt * (a.fleeing ? 11 : 4);
    else a.phase = Math.floor(a.phase / 2) * 2;   // stand on frame 1
    const bob = a.moving ? Math.abs(Math.sin(a.phase * Math.PI)) * (a.fleeing ? 14 : 5) * sc(a.y) : 0;
    const s = BASE[a.kind] * sc(a.y);
    a.img.setTexture(this.frameKey(a)).setPosition(a.x, a.y - bob).setScale(s).setFlipX(a.vx < 0).setDepth(a.y);
    a.shadow.setPosition(a.x, a.y).setDisplaySize(a.img.displayWidth * 0.75, 44 * sc(a.y)).setDepth(a.y - 2);
  }

  // ---------- loop ----------

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;

    // hunter movement: joystick or keys
    let ix = this.joyVec.x / JOY_R, iy = this.joyVec.y / JOY_R;
    if (this.keys.left.isDown || this.wasd.A.isDown) ix -= 1;
    if (this.keys.right.isDown || this.wasd.D.isDown) ix += 1;
    if (this.keys.up.isDown || this.wasd.W.isDown) iy -= 1;
    if (this.keys.down.isDown || this.wasd.S.isDown) iy += 1;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    const moving = !this.done && mag > 0.15;
    if (moving) {
      this.hx = Phaser.Math.Clamp(this.hx + ix * 820 * dt, 150, this.worldW - 150);
      this.hy = Phaser.Math.Clamp(this.hy + iy * 420 * dt, HORIZON + 60, FRONT);
      this.walkPhase += dt * 8 * Math.max(0.5, mag);
      if (this.faceLock <= 0 && Math.abs(ix) > 0.15) this.facing = ix > 0 ? 1 : -1;
    }
    this.faceLock = Math.max(0, this.faceLock - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);

    const s = HUNTER_K * sc(this.hy);
    const bob = moving ? Math.abs(Math.sin(this.walkPhase * Math.PI)) * 10 * sc(this.hy) : 0;
    this.hunter.setTexture(moving ? `hunter-${(Math.floor(this.walkPhase) % 2) + 1}` : 'hunter-1')
      .setPosition(this.hx - this.facing * this.recoil * 14, this.hy - bob)
      .setScale(s).setFlipX(this.facing < 0).setDepth(this.hy);
    this.hunterShadow.setPosition(this.hx, this.hy).setDisplaySize(190 * sc(this.hy), 48 * sc(this.hy)).setDepth(this.hy - 2);

    for (const a of this.animals) this.updateAnimal(a, dt);

    // arrows towards animals that are off screen
    const cam = this.cameras.main;
    let left = false, right = false;
    for (const a of this.animals) {
      if (a.x < cam.scrollX) left = true;
      else if (a.x > cam.scrollX + W) right = true;
    }
    const onScreen = this.animals.some((a) => a.x >= cam.scrollX && a.x <= cam.scrollX + W);
    this.arrowL.setAlpha(left && !onScreen ? 0.85 : 0);
    this.arrowR.setAlpha(right && !onScreen ? 0.85 : 0);
  }
}
