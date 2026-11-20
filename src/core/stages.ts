import type { Key } from '../i18n';
import type { SceneKey } from '../scenes/registry';
import type { Pet } from './profile';
import { forestSave } from './forestSave';

/** `id` is unique within its journey (a hub places its buildings by it).
 *  `series`: entering this stage plays the whole journey `series` (a nested run of stages with its own map) and then returns to the hub. Its `scene` is 'StageMap'. */
export interface Stage { id: string; scene: SceneKey; icon: string; label: Key; data?: object; series?: JourneyId }

export type JourneyId = 'food' | 'city' | 'farm' | 'octopus';
export type { Pet };

/** `hub`: a free-roaming scene that replaces the StageMap for this journey. It launches the stages itself,
 *  in any order and repeatedly, so `progress.index` is not advanced for hub journeys.
 *  `catch`: what FishCut cuts in this journey, overriding the player's choice in the fish shop. */
export interface Journey { title: Key; stages: Stage[]; hub?: SceneKey; catch?: Catch }

/** Data-driven journeys. Add a stage = add a scene + an entry here. */
export const journeys: Record<JourneyId, Journey> = {
  food: {
    title: 'journey.food',
    stages: [
      { id: 'crumbs', scene: 'CrumbCatch', icon: 'chicken-body', label: 'stage.crumbs' },
      { id: 'poof', scene: 'Transform', icon: 'crumb', label: 'stage.poof' },
      { id: 'feed', scene: 'FeedMonster', icon: 'nugget', label: 'stage.feed' },
    ],
  },
  city: {
    title: 'journey.city',
    hub: 'CityHub',
    // Free roaming: the hub (src/scenes/CityHub.ts) has one building per stage, any of them can be
    // entered at any time, in any order, any number of times.
    stages: [
      { id: 'checkout', scene: 'Checkout', icon: 'scanner', label: 'stage.checkout' },
      { id: 'pets', scene: 'PetShop', icon: 'cage', label: 'stage.pets' },
      { id: 'sweets', scene: 'SweetShop', icon: 'sweets-icon', label: 'stage.sweets' },
      { id: 'fish', scene: 'FishShop', icon: 'fish-icon', label: 'stage.fish' },
      { id: 'octopus', scene: 'StageMap', icon: 'octopus', label: 'journey.octopus', series: 'octopus' },
      { id: 'cut', scene: 'FishCut', icon: 'knife', label: 'stage.cut' },
      { id: 'pizza', scene: 'PizzaMaker', icon: 'pizza-icon', label: 'stage.pizza' },
      // Up the path north of the town:
      { id: 'forest', scene: 'ForestRun', icon: 'forest-icon', label: 'stage.forest' },
      // In the clearing by the path: the hunting lookout (it opens its rifle shop first, see enterStage)
      { id: 'lookout', scene: 'HuntLookout', icon: 'lookout-icon', label: 'stage.lookout' },
      // Across the clearing from the lookout: the sawmill (chop, saw, make things, sell them)
      { id: 'mill', scene: 'Sawmill', icon: 'mill-icon', label: 'stage.mill' },
      // On the country road, between the town and the farm: the idle sawmill (experiment, docs/minigames/idle.md)
      { id: 'idle', scene: 'IdleMill', icon: 'mill-icon', label: 'stage.idle' },
      // Along the country road east of the town:
      { id: 'eggs', scene: 'EggCollect', icon: 'egg', label: 'stage.eggs' },
      { id: 'farm', scene: 'StageMap', icon: 'hen', label: 'stage.hunt', series: 'farm' },
      // The rest of the farm yard: the animals you milk, shear, feed and slaughter
      { id: 'cows', scene: 'CowMilk', icon: 'cow', label: 'stage.cows' },
      { id: 'sheep', scene: 'SheepShear', icon: 'sheep', label: 'stage.sheep' },
      { id: 'pigsty', scene: 'PigFeed', icon: 'pig', label: 'stage.pigsty' },
      { id: 'rabbits', scene: 'RabbitFeed', icon: 'bunny', label: 'stage.rabbits' },
      // The moored fishing boat at the south-east corner of the town:
      { id: 'boat', scene: 'FishingBoat', icon: 'boat-icon', label: 'stage.boat' },
      // Far west end of the bottom row:
      { id: 'food', scene: 'StageMap', icon: 'monster', label: 'journey.food', series: 'food' },
    ],
  },
  farm: {
    title: 'journey.farm',
    stages: [
      { id: 'hens', scene: 'FarmShoot', icon: 'hen', label: 'stage.hens', data: { animals: ['hen'], goal: 10, speed: 1 } },
      { id: 'pigs', scene: 'FarmShoot', icon: 'pig', label: 'stage.pigs', data: { animals: ['pig'], goal: 10, speed: 1.3 } },
      { id: 'all', scene: 'FarmShoot', icon: 'hen-gold', label: 'stage.all', data: { animals: ['hen', 'pig'], goal: 15, speed: 1.6, gold: true } },
    ],
  },
  octopus: {
    title: 'journey.octopus',
    catch: 'octopus',
    stages: [
      { id: 'hunt', scene: 'OctopusCatch', icon: 'octopus', label: 'stage.hunt' },
      { id: 'cut', scene: 'FishCut', icon: 'knife', label: 'stage.cut' },
      { id: 'cook', scene: 'Cook', icon: 'pot', label: 'stage.cook' },
      { id: 'munch', scene: 'FeedMonster', icon: 'salad', label: 'stage.munch', data: { food: 'salad', title: 'feed.monster' } },
    ],
  },
};

export type Catch = 'fish' | 'octopus';

/** `sub`: a series (see `Stage.series`) that is being played inside the current hub journey. `index` then counts
 *  through the series' stages. `fish` is the catch picked in the fish shop (a journey's own `catch` overrides it).
 *  `building`: id of the hub stage whose door the player last went through (null: start of the town).
 *  `earned`: the most stars won in each stage this journey, by `stageKey()`: replaying a stage can only improve it.
 *  `solo`: a city stage started from the minigame list instead of from its door: everything leaves to the list, not the town.
 *  Coins and the pet are not here: they outlive journeys (see `profile.ts`). */
export const progress: { journey: JourneyId; sub: JourneyId | null; index: number; earned: Record<string, number>; fish: Catch; building: string | null; solo: boolean } = {
  journey: 'food', sub: null, index: 0, earned: {}, fish: 'fish', building: null, solo: false,
};

/** Key of a stage in `progress.earned`. */
export function stageKeyOf(journey: JourneyId, stageId: string): string { return `${journey}:${stageId}`; }

/** The stage being played right now: the one the hub door led to, or the current stage of a plain journey. */
export function stageKey(): string {
  const j = currentJourney();
  const id = j.hub ? progress.building : j.stages[progress.index]?.id;
  return stageKeyOf(progress.sub ?? progress.journey, id ?? '?');
}

/** Record `stars` for the current stage (only if better than before). */
export function bankStars(stars: number): void {
  const key = stageKey();
  progress.earned[key] = Math.max(progress.earned[key] ?? 0, Math.max(0, Math.min(3, stars)));
}

export function starsEarned(journey: JourneyId, stageId: string): number { return progress.earned[stageKeyOf(journey, stageId)] ?? 0; }

/** Stars shown over a hub building (0-3): the best won in its stage, or, for a series, the average over the series' stages. */
export function buildingStars(stage: Stage): number {
  if (!stage.series) return starsEarned('city', stage.id);
  const inner = journeys[stage.series].stages;
  const sum = inner.reduce((a, st) => a + starsEarned(stage.series!, st.id), 0);
  return Math.round(sum / inner.length);
}

export function totalStars(): number { return Object.values(progress.earned).reduce((a, b) => a + b, 0); }

/** The journey whose stages are being played right now: the nested series if there is one. */
export function currentJourney(): Journey { return journeys[progress.sub ?? progress.journey]; }

/** What FishCut cuts right now. */
export function currentCatch(): Catch { return currentJourney().catch ?? progress.fish; }

/** Enter a stage's series (from a hub). */
export function startSeries(id: JourneyId): void {
  progress.sub = id;
  progress.index = 0;
}

/** Leave the series and go back to the hub journey (no-op when none is running). */
export function endSeries(): void {
  progress.sub = null;
  progress.index = 0;
}

/** The scene that shows the journey's progress and starts its next stage. */
export function hubScene(): SceneKey {
  if (progress.solo && !progress.sub) return 'GameSelect'; // a stage played alone returns to the list (a series still has its map)
  return currentJourney().hub ?? 'StageMap';
}

/** Called when a stage has been finished: returns the scene to go to. Hub journeys always return to their hub; in a
 *  plain journey it is the map until the last stage is done, then back to where it was started from: the hub when it
 *  was played as a series (this ends the series), or the game list. */
export function advanceFlow(): SceneKey {
  if (currentJourney().hub || progress.index < currentJourney().stages.length) return hubScene();
  if (!progress.sub) return 'GameSelect';
  endSeries();
  return hubScene();
}

export function startJourney(id: JourneyId): void {
  progress.journey = id;
  progress.sub = null;
  progress.index = 0;
  progress.earned = {};
  progress.building = null;
  progress.fish = 'fish';
  progress.solo = false;
}

/** Everything that happens on going through a building's door, and where it leads: the one place both the town and the
 *  minigame list use, so a stage plays the same either way. Call it with the hub journey (`city`) running. */
export function enterStage(stage: Stage): { scene: SceneKey; data?: object } {
  progress.building = stage.id;
  if (stage.series) startSeries(stage.series);
  // First time at the forest gate: look at the weapons before going in.
  if (stage.id === 'forest' && forestSave.best === 0) return { scene: 'ForestShop' };
  // The lookout always starts at the rifle shop, which goes on to the hunt.
  if (stage.id === 'lookout') return { scene: 'HuntShop' };
  return { scene: stage.scene, data: stage.data };
}

/** Play one of the city's stages from the minigame list: the same as walking into its door, but afterwards back to the list. */
export function startSolo(stage: Stage): { scene: SceneKey; data?: object } {
  // Starting the journey clears the stars, but the list must keep them: some things (rifles) need a total of stars.
  const earned = progress.earned;
  startJourney('city');
  progress.earned = earned;
  progress.solo = true;
  return enterStage(stage);
}
