import { makeTask, demonTask, type Metric, type Task } from './forestData';
import type { Biome } from './biomes';

/** The quests on offer (always up to two) and how many were completed. No Phaser: the scene shows them and pays
 *  the rewards for the tasks that `report` / `setProgress` hand back as completed. */
export class QuestLog {
  tasks: Task[] = [];
  done = 0;

  add(biome: Biome): void {
    this.tasks.push(makeTask(this.done, this.tasks.map((t) => t.metric), biome));
  }

  has(metric: Metric): boolean { return this.tasks.some((t) => t.metric === metric); }

  /** `n` more of `metric` happened. Returns the quests that this completed (they leave the log). */
  report(metric: Metric, n = 1): Task[] {
    const completed: Task[] = [];
    for (const t of this.tasks) {
      if (t.metric !== metric) continue;
      t.have += n;
      if (t.have >= t.goal) completed.push(t);
    }
    return this.finish(completed);
  }

  /** For quests that count a running value (metres without a hit): set it. Returns the completed ones. */
  setProgress(metric: Metric, have: number): Task[] {
    const completed: Task[] = [];
    for (const t of this.tasks) {
      if (t.metric !== metric) continue;
      t.have = have;
      if (t.have >= t.goal) completed.push(t);
    }
    return this.finish(completed);
  }

  /** The hell's last quest: shoot the demon. It replaces all others. */
  startBossQuest(): void { this.tasks = [demonTask()]; }

  /** Entering a new world: swap quests that could never be finished there (the troll boss quest stays). */
  adaptTo(biome: Biome): void {
    const kept = this.tasks.filter((t) => t.metric === 'troll' || biome.quests.includes(t.metric));
    this.tasks = this.tasks.map((t) => (kept.includes(t) ? t : makeTask(this.done, kept.map((k) => k.metric), biome)));
  }

  private finish(completed: Task[]): Task[] {
    if (completed.length) {
      this.tasks = this.tasks.filter((t) => !completed.includes(t));
      this.done += completed.length;
    }
    return completed;
  }
}
