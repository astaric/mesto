// Data for the ForestRun first-person shooter: enemy/item definitions and quest templates.

export type Kind = 'gobec' | 'netopir' | 'pajek' | 'medved' | 'trol' | 'kamen' | 'coin' | 'honey' | 'chest' | 'bunny';

export interface Def {
  tex: string[];        // animation frames
  w: number;            // display width in px at scale 1 (z = 0)
  hp: number;
  v: number;            // own approach speed (world units / s), on top of the player's run speed
  lift: number;         // height above ground in world units (flyers)
  foe: boolean;         // damages the player
  pts: number;
  hitK: number;         // hit radius as fraction of display width (generous for kids)
  puff: number;         // colour of the "puf" when destroyed
}

export const DEFS: Record<Kind, Def> = {
  gobec:   { tex: ['gozd-gobec'], w: 310, hp: 1, v: 110, lift: 0, foe: true, pts: 10, hitK: 0.62, puff: 0xe63946 },
  netopir: { tex: ['gozd-netopir-1', 'gozd-netopir-2'], w: 340, hp: 1, v: 250, lift: 210, foe: true, pts: 15, hitK: 0.6, puff: 0x7e5fc0 },
  pajek:   { tex: ['gozd-pajek'], w: 300, hp: 2, v: 140, lift: 0, foe: true, pts: 20, hitK: 0.6, puff: 0x4a3a78 },
  medved:  { tex: ['gozd-medved-1', 'gozd-medved-2'], w: 420, hp: 5, v: 230, lift: 0, foe: true, pts: 50, hitK: 0.5, puff: 0x8b5a2b },
  trol:    { tex: ['gozd-trol'], w: 640, hp: 20, v: 70, lift: 0, foe: true, pts: 300, hitK: 0.45, puff: 0x7fa650 },
  kamen:   { tex: ['rock'], w: 190, hp: 1, v: 380, lift: 140, foe: true, pts: 5, hitK: 0.7, puff: 0x9aa5b1 },
  coin:    { tex: ['coin'], w: 120, hp: 1, v: 0, lift: 90, foe: false, pts: 10, hitK: 0.8, puff: 0xffd23f },
  honey:   { tex: ['gozd-med'], w: 150, hp: 1, v: 0, lift: 0, foe: false, pts: 0, hitK: 0.75, puff: 0xffb703 },
  chest:   { tex: ['gozd-skrinja'], w: 260, hp: 3, v: 0, lift: 0, foe: false, pts: 50, hitK: 0.6, puff: 0xffd23f },
  bunny:   { tex: ['bunny'], w: 200, hp: 1, v: 0, lift: 0, foe: false, pts: 0, hitK: 0.6, puff: 0xf2f2f7 },
};

/** Enemies unlocked after N completed quests. */
export const UNLOCK: Partial<Record<Kind, number>> = { gobec: 0, netopir: 1, pajek: 2, medved: 3 };

export type Metric = 'gobec' | 'netopir' | 'pajek' | 'medved' | 'trol' | 'coin' | 'chest' | 'bunny' | 'honey' | 'meters' | 'nohit';

export type Reward = 'heart' | 'coins' | 'score';

export interface Task {
  metric: Metric;
  goal: number;
  have: number;
  reward: Reward;
}

export function taskText(t: Task): string {
  const n = `${Math.min(t.have, t.goal)}/${t.goal}`;
  switch (t.metric) {
    case 'gobec': return `🍄 Ustreli gobce ${n}`;
    case 'netopir': return `🦇 Ustreli netopirje ${n}`;
    case 'pajek': return `🕷️ Ustreli pajke ${n}`;
    case 'medved': return `🐻 Premagaj medvede ${n}`;
    case 'trol': return `👹 Premagaj trola!`;
    case 'coin': return `🪙 Zberi kovance ${n}`;
    case 'chest': return `🧰 Odpri skrinje ${n}`;
    case 'bunny': return `🐰 Reši zajčke ${n}`;
    case 'honey': return `🍯 Zberi med ${n}`;
    case 'meters': return `👟 Teci ${n} m`;
    case 'nohit': return `🛡️ ${n} m brez zadetka`;
  }
}

/** Build a new quest. `done` = quests completed so far; every 5th one is the troll boss. */
export function makeTask(done: number, taken: Metric[]): Task {
  if (done > 0 && done % 5 === 4 && !taken.includes('trol')) return { metric: 'trol', goal: 1, have: 0, reward: 'heart' };
  const pool: Metric[] = ['gobec', 'coin', 'bunny', 'meters', 'nohit', 'honey', 'chest'];
  if (done >= 1) pool.push('netopir');
  if (done >= 2) pool.push('pajek', 'chest');
  if (done >= 3) pool.push('medved');
  const fresh = pool.filter((m) => !taken.includes(m));
  const metric = fresh[Math.floor(Math.random() * fresh.length)] ?? 'gobec';
  const lvl = done;
  const goals: Record<Metric, number> = {
    gobec: Math.min(12, 4 + Math.floor(lvl * 0.7)),
    netopir: Math.min(10, 3 + Math.floor(lvl * 0.5)),
    pajek: Math.min(8, 3 + Math.floor(lvl * 0.4)),
    medved: Math.min(4, 1 + Math.floor(lvl / 4)),
    trol: 1,
    coin: Math.min(25, 6 + lvl),
    chest: Math.min(4, 1 + Math.floor(lvl / 4)),
    bunny: Math.min(5, 2 + Math.floor(lvl / 3)),
    honey: Math.min(3, 1 + Math.floor(lvl / 5)),
    meters: 120 + lvl * 20,
    nohit: 80 + lvl * 10,
  };
  const reward: Reward = metric === 'honey' || metric === 'coin' ? 'score' : (['heart', 'coins', 'score'] as Reward[])[Math.floor(Math.random() * 3)];
  return { metric, goal: goals[metric], have: 0, reward };
}
