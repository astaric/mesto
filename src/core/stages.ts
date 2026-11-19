import type { Key } from '../i18n';

/** `series`: entering this stage plays the whole journey `series` (a nested run of stages with its own map) and then returns to the hub. Its `scene` is 'StageMap'. */
export interface Stage { scene: string; icon: string; label: Key; data?: object; series?: JourneyId }

export type JourneyId = 'food' | 'city' | 'farm' | 'octopus' | 'forest' | 'pizza';
export type Pet = 'dog' | 'cat' | 'bunny';

/** `hub`: a free-roaming scene that replaces the StageMap for this journey. It launches the stages itself,
 *  in any order and repeatedly, so `progress.index` is not advanced for hub journeys. */
export interface Journey { title: Key; stages: Stage[]; hub?: string }

/** Data-driven journeys. Add a stage = add a scene + an entry here. */
export const journeys: Record<JourneyId, Journey> = {
  food: {
    title: 'journey.food',
    stages: [
      { scene: 'CrumbCatch', icon: 'chicken-body', label: 'stage.crumbs' },
      { scene: 'Transform', icon: 'crumb', label: 'stage.poof' },
      { scene: 'FeedMonster', icon: 'nugget', label: 'stage.feed' },
    ],
  },
  city: {
    title: 'journey.city',
    hub: 'CityHub',
    // Free roaming: the hub (src/scenes/CityHub.ts) has one building per stage, any of them can be
    // entered at any time, in any order, any number of times.
    stages: [
      { scene: 'Checkout', icon: 'scanner', label: 'stage.checkout' },
      { scene: 'PetShop', icon: 'cage', label: 'stage.pets' },
      { scene: 'SweetShop', icon: 'sweets-icon', label: 'stage.sweets' },
      { scene: 'FishShop', icon: 'fish-icon', label: 'stage.fish' },
      { scene: 'StageMap', icon: 'octopus', label: 'journey.octopus', series: 'octopus' },
      { scene: 'FishCut', icon: 'knife', label: 'stage.cut' },
      { scene: 'PizzaMaker', icon: 'pizza-icon', label: 'stage.pizza' },
      // Up the path north of the town:
      { scene: 'ForestRun', icon: 'forest-icon', label: 'stage.forest' },
      // Along the country road east of the town:
      { scene: 'EggCollect', icon: 'egg', label: 'stage.eggs' },
      { scene: 'StageMap', icon: 'hen', label: 'stage.hunt', series: 'farm' },
      // Far west end of the bottom row:
      { scene: 'StageMap', icon: 'monster', label: 'journey.food', series: 'food' },
    ],
  },
  farm: {
    title: 'journey.farm',
    stages: [
      { scene: 'FarmShoot', icon: 'hen', label: 'stage.hens', data: { animals: ['hen'], goal: 10, speed: 1 } },
      { scene: 'FarmShoot', icon: 'pig', label: 'stage.pigs', data: { animals: ['pig'], goal: 10, speed: 1.3 } },
      { scene: 'FarmShoot', icon: 'hen-gold', label: 'stage.all', data: { animals: ['hen', 'pig'], goal: 15, speed: 1.6, gold: true } },
    ],
  },
  forest: {
    title: 'journey.forest',
    stages: [
      { scene: 'ForestShop', icon: 'forest-gun', label: 'stage.arsenal' },
      { scene: 'ForestRun', icon: 'forest-icon', label: 'stage.forest' },
    ],
  },
  pizza: {
    title: 'journey.pizza',
    stages: [
      { scene: 'FishCut', icon: 'pizza-cut-cheese', label: 'stage.cut', data: { items: ['pizza-cut-cheese', 'pizza-cut-frankfurter', 'pizza-cut-onion'] } },
      { scene: 'PizzaMaker', icon: 'pizza-icon', label: 'stage.pizza' },
    ],
  },
  octopus: {
    title: 'journey.octopus',
    stages: [
      { scene: 'OctopusCatch', icon: 'octopus', label: 'stage.hunt' },
      { scene: 'FishCut', icon: 'knife', label: 'stage.cut' },
      { scene: 'Cook', icon: 'pot', label: 'stage.cook' },
      { scene: 'FeedMonster', icon: 'salad', label: 'stage.munch', data: { food: 'salad', title: 'feed.monster' } },
    ],
  },
};

/** Kept for compatibility: the original journey's stages. */
export const stages: Stage[] = journeys.food.stages;

export type Treat = 'cake' | 'cupcake';
export type Catch = 'fish' | 'octopus';

/** `sub`: a series (see `Stage.series`) that is being played inside the current hub journey. `index` then counts
 *  through the series' stages; `savedFish` is what `fish` was before the series changed it. */
export const progress: { journey: JourneyId; sub: JourneyId | null; index: number; stars: number; coins: number; pet: Pet; petOwned: boolean; treat: Treat; fish: Catch; savedFish: Catch; building: number } = {
  journey: 'food', sub: null, index: 0, stars: 0, coins: 0, pet: 'dog', petOwned: false, treat: 'cake', fish: 'fish', savedFish: 'fish', building: -1,
};

/** The journey whose stages are being played right now: the nested series if there is one. */
export function currentJourney(): Journey { return journeys[progress.sub ?? progress.journey]; }

function fishFor(id: JourneyId): Catch { return id === 'octopus' ? 'octopus' : 'fish'; }

/** Enter a stage's series (from a hub). */
export function startSeries(id: JourneyId): void {
  progress.sub = id;
  progress.index = 0;
  progress.savedFish = progress.fish;
  progress.fish = fishFor(id);
}

/** Leave the series and go back to the hub journey (no-op when none is running). */
export function endSeries(): void {
  if (!progress.sub) return;
  progress.sub = null;
  progress.index = 0;
  progress.fish = progress.savedFish;
}

/** Scene to go to after a stage is finished. Hub journeys always return to their hub; in a plain journey it is
 *  the map until the last stage is done, then back to where it was started from: the hub when it was played as a
 *  series, or the game list. */
export function afterStage(): string {
  if (currentJourney().hub || progress.index < currentJourney().stages.length) return hubScene();
  if (!progress.sub) return 'GameSelect';
  endSeries();
  return hubScene();
}

/** The scene that shows the journey's progress and starts its next stage. */
export function hubScene(): string { return currentJourney().hub ?? 'StageMap'; }

export function startJourney(id: JourneyId): void {
  progress.journey = id;
  progress.sub = null;
  progress.index = 0;
  progress.stars = 0;
  progress.coins = 0;
  progress.pet = 'dog';
  progress.petOwned = false;
  progress.building = -1; // hub journeys: the building you last entered
  progress.treat = 'cake';
  progress.fish = fishFor(id);
}

export function resetProgress(): void { startJourney('food'); }
