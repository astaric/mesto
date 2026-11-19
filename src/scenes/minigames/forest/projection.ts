import Phaser from 'phaser';
import { W } from '../../../core/layout';
import type { PathColors } from './biomes';

// The hand-made pseudo-3D camera of ForestRun: world x/z -> screen, and the striped path on the ground.

export const HORIZON = 620;       // screen y of the vanishing line
export const FOCAL = 1000;        // s = FOCAL / (FOCAL + z)
export const CAMH = 600;          // ground y = HORIZON + CAMH * s
export const ZFAR = 4200;         // spawn distance
export const STEP = 250;          // length of one path stripe
export const PATH_HW = 520;       // half width of the path
export const MAX_CAM = 400;       // how far the player can strafe from the path centre
export const BEND = 600;          // max sideways shift of the far path (px)

/** Where the camera is: `camX` strafes, `bendAmt` (-1.4..1.4) curves the far part of the path. */
export interface Cam { camX: number; bendAmt: number }

export interface Projected { sx: number; sy: number; s: number }

export function proj(cam: Cam, x: number, z: number): Projected {
  const s = FOCAL / (FOCAL + z);
  const far = Math.max(0, 1 - s);
  return { sx: W / 2 + (x - cam.camX) * s + cam.bendAmt * BEND * far * far, sy: HORIZON + CAMH * s, s };
}

/** Put an upright image (feet at the projected point, `lift` world units up) at world (x, z), `w` px wide at z = 0. */
export function placeImage(img: Phaser.GameObjects.Image, cam: Cam, x: number, z: number, lift: number, w: number): void {
  const p = proj(cam, x, z);
  img.setPosition(p.sx, p.sy - lift * p.s).setScale((w / img.width) * p.s).setDepth(-z).setVisible(z > -380)
    .setAlpha(Phaser.Math.Clamp((ZFAR + 200 - z) / 1000, 0, 1));
}

export const mixColor = (a: number, b: number, k: number): number => {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Redraw the lighter ground stripes and the path (edge, surface, stripes) for the distance run so far. */
export function drawGround(g: Phaser.GameObjects.Graphics, cam: Cam, distU: number, col: PathColors): void {
  g.clear();
  const k0 = Math.floor(distU / STEP) - 3;
  const k1 = Math.ceil((distU + 9000) / STEP);
  const Zmin = -450;
  const zs: number[] = [];
  for (let k = k0; k <= k1; k++) zs.push(Math.max(Zmin, k * STEP - distU));
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
    for (let i = from; i <= to; i++) { const p = proj(cam, -hw, zs[i]); pts.push({ x: p.sx, y: p.sy }); }
    for (let i = to; i >= from; i--) { const p = proj(cam, hw, zs[i]); pts.push({ x: p.sx, y: p.sy }); }
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
