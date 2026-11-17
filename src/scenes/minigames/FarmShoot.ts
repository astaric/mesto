import Phaser from 'phaser';
import { W, H } from '../../main';
import { StageScene } from '../../core/MiniGame';
import { text } from '../../core/touch';
import { sfx } from '../../core/sfx';
import { progress } from '../../core/stages';

interface Data { animals: ('hen' | 'pig')[]; goal: number; speed: number; gold?: boolean }

type Animal = Phaser.GameObjects.Image & { kind: 'hen' | 'pig' | 'gold'; alive: boolean };

// Three lanes on the meadow: [y, scale]. Back lanes are smaller.
const LANES: [number, number][] = [[880, 0.8], [1050, 1], [1230, 1.25]];
const HIT_R = 170;

export class FarmShoot extends StageScene {
  private cfg!: Data;
  private hits = 0;
  private done = false;
  private animals: Animal[] = [];
  constructor() { super('FarmShoot'); }

  init(d: Data): void { this.cfg = d; }

  create(): void {
    this.hits = 0; this.done = false; this.animals = [];
    this.backdrop(0xbfe6ff);
    this.add.rectangle(0, 760, W, H - 760, 0x6cd38a).setOrigin(0);
    for (let i = 0; i < 5; i++) this.add.image(150 + i * 440, 800, 'fence').setOrigin(0.5, 1).setScale(0.9);
    this.add.image(250, 780, 'tree').setOrigin(0.5, 1).setScale(1.2);
    this.add.image(W - 250, 780, 'tree').setOrigin(0.5, 1).setScale(1.2);

    const title = text(this, W / 2, 110, 'Ustreli jih!', 90);
    const score = text(this, W / 2, 220, `0 / ${this.cfg.goal}`, 80);
    this.tweens.add({ targets: title, alpha: 0.4, delay: 2500, duration: 600 });

    const rifle = this.add.image(W / 2, H - 20, 'rifle').setOrigin(0.5, 0.95).setDepth(20);

    this.time.addEvent({ delay: 900 / this.cfg.speed, loop: true, callback: () => this.spawn() });
    this.spawn();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.done) return;
      // aim and recoil
      const ang = Phaser.Math.Angle.Between(rifle.x, rifle.y, p.x, p.y) + Math.PI / 2;
      rifle.setRotation(Phaser.Math.Clamp(ang, -1.2, 1.2));
      this.tweens.add({ targets: rifle, scaleY: 0.92, duration: 60, yoyo: true });
      const flash = this.add.circle(p.x, p.y, 40, 0xfff3a0).setDepth(25);
      this.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 150, onComplete: () => flash.destroy() });
      const ch = this.add.image(p.x, p.y, 'crosshair').setScale(0.6).setDepth(24);
      this.tweens.add({ targets: ch, alpha: 0, scale: 0.9, duration: 350, onComplete: () => ch.destroy() });
      sfx.bang();

      // nearest live animal within a forgiving radius
      let best: Animal | null = null;
      let bestD = HIT_R * HIT_R;
      for (const a of this.animals) {
        if (!a.alive) continue;
        const d = (a.x - p.x) ** 2 + (a.y - a.displayHeight / 2 - p.y) ** 2;
        if (d < bestD) { bestD = d; best = a; }
      }
      if (best) this.hit(best, score, title);
    });
  }

  private spawn(): void {
    if (this.done) return;
    const kinds: Animal['kind'][] = [...this.cfg.animals];
    if (this.cfg.gold && Math.random() < 0.15) kinds.push('gold');
    const kind = Phaser.Utils.Array.GetRandom(kinds);
    const [y, s] = Phaser.Utils.Array.GetRandom(LANES);
    const fromLeft = Math.random() < 0.5;
    const tex = kind === 'gold' ? 'hen-gold' : kind;
    const a = this.add.image(fromLeft ? -250 : W + 250, y, tex).setOrigin(0.5, 1).setScale(s) as Animal;
    a.kind = kind; a.alive = true;
    a.setFlipX(!fromLeft).setDepth(y);
    this.animals.push(a);
    const dur = Phaser.Math.Between(3200, 4600) / this.cfg.speed / (s > 1 ? 1 : 1.15);
    // run across with a hop
    this.tweens.add({
      targets: a, x: fromLeft ? W + 250 : -250, duration: dur,
      onComplete: () => this.remove(a),
    });
    this.tweens.add({ targets: a, y: y - 40, duration: 220, yoyo: true, repeat: -1, ease: 'Sine.out' });
  }

  private remove(a: Animal): void {
    a.alive = false;
    this.tweens.killTweensOf(a);
    a.destroy();
    this.animals = this.animals.filter((x) => x !== a);
  }

  private hit(a: Animal, score: Phaser.GameObjects.Text, title: Phaser.GameObjects.Text): void {
    const { x, y } = a;
    const h = a.displayHeight;
    const pig = a.kind === 'pig';
    this.remove(a);
    (pig ? sfx.oink : sfx.cluck)();
    // cartoon puff: feathers or mud blobs, no gore
    for (let i = 0; i < 12; i++) {
      const p = this.add.image(x, y - h / 2, pig ? 'mud' : 'feather').setScale(pig ? 0.5 : 0.8).setDepth(30);
      this.tweens.add({
        targets: p, x: x + Phaser.Math.Between(-260, 260), y: y - h / 2 + Phaser.Math.Between(-260, 120),
        angle: Phaser.Math.Between(-360, 360), alpha: 0, duration: Phaser.Math.Between(600, 1000),
        ease: 'Cubic.out', onComplete: () => p.destroy(),
      });
    }
    const puf = text(this, x, y - h, 'Puf!', 90).setDepth(31);
    this.tweens.add({ targets: puf, y: puf.y - 120, alpha: 0, duration: 800, onComplete: () => puf.destroy() });

    if (a.kind === 'gold') {
      progress.coins += 1;
      sfx.coin();
      const c = this.add.image(x, y - h / 2, 'coin').setDepth(31);
      this.tweens.add({ targets: c, y: c.y - 200, alpha: 0, duration: 900, onComplete: () => c.destroy() });
    }

    this.hits++;
    score.setText(`${this.hits} / ${this.cfg.goal}`);
    if (this.hits >= this.cfg.goal) {
      this.done = true;
      title.setText('Bravo! 🎉').setAlpha(1);
      this.time.delayedCall(1000, () => this.finish(1));
    }
  }
}
