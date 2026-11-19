import { beforeEach, describe, expect, it } from 'vitest';
import { advanceFlow, bankStars, currentCatch, currentJourney, endSeries, hubScene, journeys, progress, startJourney, startSeries, stageKey, starsEarned, totalStars, type JourneyId } from './stages';
import { artKeys } from '../test/art';
import { en } from '../i18n/en';

const ids = Object.keys(journeys) as JourneyId[];

describe('journey data', () => {
  it.each(ids)('%s: stage ids are unique', (id) => {
    const seen = journeys[id].stages.map((s) => s.id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it.each(ids)('%s: every stage icon is an art file and every label is translated', (id) => {
    for (const s of journeys[id].stages) {
      expect(artKeys.has(s.icon), `${id}/${s.id} icon ${s.icon}`).toBe(true);
      expect(s.label in en, `${id}/${s.id} label ${s.label}`).toBe(true);
    }
  });

  it('every series stage points at a journey, and plays on the StageMap', () => {
    for (const id of ids) {
      for (const s of journeys[id].stages) {
        if (!s.series) continue;
        expect(journeys[s.series], `${id}/${s.id}`).toBeDefined();
        expect(s.scene).toBe('StageMap');
      }
    }
  });

  it('a series is never a hub journey', () => {
    for (const id of ids) for (const s of journeys[id].stages) if (s.series) expect(journeys[s.series].hub).toBeUndefined();
  });
});

describe('flow', () => {
  beforeEach(() => startJourney('farm'));

  it('a plain journey goes to its map until the last stage is done, then to the game list', () => {
    const n = journeys.farm.stages.length;
    for (progress.index = 0; progress.index < n; progress.index++) expect(advanceFlow()).toBe('StageMap');
    progress.index = n;
    expect(advanceFlow()).toBe('GameSelect');
  });

  it('a hub journey always returns to its hub', () => {
    startJourney('city');
    expect(hubScene()).toBe('CityHub');
    progress.index = 99;
    expect(advanceFlow()).toBe('CityHub');
  });

  it('a series runs on its own stages, then ends and returns to the hub', () => {
    startJourney('city');
    startSeries('farm');
    expect(currentJourney()).toBe(journeys.farm);
    expect(progress.sub).toBe('farm');
    expect(hubScene()).toBe('StageMap');
    progress.index = journeys.farm.stages.length - 1;
    expect(advanceFlow()).toBe('StageMap');
    progress.index = journeys.farm.stages.length;
    expect(advanceFlow()).toBe('CityHub');
    expect(progress.sub).toBeNull();
    expect(currentJourney()).toBe(journeys.city);
  });

  it('leaving a series early goes back to the hub journey', () => {
    startJourney('city');
    startSeries('food');
    progress.index = 2;
    endSeries();
    expect(progress.sub).toBeNull();
    expect(progress.index).toBe(0);
  });

  it('the octopus series cuts octopus, then the shop choice applies again', () => {
    startJourney('city');
    progress.fish = 'fish';
    expect(currentCatch()).toBe('fish');
    startSeries('octopus');
    expect(currentCatch()).toBe('octopus');
    endSeries();
    expect(currentCatch()).toBe('fish');
  });

  it('startJourney resets the progress', () => {
    progress.earned = { 'city:pets': 3 }; progress.building = 'pets'; progress.fish = 'octopus';
    startJourney('pizza');
    expect(progress).toMatchObject({ journey: 'pizza', sub: null, index: 0, earned: {}, building: null, fish: 'fish' });
  });
});

describe('stars', () => {
  it('keys a plain journey stage by its index, a hub stage by its door, and a series stage inside the series', () => {
    startJourney('farm');
    progress.index = 1;
    expect(stageKey()).toBe('farm:pigs');
    startJourney('city');
    progress.building = 'pets';
    expect(stageKey()).toBe('city:pets');
    startSeries('octopus');
    progress.index = 2;
    expect(stageKey()).toBe('octopus:cook');
  });

  it('banks the best result of a stage only, so replaying cannot inflate the total', () => {
    startJourney('city');
    progress.building = 'checkout';
    bankStars(2); bankStars(1); bankStars(2);
    expect(starsEarned('city', 'checkout')).toBe(2);
    bankStars(3);
    progress.building = 'sweets';
    bankStars(3);
    expect(totalStars()).toBe(6);
    bankStars(99);
    expect(starsEarned('city', 'sweets')).toBe(3);
  });
});
