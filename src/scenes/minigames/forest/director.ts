import { DEFS, UNLOCK, type Kind, type Task } from './forestData';
import { BOSS_AT_M, type Biome } from './biomes';

// The spawner's decisions, without any Phaser: what comes next and how soon. The scene creates the things.

/** Seconds until the next spawn. It gets shorter with every quest done and with distance, and longer in the boss fight. */
export function spawnInterval(tasksDone: number, km: number, bossSpawned: boolean, rand = Math.random): number {
  return Math.max(0.65, 1.5 - tasksDone * 0.04 - km * 0.0008) * (0.8 + rand() * 0.4) * (bossSpawned ? 1.8 : 1);
}

export type Spawn = { type: 'demon' } | { type: 'troll' } | { type: 'kind'; kind: Kind } | null;

export interface DirectorView {
  biome: Biome;
  km: number;               // metres run
  tasks: Task[];
  tasksDone: number;
  hearts: number;
  maxHearts: number;
  bossSpawned: boolean;
  alive: Kind[];            // kinds of everything now on the path
}

const BIG: Kind[] = ['bear', 'polar', 'golem', 'wolf'];
export const isBig = (k: Kind): boolean => BIG.includes(k);
/** A normal enemy: counts against the cap on how many foes are out at once. */
const isFoe = (k: Kind): boolean => DEFS[k].foe && !DEFS[k].solid && !DEFS[k].boss && k !== 'rock';

/** What to spawn now, or null for nothing (every kind is capped). */
export function chooseSpawn(v: DirectorView, rand = Math.random): Spawn {
  // the hell ends with the demon: it replaces all other quests
  if (v.biome.id === 'hell' && !v.bossSpawned && v.km >= BOSS_AT_M) return { type: 'demon' };
  // a boss quest summons the troll once
  if (v.tasks.some((t) => t.metric === 'troll') && !v.alive.includes('troll')) return { type: 'troll' };

  const foes = v.alive.filter(isFoe).length;
  const forest = v.biome.id === 'forest';
  const wanted = (k: Kind): number => (v.tasks.some((t) => t.metric === k) ? 3 : 1);
  const bag = v.biome.bag.filter(([k]) => {
    const u = UNLOCK[k];
    if (forest && u !== undefined && v.tasksDone < u) return false;
    if (isFoe(k) && foes >= (v.bossSpawned ? 2 : 8)) return false;
    if (isBig(k) && v.alive.filter((a) => a === k).length >= 2) return false;
    return true;
  }).map(([k, w]) => [k, (k === 'honey' && v.hearts >= v.maxHearts ? w * 0.3 : w) * wanted(k)] as [Kind, number]);
  if (bag.length === 0) return null;

  const total = bag.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  let kind: Kind = bag[0][0];
  for (const [k, w] of bag) { r -= w; if (r <= 0) { kind = k; break; } }
  return { type: 'kind', kind };
}
