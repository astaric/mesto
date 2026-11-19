import Phaser from 'phaser';
import { W, H } from '../core/layout';
import { currentJourney, progress, startSeries, type Stage } from '../core/stages';
import { sfx } from '../core/sfx';
import { text } from '../core/touch';
import { t } from '../i18n';

// A 3/4 ("45 degrees") view of the town: the camera looks at it from the south, so buildings show
// their front wall and a bit of roof, and things further down the screen (bigger y) draw in front.
// Every object's depth is its ground y, so the player walks in front of and behind things.
const WORLD_W = 6300;
const WORLD_H = 2300;
const NORTH = 2400; // the world also reaches this far above y = 0: the forest
const TOWN_E = 3400; // east of this the street turns into a dirt country road
const FARM_X = 4450; // where the country road reaches the farm yard
const SPEED = 560;
const JOY = { x: 300, y: 1250, r: 140 };
const INK = 0x5a3a22;
const MAX_VIEW_W = 3400; // the widest view we stretch to on very wide screens

const WALL_H = 360;
const ROOF_D = 100;
const BODY_H = WALL_H + ROOF_D; // how far up the screen a building's silhouette reaches
const TOP_BASE = 760; // ground y of the top row's front wall (the player can't walk north of this)
const BOTTOM_BASE = 1800; // ground y of the bottom row's front wall
const MIN_Y = TOP_BASE + 10;
const MAX_Y = 2150;
const START = { x: 260, y: 1050 };
const ROAD_Y = 1050; // centre line of the street and the country road
const PATH_X = 1690; // the path north, and the forest gate at its end
const FOREST_GATE_Y = -1700;

interface Spot { id: string; x: number; base: number; w: number; wall: number; roof: number; gable?: boolean; kind?: 'gate' }
/** One enterable building per stage of the journey, matched to it by stage `id`. */
const spots: Spot[] = [
  { id: 'checkout', x: 520, base: TOP_BASE, w: 460, wall: 0xffd9a8, roof: 0xff6b6b },          // checkout
  { id: 'pets', x: 1300, base: TOP_BASE, w: 460, wall: 0xffc6e0, roof: 0xb86bff },         // animals
  { id: 'sweets', x: 2080, base: TOP_BASE, w: 460, wall: 0xfff0a8, roof: 0xff8fb8 },         // sweets
  { id: 'fish', x: 2860, base: TOP_BASE, w: 460, wall: 0xc9ecff, roof: 0x3fa7ff },         // fish
  { id: 'octopus', x: 2600, base: BOTTOM_BASE, w: 520, wall: 0xbfe3ff, roof: 0x2e6fd1, gable: true }, // octopus house
  { id: 'cut', x: 1300, base: BOTTOM_BASE, w: 460, wall: 0xe4ffd0, roof: 0x4fbf6a },      // kitchen / cutting
  { id: 'pizza', x: 1950, base: BOTTOM_BASE, w: 460, wall: 0xfff1d6, roof: 0xe8453c },      // pizzeria
  { id: 'forest', x: PATH_X, base: FOREST_GATE_Y, w: 0, wall: 0, roof: 0, kind: 'gate' },    // forest, at the end of the path north
  { id: 'eggs', x: 4950, base: TOP_BASE, w: 560, wall: 0xe0463c, roof: 0x7a4a2a, gable: true }, // farm: barn (eggs)
  { id: 'farm', x: 5750, base: TOP_BASE, w: 460, wall: 0xfff0c0, roof: 0xe0903a, gable: true }, // farm: hen house (farm shooter)
  { id: 'food', x: 380, base: BOTTOM_BASE, w: 440, wall: 0xdfd3ff, roof: 0x7a6bd6 },       // funny food (monster) house
];

type Rect = { x0: number; y0: number; x1: number; y1: number };

// The path north: it leaves the street through the gap between the 2nd and 3rd top buildings and climbs
// through the trees to a clearing with the forest gate. North of the street the player may only walk here.
const PATH: Rect = { x0: 1580, x1: 1800, y0: -1150, y1: MIN_Y };
const CLEARING: Rect = { x0: 900, x1: 2500, y0: -1730, y1: -1100 };
const northZones: Rect[] = [PATH, CLEARING];

/** Top-down-ish town: walk with the joystick, step into a building's door to play its game. */
export class CityHub extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Image;
  private pet?: Phaser.GameObjects.Image;
  private walls: Rect[] = [];
  private doors: { x: number; y: number; stage: Stage }[] = [];
  private joyId: number | null = null;
  private joyV = new Phaser.Math.Vector2();
  private joyKnob!: Phaser.GameObjects.Arc;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private entering = false;
  private rightHud: { o: Phaser.GameObjects.GameObject & { x: number }; fromRight: number }[] = [];
  private hint!: Phaser.GameObjects.Text;

  constructor() { super('CityHub'); }

  create(): void {
    this.walls = []; this.doors = []; this.joyId = null; this.joyV.set(0, 0);
    this.entering = false;

    this.cameras.main.setBackgroundColor(0x7fd69a);
    this.cameras.main.fadeIn(300, 255, 232, 163);
    this.cameras.main.setBounds(0, -NORTH, WORLD_W, WORLD_H + NORTH);

    this.drawGround();
    this.drawScenery();
    spots.forEach(s => this.addBuilding(s));
    this.addFountain(1700, 1060);
    this.addPeople();
    this.addFarmAnimals();

    // Player (+ the pet you bought, once you have one), starting at the door you just left.
    const door = this.doors.find(d => d.stage.id === progress.building);
    const start = door ? { x: door.x + 90, y: door.y + 120 } : START;
    const shadow = this.add.ellipse(0, 0, 110, 36, 0x000000, 0.22);
    this.body = this.add.image(0, 0, 'person').setOrigin(0.5, 1).setScale(0.5);
    this.player = this.add.container(start.x, start.y, [shadow, this.body]);
    if (progress.petOwned) this.pet = this.add.image(start.x - 90, start.y + 10, progress.pet).setOrigin(0.5, 1).setScale(0.3);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.centerOn(start.x, start.y);

    this.buildHud();
    this.setupInput();

    // On a screen wider than 4:3 show more of the town instead of empty bars, so the joystick
    // sits at the real left edge. Other scenes are laid out for W x H, so restore it on exit.
    this.scale.on('resize', this.fitWidth, this);
    this.fitWidth();
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fitWidth, this);
      this.scale.setGameSize(W, H);
    });
  }

  /** Make the canvas as wide as the screen's aspect allows (never narrower than W) and re-place the HUD. */
  private fitWidth(): void {
    const p = this.scale.parentSize;
    if (p.height > 0) {
      const w = Phaser.Math.Clamp(Math.round(H * p.width / p.height), W, MAX_VIEW_W);
      if (w !== this.scale.width) { this.scale.setGameSize(w, H); return; } // re-enters through 'resize'
    }
    const w = this.scale.width;
    this.rightHud.forEach(r => { r.o.x = w - r.fromRight; });
    this.hint.x = w / 2;
  }

  // ---------- drawing ----------

  private drawGround(): void {
    // Far below every object's depth (= its ground y, which is negative up in the forest).
    const g = this.add.graphics().setDepth(-10000);
    g.fillStyle(0x7fd69a).fillRect(0, -NORTH, WORLD_W, WORLD_H + NORTH);
    // back lawn behind the top row, and darker forest floor in the north
    g.fillStyle(0x5fbf80).fillRect(0, -NORTH, WORLD_W, NORTH + TOP_BASE - 300);
    g.fillStyle(0x4aa564).fillRect(500, -NORTH, 2400, NORTH + TOP_BASE - 300);
    // street: sidewalks, asphalt, dashes
    const streetTop = TOP_BASE, streetBottom = BOTTOM_BASE - BODY_H;
    g.fillStyle(0xd7dbe3).fillRect(0, streetTop, TOWN_E, streetBottom - streetTop);
    g.fillStyle(0x6b7280).fillRect(0, streetTop + 110, TOWN_E, streetBottom - streetTop - 220);
    g.fillStyle(0xb7bdc9).fillRect(0, streetTop + 100, TOWN_E, 10).fillRect(0, streetBottom - 110, TOWN_E, 10);
    g.fillStyle(0xffffff, 0.8);
    for (let x = 60; x < TOWN_E; x += 280) g.fillRect(x, ROAD_Y - 8, 150, 16);
    // paths through the gaps between the bottom buildings, and the lawn below
    g.fillStyle(0xd7dbe3).fillRect(0, BOTTOM_BASE, TOWN_E, 90);
    g.fillStyle(0x6bc788).fillRect(0, BOTTOM_BASE + 90, WORLD_W, 14);
    // pavement strip in front of the top row's gaps
    g.fillStyle(0xcfd4dd).fillRect(0, streetBottom - 4, TOWN_E, 4);

    this.drawForestPath(g);
    this.drawCountry(g);
  }

  /** The dirt path from the street up to the forest clearing. */
  private drawForestPath(g: Phaser.GameObjects.Graphics): void {
    const cx = PATH_X;
    g.fillStyle(0x73bf86).fillRoundedRect(CLEARING.x0, CLEARING.y0 - 40, CLEARING.x1 - CLEARING.x0, CLEARING.y1 - CLEARING.y0 + 80, 90);
    g.fillStyle(0xa98450).fillRect(cx - 140, CLEARING.y0, 280, TOP_BASE + 80 - CLEARING.y0);
    g.fillStyle(0xc9a56b).fillRect(cx - 125, CLEARING.y0, 250, TOP_BASE + 80 - CLEARING.y0);
    g.fillStyle(0xb48f58);
    for (let y = TOP_BASE - 60; y > CLEARING.y0; y -= 130) g.fillEllipse(cx + ((y / 130) % 2 ? 50 : -50), y, 60, 22);
  }

  /** The country road east of the town, fields along it, and the farm yard where it ends. */
  private drawCountry(g: Phaser.GameObjects.Graphics): void {
    // dirt road, a bit narrower than the street
    g.fillStyle(0xa98450).fillRect(TOWN_E - 60, ROAD_Y - 130, FARM_X - TOWN_E + 80, 260);
    g.fillStyle(0xcfa96a).fillRect(TOWN_E - 60, ROAD_Y - 118, FARM_X - TOWN_E + 80, 236);
    g.fillStyle(0xb48f58);
    for (let x = TOWN_E + 40; x < FARM_X; x += 210) g.fillEllipse(x, ROAD_Y + ((x / 210) % 2 ? 40 : -40), 70, 22);
    // fields: ploughed rows south of the road, green rows north of it
    for (let y = 1240; y < 1760; y += 64) {
      const i = (y - 1240) / 64;
      g.fillStyle(i % 2 ? 0x9bd36a : 0x8a6a3e).fillRect(TOWN_E + 120, y, FARM_X - TOWN_E - 260, 40);
    }
    for (let y = 770; y < 910; y += 56) g.fillStyle(((y - 770) / 56) % 2 ? 0x6fc47a : 0x8fe08a).fillRect(TOWN_E + 120, y, FARM_X - TOWN_E - 260, 36);
    // the farm yard
    g.fillStyle(0xe2c88c).fillRoundedRect(FARM_X, TOP_BASE, WORLD_W - FARM_X - 40, 1560 - TOP_BASE, 50);
    g.fillStyle(0xd9bb78).fillRoundedRect(FARM_X + 30, TOP_BASE + 30, WORLD_W - FARM_X - 100, 1500 - TOP_BASE, 40);
  }

  private drawScenery(): void {
    const rng = new Phaser.Math.RandomDataGenerator(['city-hub']);
    const tree = (x: number, y: number, key: string, sc: number): void => {
      this.add.image(x, y, key).setOrigin(0.5, 1).setScale(sc).setDepth(y);
    };
    // tree line behind the top row (keeping the path north free)
    for (let x = 80; x < WORLD_W; x += rng.between(150, 230)) {
      const y = rng.between(420, TOP_BASE - 120);
      if (x > PATH.x0 - 100 && x < PATH.x1 + 100) continue;
      tree(x, y, 'tree', rng.realInRange(0.55, 0.8));
    }
    // the forest north of the town: rows of pines, with the path and the clearing kept free
    for (let y = -NORTH + 60; y < 300; y += 110) {
      for (let x = 300 + rng.between(0, 100); x < 3100; x += rng.between(170, 260)) {
        const px = x + rng.between(-40, 40), py = y + rng.between(-30, 30);
        if (px > PATH.x0 - 110 && px < PATH.x1 + 110 && py > CLEARING.y0 - 40) continue;
        if (px > CLEARING.x0 - 60 && px < CLEARING.x1 + 60 && py > CLEARING.y0 - 60 && py < CLEARING.y1 + 80) continue;
        tree(px, py, rng.frac() < 0.75 ? 'forest-pine' : 'tree', rng.realInRange(0.42, 0.62));
      }
    }
    // trees lining the path and the clearing
    for (let y = CLEARING.y1 + 30; y < 300; y += 140) {
      tree(PATH.x0 - 70 + rng.between(-12, 12), y + rng.between(-20, 20), 'forest-pine', rng.realInRange(0.5, 0.62));
      tree(PATH.x1 + 70 + rng.between(-12, 12), y + rng.between(-20, 20), 'forest-pine', rng.realInRange(0.5, 0.62));
    }
    for (let x = CLEARING.x0 - 30; x < CLEARING.x1 + 40; x += 150) {
      if (Math.abs(x - PATH_X) < 380) continue; // leave room for the gate
      tree(x, CLEARING.y0 - 10 + rng.between(-15, 15), 'forest-pine', rng.realInRange(0.6, 0.75));
    }
    for (let y = CLEARING.y0 + 60; y < CLEARING.y1; y += 150) {
      tree(CLEARING.x0 - 40, y, 'forest-pine', 0.6);
      tree(CLEARING.x1 + 40, y, 'forest-pine', 0.6);
    }
    // sparse trees and bushes behind the farm side of the road
    for (let x = TOWN_E + 100; x < WORLD_W; x += rng.between(230, 380)) {
      tree(x, rng.between(160, 700), rng.frac() < 0.5 ? 'tree' : 'forest-pine', rng.realInRange(0.5, 0.75));
    }
    // trees + flowers on the southern lawn
    for (let x = 140; x < WORLD_W; x += rng.between(260, 420)) {
      const y = rng.between(BOTTOM_BASE + 260, MAX_Y + 100);
      if (spots.some(b => b.base === BOTTOM_BASE && Math.abs(b.x - x) < 300)) continue; // keep doors visible
      tree(x, y, 'tree', rng.realInRange(0.5, 0.75));
      this.walls.push({ x0: x - 28, y0: y - 30, x1: x + 28, y1: y });
    }
    for (let i = 0; i < 70; i++) {
      const x = rng.between(40, WORLD_W - 40), y = rng.between(BOTTOM_BASE + 130, WORLD_H - 40);
      this.add.image(x, y, 'grass-tuft').setOrigin(0.5, 1).setScale(0.35).setDepth(-9000);
    }
    // street lamps on the sidewalks (not in front of the path north)
    for (let x = 900; x < TOWN_E; x += 800) if (Math.abs(x - PATH_X) > 200) this.addLamp(x, TOP_BASE + 90);
    for (let x = 500; x < TOWN_E; x += 800) this.addLamp(x, BOTTOM_BASE - BODY_H - 20);
    // fences along the country road and round the farm yard
    for (let x = TOWN_E + 130; x < FARM_X - 100; x += 175) {
      this.add.image(x, ROAD_Y - 150, 'fence').setOrigin(0.5, 1).setScale(0.3).setDepth(ROAD_Y - 150);
      this.add.image(x, ROAD_Y + 280, 'fence').setOrigin(0.5, 1).setScale(0.3).setDepth(ROAD_Y + 280);
    }
    for (let x = FARM_X + 100; x < WORLD_W - 100; x += 175) {
      this.add.image(x, 1560, 'fence').setOrigin(0.5, 1).setScale(0.3).setDepth(1560);
    }
  }

  /** Hens and piglets wandering about the farm yard. */
  private addFarmAnimals(): void {
    const rng = new Phaser.Math.RandomDataGenerator(['farm-animals']);
    const kinds = ['hen', 'pig', 'hen', 'hen', 'pig', 'hen-gold'];
    kinds.forEach((k, i) => {
      const x = FARM_X + 260 + i * 230, y = rng.between(1000, 1420);
      const a = this.add.image(x, y, k).setOrigin(0.5, 1).setScale(k === 'pig' ? 0.34 : 0.3).setDepth(y);
      this.tweens.add({ targets: a, x: x + rng.between(120, 260), duration: rng.between(2500, 4200), yoyo: true, repeat: -1, ease: 'Sine.inOut', onYoyo: () => a.toggleFlipX(), onRepeat: () => a.toggleFlipX() });
    });
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

  /** White sign with the stage's icon and name, `sw` wide, centred at (0, cy) in container `c`. */
  private addSign(c: Phaser.GameObjects.Container, stage: Stage, sw: number, cy: number): void {
    const left = -sw / 2;
    const sign = this.add.graphics();
    sign.fillStyle(0xffffff).fillRoundedRect(left, cy - 44, sw, 88, 24).lineStyle(8, INK).strokeRoundedRect(left, cy - 44, sw, 88, 24);
    const icon = this.add.image(left + 55, cy, stage.icon);
    icon.setScale(66 / Math.max(icon.width, icon.height));
    const label = text(this, 28, cy, t(stage.label), 46);
    label.setScale(Math.min(1, (sw - 130) / label.width)); // long names shrink to fit
    c.add([sign, icon, label]);
  }

  /** The forest gate: a dark opening between two big pines, at the end of the path north. */
  private addGate(s: Spot, stage: Stage): void {
    const c = this.add.container(s.x, s.base).setDepth(s.base);
    const g = this.add.graphics();
    g.fillStyle(0x16382a).fillRoundedRect(-130, -330, 260, 330, { tl: 130, tr: 130, bl: 0, br: 0 });
    g.lineStyle(8, INK).strokeRoundedRect(-130, -330, 260, 330, { tl: 130, tr: 130, bl: 0, br: 0 });
    g.fillStyle(0x0b2018).fillRoundedRect(-80, -270, 160, 270, { tl: 80, tr: 80, bl: 0, br: 0 });
    c.add(g);
    for (const dx of [-290, 290]) {
      c.add(this.add.image(dx, 0, 'forest-pine').setOrigin(0.5, 1).setScale(0.85));
      this.walls.push({ x0: s.x + dx - 35, y0: s.base - 40, x1: s.x + dx + 35, y1: s.base });
    }
    this.addSign(c, stage, 360, -400);
    this.doors.push({ x: s.x, y: s.base, stage });
  }

  private addBuilding(s: Spot): void {
    const stage = currentJourney().stages.find(st => st.id === s.id);
    if (!stage) throw new Error(`no stage '${s.id}' for the building at x=${s.x}`);
    if (s.kind === 'gate') { this.addGate(s, stage); return; }
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

    this.addSign(c, stage, s.w - 100, -WALL_H + 80);
    this.doors.push({ x: s.x, y: s.base, stage });
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
    // right-hand counters keep their distance from the right edge (see fitWidth)
    this.rightHud = [
      { o: fixed(this.add.image(0, 90, 'coin').setScale(0.7)), fromRight: 590 },
      { o: fixed(text(this, 0, 90, String(progress.coins), 80)), fromRight: 460 },
      { o: fixed(this.add.image(0, 90, 'star').setScale(0.55)), fromRight: 850 },
      { o: fixed(text(this, 0, 90, String(progress.stars), 80)), fromRight: 740 },
    ];
    this.hint = fixed(text(this, W / 2, 140, t('city.hint'), 90).setColor('#ffffff').setStroke('#5a3a22', 14));
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 4500, duration: 600 });

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
    if (y > MAX_Y || x < 90 || x > WORLD_W - 90) return true;
    // north of the street only the path and the clearing are open
    if (y < MIN_Y && !northZones.some(z => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) return true;
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
      if (Math.abs(this.player.x - d.x) <= 70 && this.player.y <= d.y + 45 && this.player.y >= d.y - 5) { this.enter(d); return; }
    }
  }

  private enter(d: { x: number; y: number; stage: Stage }): void {
    this.entering = true;
    const stage = d.stage;
    progress.building = stage.id;
    sfx.whoosh();
    this.tweens.add({ targets: this.player, x: d.x, y: d.y - 20, scale: 0.7, alpha: 0, duration: 450 });
    if (this.pet) this.tweens.add({ targets: this.pet, x: d.x, y: d.y, alpha: 0, duration: 450 });
    this.cameras.main.fadeOut(500, 255, 232, 163);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (stage.series) startSeries(stage.series);
      this.scene.start(stage.scene, stage.data);
    });
  }

  private leaveTown(): void {
    if (this.entering) return;
    this.entering = true;
    this.cameras.main.fadeOut(300, 255, 232, 163);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameSelect'));
  }
}
