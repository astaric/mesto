---
name: idle-mill
description: Use when implementing or changing any part of the idle sawmill minigame (scene IdleMill, src/scenes/minigames/idle/, docs/minigames/idle.md and idle-plan.md): the isometric world, forest and tapping, machines, forklifts, trucks, economy, upgrades, save, art. Gives the state of the experiment, the decisions already made and how to work and verify, so you do not have to guess what is being built. The part to implement is passed as the argument; if there is none, ask which step of idle-plan.md.
---

# Idle sawmill

An experimental idle (incremental) minigame in 2:1 isometric projection. **The part to implement now is the skill's argument** (for example "step 4 in
`docs/minigames/idle-plan.md`: forest and tapping"). If no part was given, ask which step of the plan.

## Read first, in this order (do not survey the rest of the repo)

1. `CLAUDE.md`: project rules (English-only code, i18n in `en.ts` AND `sl.ts`, storage only through `src/core/storage.ts`, no raw colours/fonts, shared HUD helpers).
2. `docs/minigames/idle.md`: the design reference: the chain, the decisions, the isometric grid maths, the zone table with tile coordinates, the top-down map, the rules sketch,
   the open questions.
3. `docs/minigames/idle-plan.md`: the ordered steps; step 1 (static prototype) is done, the rest are not. Tick off what you finish; move anything that turns out to be wrong into `idle.md`.
4. `docs/new-minigame.md` only if you need a helper from the shared UI list.

## The game in one paragraph

Flow left to right. Forest (top left, lumberjack plots; the player taps an idle lumberjack to chop/replant, a supervisor upgrade automates it) -> logging truck on the ingress
road -> trunk pile -> forklift F1 -> debarker -> storage area (peeled trunks wait for a free saw) -> forklifts F2 -> row 1 saws (a trunk becomes a square log, the trade term is a
"cant") -> F3 -> row 2 saws (optional, rough planks) -> F4 -> row 3 planers (optional, planed planks) -> F5 -> loading yard -> delivery truck on a separate delivery road -> exit
ramp bottom right -> sold for coins (`earn()` in `core/profile.ts`). **Rows 2 and 3 are optional**: the loading yard gets the output of the last built row, so square logs and
rough planks can be sold directly, just cheaper (the price rises along the chain); a row can only be built after the one before it. Each row has up to 3 machines (3 x 3 tiles) bought one
by one at rising prices, from the screen-left end (`SLOT_GY` = 13, 9, 5); only row 1's first machine exists at the start. Machines are turned along the flow (a log goes in on the left,
comes out on the right); the forklift aisles run along `gy` between the rows and serve every machine of the row before and after. Upgrades are bought by tapping the thing (a bubble with
its level and price; `priceTag()`/`pay()` from `core/ui.ts`). The factory is an open-sided shed with no roof. The world is 55 x 22 tiles (4928 x 2768 px) and scrolls: drag to pan,
an overview button zooms out.

## What exists (step 1, a static prototype)

- `src/scenes/minigames/idle/idleIso.ts` (+ test): grid constants (`GX = 55`, `GY = 22`, 128 x 64 tiles), `toWorld(gx, gy, z)`, `toTile(x, y)`. Phaser-free.
- `idleLayout.ts` (+ test): every zone, the shed, `FOREST_PLOTS`, `PILE`, `F1_LANE`, `DEBARKER`, `STORAGE`, `AISLES` f2..f5, `ROWS` 1..3, `SLOTS` (9), `SLOT_GY`, `STARTING_SLOT`,
  `TRUCK_STOPS`, `LOADING_YARD`, `DELIVERY_ROAD`, `EXIT_ROAD`, `GROUND` painting order, `LABELS`. Phaser-free. The tests encode the geometry (aisles between the rows, the chain lines up,
  the trucks stop beside the pile and yard): keep them passing when you move things.
- `idleDraw.ts`: draws the whole static world ONCE into one Phaser Graphics, back to front, with flat placeholder blocks. Moving things need real sprites and a plan for depth-sorting
  against this static layer (step 5 of the plan).
- `IdleMill.ts`: the scene. **Two cameras**: the main camera shows the world (a Phaser `Layer`; it scrolls and zooms, has bounds, drag-to-pan with an 18 px threshold so taps still work,
  the overview button tweens the camera zoom); a second camera added on top shows only the HUD (top band, bottom band with six stock counters that are static zeros, back button, coins).
  HUD objects are collected from `this.children.list` and ignored by the main camera; the world layer is ignored by the HUD camera. **Any new world object must be added to the world
  layer and ignored by the HUD camera (`ui.ignore(obj)`); any new HUD object must be ignored by the main camera (`cam.ignore(obj)`).**
- Wiring: stage `{ id: 'idle', scene: 'IdleMill', icon: 'mill-icon' (reused for now), label: 'stage.idle' }` in `src/core/stages.ts` (city journey), a door spot `{ id: 'idle', x: 3950, TOP_BASE ... }`
  in `src/scenes/city/town.ts`, `IdleMill` in `src/scenes/registry.ts`, texts in `en.ts` and `sl.ts` (`stage.idle`, `idle.title`, `idle.stock.*`, `idle.zone.*`). The scene never calls
  `win()` (open-ended); ◀ goes back through `StageScene.onBack()`.

## Decisions already made (do not re-ask)

Two trucks on two one-way roads; upgrades by tapping the part; open-sided shed; the forest is an active part of the game; up to 3 machines per row at rising prices; rows 2 and 3 optional and
unlocked in order; storage area between debarker and saws; scrolling camera with an overview button. The open questions at the end of `idle.md` (prices, curves, stars, save format, offline
progress, door icon) are yours to propose values for when your part needs them: keep them in data tables and write them into the doc.

## How to work

- Rules and numbers go in Phaser-free modules (`idleData.ts` tables, `idleLogic.ts` with `tick(state, dt)`) with vitest tests next to them, like `minigames/sawmill/millLogic.ts` and
  `millData.ts`. The scene only draws and wires input. Never import Phaser in the logic files.
- All per-play state is reset in `create()` (the scene object is reused). Text only through `t()`, with keys added to BOTH `en.ts` and `sl.ts` (Slovene is a `Record<Key, string>`, a missing key
  fails `tsc`); call `t()` inside `create()`/methods, never at module top level.
- A new saved value: a new module in `src/core/` using `storage.ts`, plus a line in `resetProgress()` in `src/core/reset.ts` and its test.
- New art: an SVG in `src/art/`, English file names with an `idle-` prefix, auto-loaded by `Boot` under the file name without extension, rasterised at 1.5x; a texture key in a table that has no
  file fails a test.
- A world tap handler must ignore a pointer that has moved past the drag threshold, and a HUD tap must not also act on the world.
- Keep `docs/minigames/idle.md` and `idle-plan.md` in step with the code in the same change.

## Verify

`npm run build` and `npm test` pass AND you looked at it in the browser: `preview_start` with name `dev` (port 5173 may be taken, it picks another, e.g. 5174). To open the scene directly, wait
about 3.5 s after load for Boot to finish, then run in the page `window.__game.scene.getScenes(true).forEach(s => s.scene.start('IdleMill'))` (starting it earlier gets overwritten by the Title
scene). The overview button is at the bottom right of the screen. Check the console for errors and screenshot what you changed. The only check left to the user is the iPad.

## Git: this overrides the project rule "always commit when done"

The idle game is an experiment and **nothing is committed until the user says so**. Do not commit, stash, reset or switch branches. Work in the user's own folder, not a worktree
(the idle files are untracked, a worktree would not have them). `git status` shows modified `stages.ts`, `en.ts`, `sl.ts`, `town.ts`, `registry.ts` and untracked
`docs/minigames/idle*.md` and `src/scenes/minigames/idle/`.

## When you finish

Tell the user what you did, what you could not verify, and which numbers you invented, so they can tune them.
