# Idle sawmill: plan and next steps

Design and layout are in [idle.md](idle.md). This file is the order of work. It is an experiment: **nothing is committed until the user says so.**
Tick a step off here when it is done, and move what turns out to be wrong into `idle.md`.

## Done

- [x] Concept, chain, decisions (two trucks, tap-to-upgrade, open shed, active forest, up to 3 saws per row) in `idle.md`.
- [x] General layout agreed: 55 x 22 tile isometric world, flow left to right, machines turned along the flow, three rows (saws 1, saws 2, planers) of up to 3 machines with forklift aisles between, separate ingress and exit roads, scrolling camera. Revised twice after the first prototype: debarker and pile moved left, rows became columns, planer row added; then a storage area for peeled trunks, the start of the line moved to the screen-left end (leftmost machine bought first), rows 2 and 3 optional (the loading yard takes the output of the last built row, so square logs and rough planks can be sold directly, cheaper).

## Slice 1: one tree to one sold square log (done, see "Rules as built" in idle.md)

A vertical slice through steps 3, 4 and 5 with placeholder blocks: tap the worker -> trunk -> logging truck (tapped, drives its loop) -> pile -> F1 (tapped) -> debarker -> storage -> F2 (tapped) -> saw 1 -> output forklift
(tapped) -> yard -> delivery truck -> coins. Revised after the first run: one worker for three trees, the forklifts and the logging truck work for 30 s after a tap, and machines hold one piece (a finished piece stays on the machine until a forklift takes it, a forklift waits for a free machine; the storage moved north beside the aisle F2). `idleData.ts`, `idleLogic.ts` (+ test, including the end-to-end run), route data in `idleLayout.ts` (+ tests), `idleView.ts`, the static world split into depth-sorted game objects (`idleDraw.ts`).
- [x] Looked at in the desktop browser: tap, the whole line, the sale and the coin counter.
- [ ] Look at it on the iPad: the speed of things, whether the first sale feels too slow or too fast, the start view.

## Step 1: static prototype (done)

Goal: open the scene on the iPad and judge the layout, the size of things and the drag feel, before any logic or art.

- [x] `idleIso.ts` (Phaser-free): grid constants, `toWorld(gx, gy, z)`, `toTile(x, y)`, world size. Test.
- [x] `idleLayout.ts` (Phaser-free): zones, shed, 3 rows, 9 machine slots, aisles, stations, truck stops. Test (everything inside the map, slots inside rows, aisles between the rows, stops line up).
- [x] `idleDraw.ts`: draws the whole world once, back to front, with flat placeholder blocks (ground, trees, shed wall, debarker, pile, 3 machines, storage, 6 empty lots, yard, trucks, forklifts) and a text label per zone.
- [x] `IdleMill.ts` scene: world camera with drag-to-pan (tap still taps) and clamped bounds, an overview button (zoom out to the whole world), HUD camera with the top and bottom bands, back button, coins, six stock counters (static zeros).
- [x] Wired in as a city stage `idle` (door on the country road, top row) with texts in `en.ts` and `sl.ts`, so it opens from the town and from the minigame list.
- [x] Checked in the desktop browser: renders, drag pans, the overview button zooms out and back, the HUD buttons (back) still work, opens from the minigame list.
- [ ] Look at it on the iPad; adjust sizes, margins, start view, label sizes. Known: the zone labels are drawn in the world and collide with the HUD bands at the start view.

## Step 2: art, isometric style

Decide the look (flat shapes with the ink outline like the rest of the game, 2:1 tiles, light from the upper left) and draw the SVGs in `src/art/`, English file names
with an `idle-` prefix: ground tiles, tree (3 growth stages), stump, lumberjack, supervisor, trunk, barkless trunk, square log, plank, pallet, logging truck,
delivery truck, forklift (front and back), debarker, saw 1, saw 2, empty lot with a "for sale" sign, shed wall + chimney, heaps (bark, sawdust). Replace the blocks in `idleDraw.ts`
one kind at a time; the layout data does not change.

## Step 3: rules and numbers (Phaser-free, with tests)

Done in slice 1: the four stocks with capacities, single-piece machines, forklift jobs and hand-overs, trucks, the sale. Left: plank counts and prices, upgrade levels and costs, the prices of the 2nd and 3rd machine and of rows 2 and 3, the loading yard taking
the output of the last built row, a row not buildable before the one before it, prices rising along the chain (a test).

`idleData.ts` (tables) and `idleLogic.ts` (`tick(state, dt)`): stocks with capacities, machine speeds, forklift trips, truck cycles, plank count per log, price per plank,
price of the 1st, 2nd and 3rd machine per row and of unlocking rows 2 and 3, upgrade levels and costs, the price of a square log, a rough plank and a planed plank. Tests: the line backs up when a stock is full, nothing is created or lost, prices only go up along the chain, the loading yard gets the product of the last built row, a row cannot be built before the one before it.

## Rows of machines (done, see "Rows of machines, planks and prices" in idle.md)

Empty lots start empty; a plus with a price appears when a lot opens (second saw of a row: the first of that row at level 50; first machine of the next row: the first machine of the row before at level 100); each machine has its own level; a finished machine passes its piece to a free machine of the next row by itself (no forklift) or waits; a log is cut into 4 planks (half a log each), planed planks are worth double; the price of a piece is its base price times 3 % per level of the debarker and of the best machine of each row it went through; `idleSave` keeps the machines.
- [x] `idleData.ts` (prices, unlock levels, lot prices), `idleLogic.ts` (`slotOffer`, `buyMachine`, `passOn`, `pieceValue`, `lastRow`), `idleLayout.ts` (a station per machine), `idleView.ts` (machines drawn as they are bought, the plus), the dialogs, the save, tests.
- [x] Looked at in the desktop browser: the plus, buying a saw 1, the saw 2 and the planer, a log through all three rows to four sales.
- [x] Forklift brains (`decide` in idleLogic.ts): F2 gathers peeled trunks up to its capacity and feeds the saws from its forks, one to the storage only with full forks; the output forklift goes to the yard only with full forks; an exit truck waits while the forklift unloads (unless full); each piece is paid as it is loaded.
- [x] Exit trucks: their own level, a new truck every 50 levels, a line at the ramp (one loads at a time); big numbers with K/M/B/T/aa/ab suffixes (`core/format.ts`).
- [ ] Look at it on the iPad; tune the lot prices, the saw 2 and planer times, and whether the output forklift is a bottleneck for planks. Not done: the first-time hint for the plus, art for the saw 2 and the planer (they are blocks), `idle.stock.*` counters show the yard only.

## Step 4: forest and tapping

Done: a forest of 21 equal trees on a grid; cutters (tap to chop), planters (automatic) and a manager (cutters chop by themselves), bought in a dialog on the landing: cutter levels endless (1 coin, then +30 %), planter and manager locked until cutter level 10 (planter 10 coins then +30 %, manager 100 coins, no levels); every 10th level of a kind hires one more of that kind (cutter levels cutters, planter levels planters). Also done: the factory dialog on a machine (forklift level: speed and carrying up to 4 pieces; debarker and saw levels: +3 % goods value each). Left: more trees, more workers, the supervisor upgrade that sends the worker by itself (and may automate the forklifts and the truck the same way), faster chopping and regrowth.

Lumberjack plots, tap an idle lumberjack to chop or replant, the trunk goes to the landing, the supervisor upgrade automates the tapping.

## Step 5: simulation drawn

Done in slice 1: movers as placeholder Graphics sorted by depth against the static world, stacks of logs on the pads, progress bars. Left: machine animation, planks, sawdust and bark heaps, real sprites, and what changes when
several machines per row and several forklifts per aisle exist (`sawIn`/`sawOut` and the output lane are single places now).

Machines work (animation), forklifts shuttle along their aisles with cargo, the logging truck and the delivery truck run their trips, planks are sold and coins are earned (`earn()`).
Decide the depth-sorting of moving things against the static world (the static world may become one render texture, only moving things are sprites).

## Step 6: buying and upgrading

Tap a part: bubble with level, effect and price (`priceTag`, `pay()`). Tap an empty lot: buy a saw. Affordable "!" markers. Forklifts and trucks bought the same way.

## Step 7: save, reset, stars

`core/idleSave.ts` through `core/storage.ts`, a line in `resetProgress()` (`core/reset.ts`) and its test; star milestones through `bankStars()`; offline progress is a decision still open.

## Step 8: polish and docs

Sounds (`sfx`), first-time hints, performance on the iPad (trees as one texture), the door's icon and building, `CLAUDE.md` line and the `new-minigame` checklist, then the commit the user asks for.
