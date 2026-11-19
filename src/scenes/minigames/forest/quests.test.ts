import { describe, expect, it } from 'vitest';
import { BIOMES } from './biomes';
import { QuestLog } from './quests';
import type { Task } from './forestData';

const forest = BIOMES[0];
const cave = BIOMES[1];

function logWith(...tasks: Task[]): QuestLog {
  const q = new QuestLog();
  q.tasks = tasks;
  return q;
}
const task = (metric: Task['metric'], goal: number, have = 0): Task => ({ metric, goal, have, reward: 'score' });

describe('QuestLog', () => {
  it('add() puts a quest from the world on the list', () => {
    const q = new QuestLog();
    q.add(forest);
    expect(q.tasks).toHaveLength(1);
    expect(forest.quests).toContain(q.tasks[0].metric);
  });

  it('does not offer the same metric twice while others are possible', () => {
    const q = new QuestLog();
    for (let i = 0; i < 2; i++) q.add(forest);
    expect(new Set(q.tasks.map((t) => t.metric)).size).toBe(2);
  });

  it('report() counts up, completes at the goal, removes the quest and counts it as done', () => {
    const q = logWith(task('mushroom', 3), task('coin', 5));
    expect(q.report('mushroom', 2)).toEqual([]);
    expect(q.tasks[0].have).toBe(2);
    const done = q.report('mushroom');
    expect(done.map((t) => t.metric)).toEqual(['mushroom']);
    expect(q.tasks.map((t) => t.metric)).toEqual(['coin']);
    expect(q.done).toBe(1);
  });

  it('report() ignores other metrics', () => {
    const q = logWith(task('bat', 1));
    expect(q.report('spider', 5)).toEqual([]);
    expect(q.tasks[0].have).toBe(0);
  });

  it('setProgress() sets a running value (no hit) and completes at the goal', () => {
    const q = logWith(task('nohit', 80, 70));
    expect(q.setProgress('nohit', 79)).toEqual([]);
    expect(q.setProgress('nohit', 0)[0]).toBeUndefined();
    expect(q.tasks[0].have).toBe(0);
    expect(q.setProgress('nohit', 80)).toHaveLength(1);
    expect(q.tasks).toHaveLength(0);
  });

  it('the boss quest replaces everything', () => {
    const q = logWith(task('imp', 3), task('coin', 5));
    q.startBossQuest();
    expect(q.tasks.map((t) => t.metric)).toEqual(['demon']);
  });

  it('adaptTo() swaps quests the new world cannot offer, keeps the others and the troll', () => {
    const q = logWith(task('mushroom', 5), task('slime', 4));
    q.adaptTo(cave);
    expect(q.tasks).toHaveLength(2);
    expect(q.tasks.find((t) => t.metric === 'slime')).toBeDefined(); // possible in the cave: kept
    expect(q.tasks.every((t) => cave.quests.includes(t.metric))).toBe(true);

    const withTroll = logWith(task('troll', 1), task('mushroom', 5));
    withTroll.adaptTo(cave);
    expect(withTroll.tasks.some((t) => t.metric === 'troll')).toBe(true);
    expect(withTroll.tasks.every((t) => t.metric === 'troll' || cave.quests.includes(t.metric))).toBe(true);
  });
});
