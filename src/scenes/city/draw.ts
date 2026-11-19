import Phaser from 'phaser';
import { INK } from '../../core/theme';
import { text } from '../../core/touch';
import type { Stage } from '../../core/stages';
import { t } from '../../i18n';
import {
  BODY_H, BOTTOM_BASE, CLEARING, FARM_X, FOUNTAIN, NORTH, PATH, PATH_X, ROAD_Y, ROOF_D, TOP_BASE, TOWN_E,
  WALL_H, WORLD_H, WORLD_W, MAX_Y, spots, type Rect, type Spot,
} from './town';

export interface Door { x: number; y: number; stage: Stage }

/** Draws the whole town into `scene` (ground, scenery, buildings, people, farm animals) and collects what the scene
 *  needs to play in it: the solid `walls` and one `door` per enterable stage. Everything is drawn once, in the
 *  constructor; the objects only move (people, animals, fountain drops) through tweens. */
export class TownView {
  readonly walls: Rect[] = [];
  readonly doors: Door[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly stages: Stage[]) {
    this.drawGround();
    this.drawScenery();
    spots.forEach(s => this.addBuilding(s));
    this.addFountain(FOUNTAIN.x, FOUNTAIN.y);
    this.addPeople();
    this.addFarmAnimals();
  }

  private drawGround(): void {
    // Far below every object's depth (= its ground y, which is negative up in the forest).
    const g = this.scene.add.graphics().setDepth(-10000);
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
      this.scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(sc).setDepth(y);
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
      this.scene.add.image(x, y, 'grass-tuft').setOrigin(0.5, 1).setScale(0.35).setDepth(-9000);
    }
    // street lamps on the sidewalks (not in front of the path north)
    for (let x = 900; x < TOWN_E; x += 800) if (Math.abs(x - PATH_X) > 200) this.addLamp(x, TOP_BASE + 90);
    for (let x = 500; x < TOWN_E; x += 800) this.addLamp(x, BOTTOM_BASE - BODY_H - 20);
    // fences along the country road and round the farm yard
    for (let x = TOWN_E + 130; x < FARM_X - 100; x += 175) {
      this.scene.add.image(x, ROAD_Y - 150, 'fence').setOrigin(0.5, 1).setScale(0.3).setDepth(ROAD_Y - 150);
      this.scene.add.image(x, ROAD_Y + 280, 'fence').setOrigin(0.5, 1).setScale(0.3).setDepth(ROAD_Y + 280);
    }
    for (let x = FARM_X + 100; x < WORLD_W - 100; x += 175) {
      this.scene.add.image(x, 1560, 'fence').setOrigin(0.5, 1).setScale(0.3).setDepth(1560);
    }
  }

  /** Hens and piglets wandering about the farm yard. */
  private addFarmAnimals(): void {
    const rng = new Phaser.Math.RandomDataGenerator(['farm-animals']);
    const kinds = ['hen', 'pig', 'hen', 'hen', 'pig', 'hen-gold'];
    kinds.forEach((k, i) => {
      const x = FARM_X + 260 + i * 230, y = rng.between(1000, 1420);
      const a = this.scene.add.image(x, y, k).setOrigin(0.5, 1).setScale(k === 'pig' ? 0.34 : 0.3).setDepth(y);
      this.scene.tweens.add({ targets: a, x: x + rng.between(120, 260), duration: rng.between(2500, 4200), yoyo: true, repeat: -1, ease: 'Sine.inOut', onYoyo: () => a.toggleFlipX(), onRepeat: () => a.toggleFlipX() });
    });
  }

  private addLamp(x: number, y: number): void {
    const g = this.scene.add.graphics({ x, y }).setDepth(y);
    g.lineStyle(8, INK).fillStyle(0x4a5060).fillRect(-8, -210, 16, 210).strokeRect(-8, -210, 16, 210);
    g.fillStyle(0xffe27a).fillCircle(0, -225, 30).lineStyle(8, INK).strokeCircle(0, -225, 30);
    this.walls.push({ x0: x - 14, y0: y - 14, x1: x + 14, y1: y });
  }

  private addFountain(x: number, y: number): void {
    const g = this.scene.add.graphics({ x, y }).setDepth(y);
    g.lineStyle(8, INK);
    g.fillStyle(0xb7bdc9).fillEllipse(0, 0, 330, 150).strokeEllipse(0, 0, 330, 150);
    g.fillStyle(0x6ec6ff).fillEllipse(0, -8, 270, 110).strokeEllipse(0, -8, 270, 110);
    g.fillStyle(0xb7bdc9).fillRect(-22, -120, 44, 112).strokeRect(-22, -120, 44, 112);
    g.fillStyle(0xcfd4dd).fillEllipse(0, -120, 130, 46).strokeEllipse(0, -120, 130, 46);
    g.fillStyle(0x9fdcff).fillEllipse(0, -124, 100, 30);
    // droplets
    for (let i = 0; i < 6; i++) {
      const d = this.scene.add.circle(x, y - 130, 8, 0x9fdcff).setDepth(y + 1).setStrokeStyle(3, 0x3fa7ff);
      const dx = (i - 2.5) * 22;
      this.scene.tweens.add({ targets: d, x: x + dx, y: y - 40, duration: 900, delay: i * 150, repeat: -1, ease: 'Quad.in', onRepeat: () => { d.setPosition(x, y - 130); } });
    }
    this.walls.push({ x0: x - 150, y0: y - 50, x1: x + 150, y1: y + 40 });
  }

  /** White sign with the stage's icon and name, `sw` wide, centred at (0, cy) in container `c`. */
  private addSign(c: Phaser.GameObjects.Container, stage: Stage, sw: number, cy: number): void {
    const left = -sw / 2;
    const sign = this.scene.add.graphics();
    sign.fillStyle(0xffffff).fillRoundedRect(left, cy - 44, sw, 88, 24).lineStyle(8, INK).strokeRoundedRect(left, cy - 44, sw, 88, 24);
    const icon = this.scene.add.image(left + 55, cy, stage.icon);
    icon.setScale(66 / Math.max(icon.width, icon.height));
    const label = text(this.scene, 28, cy, t(stage.label), 46);
    label.setScale(Math.min(1, (sw - 130) / label.width)); // long names shrink to fit
    c.add([sign, icon, label]);
  }

  /** The forest gate: a dark opening between two big pines, at the end of the path north. */
  private addGate(s: Spot, stage: Stage): void {
    const c = this.scene.add.container(s.x, s.base).setDepth(s.base);
    const g = this.scene.add.graphics();
    g.fillStyle(0x16382a).fillRoundedRect(-130, -330, 260, 330, { tl: 130, tr: 130, bl: 0, br: 0 });
    g.lineStyle(8, INK).strokeRoundedRect(-130, -330, 260, 330, { tl: 130, tr: 130, bl: 0, br: 0 });
    g.fillStyle(0x0b2018).fillRoundedRect(-80, -270, 160, 270, { tl: 80, tr: 80, bl: 0, br: 0 });
    c.add(g);
    for (const dx of [-290, 290]) {
      c.add(this.scene.add.image(dx, 0, 'forest-pine').setOrigin(0.5, 1).setScale(0.85));
      this.walls.push({ x0: s.x + dx - 35, y0: s.base - 40, x1: s.x + dx + 35, y1: s.base });
    }
    this.addSign(c, stage, 360, -400);
    this.doors.push({ x: s.x, y: s.base, stage });
  }

  private addBuilding(s: Spot): void {
    const stage = this.stages.find(st => st.id === s.id);
    if (!stage) throw new Error(`no stage '${s.id}' for the building at x=${s.x}`);
    if (s.kind === 'gate') { this.addGate(s, stage); return; }
    const c = this.scene.add.container(s.x, s.base).setDepth(s.base);
    const g = this.scene.add.graphics();
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
      const p = this.scene.add.image(x, y, i % 2 ? 'customer' : 'worker').setOrigin(0.5, 1).setScale(0.42).setDepth(y);
      this.scene.tweens.add({ targets: p, x: x + rng.between(200, 360), duration: rng.between(3500, 5500), yoyo: true, repeat: -1, ease: 'Sine.inOut', onYoyo: () => p.toggleFlipX(), onRepeat: () => p.toggleFlipX() });
    }
  }
}
