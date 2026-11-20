import Phaser from 'phaser';

export interface JoystickOptions {
  /** Radius in px; the knob can travel this far from the centre. */
  r: number;
  /** A touch starts the stick only when it lands left of `maxX` and below `minY` (screen coordinates). */
  zone: { maxX: number; minY: number };
  /** Centre of a fixed stick, drawn all the time. Without it the stick floats: it appears under the finger. */
  x?: number;
  y?: number;
  /** 'x' for strafing only (the vertical part is always 0). Default 'xy'. */
  axis?: 'xy' | 'x';
  /** Stick travel (0..1 of `r`) below which it reads as 0. Default 0.15. */
  deadZone?: number;
  /** Depth of the base; the knob is one above. Default 1000. */
  depth?: number;
}

/** A touch joystick plus the arrow keys and WASD, read through one vector. One finger at a time drives it.
 *  The scene creates it in `create()`; its listeners and shapes belong to the scene and go away with it.
 *  A scene that also reacts to taps asks `owns(p)` first, so the stick's finger does not also shoot. */
export class Joystick {
  private readonly o: Required<Pick<JoystickOptions, 'r' | 'axis' | 'deadZone'>> & JoystickOptions;
  private readonly fixed: boolean;
  private id: number | null = null;
  private enabled = true;
  private readonly origin = new Phaser.Math.Vector2();
  private readonly stick = new Phaser.Math.Vector2(); // -1..1 per axis
  private readonly out = new Phaser.Math.Vector2();
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly keys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene, opts: JoystickOptions) {
    this.o = { axis: 'xy', deadZone: 0.15, ...opts };
    this.fixed = opts.x !== undefined && opts.y !== undefined;
    const depth = opts.depth ?? 1000;
    const { r } = this.o;
    this.base = scene.add.circle(opts.x ?? 0, opts.y ?? 0, r + 20, 0xffffff, 0.2).setStrokeStyle(8, 0xffffff, 0.55)
      .setScrollFactor(0).setDepth(depth).setVisible(this.fixed);
    this.knob = scene.add.circle(opts.x ?? 0, opts.y ?? 0, 64, 0xffffff, 0.6)
      .setScrollFactor(0).setDepth(depth + 1).setVisible(this.fixed);
    this.origin.set(opts.x ?? 0, opts.y ?? 0);

    const kb = scene.input.keyboard;
    if (kb) { this.keys = kb.createCursorKeys(); this.wasd = kb.addKeys('W,A,S,D') as typeof this.wasd; }

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  /** The id of the finger driving the stick, or null. */
  get pointerId(): number | null { return this.id; }

  /** Does this touch belong to the stick (it is driving it, or it is free and the touch is in its zone)? */
  owns(p: Phaser.Input.Pointer): boolean { return this.enabled && (this.id === p.id || (this.id === null && this.inZone(p))); }

  /** Stick plus keys, length at most 1. The same vector object is reused: read it, don't keep it. */
  read(): Phaser.Math.Vector2 {
    const v = this.out.copy(this.stick);
    const k = this.keys, w = this.wasd;
    if (k && w) {
      if (k.left.isDown || w.A.isDown) v.x -= 1;
      if (k.right.isDown || w.D.isDown) v.x += 1;
      if (this.o.axis === 'xy') {
        if (k.up.isDown || w.W.isDown) v.y -= 1;
        if (k.down.isDown || w.S.isDown) v.y += 1;
      }
    }
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  /** Switch the stick off (a fixed one disappears) while something else, a menu, takes the screen; on again with `true`. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.reset();
    this.base.setVisible(on && this.fixed);
    this.knob.setVisible(on && this.fixed);
  }

  /** Let go of the stick (e.g. when the game ends) without waiting for the finger to lift. */
  reset(): void {
    this.id = null;
    this.stick.set(0, 0);
    this.knob.setPosition(this.origin.x, this.origin.y);
    if (!this.fixed) { this.base.setVisible(false); this.knob.setVisible(false); }
  }

  private inZone(p: Phaser.Input.Pointer): boolean { return p.x < this.o.zone.maxX && p.y > this.o.zone.minY; }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled || this.id !== null || !this.inZone(p)) return;
    this.id = p.id;
    if (!this.fixed) {
      this.origin.set(p.x, p.y);
      this.base.setPosition(p.x, p.y).setVisible(true);
      this.knob.setPosition(p.x, p.y).setVisible(true);
    }
    this.onMove(p);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.id) return;
    const { r, axis, deadZone } = this.o;
    const d = new Phaser.Math.Vector2(p.x - this.origin.x, axis === 'x' ? 0 : p.y - this.origin.y);
    if (d.length() > r) d.setLength(r);
    this.knob.setPosition(this.origin.x + d.x, this.origin.y + d.y);
    this.stick.set(d.x / r, d.y / r);
    if (this.stick.length() < deadZone) this.stick.set(0, 0);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.id) this.reset();
  }
}
