# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server on port 5173 (strict port, exposed on the LAN so an iPad can connect). Also configured as `dev` in `.claude/launch.json`.
- `npm run build` — `tsc --noEmit && vite build`. Type-checking is the only static check; there is no linter or test suite.
- `npm run preview` — serve the production build (also `preview` in `.claude/launch.json`, port 4173). Use this to test the offline service worker; it is only registered in production builds.
- The latest commit's date/time and subject are injected at build/dev-start as `__BUILD_COMMIT__` (`define` in `vite.config.ts`, typed in `src/build-info.d.ts`) and shown faintly at the bottom of `Title`. In dev it only updates when the dev server restarts.
- Dev-only helpers: `window.__game` exposes the Phaser game instance; `?debug` in the URL shows an FPS counter.

## Workflow

- Always commit when you are done with a task (after `npm run build` passes). Don't wait to be asked.
- **Language rule:** all code is English, always, even though the game's player-facing text is Slovene and the conversation may be too. That covers identifiers, comments, file names, scene keys, journey ids, enum/union values, texture keys and `src/art/*.svg` file names, storage keys and commit messages (e.g. `forest-mushroom.svg`, not `gozd-gobec.svg`; `'city'`, not `'mesto'`). The only Slovene allowed is in `src/i18n/sl.ts`, and it must never double as a key, id or texture name. If a Slovene word shows up in code, rename it. The product name "Mesto" is the one exception: it is a brand name (manifest, `index.html`, package name, title screen).
- Scene modules must not read `W`/`H` (imported from `src/main.ts`) at module top level: it's a circular import and throws "Cannot access 'W' before initialization". Use them inside methods only.

## Architecture

Phaser 4 + TypeScript + Vite kids' game targeting iPad (installable via `public/manifest.webmanifest`). The game uses a fixed 2048×1536 canvas (`W`, `H` exported from `src/main.ts`) scaled with `Phaser.Scale.FIT`; lay everything out in those coordinates. Player-facing text is Slovene by default with an English translation, managed by the i18n module (see **Translations** below).

**Journeys and stages** (`src/core/stages.ts`): the game is data-driven. A `Journey` is an ordered list of `Stage`s (`{scene, icon, label, data?}`), and the module-level `progress` object holds the current journey, stage index, stars, coins and chosen pet. Flow: `Title` → `GameSelect` (pick a journey, calls `startJourney`) → `StageMap` (shows stages, "Go!" starts the scene of `stages[progress.index]`, passing `data`) → stage scene → back to `StageMap`. To add a stage: write a scene, register it in the `scene` array in `src/main.ts`, and add an entry to the journey. To add a journey: extend `JourneyId`, `journeys`, and the `cards` list in `src/scenes/GameSelect.ts`.

**Stage scenes** extend `StageScene` (`src/core/MiniGame.ts`); calling `finish(stars)` awards stars, increments `progress.index`, and fades back to `StageMap`. Finale scenes (`Finale`, `CityFinale`, `OctopusFinale`, `ForestFinale`, `PizzaFinale`) end a journey. Journey ids are `food`, `city`, `farm`, `octopus`, `forest`, `pizza`. Minigames live in `src/scenes/minigames/`; the same scene can be reused with different `data` (e.g. `CityWalk` with `goal: 'metro'` vs `'farm'`).

**Forest journey** (`ForestRun`, `src/scenes/minigames/forestData.ts`): endless first-person shooter on a forest path. It is pseudo-3D done by hand: entities have world `x`/`z`, `proj()` maps them to the screen (`s = FOCAL/(FOCAL+z)`, depth = `-z`), and the path is redrawn each frame into a Graphics. Enemy/item stats and quest templates live in `forestData.ts`; art is `src/art/forest-*.svg`. Left-bottom joystick strafes, any other tap shoots at that point.

**Pica journey** (`PizzaMaker`, `src/scenes/minigames/pizzaData.ts`): `FishCut` (with `data.items`, a queue of texture keys, instead of `progress.fish`) cuts ingredients, then `PizzaMaker` serves 3 customers. The pizzas are real ones from the Harlekin inn menu (harlekin.si); the ones not added yet, and what ingredient each still needs, are in `TODO-pizzas.md`. A pizza is stacked 500×500 layer textures `pizza-<ingredient>` on `pizza-dough`; the customer's order bubble is built from the same layers. `check()` requires sauce then cheese first, then exactly the toppings in any order; a wrong pizza repeats the same customer.

**Translations** (`src/i18n/`): `en.ts` is the source of truth, a flat `as const` object of English-keyed strings (`'quest.bear': '🐻 Defeat bears {n}'`) and `type Key = keyof typeof en`; `sl.ts` is `Record<Key, string>`, so a missing translation fails `tsc`. `t(key, { n })` fills `{name}` placeholders. Never write player-visible text inline in a scene: add a key to both files (namespaced by area: `stage.*`, `quest.*`, `forest.*`, ...) and call `t()` inside `create()`/methods, not at module top level (the language is read at startup and can change on the Title screen). Data tables store keys, not text (`Stage.label` and `Journey.title` are `Key`s; pizza names are `pizza.${id}`), and are translated where rendered. The language comes from `?lang=sl|en` (remembered), then localStorage `lang`, then Slovene; the corner button on `Title` switches it and restarts the scene. To add a language: extend `Lang`/`LANGS` in `index.ts`, add a `Record<Key, string>` table. No plural helper yet: add one when a string needs a real count.

**Assets**: there are no image or audio files to load by hand. Every SVG in `src/art/` is auto-loaded by `Boot` (via `import.meta.glob`) as a texture keyed by its filename without extension (`src/art/monster.svg` → `'monster'`), rasterised at scale 1.5. Sound is synthesised with WebAudio in `src/core/sfx.ts`; `unlockAudio()` must be called from a user tap (iOS rule).

**Touch helpers** (`src/core/touch.ts`): `dragX`, `tapButton`, `text` — use these for large, forgiving touch targets and consistent styling. Input supports 3 simultaneous pointers.

**Offline**: the `offlineServiceWorker` plugin in `vite.config.ts` emits `dist/sw.js` after every build, precaching every built file (cache name = content hash, so each build replaces the old cache). It is registered from the bottom of `src/main.ts` in production only. Cache-first, ignoring query strings and `Vary` (needed for the crossorigin module script). iOS requires HTTPS (or localhost) for service workers, so the home-screen app must be installed from a secure host; after the first online launch it works offline, and a new deploy is picked up on the next launch after that.

**Deploy**: `.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main` (repo Settings → Pages → Source must be "GitHub Actions"). Pages serves project sites from `/<repo>/`, so the build uses `base: './'` and every URL (index.html links, manifest, `sw.js` precache list, SW registration) must stay relative; never add root-absolute (`/foo`) URLs.
