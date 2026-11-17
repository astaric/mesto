# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server on port 5173 (strict port, exposed on the LAN so an iPad can connect). Also configured as `dev` in `.claude/launch.json`.
- `npm run build` — `tsc --noEmit && vite build`. Type-checking is the only static check; there is no linter or test suite.
- `npm run preview` — serve the production build.
- Dev-only helpers: `window.__game` exposes the Phaser game instance; `?debug` in the URL shows an FPS counter.

## Architecture

Phaser 4 + TypeScript + Vite kids' game targeting iPad (installable via `public/manifest.webmanifest`). The game uses a fixed 2048×1536 canvas (`W`, `H` exported from `src/main.ts`) scaled with `Phaser.Scale.FIT`; lay everything out in those coordinates. Dialogue text is Slovenian in the Mesto journey.

**Journeys and stages** (`src/core/stages.ts`): the game is data-driven. A `Journey` is an ordered list of `Stage`s (`{scene, icon, label, data?}`), and the module-level `progress` object holds the current journey, stage index, stars, coins and chosen pet. Flow: `Title` → `GameSelect` (pick a journey, calls `startJourney`) → `StageMap` (shows stages, "Go!" starts the scene of `stages[progress.index]`, passing `data`) → stage scene → back to `StageMap`. To add a stage: write a scene, register it in the `scene` array in `src/main.ts`, and add an entry to the journey. To add a journey: extend `JourneyId`, `journeys`, and the `cards` list in `src/scenes/GameSelect.ts`.

**Stage scenes** extend `StageScene` (`src/core/MiniGame.ts`); calling `finish(stars)` awards stars, increments `progress.index`, and fades back to `StageMap`. Finale scenes (`Finale`, `MestoFinale`) end a journey. Minigames live in `src/scenes/minigames/`; the same scene can be reused with different `data` (e.g. `CityWalk` with `goal: 'metro'` vs `'farm'`).

**Assets**: there are no image or audio files to load by hand. Every SVG in `src/art/` is auto-loaded by `Boot` (via `import.meta.glob`) as a texture keyed by its filename without extension (`src/art/monster.svg` → `'monster'`), rasterised at scale 1.5. Sound is synthesised with WebAudio in `src/core/sfx.ts`; `unlockAudio()` must be called from a user tap (iOS rule).

**Touch helpers** (`src/core/touch.ts`): `dragX`, `tapButton`, `text` — use these for large, forgiving touch targets and consistent styling. Input supports 3 simultaneous pointers.
