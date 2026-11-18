import Phaser from 'phaser';
import { W } from '../main';
import { currentJourney, progress } from '../core/stages';
import { sfx } from '../core/sfx';
import { text } from '../core/touch';
import { t } from '../i18n';

// A 3/4 ("45 degrees") view of the town: the camera looks at it from the south, so buildings show
// their front wall and a bit of roof, and things further down the screen (bigger y) draw in front.
// Every object's depth is its ground y, so the player walks in front of and behind things.
const WORLD_W = 3400;
const WORLD_H = 2300;
const SPEED = 560;
const JOY = { x: 300, y: 1250, r: 140 };
const INK = 0x5a3a22;

const WALL_H = 360;
const ROOF_D = 100;
const BODY_H = WALL_H + ROOF_D; // how far up the screen a building's silhouette reaches
const TOP_BASE = 760; // ground y of the top row's front wall (the player can't walk north of this)
const BOTTOM_BASE = 1800; // ground y of the bottom row's front wall
const MIN_Y = TOP_BASE + 10;
const MAX_Y = 2150;
const START = { x: 260, y: 1050 };

interface Spot { x: number; base: number; w: number; wall: number; roof: number; gable?: boolean }
/** One enterable building per stage of the journey, in stage order (the finale has no building). */
const spots: Spot[] = [
  { x: 520, base: TOP_BASE, w: 460, wall: 0xffd9a8, roof: 0xff6b6b },          // checkout
  { x: 1300, base: TOP_BASE, w: 460, wall: 0xffc6e0, roof: 0xb86bff },         // animals
  { x: 2080, base: TOP_BASE, w: 460, wall: 0xfff0a8, roof: 0xff8fb8 },         // sweets
  { x: 2860, base: TOP_BASE, w: 460, wall: 0xc9ecff, roof: 0x3fa7ff },         // fish
  { x: 2600, base: BOTTOM_BASE, w: 520, wall: 0xff8a7a, roof: 0x9b5a2b, gable: true }, // home / eggs
  { x: 1300, base: BOTTOM_BASE, w: 460, wall: 0xe4ffd0, roof: 0x4fbf6a },      // kitchen / cutting
  { x: 1950, base: BOTTOM_BASE, w: 460, wall: 0xfff1d6, roof: 0xe8453c },      // pizzeria
];
/** Non-playable houses, just for the look of a town. */
const houses: Spot[] = [
  { x: 380, base: BOTTOM_BASE, w: 440, wall: 0xdfd3ff, roof: 0x7a6bd6 },
];

type Rect = { x0: number; y0: number; x1: number; y1: number };

/** Top-down-ish town: walk with the joystick, step into a building's door to play its game. */
export class CityHub extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Image;
  private pet?: Phaser.GameObjects.Image;
  private walls: Rect[] = [];
  private doors: { x: number; y: number }[] = [];
  private joyId: number | null = null;
  private joyV = new Phaser.Math.Vector2();
  private joyKnob!: Phaser.GameObjects.Arc;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private entering = false;

  constructor() { super('CityHub'); }

  create(): void {
    this.walls = []; this.doors = []; this.joyId = null; this.joyV.set(0, 0);
    this.entering = false;

    this.cameras.main.setBackgroundColor(0x7fd69a);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    this.drawGround();
    this.drawScenery();
    spots.forEach((s, i) => this.addBuilding(s, i));
    houses.forEach(s => this.addBuilding(s, -1));
    this.addFountain(1700, 1060);
    this.addPeople();

    // Player (+ the pet you bought, once you have one), starting at the door you just left.
    const door = this.doors[progress.building];
    const start = door ? { x: door.x + 90, y: door.y + 120 } : START;
    const shadow = this.add.ellipse(0, 0, 110, 36, 0x000000, 0.22);
    this.body = this.add.image(0, 0, 'person').setOrigin(0.5, 1).setScale(0.5);
    this.player = this.add.container(start.x, start.y, [shadow, this.body]);
    if (progress.petOwned) this.pet = this.add.image(start.x - 90, start.y + 10, progress.pet).setOrigin(0.5, 1).setScale(0.3);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.centerOn(start.x, start.y);

    this.buildHud();
    this.setupInput();
  }

  // ---------- drawing ----------

  private drawGround(): void {
    const g = this.add.graphics().setDepth(-100);
    g.fillStyle(0x7fd69a).fillRect(0, 0, WORLD_W, WORLD_H);
    // back lawn + hedge behind the top row
    g.fillStyle(0x5fbf80).fillRect(0, 0, WORLD_W, TOP_BASE - 300);
    // street: sidewalks, asphalt, dashes
    const streetTop = TOP_BASE, streetBottom = BOTTOM_BASE - BODY_H;
    g.fillStyle(0xd7dbe3).fillRect(0, streetTop, WORLD_W, streetBottom - streetTop);
    g.fillStyle(0x6b7280).fillRect(0, streetTop + 110, WORLD_W, streetBottom - streetTop - 220);
    g.fillStyle(0xb7bdc9).fillRect(0, streetTop + 100, WORLD_W, 10).fillRect(0, streetBottom - 110, WORLD_W, 10);
    g.fillStyle(0xffffff, 0.8);
    const midY = (streetTop + streetBottom) / 2;
    for (let x = 60; x < WORLD_W; x += 280) g.fillRect(x, midY - 8, 150, 16);
    // paths through the gaps between the bottom buildings, and the lawn below
    g.fillStyle(0xd7dbe3).fillRect(0, BOTTOM_BASE, WORLD_W, 90);
    g.fillStyle(0x7fd69a).fillRect(0, BOTTOM_BASE + 90, WORLD_W, WORLD_H - BOTTOM_BASE - 90);
    g.fillStyle(0x6bc788).fillRect(0, BOTTOM_BASE + 90, WORLD_W, 14);
    // pavement strip in front of the top row's gaps
    g.fillStyle(0xcfd4dd).fillRect(0, streetBottom - 4, WORLD_W, 4);
  }

  private drawScenery(): void {
    const rng = new Phaser.Math.RandomDataGenerator(['city-hub']);
    // tree line behind the top row
    for (let x = 80; x < WORLD_W; x += rng.between(150, 230)) {
      const y = rng.between(420, TOP_BASE - 120);
      this.add.image(x, y, 'tree').setOrigin(0.5, 1).setScale(rng.realInRange(0.55, 0.8)).setDepth(y);
    }
    // trees + flowers on the southern lawn
    for (let x = 140; x < WORLD_W; x += rng.between(260, 420)) {
      const y = rng.between(BOTTOM_BASE + 260, MAX_Y + 100);
      if ([...spots, ...houses].some(b => b.base === BOTTOM_BASE && Math.abs(b.x - x) < 300)) continue; // keep doors visible
      this.add.image(x, y, 'tree').setOrigin(0.5, 1).setScale(rng.realInRange(0.5, 0.75)).setDepth(y);
      this.walls.push({ x0: x - 28, y0: y - 30, x1: x + 28, y1: y });
    }
    for (let i = 0; i < 40; i++) {
      const x = rng.between(40, WORLD_W - 40), y = rng.between(BOTTOM_BASE + 130, WORLD_H - 40);
      this.add.image(x, y, 'grass-tuft').setOrigin(0.5, 1).setScale(0.35).setDepth(-50);
    }
    // street lamps on the sidewalks
    for (let x = 900; x < WORLD_W; x += 800) this.addLamp(x, TOP_BASE + 90);
    for (let x = 500; x < WORLD_W; x += 800) this.addLamp(x, BOTTOM_BASE - BODY_H - 20);
  }

  private addLamp(x: number, y: number): void {
    const g = this.add.graphics({ x, y }).setDepth(y);
    g.lineStyle(8, INK).fillStyle(0x4a5060).fillRect(-8, -210, 16, 210).strokeRect(-8, -210, 16, 210);
    g.fillStyle(0xffe27a).fillCircle(0, -225, 30).lineStyle(8, INK).strokeCircle(0, -225, 30);
    this.walls.push({ x0: x - 14, y0: y - 14, x1: x + 14, y1: y });
  }

  private addFountain(x: number, y: number): void {
    const g = this.add.graphics({ x, y }).setDepth(y);
    g.lineStyle(8, INK);
    g.fillStyle(0xb7bdc9).fillEllipse(0, 0, 330, 150).strokeEllipse(0, 0, 330, 150);
    g.fillStyle(0x6ec6ff).fillEllipse(0, -8, 270, 110).strokeEllipse(0, -8, 270, 110);
    g.fillStyle(0xb7bdc9).fillRect(-22, -120, 44, 112).strokeRect(-22, -120, 44, 112);
    g.fillStyle(0xcfd4dd).fillEllipse(0, -120, 130, 46).strokeEllipse(0, -120, 130, 46);
    g.fillStyle(0x9fdcff).fillEllipse(0, -124, 100, 30);
    // droplets
    for (let i = 0; i < 6; i++) {
      const d = this.add.circle(x, y - 130, 8, 0x9fdcff).setDepth(y + 1).setStrokeStyle(3, 0x3fa7ff);
      const dx = (i - 2.5) * 22;
      this.tweens.add({ targets: d, x: x + dx, y: y - 40, duration: 900, delay: i * 150, repeat: -1, ease: 'Quad.in', onRepeat: () => { d.setPosition(x, y - 130); } });
    }
    this.walls.push({ x0: x - 150, y0: y - 50, x1: x + 150, y1: y + 40 });
  }

  private addBuilding(s: Spot, index: number): void {
    const stage = index >= 0 ? currentJourney().stages[index] : undefined;
    const c = this.add.container(s.x, s.base).setDepth(s.base);
    const g = this.add.graphics();
    const hw = s.w / 2;
    g.lineStyle(8, INK);
    // front wall
    g.fillStyle(s.wall).fillRect(-hw, -WALL_H, s.w, WALL_H).strokeRect(-hw, -WALL_H, s.w, WALL_H);
    // roof
    if (s.gable) {
      g.fillStyle(s.roof).fillTriangle(-hw - 24, -WALL_H, hw + 24, -WALL_H, 0, -WALL_H - ROOF_D * 1.7);
      g.lineStyle(8, INK).strokeTriangle(-hw - 24, -WALL_H, hw + 24, -WALL_H, 0, -WALL_H - ROOF_D * 1.7);
    } else {
      g.fillStyle(s.roof).fillPoints([new Phaser.Math.Vector2(-hw - 20, -WALL_H), new Phaser.Math.Vector2(hw + 20, -WALL_H), new Phaser.Math.Vector2(hw - 40, -BODY_H), new Phaser.Math.Vector2(-hw + 40, -BODY_H)], true);
      g.lineStyle(8, INK).strokePoints([new Phaser.Math.Vector2(-hw - 20, -WALL_H), new Phaser.Math.Vector2(hw + 20, -WALL_H), new Phaser.Math.Vector2(hw - 40, -BODY_H), new Phaser.Math.Vector2(-hw + 40, -BODY_H)], true);
    }
    // windows
    const win = (cx: number, cy: number): void => {
      g.fillStyle(0xbfe8ff).fillRect(cx - 45, cy - 45, 90, 90).lineStyle(6, INK).strokeRect(cx - 45, cy - 45, 90, 90);
      g.lineBetween(cx, cy - 45, cx, cy + 45).lineBetween(cx - 45, cy, cx + 45, cy);
    };
    win(-hw + 85, -150); win(hw - 85, -150);
    // door
    g.fillStyle(0xa0693a).fillRoundedRect(-55, -230, 110, 230, { tl: 40, tr: 40, bl: 0, br: 0 });
    g.lineStyle(8, INK).strokeRoundedRect(-55, -230, 110, 230, { tl: 40, tr: 40, bl: 0, br: 0 });
    g.fillStyle(0xffd23f).fillCircle(30, -105, 8);
    c.add(g);

    if (stage) {
      // sign with the stage's icon and name
      const sign = this.add.graphics();
      sign.fillStyle(0xffffff).fillRoundedRect(-hw + 50, -WALL_H + 36, s.w - 100, 88, 24).lineStyle(8, INK).strokeRoundedRect(-hw + 50, -WALL_H + 36, s.w - 100, 88, 24);
      const icon = this.add.image(-hw + 105, -WALL_H + 80, stage.icon);
      icon.setScale(66 / Math.max(icon.width, icon.height));
      const label = text(this, 28, -WALL_H + 80, t(stage.label), 46);
      c.add([sign, icon, label]);
    }
    if (stage) this.doors.push({ x: s.x, y: s.base });
    this.walls.push({ x0: s.x - hw - 20, y0: s.base - BODY_H, x1: s.x + hw + 20, y1: s.base });
  }

  private addPeople(): void {
    const rng = new Phaser.Math.RandomDataGenerator(['people']);
    const lanes = [TOP_BASE + 60, BOTTOM_BASE - BODY_H - 50];
    for (let i = 0; i < 8; i++) {
      const y = lanes[i % 2];
      const x = 400 + i * 380;
      const p = this.add.image(x, y, i % 2 ? 'customer' : 'worker').setOrigin(0.5, 1).setScale(0.42).setDepth(y);
      this.tweens.add({ targets: p, x: x + rng.between(200, 360), duration: rng.between(3500, 5500), yoyo: true, repeat: -1, ease: 'Sine.inOut', onYoyo: () => p.toggleFlipX(), onRepeat: () => p.toggleFlipX() });
    }
  }

  // ---------- HUD + input ----------

  private buildHud(): void {
    const fixed = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T): T => o.setScrollFactor(0).setDepth(5000);
    fixed(this.add.circle(JOY.x, JOY.y, JOY.r + 20, 0xffffff, 0.2).setStrokeStyle(8, 0xffffff, 0.55));
    this.joyKnob = fixed(this.add.circle(JOY.x, JOY.y, 64, 0xffffff, 0.6)).setDepth(5001);
    fixed(this.add.image(W - 330, 90, 'coin').setScale(0.7));
    fixed(text(this, W - 200, 90, String(progress.coins), 80));
    const hint = fixed(text(this, W / 2, 140, t('city.hint'), 90).setColor('#ffffff').setStroke('#5a3a22', 14));
    this.tweens.add({ targets: hint, alpha: 0, delay: 4500, duration: 600 });

    fixed(this.add.image(W - 590, 90, 'star').setScale(0.55));
    fixed(text(this, W - 480, 90, String(progress.stars), 80));
    // leave the town
    const home = fixed(this.add.container(100, 100, [
      this.add.circle(0, 0, 64, 0xffffff, 0.75).setStrokeStyle(8, INK),
      this.add.text(0, 4, '⌂', { fontFamily: 'system-ui, sans-serif', fontSize: '80px', color: '#5a3a22' }).setOrigin(0.5),
    ]).setSize(160, 160).setInteractive());
    home.on('pointerdown', () => { sfx.pop(); this.leaveTown(); });
  }

  private setupInput(): void {
    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.joyId === null && p.x < 640 && p.y > 900) { this.joyId = p.id; this.onJoy(p); }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onJoy(p));
    const up = (p: Phaser.Input.Pointer): void => {
      if (p.id !== this.joyId) return;
      this.joyId = null; this.joyV.set(0, 0); this.joyKnob.setPosition(JOY.x, JOY.y);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  }

  private onJoy(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyId) return;
    const v = new Phaser.Math.Vector2(p.x - JOY.x, p.y - JOY.y);
    const len = Math.min(v.length(), JOY.r);
    if (len > 0) v.setLength(len);
    this.joyKnob.setPosition(JOY.x + v.x, JOY.y + v.y);
    this.joyV.set(len < 24 ? 0 : v.x / JOY.r, len < 24 ? 0 : v.y / JOY.r);
  }

  // ---------- per-frame ----------

  private blocked(x: number, y: number): boolean {
    if (y < MIN_Y || y > MAX_Y || x < 90 || x > WORLD_W - 90) return true;
    return this.walls.some(w => x > w.x0 - 30 && x < w.x1 + 30 && y > w.y0 && y < w.y1);
  }

  update(_t: number, delta: number): void {
    if (this.entering || !this.player) return;
    const dt = Math.min(delta, 50) / 1000;

    let vx = this.joyV.x, vy = this.joyV.y;
    if (this.keys.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.keys.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.keys.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.keys.down.isDown || this.wasd.S.isDown) vy += 1;
    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 1) v.normalize();

    const moving = v.lengthSq() > 0.01;
    if (moving) {
      // Slide along walls: try each axis on its own.
      const nx = this.player.x + v.x * SPEED * dt;
      if (!this.blocked(nx, this.player.y)) this.player.x = nx;
      const ny = this.player.y + v.y * SPEED * dt;
      if (!this.blocked(this.player.x, ny)) this.player.y = ny;
      if (Math.abs(v.x) > 0.1) this.body.setFlipX(v.x < 0);
      this.body.setAngle(Math.sin(this.time.now / 70) * 4);
    } else {
      this.body.setAngle(0);
    }
    this.player.setDepth(this.player.y);

    if (this.pet) {
      const side = this.body.flipX ? 1 : -1;
      const tx = this.player.x + side * 100, ty = this.player.y + 8;
      this.pet.x += (tx - this.pet.x) * 0.08;
      const moved = Math.abs(tx - this.pet.x) > 6 || Math.abs(ty - this.pet.y) > 6;
      this.pet.y += (ty - this.pet.y) * 0.08;
      this.pet.y -= moved ? Math.abs(Math.sin(this.time.now / 90)) * 8 : 0;
      this.pet.setFlipX(this.pet.x > this.player.x).setDepth(this.pet.y);
    }

    this.checkDoors();
  }

  private checkDoors(): void {
    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      if (Math.abs(this.player.x - d.x) <= 70 && this.player.y <= d.y + 45 && this.player.y >= d.y - 5) { this.enter(i); return; }
    }
  }

  private enter(i: number): void {
    this.entering = true;
    progress.building = i;
    const stage = currentJourney().stages[i];
    const d = this.doors[i];
    sfx.whoosh();
    this.tweens.add({ targets: this.player, x: d.x, y: d.y - 20, scale: 0.7, alpha: 0, duration: 450 });
    if (this.pet) this.tweens.add({ targets: this.pet, x: d.x, y: d.y, alpha: 0, duration: 450 });
    this.cameras.main.fadeOut(500, 255, 232, 163);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(stage.scene, stage.data));
  }

  private leaveTown(): void {
    if (this.entering) return;
    this.entering = true;
    this.cameras.main.fadeOut(300, 255, 232, 163);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameSelect'));
  }
}
