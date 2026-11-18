import Phaser from 'phaser';
import { H } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { progress } from '../../core/stages';
import { sfx } from '../../core/sfx';
import { text } from '../../core/touch';
import { t } from '../../i18n';

const WORLD_W = 6144;
const GROUND_Y = 1200;
const SPEED = 650;

type Goal = 'metro' | 'farm';

/** Tap to walk through the big scrolling city. goal 'metro' = go down to the shop; 'farm' = walk home to the animals. */
export class CityWalk extends StageScene {
  private goal: Goal = 'metro';
  private player!: Phaser.GameObjects.Container;
  private pet?: Phaser.GameObjects.Image;
  private targetX = 0;
  private goalX = WORLD_W - 500;
  private arrived = false;

  constructor() { super('CityWalk'); }

  init(data: { goal?: Goal }): void {
    this.goal = data?.goal ?? 'metro';
    this.arrived = false;
  }

  create(): void {
    this.backdrop(0xbfe6ff);
    this.cameras.main.setBounds(0, 0, WORLD_W, H);
    this.add.rectangle(0, GROUND_Y, WORLD_W, H - GROUND_Y, 0x6b7280).setOrigin(0);
    this.add.rectangle(0, GROUND_Y, WORLD_W, 30, 0xb7bdc9).setOrigin(0);
    for (let x = 100; x < WORLD_W; x += 300) this.add.rectangle(x, GROUND_Y + 190, 160, 18, 0xffffff, 0.8);

    // Skyline + trees.
    const rng = new Phaser.Math.RandomDataGenerator(['city']);
    for (let x = 250; x < WORLD_W - 700; x += rng.between(330, 520)) {
      const b = this.add.image(x, GROUND_Y, 'building').setOrigin(0.5, 1);
      b.setScale(rng.realInRange(0.8, 1.3)).setTint(rng.pick([0xffffff, 0xffe2e2, 0xe2ffe9, 0xfff3c9]));
      if (rng.frac() < 0.55) this.add.image(x + rng.between(220, 300), GROUND_Y + 10, 'tree').setOrigin(0.5, 1).setScale(rng.realInRange(0.7, 1));
    }

    // Wandering townspeople.
    for (let i = 0; i < 9; i++) {
      const x = 600 + i * 560;
      const p = this.add.image(x, GROUND_Y + 150, i % 2 ? 'customer' : 'worker').setOrigin(0.5, 1).setScale(0.7);
      this.tweens.add({ targets: p, x: x + rng.between(250, 450), duration: rng.between(3000, 5000), yoyo: true, repeat: -1, ease: 'Sine.inOut', onYoyo: () => p.toggleFlipX(), onRepeat: () => p.toggleFlipX() });
    }

    // Goal.
    if (this.goal === 'metro') this.buildMetro(); else this.buildFarm();

    // Player (+ pet when walking home).
    const startX = this.goal === 'metro' ? 250 : 420;
    this.player = this.add.container(startX, GROUND_Y + 190, [this.add.image(0, 0, 'person').setOrigin(0.5, 1).setScale(0.85)]);
    this.player.setDepth(10);
    this.targetX = startX;
    if (this.goal === 'farm') {
      this.pet = this.add.image(startX - 160, GROUND_Y + 190, progress.pet).setOrigin(0.5, 1).setScale(0.5).setDepth(9);
      this.player.alpha = 0;
      this.pet.alpha = 0;
      this.tweens.add({ targets: [this.player, this.pet], alpha: 1, duration: 500 });
    }
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setFollowOffset(0, 0);

    const hint = text(this, 1024, 140, this.goal === 'metro' ? t('city.walk') : t('city.walkHome'), 100).setScrollFactor(0).setDepth(20);
    this.time.delayedCall(4000, () => this.tweens.add({ targets: hint, alpha: 0, duration: 600 }));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.arrived) return;
      this.targetX = Phaser.Math.Clamp(p.worldX, 100, WORLD_W - 100);
      sfx.pop();
    });
  }

  private buildMetro(): void {
    this.add.image(this.goalX, GROUND_Y + 20, 'metro').setOrigin(0.5, 1).setScale(1.3);
    text(this, this.goalX, GROUND_Y - 640, t('city.shop'), 90).setColor('#ffffff').setStroke('#5a3a22', 14);
    const arrow = this.add.text(this.goalX, GROUND_Y - 760, '▼', { fontSize: '120px', color: '#ff5d5d' }).setOrigin(0.5);
    this.tweens.add({ targets: arrow, y: arrow.y + 40, duration: 450, yoyo: true, repeat: -1 });
  }

  private buildFarm(): void {
    this.add.image(300, GROUND_Y + 20, 'metro').setOrigin(0.5, 1).setScale(1.1).setAlpha(0.9);
    const meadowX = this.goalX - 300;
    this.add.rectangle(meadowX, GROUND_Y - 20, 1300, 40, 0x6cd38a).setOrigin(0, 1);
    this.add.rectangle(meadowX, GROUND_Y + 20, 1300, H - GROUND_Y, 0x6cd38a).setOrigin(0, 0).setDepth(1).setAlpha(0.95);
    for (let i = 0; i < 4; i++) this.add.image(meadowX + 120 + i * 330, GROUND_Y + 10, 'fence').setOrigin(0.5, 1).setScale(0.8).setDepth(2);
    text(this, this.goalX + 100, GROUND_Y - 520, t('city.home'), 120).setColor('#ffffff').setStroke('#5a3a22', 14);
  }

  update(_t: number, dt: number): void {
    if (this.arrived) return;
    const dx = this.targetX - this.player.x;
    const step = (SPEED * dt) / 1000;
    const walking = Math.abs(dx) > step;
    if (walking) {
      this.player.x += Math.sign(dx) * step;
      const img = this.player.list[0] as Phaser.GameObjects.Image;
      img.setFlipX(dx < 0);
      img.setAngle(Math.sin(this.time.now / 70) * 4);
    } else {
      (this.player.list[0] as Phaser.GameObjects.Image).setAngle(0);
    }
    if (this.pet) {
      const px = this.player.x - Math.sign(dx || 1) * 170;
      this.pet.x += (px - this.pet.x) * 0.08;
      this.pet.y = GROUND_Y + 190 - (walking ? Math.abs(Math.sin(this.time.now / 90)) * 30 : 0);
      this.pet.setFlipX(this.pet.x > this.player.x ? true : false);
    }
    if (Math.abs(this.player.x - this.goalX) < 120) this.arrive();
  }

  private arrive(): void {
    this.arrived = true;
    this.targetX = this.player.x;
    if (this.goal === 'metro') {
      sfx.whoosh();
      this.tweens.add({ targets: this.player, y: this.player.y + 400, alpha: 0, scale: 0.6, duration: 700, onComplete: () => this.finish(0) });
    } else {
      sfx.boing();
      this.tweens.add({ targets: this.pet, y: this.pet!.y - 120, duration: 250, yoyo: true, repeat: 2 });
      this.time.delayedCall(1100, () => this.finish(0));
    }
  }
}
