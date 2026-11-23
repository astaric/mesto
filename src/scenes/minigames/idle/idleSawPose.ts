// The timing of the log saw (docs/minigames/idle-logsaw-shuttle-sample.svg), without Phaser so that it can be tested: where the trunk is and what is done
// `f` (0..1) of the way through the work. Drawn by idleSaw.ts. All x offsets are tiles from the machine's left edge.

export const LANE = 1.5;
export const SAW_X = 1.5;
/** Where the trunk's back end rests, where it is when the cut is through, and where the finished square log lies (the same place `drawPieces` puts it). */
export const X_START = 0.05, X_THROUGH = SAW_X + 0.1, X_OUT = 1.6;
/** The square log lies on the end of the belt (`BELT_LEN` = 3.0, a log is 1.4 long); the output forklift stops heads-on at the belt's end, the log's end touching the front of the forks' second column of pieces (the load is two columns of 0.35 starting 0.014 from the forklift's middle, so 0.714 in front of it): this far from the machine's left edge. */
export const OUT_STATION_X = 3 + 0.714;
/** The flats a trunk needs: it is sawn square on all four sides. One disc cuts them one pass at a time (with a quarter roll between), more discs cut several in the same pass. */
export const PASSES = 4;
/** The saw's level at which it gets its second disc (on the near side of the belt, opposite the first) and at which it gets four (the other two above and below the trunk). The row shares one level. */
export const SECOND_DISC_LEVEL = 25, FOURTH_DISC_LEVEL = 50;
/** How many discs a log saw of this level has: 1, 2 or 4 (they divide the four flats evenly; three would still need two passes). */
export const discsAt = (level: number): 1 | 2 | 4 => (level >= FOURTH_DISC_LEVEL ? 4 : level >= SECOND_DISC_LEVEL ? 2 : 1);
/** The passes one trunk needs with this many discs: 4, 2 or 1. */
export const passesFor = (discs: number): number => PASSES / discs;
/** Where the discs stand round the trunk, as angles on its cross-section (0 = the viewer's side, pi/2 = up), in the order they are added: the far side, the near side, the top, the bottom. */
export const DISC_SIDES = [Math.PI, 0, Math.PI / 2, -Math.PI / 2];

/** The angles of the flats on the trunk in pass `pass` (0..): those of the earlier passes and, when `current`, of this one too, each turned back by the quarter rolls since it was cut (`rolled` = how much of the roll after this pass is done, 0..1). */
export function sawFlats(pass: number, discs: number, rolled: number, current: boolean): number[] {
  const flats: number[] = [];
  for (let q = current ? pass : pass - 1; q >= 0; q--) {
    for (let d = 0; d < discs; d++) flats.push(DISC_SIDES[d] - (pass - q + rolled) * (Math.PI / 2));
  }
  return flats;
}
/** How fast the trunk moves on the saw's belt, tiles a second: the same as the conveyor that carries a log from a saw 1 to its saw 2 (`TRANSFER_SPEED`), so the whole line's belts run alike. */
export const BELT_SPEED = 2;
/** The quarter roll between two passes, seconds. */
export const ROLL_S = 0.4;
/** One pass is the forward cut, the way back and the quarter roll; the last one only goes forward, on out of the machine. The trunk moves at `BELT_SPEED` forward and back, so these are seconds: */
const FORWARD_S = (X_THROUGH - X_START) / BELT_SPEED;
export const PASS_S = 2 * FORWARD_S + ROLL_S;
export const LAST_S = (X_OUT - X_START) / BELT_SPEED;
const FORWARD = FORWARD_S / PASS_S, BACK = (2 * FORWARD_S) / PASS_S;
/** Seconds one trunk takes on a saw with this many discs: all its passes but the last (cut, back, roll) and then the last one on out. */
export const sawTotalS = (discs: number): number => (passesFor(discs) - 1) * PASS_S + LAST_S;

export interface SawPose {
  /** the pass being made, 0..(passes - 1) */ pass: number;
  /** the trunk's back end, tiles from the machine's left edge */ x: number;
  /** quarter roll done so far (0..1) after this pass's cut; 0 while cutting */ turn: number;
  /** the trunk is being rolled on the rollers */ rolling: boolean;
  /** the whole trunk has been through the saw on this pass (it is flat on its far side all along) */ allSawn: boolean;
  /** cuts that are through by now (the slabs lying behind the saw) */ cuts: number;
  /** the saw is cutting right now (dust flies) */ cutting: boolean;
}

/** Where the trunk is `f` (0..1) of the way through the work. */
export function sawPose(f: number, len: number, discs = 1): SawPose {
  const passes = passesFor(discs), t = Math.min(0.999999, Math.max(0, f)) * sawTotalS(discs), pass = Math.min(passes - 1, Math.floor(t / PASS_S));
  const last = pass === passes - 1, p = (t - pass * PASS_S) / PASS_S;
  let x: number, turn = 0;
  if (last) x = Math.min(X_OUT, X_START + (t - pass * PASS_S) * BELT_SPEED);
  else if (p < FORWARD) x = X_START + ((X_THROUGH - X_START) * p) / FORWARD;
  else if (p < BACK) x = X_THROUGH - ((X_THROUGH - X_START) * (p - FORWARD)) / (BACK - FORWARD);
  else { x = X_START; turn = (p - BACK) / (1 - BACK); }
  const allSawn = last ? x >= SAW_X : p >= FORWARD;
  const touching = x < SAW_X + 0.1 && x + len > SAW_X && (last || p < FORWARD);
  return { pass, x, turn, rolling: !last && p >= BACK, allSawn, cuts: (pass + (allSawn ? 1 : 0)) * discs, cutting: touching };
}

