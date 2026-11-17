export interface Stage { scene: string; icon: string; label: string; data?: object }

export type JourneyId = 'food' | 'mesto';
export type Pet = 'dog' | 'cat' | 'bunny';

export interface Journey { title: string; stages: Stage[] }

/** Data-driven journeys. Add a stage = add a scene + an entry here. */
export const journeys: Record<JourneyId, Journey> = {
  food: {
    title: 'The Silly Journey',
    stages: [
      { scene: 'CrumbCatch', icon: 'chicken-body', label: 'Crumbs!' },
      { scene: 'Transform', icon: 'crumb', label: 'Poof!' },
      { scene: 'FeedMonster', icon: 'nugget', label: 'Feed!' },
      { scene: 'Finale', icon: 'monster', label: 'Yum!' },
    ],
  },
  mesto: {
    title: 'Mesto',
    stages: [
      { scene: 'CityWalk', icon: 'metro', label: 'V mesto!', data: { goal: 'metro' } },
      { scene: 'Checkout', icon: 'scanner', label: 'Blagajna!' },
      { scene: 'PetShop', icon: 'cage', label: 'Živali!' },
      { scene: 'CityWalk', icon: 'fence', label: 'Domov!', data: { goal: 'farm' } },
      { scene: 'MestoFinale', icon: 'star', label: 'Bravo!' },
    ],
  },
};

/** Kept for compatibility: the original journey's stages. */
export const stages: Stage[] = journeys.food.stages;

export const progress: { journey: JourneyId; index: number; stars: number; coins: number; pet: Pet } = {
  journey: 'food', index: 0, stars: 0, coins: 0, pet: 'dog',
};

export function currentJourney(): Journey { return journeys[progress.journey]; }

export function startJourney(id: JourneyId): void {
  progress.journey = id;
  progress.index = 0;
  progress.stars = 0;
  progress.coins = 0;
  progress.pet = 'dog';
}

export function resetProgress(): void { startJourney('food'); }
