# Pizzas not added yet

The Pica journey serves real pizzas from the Harlekin inn menu (http://www.harlekin.si/gostilna/jedilnik/, section "Pice iz krušne peči", read 2026-11-18). Only pizzas whose toppings are fully covered by the current ingredient layers are in the game (`src/scenes/minigames/pizzaData.ts`):

- In the game: Margerita, Romana, Gobova, Štirje letni časi, Pica s tuno, Hrenovka, Kraška, Harlekin.
- Current ingredients: sauce (pelati), cheese (mocarela), ham, mushrooms, olives, frankfurter, prosciutto, onion, tuna.
- `origano` is on every menu pizza and is deliberately not modelled (no visible layer).

This file lists the rest, with what is missing for each. (Slovene names below are the menu's proper names; code ids must stay English.)

## How to add one
1. Draw any missing ingredient: a 500×500 layer `src/art/pizza-<id>.svg` and a 200×200 button icon `src/art/pizza-ico-<id>.svg` (copy the style of `pizza-ham.svg` / `pizza-ico-ham.svg`).
2. Add the ingredient to `INGREDIENTS` in `pizzaData.ts`.
3. Add a `pizza.<id>` key to both `src/i18n/en.ts` and `sl.ts`, and the pizza to a row of `TIERS` (easy to hard: customer 1, 2, 3).
4. The ingredient button row is already 9 buttons at 210px spacing on the 2048px canvas; a 10th still fits, more needs a second row or paging (`makeButtons` in `PizzaMaker.ts`).

## Missing ingredients that unlock the most pizzas
Dry/Hungarian salami, sour cream (kisla smetana), ajvar, panceta, klobasa (sausage), garlic, feferoni (hot peppers), rukola, fresh tomato, artichokes, feta.

## Engine note
Pizzas without mozzarella or without tomato sauce need a per-pizza `base`. `Pizza.base` and `check()` already support that; only the `pizza()` helper hardcodes `BASE = [sauce, cheese]`.

## Klasične
- Calcone (folded pizza: needs a folded-shape variant; ham, mushrooms, sour cream)
- Ogrska: ham, Hungarian salami, mushrooms, sour cream, ajvar
- Kmečka: panceta, onion, mushrooms, klobasa
- Pica Špica: ham, salami, mushrooms, frankfurters, feferoni, tržaška omaka, prosciutto, ajvar, sour cream
- T' dr'gačna: ham, salami, mushrooms, frankfurters, cabbage, radicchio or lettuce, beans, tuna, tatarska omaka

## Hišne
- Pivska (no tomato sauce): panceta, vratovina (pork neck), prosciutto, dry salami
- Ribn'čan: vratovina, fresh tomato, porcini (jurčki), basil
- Sv. Ana: chicken, rukola, sour cream, parmesan
- Gozdarska: vratovina, Hungarian salami, porcini, boiled egg, horseradish (hren)

## Morske
- Mornarska: salted fillets (anchovies), garlic
- Gamberi: prawns, rukola, parmesan
- Pica z morskimi sadeži: seafood, olives, tržaška omaka

## Pikantne
- Pikantna: dry salami, tabasco, mushrooms, feferoni, garlic
- Žerjavica: chili, smoked vratovina, feferoni, egg, ajvar
- Kurišče: chili, dry salami, mushrooms, onion, nacho cheese

## Vegetarijanske
- Vegetarijanska: asparagus, capers, artichokes, mushrooms, olives, corn, pepper
- Štirje siri: gouda, gorgonzola, parmesan (on top of mozzarella)
- Feta (no mozzarella): basil, olives, garlic, artichokes, feta
- Rukola (no mozzarella): fresh tomato, mushrooms, rukola, parmesan
- Mediteranska: fresh tomato, artichokes, feta, rosemary
- Pomladna: garlic, basil, fresh tomato, sunflower and pumpkin seeds
- Lahka: asparagus, capers, olives

## Picete in lepinje (different dish shapes, not pizzas)
Piceta s sirom / po tržaško / z baziliko / s panceto, and Lepinja.

## Dropped from the old invented list (not on the menu)
Hawaii (pineapple), Capricciosa, Vegetable, plain "ham" and "salami" pizzas. The old basil, pepper, pineapple and salami art was deleted; recover it from git history (before the Harlekin menu commit) if needed.
