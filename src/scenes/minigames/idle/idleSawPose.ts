// The timing and the geometry of the log saw (docs/minigames/idle-logsaw-levels-sample.svg, version B), without Phaser so that it can be tested: where the trunk is and what is done
// `f` (0..1) of the way through the work. Drawn by idleSaw.ts. All x offsets are tiles from the machine's left edge.
//
// A trunk is sawn square on all four sides. Flat blades slide across it in a portal over the belt: 1 blade (the top flat, then the trunk rolls a quarter, four passes), 2 blades
// from level 25 (top and bottom flats, two passes), 4 from level 50 (a second pair, vertical, a little further down the same portal takes the far and near flats: one pass, no roll).

/** The flats a trunk needs. */
export const PASSES = 4;
/** The saw's level at which it gets its second blade (under the trunk) and at which it gets four (a vertical pair). The row shares one level. */
export const SECOND_BLADE_LEVEL = 25, FOURTH_BLADE_LEVEL = 50;
/** How many blades a log saw of this level has: 1, 2 or 4 (they divide the four flats evenly; three would still need two passes). */
export const sawBladesAt = (level: number): 1 | 2 | 4 => (level >= FOURTH_BLADE_LEVEL ? 4 : level >= SECOND_BLADE_LEVEL ? 2 : 1);
/** The passes one trunk needs with this many blades: 4, 2 or 1. */
export const passesFor = (blades: number): number => PASSES / blades;
/** Where the blades stand round the trunk, as angles on its cross-section (0 = the viewer's side, pi/2 = up), in the order they are added: the top, the bottom, the far side, the near side. */
export const BLADE_SIDES = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];

/** The trunk's flats in pass `pass` (0..): those of the earlier passes and the first `now` blades' of this one (default all), each turned back by the quarter rolls since it was cut (`rolled` = how much of the roll after this pass is done, 0..1). */
export function sawFlats(pass: number, blades: number, rolled: number, now = blades): number[] {
  const flats: number[] = [];
  for (let q = pass; q >= 0; q--) {
    for (let d = 0; d < (q === pass ? now : blades); d++) flats.push(BLADE_SIDES[d] - (pass - q + rolled) * (Math.PI / 2));
  }
  return flats;
}

/** The blades' bodies: where the flat blades lie along the belt (x of the body's start, its width and how far the teeth stick out towards the incoming trunk). The horizontal pair is at the front of the portal, the vertical pair `VERTICAL_AT` further down. */
export const BX = 1.65, BW = 0.17, DEPTH = 0.12, VERTICAL_AT = 0.7;
export const BX_V = BX + VERTICAL_AT;
/** Where a blade of this index (0 top, 1 bottom, 2 far, 3 near) cuts: the x of its teeth, and of the end of its body. */
export const bladeX = (i: number): { from: number; to: number } => { const bx = i < 2 ? BX : BX_V; return { from: bx - DEPTH, to: bx + BW }; };

/** Where the trunk's back end rests, where it is when the cuts of the first two blades are through (the pass goes forward this far and comes back), and where the finished square log lies (the same place `drawPieces` puts it, past the whole portal). */
export const X_START = 0.05, X_THROUGH = BX + BW + 0.05, X_OUT = BX_V + BW + 0.1;
/** The belt ends here: the square log (1.4 long) lies on its end; the output forklift stops heads-on at the belt's end, the log's end touching the front of the forks' second column of pieces (the load is two columns of 0.35 starting 0.014 from the forklift's middle, so 0.714 in front of it): `OUT_STATION_X` from the machine's left edge. */
export const BELT_END = X_OUT + 1.4;
export const OUT_STATION_X = BELT_END + 0.714;

/** How fast the trunk moves on the saw's belt, tiles a second: the same as the conveyor that carries a log from a saw 1 to its saw 2 (`TRANSFER_SPEED`), so the whole line's belts run alike. */
export const BELT_SPEED = 2;
/** The quarter roll between two passes, seconds. */
export const ROLL_S = 0.4;
/** One pass is the forward cut, the way back and the quarter roll; the last one only goes forward, on out of the machine. The trunk moves at `BELT_SPEED` forward and back, so these are seconds: */
const FORWARD_S = (X_THROUGH - X_START) / BELT_SPEED;
export const PASS_S = 2 * FORWARD_S + ROLL_S;
export const LAST_S = (X_OUT - X_START) / BELT_SPEED;
const FORWARD = FORWARD_S / PASS_S, BACK = (2 * FORWARD_S) / PASS_S;
/** Seconds one trunk takes on a saw with this many blades: all its passes but the last (cut, back, roll) and then the last one on out. */
export const sawTotalS = (blades: number): number => (passesFor(blades) - 1) * PASS_S + LAST_S;

export interface SawPose {
  /** the pass being made, 0..(passes - 1) */ pass: number;
  /** the trunk's back end, tiles from the machine's left edge */ x: number;
  /** quarter roll done so far (0..1) after this pass's cut; 0 while cutting */ turn: number;
  /** the trunk is being rolled on the rollers */ rolling: boolean;
  /** cuts that are through by now (the slabs lying behind the saw) */ cuts: number;
  /** a blade is cutting right now (dust flies) */ cutting: boolean;
  /** how many of this pass's blades the trunk has reached (so far its flats are there only for those) */ reached: number;
  /** the trunk is on its way forward through the blades (on the way back and while rolling it is sawn all along) */ forward: boolean;
}

/** Where the trunk is `f` (0..1) of the way through the work. */
export function sawPose(f: number, len: number, blades = 1): SawPose {
  const passes = passesFor(blades), t = Math.min(0.999999, Math.max(0, f)) * sawTotalS(blades), pass = Math.min(passes - 1, Math.floor(t / PASS_S));
  const last = pass === passes - 1, p = (t - pass * PASS_S) / PASS_S;
  let x: number, turn = 0;
  if (last) x = Math.min(X_OUT, X_START + (t - pass * PASS_S) * BELT_SPEED);
  else if (p < FORWARD) x = X_START + ((X_THROUGH - X_START) * p) / FORWARD;
  else if (p < BACK) x = X_THROUGH - ((X_THROUGH - X_START) * (p - FORWARD)) / (BACK - FORWARD);
  else { x = X_START; turn = (p - BACK) / (1 - BACK); }
  const forward = last || p < FORWARD;
  // a blade has started on the trunk once the trunk's front end is past the blade's teeth; its flat is all along the trunk once the back end is past the blade's body
  const reached = forward ? Array.from({ length: blades }, (_, i) => i).filter((i) => x + len > bladeX(i).from).length : blades;
  const cutting = forward && Array.from({ length: blades }, (_, i) => i).some((i) => x + len > bladeX(i).from && x < bladeX(i).to);
  return { pass, x, turn, rolling: !last && p >= BACK, cuts: pass * blades + reached, cutting, reached, forward };
}
