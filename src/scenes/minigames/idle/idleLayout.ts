// Where everything stands in the idle sawmill, as tiles. No Phaser in here (see docs/minigames/idle.md for the picture).
//
// The material flows along gx (to the lower right of the screen), through machines that stand turned the same way, so a log goes in at
// the left side of a machine and comes out at the right:
//   forest -> landing -> logging truck -> trunk pile -> F1 -> debarker -> storage -> F2 -> row 1 (saws 1) -> F3 -> row 2 (saws 2)
//   -> F4 -> row 3 (planers) -> F5 -> loading yard -> delivery truck -> exit road.
// Rows 2 and 3 are optional: the loading yard takes the output of the last row that is built (square logs, rough planks or planed planks), carried over the empty floor
// of the rows that are not built. A row can only be built after the one before it.
// The start of the line (pile, debarker, storage, the first machine of every row, the yard) is along gy 12 - 16, the screen-left end of the rows.
// A "row" is a vertical stack (along gy) of up to 3 machines of one kind; the forklift aisles between the rows run along gy.

import type { Key } from '../../../i18n';
import { GX, GY, type Tile } from './idleIso';

/** A rectangle of whole tiles, both ends inclusive. */
export interface TileRect { gx0: number; gy0: number; gx1: number; gy1: number }

export const tr = (gx0: number, gy0: number, gx1: number, gy1: number): TileRect => ({ gx0, gy0, gx1, gy1 });
export const tilesW = (r: TileRect): number => r.gx1 - r.gx0 + 1;
export const tilesH = (r: TileRect): number => r.gy1 - r.gy0 + 1;
export const overlaps = (a: TileRect, b: TileRect): boolean => a.gx0 <= b.gx1 && b.gx0 <= a.gx1 && a.gy0 <= b.gy1 && b.gy0 <= a.gy1;
export const contains = (outer: TileRect, inner: TileRect): boolean => inner.gx0 >= outer.gx0 && inner.gx1 <= outer.gx1 && inner.gy0 >= outer.gy0 && inner.gy1 <= outer.gy1;
export const centre = (r: TileRect): { gx: number; gy: number } => ({ gx: (r.gx0 + r.gx1 + 1) / 2, gy: (r.gy0 + r.gy1 + 1) / 2 });

export const MAP = tr(0, 0, GX - 1, GY - 1);

// ---------- the places ----------

export const FOREST = tr(0, 0, 7, 21);
export const LANDING = tr(7, 0, 7, 2);          // cut trunks stack up here, next to the ingress road
export const INGRESS_ROAD = tr(8, 0, 9, 21);    // one way, +gy: enters at the top, leaves at the bottom-left edge
export const COURTYARD_W = tr(10, 0, 12, 21);
export const PILE = tr(10, 12, 12, 16);          // the entrance: the logging truck unloads here
export const SHED = tr(13, 4, 41, 16);          // the open-sided factory: floor, back wall along gy = 3, no roof
export const SHED_WALL = tr(13, 3, 41, 3);
export const F1_LANE = tr(13, 13, 14, 15);      // pile -> debarker (along gx)
export const DEBARKER = tr(15, 13, 17, 15);     // one machine, in line with the first slot of every row
export const STORAGE = tr(18, 6, 20, 10);       // peeled trunks wait here for a free saw; beside the aisle F2, north of the line (a forklift brings them and takes them from the aisle side)
export const F2_APPROACH = tr(18, 13, 20, 15);  // the way from the debarker's output side to the aisle F2, in line with the debarker
export const COURTYARD_E = tr(42, 0, 45, 21);
export const LOADING_YARD = tr(42, 12, 45, 16);   // the delivery truck is loaded here
export const DELIVERY_ROAD = tr(46, 0, 47, 20); // one way, +gy: enters at the top, turns into the exit road
export const EXIT_ROAD = tr(46, 19, 54, 20);    // leaves over the bottom-right edge

/** The forklift aisles between the stages (they run along gy, so one forklift reaches every machine of the row before and the row after). */
export const AISLES = {
  f2: tr(21, 4, 23, 16),  // storage -> row 1
  f3: tr(27, 4, 29, 16),  // row 1 -> row 2
  f4: tr(33, 4, 35, 16),  // row 2 -> row 3
  f5: tr(39, 4, 41, 16),  // row 3 -> loading yard
} as const;

/** The three rows of machines. Row 1 makes square logs from barkless trunks, row 2 rough planks from them, row 3 planes the rough planks smooth. */
export const ROWS = { 1: tr(24, 4, 26, 16), 2: tr(30, 4, 32, 16), 3: tr(36, 4, 38, 16) } as const;
export type RowId = 1 | 2 | 3;
export const ROW_IDS: readonly RowId[] = [1, 2, 3];
export const ROW_KIND = { 1: 'saw1', 2: 'saw2', 3: 'planer' } as const;

export const SLOT_SIZE = 3;
/** A row has 3 slots, 3 x 3 tiles with one tile between. They are numbered in the order they are bought, from the screen-left end of the row (the highest gy, in line with the
 *  debarker and the storage) to the right: the left one first, then the middle one, then the right one. */
export const SLOT_GY = [13, 9, 5] as const;
export type SlotIndex = 0 | 1 | 2;

export interface Slot { row: RowId; index: SlotIndex; rect: TileRect }
export const SLOTS: readonly Slot[] = ROW_IDS.flatMap((row) =>
  ([0, 1, 2] as const).map((index): Slot => ({
    row, index, rect: tr(ROWS[row].gx0, SLOT_GY[index], ROWS[row].gx0 + SLOT_SIZE - 1, SLOT_GY[index] + SLOT_SIZE - 1),
  })));

/** Each row starts with the machine in this slot (the leftmost); the others are lots for sale, each dearer than the one before. */
export const STARTING_SLOT: SlotIndex = 0;

/** Where the trucks stop. The logging truck first loads at the landing, then unloads at the pile; the delivery truck waits at the yard. */
export const TRUCK_STOPS = {
  landing: tr(8, 0, 9, 2),
  pile: tr(8, 12, 9, 16),
  yard: tr(46, 12, 47, 16),
} as const;

// ---------- the routes things drive and walk (tile coordinates, fractions allowed; a vehicle's point is its centre) ----------

/** The forklifts' lane along gx through the line (the F1 lane, the debarker, the first slot of every row all lie on it). */
export const LANE_GY = 14.5;
/** The output forklift's lane to the yard runs along the front edge of the shed floor, in front of the first slot of every row (which ends at gy 15), so it never crosses a machine, built or not. */
export const OUT_LANE_GY = 16.5;
export const slotRect = (row: RowId, index: SlotIndex): TileRect => SLOTS.find((s) => s.row === row && s.index === index)!.rect;
const SLOT_INDEXES: readonly SlotIndex[] = [0, 1, 2];

/** Where a forklift stands to put a piece down or pick one up. `via` is the point where it joins the main lane along gx (the same as `pos` where it is on the lane already): a forklift driving from one
 *  station to another goes from `pos` to `via`, along the lane, then to the other `via` and `pos`, so it never cuts across a machine or the storage. */
export type SawInId = `sawIn${SlotIndex}`;
/** The output side of the machine in this row and slot: `out12` = row 1, slot 2. Only the last built row hands its goods to the output forklift (the rows before it pass them on by themselves). */
export type MachineOutId = `out${RowId}${SlotIndex}`;
export type StationId = 'pile' | 'debarkerIn' | 'debarkerOut' | 'storage' | 'yard' | SawInId | MachineOutId;
export const sawInId = (index: SlotIndex): SawInId => `sawIn${index}`;
export const machineOutId = (row: RowId, index: SlotIndex): MachineOutId => `out${row}${index}`;
export interface Station { pos: { gx: number; gy: number }; via: { gx: number; gy: number } }
const onLane = (gx: number, gy: number): Station => ({ pos: { gx, gy }, via: { gx, gy } });
const slotMidGy = (row: RowId, index: SlotIndex): number => centre(slotRect(row, index)).gy;
/** The machines' stations: F2 puts a peeled trunk on a saw 1 at the aisle F2 (the saw's input side, in line with the saw: along the aisle from the lane); the output forklift takes the product off the output side of a machine of the last built row, in the aisle behind it, and drives out to the lane in front of the shed. */
const machineStations = (): Partial<Record<StationId, Station>> => {
  const out: Partial<Record<StationId, Station>> = {};
  for (const index of SLOT_INDEXES) {
    const gx = slotRect(1, index).gx0 - 0.5;
    out[sawInId(index)] = { pos: { gx, gy: slotMidGy(1, index) }, via: { gx, gy: LANE_GY } };
    for (const row of ROW_IDS) {
      const ox = ROWS[row].gx1 + 2.3;
      out[machineOutId(row, index)] = { pos: { gx: ox, gy: slotMidGy(row, index) }, via: { gx: ox, gy: OUT_LANE_GY } };
    }
  }
  return out;
};
export const STATIONS = {
  pile: onLane(PILE.gx1 + 1.5, LANE_GY),                     // F1 takes a trunk from the pile ...
  debarkerIn: onLane(DEBARKER.gx0 - 0.5, LANE_GY),           // ... and puts it on the debarker's input side
  debarkerOut: onLane(DEBARKER.gx1 + 2.3, LANE_GY),          // F2 takes the peeled trunk off the output side
  yard: onLane(LOADING_YARD.gx0 - 0.5, OUT_LANE_GY),         // the output forklift puts the product down in the loading yard
  storage: { pos: { gx: STORAGE.gx1 + 1.5, gy: (STORAGE.gy0 + STORAGE.gy1 + 1) / 2 }, via: { gx: STORAGE.gx1 + 1.5, gy: LANE_GY } }, // F2 comes up the aisle to the storage's aisle side
  ...machineStations(),
} as Record<StationId, Station>;
/** Where each forklift waits (and goes back to) when it has nothing to do. The output forklift waits behind the first machine of the last built row (`outHome` in idleLogic.ts); this is where it starts. */
export const FORKLIFT_HOME: Record<'f1' | 'f2' | 'f3' | 'out', StationId> = { f1: 'pile', f2: 'debarkerOut', f3: machineOutId(1, 1), out: machineOutId(1, 0) };

/** The ingress road is two lanes wide: the logging truck parks on the east lane in front of the pile, drives up it to the forest, turns over to the west lane, loads at the landing
 *  (which lies along the west lane), drives down it and crosses back to the east lane to park and unload at the pile. A loop. */
export const INGRESS_LANE = { west: INGRESS_ROAD.gx0 + 0.55, east: INGRESS_ROAD.gx1 + 1 - 0.55 } as const;
export const LOGGING_ROUTE = {
  park: { gx: INGRESS_LANE.east, gy: (PILE.gy0 + PILE.gy1 + 1) / 2 },
  north: { gx: INGRESS_LANE.east, gy: 0.5 },
  landing: { gx: INGRESS_LANE.west, gy: 2.5 },
  south: { gx: INGRESS_LANE.west, gy: PILE.gy1 + 1.5 },
} as const;

/** The delivery road's middle. The truck waits at the dock beside the yard, then drives down and out along the exit road. */
export const DELIVERY_X = (DELIVERY_ROAD.gx0 + DELIVERY_ROAD.gx1 + 1) / 2;
export const EXIT_GY = (EXIT_ROAD.gy0 + EXIT_ROAD.gy1 + 1) / 2;
/** Exit trucks wait for the loading ramp on the delivery road, one behind the other, this many tiles apart (a truck is about 4 tiles long). The first one stands at the dock and loads; the others stand in line behind it, up the road. */
export const QUEUE_SPACING = 5;
export const DELIVERY_ROUTE = {
  depot: { gx: DELIVERY_X, gy: -5 },
  dock: { gx: DELIVERY_X, gy: (LOADING_YARD.gy0 + LOADING_YARD.gy1 + 1) / 2 },
  turn: { gx: DELIVERY_X, gy: EXIT_GY },
  exit: { gx: GX + 4, gy: EXIT_GY },
} as const;

/** Where the cutter stands at a tree (one tile in front of it, so he is drawn over it, in the free lane between the rows), where he puts a trunk down at the landing, and where he waits
 *  for the next tap (beside the landing). */
export const treeSpot = (tree: Tile): Tile => ({ gx: tree.gx, gy: tree.gy + 1 });
export const LANDING_SPOT = { gx: LANDING.gx0 - 0.15, gy: (LANDING.gy0 + LANDING.gy1 + 1) / 2 };
const HOME_ROWS = 5;
const HOME_GAP = 0.8;
/** Where the k-th cutter waits (the first beside the landing, the others in a column below him, then a column to the left of it). */
export const cutterHome = (k: number): Tile => ({ gx: LANDING.gx0 + 0.5 - 0.7 * Math.floor(k / HOME_ROWS), gy: LANDING.gy1 + 1.4 + HOME_GAP * (k % HOME_ROWS) });
/** Where the k-th planter (hired by the planter's levels) waits: in the forest, further down the landing's edge than the cutters, so the two kinds never share a place. */
export const planterHome = (k: number): Tile => ({ gx: LANDING.gx0 - 0.9 - 0.7 * Math.floor(k / HOME_ROWS), gy: LANDING.gy1 + 6.4 + HOME_GAP * (k % HOME_ROWS) });
export const WORKER_HOME = cutterHome(0);
export const PLANTER_HOME = planterHome(0);
/** The manager stands in the forest between the landing and the trees. */
export const MANAGER_HOME = { gx: LANDING.gx0 - 0.6, gy: LANDING.gy1 - 0.4 };
/** The forklift manager stands in the courtyard above the trunk pile, where the first forklift works. */
/** The truck manager stands in the courtyard beside the ingress road, where the logging truck drives. */
export const TRUCK_MANAGER_HOME = { gx: COURTYARD_W.gx0 + 0.6, gy: 7.5 };
export const FORKLIFT_MANAGER_HOME = { gx: PILE.gx0 + 1.5, gy: PILE.gy0 - 1.2 };

/** Every tree of the forest stands on a regular grid: one every `TREE_GAP` tiles along both axes, `TREE_MARGIN` tiles in from the forest's edge. The lanes between them are free to walk through. */
export const TREE_GAP = 1;
export const TREE_MARGIN = 1;
/** The cutter chops the one nearest to his place first, so the trees are listed from there outwards. */
export const FOREST_TREES: readonly Tile[] = (() => {
  const out: Tile[] = [];
  for (let gx = FOREST.gx0 + TREE_MARGIN; gx <= LANDING.gx0 - 2; gx += TREE_GAP) {
    for (let gy = FOREST.gy0 + TREE_MARGIN; gy <= FOREST.gy1 - 1; gy += TREE_GAP) out.push({ gx, gy });
  }
  const d = (t: Tile): number => Math.hypot(t.gx - WORKER_HOME.gx, t.gy - WORKER_HOME.gy);
  return out.sort((a, b) => d(a) - d(b));
})();

// ---------- the ground, back to front ----------

export type GroundKind = 'forest' | 'landing' | 'road' | 'courtyard' | 'floor' | 'lane' | 'yard';
export interface Ground { id: string; kind: GroundKind; rect: TileRect }

/** Painted in this order, each on top of the one before; the bare map is grass. */
export const GROUND: readonly Ground[] = [
  { id: 'forest', kind: 'forest', rect: FOREST },
  { id: 'landing', kind: 'landing', rect: LANDING },
  { id: 'ingress', kind: 'road', rect: INGRESS_ROAD },
  { id: 'courtyardW', kind: 'courtyard', rect: COURTYARD_W },
  { id: 'courtyardE', kind: 'courtyard', rect: COURTYARD_E },
  { id: 'shed', kind: 'floor', rect: SHED },
  { id: 'f1', kind: 'lane', rect: F1_LANE },
  { id: 'f2in', kind: 'lane', rect: F2_APPROACH },
  { id: 'storage', kind: 'yard', rect: STORAGE },
  { id: 'f2', kind: 'lane', rect: AISLES.f2 },
  { id: 'f3', kind: 'lane', rect: AISLES.f3 },
  { id: 'f4', kind: 'lane', rect: AISLES.f4 },
  { id: 'f5', kind: 'lane', rect: AISLES.f5 },
  { id: 'yard', kind: 'yard', rect: LOADING_YARD },
  { id: 'delivery', kind: 'road', rect: DELIVERY_ROAD },
  { id: 'exit', kind: 'road', rect: EXIT_ROAD },
];

// ---------- labels ----------

/** A name floating over a place: the translation key, the tile it hangs over and how high. */
export interface Label { key: Key; gx: number; gy: number; z: number }
export const LABELS: readonly Label[] = [
  { key: 'idle.zone.forest', gx: 3.5, gy: 10.5, z: 0 },
  { key: 'idle.zone.landing', gx: 7.5, gy: 1.5, z: 80 },
  { key: 'idle.zone.ingress', gx: 9, gy: 16, z: 0 },
  { key: 'idle.zone.pile', gx: 11.5, gy: 14.5, z: 100 },
  { key: 'idle.zone.debarker', gx: 16.5, gy: 14.5, z: 170 },
  { key: 'idle.zone.storage', gx: 19.5, gy: 8.5, z: 20 },
  { key: 'idle.zone.row1', gx: 25.5, gy: 17.5, z: 0 },
  { key: 'idle.zone.row2', gx: 31.5, gy: 17.5, z: 0 },
  { key: 'idle.zone.row3', gx: 37.5, gy: 17.5, z: 0 },
  { key: 'idle.zone.yard', gx: 43.5, gy: 14, z: 70 },
  { key: 'idle.zone.delivery', gx: 46.5, gy: 5, z: 0 },
  { key: 'idle.zone.exit', gx: 50, gy: 19.8, z: 0 },
];
