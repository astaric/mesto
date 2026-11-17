export interface Stage { scene: string; icon: string; label: string }

/** Data-driven journey. Add a stage = add a scene + an entry here. */
export const stages: Stage[] = [
  { scene: 'CrumbCatch', icon: 'chicken-body', label: 'Crumbs!' },
  { scene: 'Transform', icon: 'crumb', label: 'Poof!' },
  { scene: 'FeedMonster', icon: 'nugget', label: 'Feed!' },
  { scene: 'Finale', icon: 'monster', label: 'Yum!' },
];

export const progress = { index: 0, stars: 0 };

export function resetProgress(): void { progress.index = 0; progress.stars = 0; }
