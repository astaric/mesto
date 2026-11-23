// The timing of the plank saw (saw 2, row 2; design: docs/minigames/idle-plank-saw4-sample.svg), without Phaser so that it can be tested: how many blades it has
// at its level, how many passes the square log needs with them and how far the work is. Drawn by idlePlank.ts.
//
// A square log is `PLANK_LAYERS` planks thick, so sawing it takes `PLANK_LAYERS - 1` cuts. The log is fed along the belt between two posts and flat blades slide across it
// at the heights of the cuts. The more blades, the fewer passes: one blade (level 1) cuts the top plank off, then the next, then the last cut (3 passes); two
// blades (level 25) cut two planks at once and then the last cut (2 passes); three blades (level 50) make all the cuts together (1 pass).

export const PLANK_LAYERS = 4;
/** The saw's level at which it gets its second and its third blade (the row shares one level). */
export const SECOND_BLADE_LEVEL = 25, THIRD_BLADE_LEVEL = 50;

/** How many blades a plank saw of this level has. */
export const bladesAt = (level: number): number => (level >= THIRD_BLADE_LEVEL ? 3 : level >= SECOND_BLADE_LEVEL ? 2 : 1);

/** One pass: the log is whole below the lowest blade (`base` planks thick) and `blades` blades cut the `blades` planks above it off. */
export interface PlankPass { base: number; blades: number }

/** The passes a saw with this many blades makes on one log, in order: every pass uses as many blades as there are cuts left, up to all of them. */
export function plankPasses(blades: number): PlankPass[] {
  const passes: PlankPass[] = [];
  for (let layers = PLANK_LAYERS; layers > 1;) {
    const k = Math.min(blades, layers - 1);
    passes.push({ base: layers - k, blades: k });
    layers -= k;
  }
  return passes;
}

/** Where the log's back end (its x, tiles from the machine's left edge) is at the start of a pass, short of the blades (the log is 1.4 long: its front end is still short of the teeth), when it is through them, and where the finished planks lie (the output end: the same place `drawPieces` puts a machine's pieces). */
export const X_IN = -0.25, X_THROUGH = 1.7, X_OUT = 2.8;
/** In every pass but the last the log goes forward through the blades for this much of the pass and comes back for the rest; the last pass goes on out of the machine. */
const FORWARD = 0.55;

export interface PlankPose {
  /** the pass being made, 0.. */ pass: number;
  /** how many passes the log needs at this level */ passes: number;
  /** planks in the part of the log that is whole below the lowest blade */ base: number;
  /** blades at work in this pass */ blades: number;
  /** the log's back end, tiles from the machine's left edge */ x: number;
  /** the log is on its way back to the start (the planks cut off in this pass are gone, only `base` planks are left) */ back: boolean;
}

/** What the saw is doing `f` (0..1) of the way through the work at this level: each pass takes an equal share of it. */
export function plankPose(f: number, level: number): PlankPose {
  const plan = plankPasses(bladesAt(level)), g = Math.min(0.999999, Math.max(0, f)) * plan.length, pass = Math.floor(g), p = g - pass, last = pass === plan.length - 1;
  let x: number, back = false;
  if (last) x = X_IN + (X_OUT - X_IN) * p;
  else if (p < FORWARD) x = X_IN + ((X_THROUGH - X_IN) * p) / FORWARD;
  else { x = X_THROUGH - ((X_THROUGH - X_IN) * (p - FORWARD)) / (1 - FORWARD); back = true; }
  return { pass, passes: plan.length, base: plan[pass].base, blades: plan[pass].blades, x, back };
}

/** The saw at rest (idle, or with the finished planks lying on the belt): the blades wait at the heights of the first pass. */
export const restPass = (level: number): PlankPass => plankPasses(bladesAt(level))[0];
