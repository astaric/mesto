export interface Stage { scene: string; icon: string; label: string; data?: object }

export type JourneyId = 'food' | 'mesto' | 'farm' | 'hobotnica' | 'gozd' | 'pica';
export type Pet = 'dog' | 'cat' | 'bunny';

export interface Journey { title: string; stages: Stage[] }

/** Data-driven journeys. Add a stage = add a scene + an entry here. */
export const journeys: Record<JourneyId, Journey> = {
  food: {
    title: 'Smešna hrana',
    stages: [
      { scene: 'CrumbCatch', icon: 'chicken-body', label: 'Drobtine!' },
      { scene: 'Transform', icon: 'crumb', label: 'Puf!' },
      { scene: 'FeedMonster', icon: 'nugget', label: 'Hrani!' },
      { scene: 'Finale', icon: 'monster', label: 'Mmm!' },
    ],
  },
  mesto: {
    title: 'Mesto',
    stages: [
      { scene: 'CityWalk', icon: 'metro', label: 'V mesto!', data: { goal: 'metro' } },
      { scene: 'Checkout', icon: 'scanner', label: 'Blagajna!' },
      { scene: 'PetShop', icon: 'cage', label: 'Živali!' },
      { scene: 'SweetShop', icon: 'sweets-icon', label: 'Sladice!' },
      { scene: 'FishShop', icon: 'fish-icon', label: 'Ribe!' },
      { scene: 'CityWalk', icon: 'fence', label: 'Domov!', data: { goal: 'farm' } },
      { scene: 'EggCollect', icon: 'egg', label: 'Jajca!' },
      { scene: 'FishCut', icon: 'knife', label: 'Režem!' },
      { scene: 'MestoFinale', icon: 'star', label: 'Bravo!' },
    ],
  },
  farm: {
    title: 'Kmetija',
    stages: [
      { scene: 'FarmShoot', icon: 'hen', label: 'Kokoši!', data: { animals: ['hen'], goal: 10, speed: 1 } },
      { scene: 'FarmShoot', icon: 'pig', label: 'Pujsi!', data: { animals: ['pig'], goal: 10, speed: 1.3 } },
      { scene: 'FarmShoot', icon: 'hen-gold', label: 'Vse!', data: { animals: ['hen', 'pig'], goal: 15, speed: 1.6, gold: true } },
      { scene: 'FarmFinale', icon: 'star', label: 'Bravo!' },
    ],
  },
  gozd: {
    title: 'Gozd',
    stages: [
      { scene: 'ForestRun', icon: 'gozd-ikona', label: 'Gozd!' },
      { scene: 'ForestFinale', icon: 'star', label: 'Bravo!' },
    ],
  },
  pica: {
    title: 'Pica',
    stages: [
      { scene: 'FishCut', icon: 'pizza-cut-salama', label: 'Režem!', data: { items: ['pizza-cut-salama', 'pizza-cut-paprika', 'pizza-cut-sir'] } },
      { scene: 'PizzaMaker', icon: 'pizza-icon', label: 'Pica!' },
      { scene: 'PizzaFinale', icon: 'star', label: 'Bravo!' },
    ],
  },
  hobotnica: {
    title: 'Hobotnica',
    stages: [
      { scene: 'OctopusCatch', icon: 'octopus', label: 'Lov!' },
      { scene: 'FishCut', icon: 'knife', label: 'Režem!' },
      { scene: 'Cook', icon: 'pot', label: 'Kuham!' },
      { scene: 'FeedMonster', icon: 'salad', label: 'Mljask!', data: { food: 'salad', title: 'Nahrani pošast!' } },
      { scene: 'HobotnicaFinale', icon: 'star', label: 'Bravo!' },
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
  progress.fish = id === 'hobotnica' ? 'octopus' : 'fish';
}

export function resetProgress(): void { startJourney('food'); }
