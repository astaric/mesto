import Phaser from 'phaser';
import { W, H } from '../core/layout';
import { currentJourney, enterStage, progress, totalStars } from '../core/stages';
import { profile } from '../core/profile';
import { sfx } from '../core/sfx';
import { text } from '../core/touch';
import { GameScene } from '../core/GameScene';
import { Joystick } from '../core/Joystick';
import { circleButton, outlined } from '../core/ui';
import { t } from '../i18n';
import { NORTH, START, WORLD_H, WORLD_W, isBlocked, type Rect } from './city/town';
import { TownView, type Door } from './city/draw';

const SPEED = 560;
const JOY = { x: 300, y: 1250, r: 140 };
const MAX_VIEW_W = 3400; // the widest view we stretch to on very wide screens

/** Top-down-ish town: walk with the joystick, step into a building's door to play its game. */
export class CityHub extends GameScene {
  private player!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Image;
  private pet?: Phaser.GameObjects.Image;
  private walls: Rect[] = [];
  private doors: Door[] = [];
  private joy!: Joystick;
  private entering = false;
  private rightHud: { o: Phaser.GameObjects.GameObject & { x: number }; fromRight: number }[] = [];
  private hint!: Phaser.GameObjects.Text;

  constructor() { super('CityHub'); }

  create(): void {
    this.entering = false;

    this.fadeInScene(0x7fd69a);
    this.cameras.main.setBounds(0, -NORTH, WORLD_W, WORLD_H + NORTH);

    const town = new TownView(this, currentJourney().stages);
    this.walls = town.walls;
    this.doors = town.doors;

    // Player (+ the pet you bought, once you have one), starting at the door you just left.
    const door = this.doors.find(d => d.stage.id === progress.building);
    const start = door ? { x: door.x + 90, y: door.y + 120 } : START;
    const shadow = this.add.ellipse(0, 0, 110, 36, 0x000000, 0.22);
    this.body = this.add.image(0, 0, 'person').setOrigin(0.5, 1).setScale(0.5);
    this.player = this.add.container(start.x, start.y, [shadow, this.body]);
    if (profile.petOwned) this.pet = this.add.image(start.x - 90, start.y + 10, profile.pet).setOrigin(0.5, 1).setScale(profile.pet === 'hound' ? 0.4 : 0.3);

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

  // ---------- HUD + input ----------

  private buildHud(): void {
    const fixed = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T): T => o.setScrollFactor(0).setDepth(5000);
    // right-hand counters keep their distance from the right edge (see fitWidth)
    this.rightHud = [
      { o: fixed(this.add.image(0, 90, 'coin').setScale(0.7)), fromRight: 590 },
      { o: fixed(outlined(text(this, 0, 90, String(profile.coins), 80))), fromRight: 460 },
      { o: fixed(this.add.image(0, 90, 'star').setScale(0.55)), fromRight: 850 },
      { o: fixed(outlined(text(this, 0, 90, String(totalStars()), 80))), fromRight: 740 },
    ];
    this.hint = fixed(outlined(text(this, W / 2, 140, t('city.hint'), 90), '#ffffff', 14));
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 4500, duration: 600 });

    // leave the town
    fixed(circleButton(this, '⌂', () => this.leaveTown(), { fontSize: 80, dy: 4 }));
  }

  private setupInput(): void {
    this.joy = new Joystick(this, { ...JOY, zone: { maxX: 640, minY: 900 }, depth: 5000 });
  }

  // ---------- per-frame ----------

  update(_t: number, delta: number): void {
    if (this.entering || !this.player) return;
    const dt = Math.min(delta, 50) / 1000;

    const v = this.joy.read();

    const moving = v.lengthSq() > 0.01;
    if (moving) {
      // Slide along walls: try each axis on its own.
      const nx = this.player.x + v.x * SPEED * dt;
      if (!isBlocked(this.walls, nx, this.player.y)) this.player.x = nx;
      const ny = this.player.y + v.y * SPEED * dt;
      if (!isBlocked(this.walls, this.player.x, ny)) this.player.y = ny;
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

  private enter(d: Door): void {
    this.entering = true;
    const stage = d.stage;
    const target = enterStage(stage);
    sfx.whoosh();
    this.tweens.add({ targets: this.player, x: d.x, y: d.y - 20, scale: 0.7, alpha: 0, duration: 450 });
    if (this.pet) this.tweens.add({ targets: this.pet, x: d.x, y: d.y, alpha: 0, duration: 450 });
    this.fadeToScene(target.scene, target.data, 500);
  }

  private leaveTown(): void {
    if (this.entering) return;
    this.entering = true;
    this.fadeToScene('Title', undefined, 300);
  }
}
