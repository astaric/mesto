// The timing of the log saw (docs/minigames/idle-logsaw-shuttle-sample.svg), without Phaser so that it can be tested: where the trunk is and what is done
// `f` (0..1) of the way through the work. Drawn by idleSaw.ts. All x offsets are tiles from the machine's left edge.

export const LANE = 1.5;
export const SAW_X = 1.5;
/** Where the trunk's back end rests, where it is when the cut is through, and where the finished square log lies (the same place `drawPieces` puts it). */
export const X_START = 0.05, X_THROUGH = SAW_X + 0.1, X_OUT = 1.6;
/** The square log lies on the end of the belt (`BELT_LEN` = 3.0, a log is 1.4 long); the output forklift stops heads-on at the belt's end, the log's end touching the front of the forks' second column of pieces (the load is two columns of 0.35 starting 0.014 from the forklift's middle, so 0.714 in front of it): this far from the machine's left edge. */
export const OUT_STATION_X = 3 + 0.714;
export const PASSES = 4;
/** One pass is the forward cut, the way back and the quarter roll; the last one only goes forward, on out of the machine. */
const FORWARD = 0.55, BACK = 0.8;

export interface SawPose {
  /** the pass being made, 0..3 */ pass: number;
  /** the trunk's back end, tiles from the machine's left edge */ x: number;
  /** quarter roll done so far (0..1) after this pass's cut; 0 while cutting */ turn: number;
  /** the trunk is being rolled on the rollers */ rolling: boolean;
  /** the whole trunk has been through the saw on this pass (it is flat on its far side all along) */ allSawn: boolean;
  /** cuts that are through by now (the slabs lying behind the saw) */ cuts: number;
  /** the saw is cutting right now (dust flies) */ cutting: boolean;
}

/** Where the trunk is `f` (0..1) of the way through the work. */
export function sawPose(f: number, len: number): SawPose {
  const g = Math.min(0.999999, Math.max(0, f)) * PASSES, pass = Math.floor(g), p = g - pass;
  const last = pass === PASSES - 1;
  let x: number, turn = 0;
  if (last) x = X_START + (X_OUT - X_START) * p;
  else if (p < FORWARD) x = X_START + ((X_THROUGH - X_START) * p) / FORWARD;
  else if (p < BACK) x = X_THROUGH - ((X_THROUGH - X_START) * (p - FORWARD)) / (BACK - FORWARD);
  else { x = X_START; turn = (p - BACK) / (1 - BACK); }
  const allSawn = last ? x >= SAW_X : p >= FORWARD;
  const touching = x < SAW_X + 0.1 && x + len > SAW_X && (last || p < FORWARD);
  return { pass, x, turn, rolling: !last && p >= BACK, allSawn, cuts: pass + (allSawn ? 1 : 0), cutting: touching };
}

