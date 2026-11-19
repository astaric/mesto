import type { Kind, Metric } from './forestData';

// The worlds of the ForestRun shooter. They follow each other by distance run (see `startM`).

export type BiomeId = 'forest' | 'cave' | 'arctic' | 'hell';

export interface PathColors { edge: number; main: number; stripe: number; grass: number }

export interface Biome {
  id: BiomeId;
  startM: number;                          // distance (m) at which this world begins
  sky: [number, string][];                 // gradient stops
  ground: [number, string][];
  bg: number;                              // camera background colour
  horizon: { tex: string; tint: number; h: [number, number] };  // small silhouettes along the horizon (display height range, px)
  hills: number | null;                    // tint of the hills, null = none
  clouds: boolean;
  ceiling: boolean;                        // stalactites hanging from the top (cave)
  path: PathColors;
  decor: { tex: string; w: number; weight: number }[];
  bag: [Kind, number][];                   // what the director spawns, with weights
  quests: Metric[];                        // quest metrics possible in this world
  ambient: 'none' | 'snow' | 'embers';
}

export const BIOMES: Biome[] = [
  {
    id: 'forest', startM: 0,
    sky: [[0, '#4a9be0'], [0.65, '#a9dcf7'], [1, '#e8f7e4']],
    ground: [[0, '#8ed17a'], [0.4, '#4f9f45'], [1, '#2a6e30']],
    bg: 0x9fd4f5,
    horizon: { tex: 'forest-pine', tint: 0x2f7a52, h: [156, 265] },
    hills: 0x4d9e6b, clouds: true, ceiling: false,
    path: { edge: 0x8a5a2b, main: 0xc79a5b, stripe: 0xb98a4d, grass: 0x9be07c },
    decor: [
      { tex: 'tree', w: 520, weight: 3 },
      { tex: 'forest-pine', w: 470, weight: 4 },
      { tex: 'forest-bush', w: 340, weight: 3 },
      { tex: 'forest-stump', w: 220, weight: 1 },
      { tex: 'rock', w: 300, weight: 1 },
    ],
    bag: [['mushroom', 5], ['bat', 3], ['spider', 2.5], ['bear', 1.5], ['coin', 3], ['chest', 1], ['bunny', 1], ['honey', 1]],
    quests: ['mushroom', 'coin', 'bunny', 'meters', 'nohit', 'honey', 'chest', 'bat', 'spider', 'bear'],
    ambient: 'none',
  },
  {
    id: 'cave', startM: 250,
    sky: [[0, '#120d22'], [0.6, '#271e44'], [1, '#3b2f5e']],
    ground: [[0, '#5a5170'], [0.4, '#3d3654'], [1, '#221d33']],
    bg: 0x120d22,
    horizon: { tex: 'cave-stalagmite', tint: 0x2a2342, h: [150, 250] },
    hills: 0x2c2545, clouds: false, ceiling: true,
    path: { edge: 0x2a2338, main: 0x7a708e, stripe: 0x6c6280, grass: 0xa08cff },
    decor: [
      { tex: 'cave-stalagmite', w: 420, weight: 4 },
      { tex: 'cave-crystal', w: 380, weight: 3 },
      { tex: 'rock', w: 320, weight: 2 },
    ],
    bag: [['slime', 4], ['bat', 3], ['spider', 3], ['golem', 1.5], ['coin', 3], ['chest', 1.2], ['honey', 1]],
    quests: ['slime', 'bat', 'spider', 'golem', 'coin', 'meters', 'nohit', 'honey', 'chest'],
    ambient: 'none',
  },
  {
    id: 'arctic', startM: 600,
    sky: [[0, '#7fb8e6'], [0.6, '#c6e4f7'], [1, '#f3faff']],
    ground: [[0, '#f7fcff'], [0.4, '#dcebf6'], [1, '#b2cfe4']],
    bg: 0x9fcdf0,
    horizon: { tex: 'arctic-pine', tint: 0x9cc3df, h: [156, 265] },
    hills: 0xb7d5ee, clouds: true, ceiling: false,
    path: { edge: 0x7fa3c0, main: 0xd3e5f2, stripe: 0xc0d7ea, grass: 0xffffff },
    decor: [
      { tex: 'arctic-pine', w: 470, weight: 4 },
      { tex: 'arctic-ice', w: 340, weight: 3 },
    ],
    bag: [['snowman', 4], ['wolf', 3], ['polar', 1.8], ['bat', 1.5], ['coin', 3], ['chest', 1.2], ['honey', 1]],
    quests: ['snowman', 'wolf', 'polar', 'coin', 'meters', 'nohit', 'honey', 'chest'],
    ambient: 'snow',
  },
  {
    id: 'hell', startM: 1000,
    sky: [[0, '#2a0808'], [0.55, '#8a2012'], [1, '#f0661e']],
    ground: [[0, '#4a1a14'], [0.4, '#2e0f0c'], [1, '#150808']],
    bg: 0x2a0808,
    horizon: { tex: 'hell-deadtree', tint: 0x1c0a0a, h: [150, 260] },
    hills: 0x3a1410, clouds: false, ceiling: false,
    path: { edge: 0xff6a1a, main: 0x5a3836, stripe: 0x4a2c2a, grass: 0xff5a1e },
    decor: [
      { tex: 'hell-rock', w: 340, weight: 3 },
      { tex: 'hell-deadtree', w: 400, weight: 3 },
      { tex: 'hell-pillar', w: 260, weight: 3 },
    ],
    bag: [['imp', 4], ['skull', 3.5], ['coin', 3], ['chest', 1.2], ['honey', 1.2]],
    quests: ['imp', 'skull', 'coin', 'meters', 'nohit', 'honey', 'chest'],
    ambient: 'embers',
  },
];

/** Distance (m) in hell at which the demon shows up. */
export const BOSS_AT_M = BIOMES[3].startM + 150;

export function biomeAt(meters: number): number {
  let idx = 0;
  BIOMES.forEach((b, i) => { if (meters >= b.startM) idx = i; });
  return idx;
}
