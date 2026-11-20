import type { IdleUpgrades, SavedMachine } from '../scenes/minigames/idle/idleLogic';
import type { RowId, SlotIndex } from '../scenes/minigames/idle/idleLayout';
import { readJson, writeJson } from './storage';

// What the idle sawmill remembers between visits (it is entered from the city door and left again): the upgrades bought with the shared wallet
// (see `profile.ts`): the levels of the cutters, planters, forklifts, trucks, exit trucks and debarker, the saws and planers bought (row, slot, level), and the three managers. The line itself starts afresh.

export const IDLE_KEY = 'idle-save';
export const IDLE_START: IdleUpgrades = {
  level: 1, planterLevel: 0, manager: false, forkliftLevel: 1, forkliftManager: false, truckLevel: 1, truckManager: false, deliveryLevel: 1, debarkerLevel: 1, machines: [],
};
/** No level can be above this: a garbled number must not freeze the game working out the prices. */
const MAX_LEVEL = 5000;

const level = (v: unknown, min: number, fallback: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= min ? Math.min(v, MAX_LEVEL) : fallback);
const flag = (v: unknown): boolean => v === true;

/** The saws and planers: each one {row 1 - 3, slot 0 - 2, level}, no row/slot twice; anything else is dropped (which of them could really have been bought is `applyUpgrades`' business). */
function machines(v: unknown): SavedMachine[] {
  if (!Array.isArray(v)) return [];
  const out: SavedMachine[] = [];
  for (const m of v as Partial<Record<keyof SavedMachine, unknown>>[]) {
    if (!m || typeof m !== 'object' || !Number.isInteger(m.row) || !Number.isInteger(m.slot)) continue;
    const row = m.row as number, slot = m.slot as number;
    if (row < 1 || row > 3 || slot < 0 || slot > 2 || out.some((o) => o.row === row && o.slot === slot)) continue;
    out.push({ row: row as RowId, slot: slot as SlotIndex, level: level(m.level, 1, 1) });
  }
  return out;
}

function load(): IdleUpgrades {
  const raw = readJson(IDLE_KEY) as Partial<Record<keyof IdleUpgrades, unknown>> | null;
  if (!raw || typeof raw !== 'object') return { ...IDLE_START };
  return {
    level: level(raw.level, 1, 1), planterLevel: level(raw.planterLevel, 0, 0), manager: flag(raw.manager),
    forkliftLevel: level(raw.forkliftLevel, 1, 1), forkliftManager: flag(raw.forkliftManager),
    truckLevel: level(raw.truckLevel, 1, 1), truckManager: flag(raw.truckManager), deliveryLevel: level(raw.deliveryLevel, 1, 1),
    debarkerLevel: level(raw.debarkerLevel, 1, 1), machines: machines(raw.machines),
  };
}

export const idleSave: IdleUpgrades = load();

export function saveIdle(): void { writeJson(IDLE_KEY, idleSave); }
