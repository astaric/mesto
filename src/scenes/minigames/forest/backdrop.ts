import Phaser from 'phaser';
import { W, H } from '../../../core/layout';
import { BIOMES, type Biome, type PathColors } from './biomes';
import { HORIZON, PATH_HW, ZFAR, drawGround, mixColor, placeImage, type Cam } from './projection';

interface Decor { img: Phaser.GameObjects.Image; x: number; z: number; w: number }

const DECOR_COUNT = 46;

/** Everything in the picture that is not an enemy: sky, ground, hills, horizon trees, clouds, the roadside scenery,
 *  the weather, and the path. It knows the current world (`biome`) and crossfades to the next one. */
export class ForestBackdrop {
  biome: Biome;
  biomeIdx = -1;
  private pathNow: PathColors;
  private readonly decor: Decor[] = [];
  private readonly treeLine: { img: Phaser.GameObjects.Image; x: number; k: number }[] = [];
  private readonly hills: Phaser.GameObjects.Image[] = [];
  private readonly clouds: Phaser.GameObjects.Image[] = [];
  private readonly ceiling: Phaser.GameObjects.Image;
  private readonly ground: Phaser.GameObjects.Graphics;
  private sky?: Phaser.GameObjects.Image;
  private floor?: Phaser.GameObjects.Image;
  private ambientEvt?: Phaser.Time.TimerEvent;

  constructor(private readonly scene: Phaser.Scene, startIdx: number) {
    this.biome = BIOMES[startIdx];
    this.pathNow = { ...this.biome.path };

    this.ceiling = scene.add.image(0, 0, 'cave-stalactites').setOrigin(0).setDisplaySize(W, 290).setDepth(-19200).setAlpha(0);
    for (let i = 0; i < 3; i++) {
      this.clouds.push(scene.add.image(300 + i * 700, 150 + (i % 2) * 120, 'cloud').setDepth(-19500).setAlpha(0.9).setScale(0.9 + i * 0.15));
    }
    [[250, 0.9], [980, 1.1], [1750, 0.95]].forEach(([x, k]) => {
      this.hills.push(scene.add.image(x, HORIZON + 12, 'hill').setOrigin(0.5, 1).setScale(k).setDepth(-19000));
    });
    for (let i = 0; i < 20; i++) {
      const x = 40 + i * 104 + Phaser.Math.Between(-30, 30);
      const img = scene.add.image(x, HORIZON + 50, 'forest-pine').setOrigin(0.5, 1).setDepth(-18000);
      this.treeLine.push({ img, x, k: Math.random() });
    }
    this.ground = scene.add.graphics().setDepth(-15000);
    for (let i = 0; i < DECOR_COUNT; i++) {
      const d: Decor = { img: scene.add.image(0, 0, 'tree'), x: 0, z: 0, w: 400 };
      this.placeDecor(d, -400 + (i * (ZFAR + 400)) / DECOR_COUNT + Phaser.Math.Between(0, 60));
      this.decor.push(d);
    }
    this.setBiome(startIdx, true);
  }

  /** Switch the whole look to world `i`: crossfade sky and ground, recolour the path, change scenery and weather. */
  setBiome(i: number, instant: boolean): void {
    const scene = this.scene;
    const b = BIOMES[i];
    this.biome = b; this.biomeIdx = i;
    const fade = instant ? 0 : 1500;

    this.gradient(`${b.id}-sky`, 256, b.sky);
    this.gradient(`${b.id}-ground`, 256, b.ground);
    const swap = (old: Phaser.GameObjects.Image | undefined, key: string, y: number, h: number, depth: number): Phaser.GameObjects.Image => {
      const img = scene.add.image(0, y, key).setOrigin(0).setDisplaySize(W, h).setDepth(depth);
      if (fade > 0 && old) {
        img.setAlpha(0);
        scene.tweens.add({ targets: img, alpha: 1, duration: fade, onComplete: () => old.destroy() });
      } else old?.destroy();
      return img;
    };
    this.sky = swap(this.sky, `${b.id}-sky`, 0, HORIZON + 40, -20000);
    this.floor = swap(this.floor, `${b.id}-ground`, HORIZON, H - HORIZON, -16000);
    scene.cameras.main.setBackgroundColor(b.bg);

    scene.tweens.add({ targets: this.ceiling, alpha: b.ceiling ? 1 : 0, duration: fade || 1 });
    this.clouds.forEach((c) => c.setVisible(b.clouds));
    this.hills.forEach((h) => { h.setVisible(b.hills !== null); if (b.hills !== null) h.setTint(b.hills); });
    this.treeLine.forEach((tl) => {
      tl.img.setTexture(b.horizon.tex).setTint(b.horizon.tint);
      tl.img.setScale(Phaser.Math.Linear(b.horizon.h[0], b.horizon.h[1], tl.k) / tl.img.height);
    });

    if (fade > 0) {
      const from = { ...this.pathNow };
      scene.tweens.addCounter({
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
      this.ambientEvt = scene.time.addEvent({ delay: 90, loop: true, callback: () => this.ambientBit(kind) });
    }
  }

  /** The player ran `dz` world units: the roadside scenery comes closer and is recycled in the distance. */
  scroll(dz: number): void {
    for (const d of this.decor) {
      d.z -= dz;
      if (d.z < -420) this.placeDecor(d, ZFAR + Phaser.Math.Between(0, 400));
    }
  }

  /** Draw the ground and place the scenery for the current camera. */
  render(cam: Cam, distU: number): void {
    drawGround(this.ground, cam, distU, this.pathNow);
    this.treeLine.forEach((t) => t.img.setX(t.x - cam.camX * 0.04 + cam.bendAmt * 90));
    this.clouds.forEach((c, i) => { c.x += 0.15 + i * 0.05; if (c.x > W + 300) c.x = -300; });
    for (const d of this.decor) placeImage(d.img, cam, d.x, d.z, 0, d.w);
  }

  private gradient(key: string, h: number, stops: [number, string][]): void {
    if (this.scene.textures.exists(key)) return;
    const t = this.scene.textures.createCanvas(key, 4, h)!;
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, h);
    t.refresh();
  }

  /** Snowflake or ember drifting across the screen. */
  private ambientBit(kind: 'snow' | 'embers'): void {
    const x = Phaser.Math.Between(0, W);
    const snow = kind === 'snow';
    const r = snow ? Phaser.Math.Between(5, 11) : Phaser.Math.Between(4, 9);
    const color = snow ? 0xffffff : [0xff9a3a, 0xffd23f, 0xff5a1e][Phaser.Math.Between(0, 2)];
    const c = this.scene.add.circle(x, snow ? -20 : H + 20, r, color, snow ? 0.85 : 0.9).setDepth(600);
    this.scene.tweens.add({
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
}
