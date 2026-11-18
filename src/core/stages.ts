import type { Key } from '../i18n';

export interface Stage { scene: string; icon: string; label: Key; data?: object }

export type JourneyId = 'food' | 'city' | 'farm' | 'octopus' | 'forest' | 'pizza';
export type Pet = 'dog' | 'cat' | 'bunny';

export interface Journey { title: Key; stages: Stage[] }

/** Data-driven journeys. Add a stage = add a scene + an entry here. */
export const journeys: Record<JourneyId, Journey> = {
  food: {
    title: 'journey.food',
    stages: [
      { scene: 'CrumbCatch', icon: 'chicken-body', label: 'stage.crumbs' },
      { scene: 'Transform', icon: 'crumb', label: 'stage.poof' },
      { scene: 'FeedMonster', icon: 'nugget', label: 'stage.feed' },
      { scene: 'Finale', icon: 'monster', label: 'common.yum' },
    ],
  },
  city: {
    title: 'journey.city',
    stages: [
      { scene: 'CityWalk', icon: 'metro', label: 'stage.toCity', data: { goal: 'metro' } },
      { scene: 'Checkout', icon: 'scanner', label: 'stage.checkout' },
      { scene: 'PetShop', icon: 'cage', label: 'stage.pets' },
      { scene: 'SweetShop', icon: 'sweets-icon', label: 'stage.sweets' },
      { scene: 'FishShop', icon: 'fish-icon', label: 'stage.fish' },
      { scene: 'CityWalk', icon: 'fence', label: 'stage.home', data: { goal: 'farm' } },
      { scene: 'EggCollect', icon: 'egg', label: 'stage.eggs' },
      { scene: 'FishCut', icon: 'knife', label: 'stage.cut' },
      { scene: 'CityFinale', icon: 'star', label: 'common.bravo' },
    ],
  },
  farm: {
    title: 'journey.farm',
    stages: [
      { scene: 'FarmShoot', icon: 'hen', label: 'stage.hens', data: { animals: ['hen'], goal: 10, speed: 1 } },
      { scene: 'FarmShoot', icon: 'pig', label: 'stage.pigs', data: { animals: ['pig'], goal: 10, speed: 1.3 } },
      { scene: 'FarmShoot', icon: 'hen-gold', label: 'stage.all', data: { animals: ['hen', 'pig'], goal: 15, speed: 1.6, gold: true } },
      { scene: 'FarmFinale', icon: 'star', label: 'common.bravo' },
    ],
  },
  forest: {
    title: 'journey.forest',
    stages: [
      { scene: 'ForestRun', icon: 'forest-icon', label: 'stage.forest' },
      { scene: 'ForestFinale', icon: 'star', label: 'common.bravo' },
    ],
  },
  pizza: {
    title: 'journey.pizza',
    stages: [
      { scene: 'FishCut', icon: 'pizza-cut-cheese', label: 'stage.cut', data: { items: ['pizza-cut-cheese', 'pizza-cut-frankfurter', 'pizza-cut-onion'] } },
      { scene: 'PizzaMaker', icon: 'pizza-icon', label: 'stage.pizza' },
      { scene: 'PizzaFinale', icon: 'star', label: 'common.bravo' },
    ],
  },
  octopus: {
    title: 'journey.octopus',
    stages: [
      { scene: 'OctopusCatch', icon: 'octopus', label: 'stage.hunt' },
      { scene: 'FishCut', icon: 'knife', label: 'stage.cut' },
      { scene: 'Cook', icon: 'pot', label: 'stage.cook' },
      { scene: 'FeedMonster', icon: 'salad', label: 'stage.munch', data: { food: 'salad', title: 'feed.monster' } },
      { scene: 'OctopusFinale', icon: 'star', label: 'common.bravo' },
    ],
  },
};

/** Kept for compatibility: the original journey's stages. */
export const stages: Stage[] = journeys.food.stages;

export type Treat = 'cake' | 'cupcake';
export type Catch = 'fish' | 'octopus';

export const progress: { journey: JourneyId; index: number; stars: number; coins: number; pet: Pet; treat: Treat; fish: Catch } = {
  journey: 'food', index: 0, stars: 0, coins: 0, pet: 'dog', treat: 'cake', fish: 'fish',
};

export function currentJourney(): Journey { return journeys[progress.journey]; }

export function startJourney(id: JourneyId): void {
  progress.journey = id;
  progress.index = 0;
  progress.stars = 0;
  progress.coins = 0;
  progress.pet = 'dog';
  progress.treat = 'cake';
  progress.fish = id === 'octopus' ? 'octopus' : 'fish';
}

export function resetProgress(): void { startJourney('food'); }
