import { describe, expect, it } from 'vitest';
import {
  AISLES, F2_APPROACH, LANE_GY, OUT_LANE_GY, STATIONS, DEBARKER, DELIVERY_ROAD, DELIVERY_ROUTE, EXIT_ROAD, F1_LANE, FORKLIFT_HOME, FOREST, FOREST_TREES, GROUND, INGRESS_ROAD, LABELS, INGRESS_LANE, LANDING, LANDING_SPOT,
  LOGGING_ROUTE, WORKER_HOME, PLANTER_HOME, MANAGER_HOME, FORKLIFT_MANAGER_HOME, TRUCK_MANAGER_HOME, COURTYARD_W, cutterHome, planterHome, TREE_GAP, MAP, PILE, LOADING_YARD, ROWS, ROW_IDS, SHED, SHED_WALL, SLOTS, SLOT_GY, SLOT_SIZE, STARTING_SLOT, STORAGE, TRUCK_STOPS, contains, overlaps,
  machineOutId, sawInId, slotRect, treeSpot, tilesH, tilesW, tr,
} from './idleLayout';
import { GX, GY } from './idleIso';

describe('idle layout', () => {
  it('keeps every ground piece and place inside the map', () => {
    for (const g of GROUND) expect(contains(MAP, g.rect), g.id).toBe(true);
    for (const r of [SHED_WALL, DEBARKER, STORAGE, PILE, ...SLOTS.map((s) => s.rect), ...Object.values(TRUCK_STOPS)]) expect(contains(MAP, r)).toBe(true);
    expect(GROUND.map((g) => g.id).length).toBe(new Set(GROUND.map((g) => g.id)).size);
  });

  it('has 3 slots in each of the 3 rows, 3 x 3 tiles, inside the row and the shed, none touching another', () => {
    expect(ROW_IDS).toEqual([1, 2, 3]);
    expect(SLOTS).toHaveLength(9);
    for (const s of SLOTS) {
      expect(tilesW(s.rect)).toBe(SLOT_SIZE);
      expect(tilesH(s.rect)).toBe(SLOT_SIZE);
      expect(contains(ROWS[s.row], s.rect)).toBe(true);
      expect(contains(SHED, s.rect)).toBe(true);
    }
    for (const [i, a] of SLOTS.entries()) for (const b of SLOTS.slice(i + 1)) expect(overlaps(tr(a.rect.gx0 - 1, a.rect.gy0 - 1, a.rect.gx1 + 1, a.rect.gy1 + 1), b.rect)).toBe(false);
  });

  it('numbers the slots in purchase order from the screen-left end of the row (highest gy), the first one in line with the debarker, the same way in every row', () => {
    expect(STARTING_SLOT).toBe(0);
    expect(SLOT_GY[STARTING_SLOT]).toBe(DEBARKER.gy0);
    expect(SLOT_GY[0]).toBeGreaterThan(SLOT_GY[1]);
    expect(SLOT_GY[1]).toBeGreaterThan(SLOT_GY[2]);
    for (const row of ROW_IDS) for (const i of [0, 1, 2] as const) {
      expect(SLOTS.find((s) => s.row === row && s.index === i)!.rect.gy0).toBe(SLOT_GY[i]);
    }
  });

  it('puts an aisle before every row and after the last, 3 tiles wide, inside the shed, none overlapping a row or the debarker', () => {
    expect(AISLES.f2.gx1 + 1).toBe(ROWS[1].gx0);
    expect(ROWS[1].gx1 + 1).toBe(AISLES.f3.gx0);
    expect(AISLES.f3.gx1 + 1).toBe(ROWS[2].gx0);
    expect(ROWS[2].gx1 + 1).toBe(AISLES.f4.gx0);
    expect(AISLES.f4.gx1 + 1).toBe(ROWS[3].gx0);
    expect(ROWS[3].gx1 + 1).toBe(AISLES.f5.gx0);
    expect(AISLES.f5.gx1 + 1).toBe(LOADING_YARD.gx0);
    for (const a of Object.values(AISLES)) {
      expect(tilesW(a)).toBe(3);
      expect(contains(SHED, a)).toBe(true);
      expect(a.gy0).toBe(SHED.gy0);
      expect(a.gy1).toBe(SHED.gy1);
      for (const r of [...Object.values(ROWS), DEBARKER]) expect(overlaps(a, r)).toBe(false);
    }
  });

  it('chains the line left to right: pile -> F1 lane -> debarker -> way to the first aisle -> aisle, with the storage beside the aisle', () => {
    expect(PILE.gx1 + 1).toBe(F1_LANE.gx0);
    expect(F1_LANE.gx1 + 1).toBe(DEBARKER.gx0);
    expect(DEBARKER.gx1 + 1).toBe(STORAGE.gx0);
    expect(STORAGE.gx1 + 1).toBe(AISLES.f2.gx0);
    expect(STORAGE.gy1).toBeLessThan(DEBARKER.gy0); // the storage lies north of the line, beside the aisle, not in line with the debarker
    expect(contains(SHED, STORAGE)).toBe(true);
    expect(overlaps(STORAGE, DEBARKER)).toBe(false);
    expect(F2_APPROACH.gx0).toBe(DEBARKER.gx1 + 1);
    expect(F2_APPROACH.gx1 + 1).toBe(AISLES.f2.gx0);
    expect(F2_APPROACH.gy0).toBe(DEBARKER.gy0);
    expect(F2_APPROACH.gy1).toBe(DEBARKER.gy1);
    expect(overlaps(F2_APPROACH, STORAGE)).toBe(false);
    expect(F1_LANE.gy0).toBe(DEBARKER.gy0);
    expect(F1_LANE.gy1).toBe(DEBARKER.gy1);
    expect(contains(AISLES.f2, tr(AISLES.f2.gx0, DEBARKER.gy0, AISLES.f2.gx1, DEBARKER.gy1))).toBe(true);
    expect(contains(PILE, tr(PILE.gx0, DEBARKER.gy0, PILE.gx1, DEBARKER.gy1))).toBe(true);
  });

  it('keeps the debarker in the shed, to the left of every row, and the pile and yard outside it', () => {
    expect(contains(SHED, DEBARKER)).toBe(true);
    for (const r of Object.values(ROWS)) expect(DEBARKER.gx1).toBeLessThan(r.gx0);
    expect(overlaps(SHED, PILE)).toBe(false);
    expect(overlaps(SHED, LOADING_YARD)).toBe(false);
    expect(SHED_WALL.gy1 + 1).toBe(SHED.gy0);
    expect(ROWS[1].gx0).toBeLessThan(ROWS[2].gx0);
    expect(ROWS[2].gx0).toBeLessThan(ROWS[3].gx0);
  });

  it('has the logging truck stop beside the pile and the delivery truck beside the yard, on their own roads', () => {
    expect(contains(INGRESS_ROAD, TRUCK_STOPS.pile)).toBe(true);
    expect(contains(INGRESS_ROAD, TRUCK_STOPS.landing)).toBe(true);
    expect(TRUCK_STOPS.landing.gy1).toBeLessThan(TRUCK_STOPS.pile.gy0); // one way, +gy: the landing comes before the pile
    expect(TRUCK_STOPS.pile.gy0).toBe(PILE.gy0);
    expect(TRUCK_STOPS.pile.gy1).toBe(PILE.gy1);
    expect(LANDING.gx1 + 1).toBe(INGRESS_ROAD.gx0);
    expect(INGRESS_ROAD.gx1 + 1).toBe(PILE.gx0);
    expect(contains(DELIVERY_ROAD, TRUCK_STOPS.yard)).toBe(true);
    expect(TRUCK_STOPS.yard.gy0).toBe(LOADING_YARD.gy0);
    expect(TRUCK_STOPS.yard.gy1).toBe(LOADING_YARD.gy1);
    expect(LOADING_YARD.gx1 + 1).toBe(DELIVERY_ROAD.gx0);
    expect(overlaps(INGRESS_ROAD, DELIVERY_ROAD)).toBe(false);
  });

  it('turns the delivery road into an exit that leaves over the bottom-right edge of the map', () => {
    expect(overlaps(DELIVERY_ROAD, EXIT_ROAD)).toBe(true);
    expect(EXIT_ROAD.gx1).toBe(GX - 1);
    expect(EXIT_ROAD.gy1).toBeLessThan(GY - 1);
    expect(DELIVERY_ROAD.gy0).toBe(0);
  });

  it('has the forest in the top left, with its trees on a regular grid inside it, clear of the landing', () => {
    expect(FOREST.gx0).toBe(0);
    expect(FOREST.gy0).toBe(0);
    expect(FOREST_TREES.length).toBeGreaterThan(10);
    const xs = new Set(FOREST_TREES.map((t) => t.gx)), ys = new Set(FOREST_TREES.map((t) => t.gy));
    expect(xs.size * ys.size).toBe(FOREST_TREES.length); // a full grid: every column has every row
    for (const set of [xs, ys]) { const v = [...set].sort((a, b) => a - b); v.slice(1).forEach((n, i) => expect(n - v[i]).toBe(TREE_GAP)); }
    for (const t of FOREST_TREES) {
      expect(contains(FOREST, tr(t.gx, t.gy, t.gx, t.gy))).toBe(true);
      expect(overlaps(tr(t.gx, t.gy, t.gx, t.gy), LANDING)).toBe(false);
      const spot = treeSpot(t);
      expect(contains(FOREST, tr(Math.floor(spot.gx), Math.floor(spot.gy), Math.floor(spot.gx), Math.floor(spot.gy)))).toBe(true);
      expect(spot).toEqual({ gx: t.gx, gy: t.gy + 1 }); // in front of it, so the cutter is drawn over the tree
    }
  });

  it('puts the forklift stations beside what they serve, in flow order, with every drive between stations clear of machines and the storage', () => {
    const st = STATIONS;
    const tile = (p: { gx: number; gy: number }) => tr(Math.floor(p.gx), Math.floor(p.gy), Math.floor(p.gx), Math.floor(p.gy));
    // F1: from the pile to the debarker's input side
    expect(contains(F1_LANE, tile(st.pile.pos))).toBe(true);
    expect(contains(F1_LANE, tile(st.debarkerIn.approach!))).toBe(true); // F1 turns in along gx to the belt (its input end), from the west
    expect(st.pile.pos.gx).toBeGreaterThan(PILE.gx1 + 1);
    expect(st.debarkerIn.approach!.gx).toBeLessThan(DEBARKER.gx0);
    expect(st.debarkerIn.pos.gx).toBeGreaterThan(DEBARKER.gx0);
    // F2: the debarker's output side, the storage's aisle side, the saw's input side
    expect(st.debarkerOut.via.gx).toBeGreaterThan(DEBARKER.gx1 + 1); // F2 comes in along gx from the east to the belt's output end
    expect(contains(F2_APPROACH, tile(st.debarkerOut.via))).toBe(true);
    expect(contains(AISLES.f2, tile(st.storage.pos))).toBe(true);
    expect(st.storage.pos.gx).toBeGreaterThan(STORAGE.gx1 + 1);
    expect(st.storage.pos.gy).toBeGreaterThanOrEqual(STORAGE.gy0);
    expect(st.storage.pos.gy).toBeLessThanOrEqual(STORAGE.gy1 + 1);
    expect(contains(AISLES.f2, tile(st.sawIn0.pos))).toBe(true);
    expect(st.sawIn0.pos.gx).toBeLessThan(ROWS[1].gx0);
    // the output forklift: the output side of a machine of the last built row, the loading yard
    expect(st.out10.pos.gx).toBeGreaterThan(ROWS[1].gx1 + 1);
    expect(st.yard.pos.gx).toBeLessThan(LOADING_YARD.gx0);
    expect(contains(AISLES.f5, tile(st.yard.pos))).toBe(true);
    // the way in from the lane to the storage runs up the aisle, not through the storage or the machines
    expect(st.storage.via.gx).toBe(st.storage.pos.gx);
    expect(st.storage.via.gy).toBe(LANE_GY);
    for (const id of Object.keys(st) as (keyof typeof st)[]) {
      expect(overlaps(tile(st[id].pos), STORAGE), id).toBe(false);
      if (id !== 'debarkerIn' && id !== 'debarkerOut') expect(overlaps(tile(st[id].pos), DEBARKER), id).toBe(false); // (these two reach in to the belt, beside the ring)
      expect(overlaps(tile(st[id].via), STORAGE), id).toBe(false);
    }
    for (const s of SLOTS) { for (const id of Object.keys(st) as (keyof typeof st)[]) expect(overlaps(tile(st[id].pos), s.rect), id).toBe(false); }
    expect(FORKLIFT_HOME.f1).toBe('pile');
    expect(FORKLIFT_HOME.f2).toBe('debarkerOut');
    expect(FORKLIFT_HOME.out).toBe('out10');
    // the output lane runs along the front edge of the shed floor, past the first slot of every row, so no machine (built or not) is in its way
    for (const s of SLOTS) expect(OUT_LANE_GY).toBeGreaterThan(s.rect.gy1 + 1);
    expect(OUT_LANE_GY).toBeLessThan(SHED.gy1 + 1);
  });

  it('has a station for every machine: F2 puts a trunk on a saw 1 from the aisle in front of it, the output forklift takes the product behind it, both level with the machine and reached along the aisle', () => {
    const tile = (p: { gx: number; gy: number }) => tr(Math.floor(p.gx), Math.floor(p.gy), Math.floor(p.gx), Math.floor(p.gy));
    for (const index of [0, 1, 2] as const) {
      const saw = slotRect(1, index), inSt = STATIONS[sawInId(index)];
      expect(contains(AISLES.f2, tile(inSt.pos))).toBe(true);
      expect(inSt.pos.gy).toBeGreaterThanOrEqual(saw.gy0);
      expect(inSt.pos.gy).toBeLessThanOrEqual(saw.gy1 + 1);
      expect(inSt.via).toEqual({ gx: inSt.pos.gx, gy: LANE_GY }); // up or down the aisle from the main lane
      for (const row of ROW_IDS) {
        const r = slotRect(row, index), outSt = STATIONS[machineOutId(row, index)];
        expect(outSt.pos.gx).toBeGreaterThan(r.gx1 + 1);
        expect(outSt.pos.gy).toBeGreaterThanOrEqual(r.gy0);
        expect(outSt.pos.gy).toBeLessThanOrEqual(r.gy1 + 1);
        expect(outSt.via).toEqual({ gx: outSt.pos.gx, gy: OUT_LANE_GY }); // along the aisle to the lane in front of the shed
        for (const other of SLOTS) { expect(overlaps(tile(outSt.pos), other.rect)).toBe(false); expect(overlaps(tile(inSt.pos), other.rect)).toBe(false); }
      }
    }
  });

  it('has the logging truck park beside the pile and drive a loop on the two lanes of the ingress road, loading at the landing', () => {
    const { park, north, landing, south } = LOGGING_ROUTE;
    expect(INGRESS_LANE.east).toBeGreaterThan(INGRESS_LANE.west);
    for (const p of [park, north, landing, south]) {
      expect(p.gx).toBeGreaterThan(INGRESS_ROAD.gx0);
      expect(p.gx).toBeLessThan(INGRESS_ROAD.gx1 + 1);
    }
    // up the east lane (the pile side), over, down the west lane (the landing side), back
    expect(park.gx).toBe(INGRESS_LANE.east);
    expect(north.gx).toBe(INGRESS_LANE.east);
    expect(landing.gx).toBe(INGRESS_LANE.west);
    expect(south.gx).toBe(INGRESS_LANE.west);
    expect(north.gy).toBeLessThan(landing.gy);
    expect(landing.gy).toBeLessThan(park.gy);
    expect(park.gy).toBeLessThan(south.gy);
    expect(park.gy).toBeGreaterThanOrEqual(TRUCK_STOPS.pile.gy0);
    expect(park.gy).toBeLessThanOrEqual(TRUCK_STOPS.pile.gy1 + 1);
    expect(landing.gy).toBeGreaterThanOrEqual(TRUCK_STOPS.landing.gy0);
    expect(landing.gy).toBeLessThanOrEqual(TRUCK_STOPS.landing.gy1 + 1);
    expect(south.gy).toBeLessThan(GY);
  });

  it('puts the delivery truck beside the yard and sends it out over the right edge of the map', () => {
    expect(DELIVERY_ROUTE.dock.gx).toBeGreaterThanOrEqual(TRUCK_STOPS.yard.gx0);
    expect(DELIVERY_ROUTE.dock.gx).toBeLessThanOrEqual(TRUCK_STOPS.yard.gx1 + 1);
    expect(DELIVERY_ROUTE.dock.gy).toBeGreaterThanOrEqual(TRUCK_STOPS.yard.gy0);
    expect(DELIVERY_ROUTE.dock.gy).toBeLessThanOrEqual(TRUCK_STOPS.yard.gy1 + 1);
    expect(DELIVERY_ROUTE.turn.gx).toBe(DELIVERY_ROUTE.dock.gx);
    expect(DELIVERY_ROUTE.turn.gy).toBeGreaterThanOrEqual(EXIT_ROAD.gy0);
    expect(DELIVERY_ROUTE.turn.gy).toBeLessThanOrEqual(EXIT_ROAD.gy1 + 1);
    expect(DELIVERY_ROUTE.exit.gx).toBeGreaterThan(GX);
  });

  it('has the cutter wait beside the landing, the manager near him, the planter a little further down, in the forest and not on a tree', () => {
    expect(WORKER_HOME.gx).toBeGreaterThan(LANDING.gx0);
    expect(WORKER_HOME.gx).toBeLessThan(LANDING.gx1 + 1);
    expect(WORKER_HOME.gy).toBeGreaterThan(LANDING.gy1 + 1); // just below the landing, on its pad's side
    expect(WORKER_HOME.gy).toBeLessThan(LANDING.gy1 + 3);
    expect(contains(FOREST, tr(Math.floor(PLANTER_HOME.gx), Math.floor(PLANTER_HOME.gy), Math.floor(PLANTER_HOME.gx), Math.floor(PLANTER_HOME.gy)))).toBe(true);
    for (const t of FOREST_TREES) expect(Math.hypot(PLANTER_HOME.gx - t.gx, PLANTER_HOME.gy - t.gy)).toBeGreaterThan(1);
    expect(contains(FOREST, tr(Math.floor(MANAGER_HOME.gx), Math.floor(MANAGER_HOME.gy), Math.floor(MANAGER_HOME.gx), Math.floor(MANAGER_HOME.gy)))).toBe(true);
    for (const t of FOREST_TREES) expect(Math.hypot(MANAGER_HOME.gx - t.gx, MANAGER_HOME.gy - t.gy)).toBeGreaterThan(1);
    for (const h of [WORKER_HOME, PLANTER_HOME]) expect(Math.hypot(MANAGER_HOME.gx - h.gx, MANAGER_HOME.gy - h.gy)).toBeGreaterThan(0.7);
    for (let k = 0; k < 40; k++) for (let j = 0; j < 40; j++) expect(Math.hypot(cutterHome(k).gx - planterHome(j).gx, cutterHome(k).gy - planterHome(j).gy)).toBeGreaterThan(0.5);
    expect(LANDING_SPOT.gx).toBeLessThanOrEqual(LANDING.gx0);
  });

  it('has room for the workers that the levels hire: each a place of his own in the forest, the first five of each kind in a column', () => {
    for (let k = 0; k < 20; k++) {
      for (const p of [cutterHome(k), planterHome(k)]) expect(contains(FOREST, tr(Math.floor(p.gx), Math.floor(p.gy), Math.floor(p.gx), Math.floor(p.gy)))).toBe(true);
    }
    expect(cutterHome(0)).toEqual(WORKER_HOME);
    expect(planterHome(0)).toEqual(PLANTER_HOME);
    for (let k = 1; k < 5; k++) {
      expect(cutterHome(k).gx).toBe(WORKER_HOME.gx);
      expect(cutterHome(k).gy).toBeGreaterThan(cutterHome(k - 1).gy);
    }
  });

  it('puts the forklift manager and the truck manager in the courtyard, clear of the pile and the roads', () => {
    for (const m of [FORKLIFT_MANAGER_HOME, TRUCK_MANAGER_HOME]) {
      const tile = tr(Math.floor(m.gx), Math.floor(m.gy), Math.floor(m.gx), Math.floor(m.gy));
      expect(contains(COURTYARD_W, tile)).toBe(true);
      expect(overlaps(tile, PILE)).toBe(false);
    }
    expect(Math.hypot(FORKLIFT_MANAGER_HOME.gx - TRUCK_MANAGER_HOME.gx, FORKLIFT_MANAGER_HOME.gy - TRUCK_MANAGER_HOME.gy)).toBeGreaterThan(1.5);
  });

  it('labels hang over the map', () => {
    for (const l of LABELS) {
      expect(l.gx).toBeGreaterThan(0);
      expect(l.gx).toBeLessThan(GX);
      expect(l.gy).toBeGreaterThan(0);
      expect(l.gy).toBeLessThan(GY);
    }
  });
});
