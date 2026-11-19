import { t } from '../../../i18n';
import type { Biome } from './biomes';

// Data for the ForestRun first-person shooter: enemy/item definitions and quest templates.

export type Kind =
  | 'mushroom' | 'bat' | 'spider' | 'bear' | 'troll' | 'rock' | 'coin' | 'honey' | 'chest' | 'bunny'
  | 'slime' | 'golem'                       // cave
  | 'snowman' | 'wolf' | 'polar'            // arctic
  | 'imp' | 'skull' | 'demon' | 'fireball'; // hell

/** How a thing moves between spawn and the player, as data. All fields are optional; `motion.ts` applies them.
 *  Things that need real logic (the troll's throws, the demon) are handled in the scene. */
export interface Move {
  homing?: number;                       // px/s its lane drifts towards the player while still far away
  sway?: [freq: number, amp: number];    // x = lane + sin(t * freq) * amp
  bob?: [freq: number, amp: number];     // lift = def.lift + sin(t * freq) * amp
  hop?: [freq: number, amp: number];     // lift = |sin(t * freq)| * amp
  drift?: boolean;                       // x moves by its own `vx` instead (thrown things, the bunny)
  drop?: { from: number; speed: number }; // starts at lift `from` and falls to the ground at `speed` px/s (the spider)
}

export interface Def {
  tex: string[];        // animation frames
  w: number;            // display width in px at scale 1 (z = 0)
  hp: number;
  v: number;            // own approach speed (world units / s), on top of the player's run speed
  lift: number;         // height above ground in world units (flyers)
  foe: boolean;         // damages the player
  pts: number;
  hitK: number;         // hit radius as fraction of display width (generous for kids)
  puff: number;         // colour of the "puff" when destroyed
  tint?: number;        // permanent colour tint (re-uses another monster's art)
  boss?: boolean;       // gets a health bar at the top
  solid?: boolean;      // cannot be shot: it has to be dodged (the demon's fireballs)
  move?: Move;
}

export const DEFS: Record<Kind, Def> = {
  mushroom: { tex: ['forest-mushroom'], w: 310, hp: 1, v: 110, lift: 0, foe: true, pts: 10, hitK: 0.62, puff: 0xe63946, move: { homing: 45, sway: [2, 30] } },
  bat:      { tex: ['forest-bat-1', 'forest-bat-2'], w: 340, hp: 1, v: 250, lift: 210, foe: true, pts: 15, hitK: 0.6, puff: 0x7e5fc0, move: { homing: 70, sway: [3, 260], bob: [5, 50] } },
  spider:   { tex: ['forest-spider'], w: 300, hp: 2, v: 140, lift: 0, foe: true, pts: 20, hitK: 0.6, puff: 0x4a3a78, move: { homing: 50, sway: [2.2, 200], drop: { from: 650, speed: 420 } } },
  bear:     { tex: ['forest-bear-1', 'forest-bear-2'], w: 420, hp: 5, v: 230, lift: 0, foe: true, pts: 50, hitK: 0.5, puff: 0x8b5a2b, move: { homing: 95, sway: [1.5, 40] } },
  troll:    { tex: ['forest-troll'], w: 640, hp: 20, v: 70, lift: 0, foe: true, pts: 300, hitK: 0.45, puff: 0x7fa650, boss: true, move: { homing: 35 } },
  rock:     { tex: ['rock'], w: 190, hp: 1, v: 380, lift: 140, foe: true, pts: 5, hitK: 0.7, puff: 0x9aa5b1, move: { drift: true } },
  coin:     { tex: ['coin'], w: 120, hp: 1, v: 0, lift: 90, foe: false, pts: 10, hitK: 0.8, puff: 0xffd23f, move: { bob: [4, 14] } },
  honey:    { tex: ['forest-honey'], w: 150, hp: 1, v: 0, lift: 0, foe: false, pts: 0, hitK: 0.75, puff: 0xffb703 },
  chest:    { tex: ['forest-chest'], w: 260, hp: 3, v: 0, lift: 0, foe: false, pts: 50, hitK: 0.6, puff: 0xffd23f },
  bunny:    { tex: ['bunny'], w: 200, hp: 1, v: 0, lift: 0, foe: false, pts: 0, hitK: 0.6, puff: 0xf2f2f7, move: { drift: true, hop: [7, 70] } },

  slime:    { tex: ['cave-slime'], w: 300, hp: 2, v: 90, lift: 0, foe: true, pts: 15, hitK: 0.6, puff: 0x6ccf5a, move: { homing: 40, sway: [1.6, 40], hop: [4, 70] } },
  golem:    { tex: ['cave-golem'], w: 420, hp: 6, v: 170, lift: 0, foe: true, pts: 60, hitK: 0.5, puff: 0x8a909c, move: { homing: 85, sway: [1.2, 30] } },
  snowman:  { tex: ['arctic-snowman'], w: 330, hp: 3, v: 120, lift: 0, foe: true, pts: 25, hitK: 0.55, puff: 0xffffff, move: { homing: 55, sway: [1.8, 60] } },
  wolf:     { tex: ['arctic-wolf'], w: 370, hp: 3, v: 330, lift: 0, foe: true, pts: 40, hitK: 0.55, puff: 0xc7d2de, move: { homing: 120, sway: [4, 70] } },
  polar:    { tex: ['forest-bear-1', 'forest-bear-2'], w: 440, hp: 6, v: 240, lift: 0, foe: true, pts: 60, hitK: 0.5, puff: 0xdbeeff, tint: 0xd8ecff, move: { homing: 95, sway: [1.5, 40] } },
  imp:      { tex: ['hell-imp'], w: 310, hp: 2, v: 230, lift: 260, foe: true, pts: 25, hitK: 0.6, puff: 0xe63946, move: { homing: 80, sway: [2.5, 280], bob: [4, 60] } },
  skull:    { tex: ['hell-skull'], w: 270, hp: 3, v: 310, lift: 110, foe: true, pts: 40, hitK: 0.6, puff: 0xff8a1f, move: { homing: 150, sway: [3, 100], bob: [6, 30] } },
  demon:    { tex: ['hell-demon'], w: 780, hp: 40, v: 0, lift: 0, foe: true, pts: 500, hitK: 0.4, puff: 0xff6a1a, boss: true },
  fireball: { tex: ['fireball'], w: 230, hp: 1, v: 430, lift: 150, foe: true, pts: 0, hitK: 0.7, puff: 0xff8a1f, solid: true, move: { drift: true } },
};

/** Forest enemies unlocked after N completed quests. */
export const UNLOCK: Partial<Record<Kind, number>> = { mushroom: 0, bat: 1, spider: 2, bear: 3 };

export type Metric =
  | 'mushroom' | 'bat' | 'spider' | 'bear' | 'troll' | 'coin' | 'chest' | 'bunny' | 'honey' | 'meters' | 'nohit'
  | 'slime' | 'golem' | 'snowman' | 'wolf' | 'polar' | 'imp' | 'skull' | 'demon';

export type Reward = 'heart' | 'coins' | 'score';

export interface Task {
  metric: Metric;
  goal: number;
  have: number;
  reward: Reward;
}

export function taskText(task: Task): string {
  const n = `${Math.min(task.have, task.goal)}/${task.goal}`;
  return t(`quest.${task.metric}`, { n });
}

/** The quest that ends the hell: shoot the demon. */
export const demonTask = (): Task => ({ metric: 'demon', goal: 1, have: 0, reward: 'heart' });

/** Build a new quest for `biome`. `done` = quests completed so far; in the forest every 5th one is the troll boss. */
export function makeTask(done: number, taken: Metric[], biome: Biome): Task {
  if (biome.id === 'forest' && done > 0 && done % 5 === 4 && !taken.includes('troll')) {
    return { metric: 'troll', goal: 1, have: 0, reward: 'heart' };
  }
  const pool = biome.quests.filter((m) => biome.id !== 'forest' || (UNLOCK[m as Kind] ?? 0) <= done);
  if (biome.id === 'forest' && done >= 2) pool.push('chest');
  const fresh = pool.filter((m) => !taken.includes(m));
  const metric = fresh[Math.floor(Math.random() * fresh.length)] ?? pool[0] ?? 'coin';
  const lvl = done;
  const goals: Record<Metric, number> = {
    mushroom: Math.min(12, 4 + Math.floor(lvl * 0.7)),
    bat: Math.min(10, 3 + Math.floor(lvl * 0.5)),
    spider: Math.min(8, 3 + Math.floor(lvl * 0.4)),
    bear: Math.min(4, 1 + Math.floor(lvl / 4)),
    troll: 1,
    coin: Math.min(25, 6 + lvl),
    chest: Math.min(4, 1 + Math.floor(lvl / 4)),
    bunny: Math.min(5, 2 + Math.floor(lvl / 3)),
    honey: Math.min(3, 1 + Math.floor(lvl / 5)),
    meters: 120 + lvl * 20,
    nohit: 80 + lvl * 10,
    slime: Math.min(10, 4 + Math.floor(lvl * 0.4)),
    golem: Math.min(4, 1 + Math.floor(lvl / 5)),
    snowman: Math.min(8, 3 + Math.floor(lvl * 0.4)),
    wolf: Math.min(6, 2 + Math.floor(lvl / 4)),
    polar: Math.min(3, 1 + Math.floor(lvl / 6)),
    imp: Math.min(8, 3 + Math.floor(lvl * 0.4)),
    skull: Math.min(6, 2 + Math.floor(lvl / 4)),
    demon: 1,
  };
  const reward: Reward = metric === 'honey' || metric === 'coin' ? 'score' : (['heart', 'coins', 'score'] as Reward[])[Math.floor(Math.random() * 3)];
  return { metric, goal: goals[metric], have: 0, reward };
}
