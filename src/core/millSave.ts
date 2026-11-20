import { GEAR, PRODUCTS, WORKERS, WORKER_LEVELS, type GearKind, type ProductId, type WorkerKind } from '../scenes/minigames/sawmill/millData';
import { newMill, type MillSave } from '../scenes/minigames/sawmill/millLogic';
import { readJson, writeJson } from './storage';

// What the sawmill remembers between sessions: the stock (logs, planks, products), the equipment, the workers hired.
// Coins are in the shared wallet (see `profile.ts`).

export const MILL_KEY = 'mill-save';

const count = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
};
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function load(): MillSave {
  const raw = readJson(MILL_KEY);
  const s = newMill();
  if (!isObject(raw)) return s;
  s.logs = count(raw.logs);
  s.planks = count(raw.planks);
  s.sold = count(raw.sold);
  const goods = isObject(raw.goods) ? raw.goods : {};
  for (const p of PRODUCTS) s.goods[p.id] = count(goods[p.id]);
  const ids = PRODUCTS.map((p) => p.id);
  s.made = Array.isArray(raw.made) ? [...new Set((raw.made as unknown[]).filter((id): id is ProductId => ids.includes(id as ProductId)))] : [];
  const gear = isObject(raw.gear) ? raw.gear : {};
  for (const k of Object.keys(GEAR) as GearKind[]) s.gear[k] = Math.min(count(gear[k]), GEAR[k].length - 1);
  const workers = isObject(raw.workers) ? raw.workers : {};
  for (const w of WORKERS) s.workers[w.kind as WorkerKind] = Math.min(count(workers[w.kind]), WORKER_LEVELS);
  if (ids.includes(raw.pick as ProductId)) s.pick = raw.pick as ProductId;
  return s;
}

export const millSave: MillSave = load();

export function saveMill(): void { writeJson(MILL_KEY, millSave); }
