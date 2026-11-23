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
export const X_IN = -0.5, X_THROUGH = 1.4, X_OUT = 2.8;
/** Where the log waits for its next cut: pulled back to the very start of the saw's belt (a log is first fed in at `X_IN`). */
export const X_BACK = -0.7;
/** The part of a pass in which the log goes forward through the blades; the rest of it the planks cut off glide to the output stack (`GLIDE` of the pass) while the log comes back (in the last pass nothing comes back: all that is left glides out). */
const FORWARD = 0.45, GLIDE = 0.3;
/** In a pass that is not the last, the log is back at the start by `RETURNED` (of the pass) and the carriage raises it in the rest. */
const RETURNED = 0.8;

export interface PlankPose {
  /** the pass being made, 0.. */ pass: number;
  /** how many passes the log needs at this level */ passes: number;
  /** planks in the part of the log that is whole below the lowest blade */ base: number;
  /** blades at work in this pass */ blades: number;
  /** the log's back end, tiles from the machine's left edge (in the last pass it stays put once it is through the blades) */ x: number;
  /** the log is on its way back to the start (the planks cut off in this pass have left it, only `base` planks are left) */ back: boolean;
  /** planks already lying on the output stack when this pass begins (all the planks of the earlier passes) */ stacked: number;
  /** how far the planks cut off in this pass have glided from the log to the top of the output stack: 0 = not yet (they are still on the log), 1 = lying there. In the last pass the whole log glides (`base` is 1: it is the lowest plank). */ glide: number;
  /** this is the last pass: when the cuts are through, everything that is left goes to the stack and nothing comes back */ last: boolean;
  /** The blades stay at the heights of the first pass; the log is raised on a carriage instead, by as many planks as it has got thinner (`base0 - base`), so that its cut lines meet the blades. How far it is raised now (planks, it rises while it comes back for the next pass) */ lift: number;
  /** how far it was raised when this pass began (the planks that go to the stack start from there) */ liftFrom: number;
  /** the planks of the first pass's whole log below its lowest blade: the blades' height, in planks */ base0: number;
  /** how many blades the saw has (the first pass uses them all) */ total: number;
}

/** What the saw is doing `f` (0..1) of the way through the work at this level: each pass takes an equal share of it. */
export function plankPose(f: number, level: number): PlankPose {
  const plan = plankPasses(bladesAt(level)), g = Math.min(0.999999, Math.max(0, f)) * plan.length, pass = Math.floor(g), p = g - pass, last = pass === plan.length - 1;
  const { base, blades } = plan[pass], through = p >= FORWARD, after = (p - FORWARD) / (1 - FORWARD);
  let x = X_THROUGH, back = false, glide = 0, rise = 0;
  const start = pass === 0 ? X_IN : X_BACK;
  if (!through) x = start + ((X_THROUGH - start) * p) / FORWARD;
  else if (last) glide = after;
  else {
    // the log goes back to the start (the planks cut off glide to the stack meanwhile), and only then does the carriage raise it
    const ret = Math.min(1, (p - FORWARD) / (RETURNED - FORWARD));
    x = X_THROUGH - (X_THROUGH - X_BACK) * ret;
    back = true;
    glide = Math.min(1, ret / GLIDE);
    rise = Math.max(0, (p - RETURNED) / (1 - RETURNED));
  }
  const base0 = plan[0].base, liftFrom = base0 - base, liftTo = last ? liftFrom : base0 - plan[pass + 1].base;
  const lift = liftFrom + (liftTo - liftFrom) * rise * rise * (3 - 2 * rise);
  return { pass, passes: plan.length, base, blades, x, back, stacked: PLANK_LAYERS - base - blades, glide, last, lift, liftFrom, base0, total: plan[0].blades };
}

/** The saw at rest (idle, or with the finished planks lying on the belt): the blades wait at the heights of the first pass. */
export const restPass = (level: number): PlankPass => plankPasses(bladesAt(level))[0];
