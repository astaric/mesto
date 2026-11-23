# Idle sawmill (`IdleMill`, working name "idle game")

Status: **experiment, not committed.** This file is the reference for the implementation; keep it in step with the code. Parts are worked out one at a
time, the order of work is in [idle-plan.md](idle-plan.md).
Progress: **general layout agreed** (revised twice: machines turned along the flow and three rows; then storage area, the start of the line at the screen-left end,
optional rows 2 and 3) and a static prototype exists (`src/scenes/minigames/idle/`, scene `IdleMill`, stage `idle`, door on the country road).
The rules, economy and art are still open.

An idle (incremental) game about a sawmill, drawn in **isometric projection**. The factory works by itself; the player spends the coins it earns
on making each part faster **and on buying more machines**, and at the start taps to do the first jobs by hand. The factory is
bigger than the screen: the player scrolls (drags) to look around.

## The chain

```
forest ─(logging truck)─▶ trunk pile ─F1─▶ debarker ─F2─▶ (STORAGE ─F2─▶) ROW 1: saws 1 ─auto─▶ [ROW 2: saws 2] ─auto─▶ [ROW 3: planers] ─out forklift─▶ loading yard ─(delivery truck)─▶ coins
 workers    ingress road   courtyard       bark off     waiting       trunk → square log      log → 4 planks         plank → planed plank     (only the last built row)    pallets          exit road
 cut trees                                              for a saw     (cant)                  (optional)             (optional)
```

The flow runs **left to right across the screen** (the `+gx` direction of the map, down-right on screen), from the forest in the top-left to the
exit ramp in the bottom-right. **Every machine stands turned along the flow**: a log goes in at its left side and comes out at its right side (a belt runs
through it). A **row** is a vertical stack (along `gy`, across the flow) of up to 3 machines of one kind; between the rows are the **aisles** where the forklifts
drive up and down, each aisle serving all machines of the row before it and the row after it.

1. **Forest** (top left). Several plots, each with a tree and a lumberjack. A cut tree becomes a trunk on the **landing** (a stack by the ingress road).
   At first the player **taps an idle lumberjack** to make him cut the tree down, or plant a new one; a **supervisor** upgrade does the
   tapping automatically. More plots / faster chopping / regrowth are upgrades.
2. **Logging truck** drives down the ingress road, takes the trunks from the landing, stops by the courtyard and **unloads onto the trunk pile** (the entrance).
3. **Forklift F1** carries trunks from the pile to the **debarker** (bark is scraped off, a bark heap grows beside it). The debarker is a single machine (speed upgrades only, for now). The line starts at the
   **screen-left end** (high `gy`) of the factory: pile, debarker and the first machine of every row are in line. **A machine holds one piece**: F1 can only put a trunk on it when it is empty (it waits with the
   trunk while the debarker works, and while a finished peeled trunk still lies on it).
4. The finished peeled trunk **stays on the debarker** until **forklift F2** takes it. F2 is a buffer on wheels: it gathers peeled trunks on its forks up to its capacity and puts one on every empty saw the moment there is one; with full forks it puts one in the **storage** (north of the line, beside the aisle F2), where peeled trunks wait for a
   free saw (capacity is an upgrade, later). F2 also feeds the saw from the storage. The saw (**row 1, saws 1**) cuts a trunk into a **square log** (the trade calls it a *cant*: a trunk sawn square on all sides;
   "beam" is the child's word); the square log **stays on the saw** until the **output forklift** takes it, so the next trunk cannot go on the saw before that.
5. **Row 2 (optional), the saws 2**: a finished saw 1 **hands its square log to a free saw 2 by itself** (no forklift, no tap; with no free saw 2 it keeps the log, and so cannot take a new trunk, until one is free). A saw 2 cuts a log into **4 rough planks**
   (sawdust beside the saws), each worth half a log.
6. **Row 3 (optional), the planers**: a finished saw 2 hands its planks to the free planers **by itself, one plank at a time** (it keeps the rest until a planer is free). A planer smooths a rough-sawn plank on all sides and makes it even,
   giving a **planed plank** (worth twice a rough plank, so a log's four planks are worth four logs).
7. The **output forklift** (the one forklift of the three that works for the yard) carries the product of **the last built row only** to the **loading yard** next to the delivery road, where the **delivery truck** is loaded. The rows before it pass their work on by themselves.
8. Every piece is **sold the moment it is loaded onto the delivery truck**: coins go into the shared wallet (`earn()` in `core/profile.ts`). The truck then drives off down the **exit road**.

**Rows 2 and 3 are optional, and every stage's product can be sold as it is.** Without row 2 the loading yard gets the square logs; with row 2 but without row 3 it gets the
rough planks; with all three it gets planed planks. **The earlier in the chain the product, the lower the price** (square log < rough plank < planed plank), so the
extra rows are a way to earn more per tree, not a requirement. The forklifts of the last built row simply carry on over the empty floor of the rows that are not built
(the first machine of every row stands at the screen-left end, so the way to the yard is a straight drive along `gx` at `gy` 13 - 15). A row can only be built after
the row before it (planers need rough planks, saws 2 need square logs). Row 1 is part of the game from the start.

Words used in the game: *square logs* (`idle.stock.logs`, Slovene "tramovi"; trade term: cant), *rough planks* (`idle.stock.planks`, "surove deske"; trade term: rough-sawn planks),
*planed planks* (`idle.stock.planed`, "zglajene"), *planer* (`idle.zone.row3`, "skobeljnik"; also called a thicknesser), *storage* (`idle.zone.storage`, "zaloga").

Decisions already made:

- **Two trucks**, not one: the logging truck brings trunks and leaves, the delivery truck loads and leaves. Nothing waits for the other.
  **Two separate roads**: the ingress road (left, along the forest) and the delivery road + exit ramp (right, leaving at the bottom-right). Both are one way,
  so each truck needs one facing.
- **Upgrades by tapping the thing** (lumberjack, supervisor, truck, forklift, machine, debarker, storage): a bubble shows its level and the price of the next one.
  The bottom bar only shows stock counters, it is not an upgrade list.
- **Up to 3 machines in each row**, bought one by one, **each more expensive than the one before**. An unbought slot is an **empty lot** (a plain light tile, no sign). When the lot can be bought, a **green plus with its price** appears on it, and tapping it buys a machine (level 1, empty);
  before that the lot stays plain and a tap does nothing. See "Rows of machines" below for what opens a lot. Slots are numbered in the order they are bought, **from the screen-left end of the row**: the leftmost first (in line with the
  debarker and the storage), then the middle one, then the right one (`SLOT_GY` = 13, 9, 5). The first machine of row 2 and row 3 unlocks that row (and its price
  is the price of building it). Every machine has **its own level** (tap it: a small dialog with its level and the price of the next one); a built machine shows its level above it.
- **The factory is an open-sided shed**: floor, a back wall and a chimney on the far side, **no roof over the machines**, open toward the courtyard and the yard.
  A closed building would hide the machines in isometric view.
- **Forest is part of the game** (workers, tapping, supervisor), not scenery.
- **Scrolling camera**: the world is about 2.4 screens wide and 2.6 viewports tall. Drag to pan (a drag only starts after a small movement, so a tap still taps),
  clamped to the world. An overview button toggles a zoomed-out view of everything (about 0.42x).

## Screen layout

Design size 2048 x 1536 (`W`, `H` in `core/layout.ts`), scaled with `Phaser.Scale.FIT`. Two layers, two cameras:

- **HUD** (its own camera, so it neither scrolls nor scales): top band y 0 - 190 with ◀ (`backdrop()`, the usual 100,100), the title (`hudTitle`) and the
  coin counter (`coinCounter`); bottom band y 1260 - 1536 with six stock counters in flow order (cut trunks, pile, peeled, square logs, rough planks, planed planks) and
  the overview button. The world is visible between the bands and shows through them.
- **World** (the main camera, scrolls and zooms): the isometric map below, in a Phaser `Layer` that the HUD camera ignores.

### Isometric grid

2:1 dimetric tiles, **128 x 64 px**. A tile is `(gx, gy)`: `gx` grows toward the lower right of the screen (this is the flow direction),
`gy` toward the lower left.

```
sx = 1408 + 64 * (gx - gy)        // world pixels; the top corner of the map (0,0) is at (1408, 200)
sy =  200 + 32 * (gx + gy)        // a point at height z is drawn z px higher
```

- Map: `GX = 55`, `GY = 22` (`idleIso.ts`). The diamond is (55 + 22) x 64 = 4928 px wide and 77 x 32 = 2464 px tall; with 200 px above (tall things, chimney) and
  some below the world is **4928 x 2768**. The camera may scroll a bit past the edges (bounds y -100 .. world height + 400) so the last rows can leave the bottom band.
- Depth of every object = its world `sy` (back to front), like the town in `CityHub`; HUD above, ◀ at 9000, win banner 8000.
- The grid maths is Phaser-free (`idleIso.ts`: `toWorld(gx, gy, z?)`, `toTile(x, y)`); the layout (zones, slots, aisles, truck stops, labels) is Phaser-free data in
  `idleLayout.ts`. Both have tests (inside the map, slots inside their rows, aisles between the rows, the chain lines up, the trucks stop beside the pile and yard).
- Tap targets use the object's screen rectangle, not its tile, because objects are tall.
- The far (back) walls of the iso box are `gx = min` and `gy = min`; a wall on the near sides would hide what is behind it, so near walls are never drawn.
- **Hidden ground.** A tall object hides the ground behind it (smaller `gx + gy`). Aisles are therefore **3 tiles wide** and machines are kept low (about 110 px);
  the aisle just before a row is still partly behind that row's machines. Forklifts are drawn by their own depth, so one that is behind a machine is hidden behind it.
  If that turns out to hide too much: draw machines at reduced alpha when a forklift is behind them, or draw forklifts on top.
- Start view: camera centred on about world (1500, 690): the worker, the landing, the ingress road, the parked logging truck, the pile and the debarker are on screen; the saw, the yard and the dock are a drag away
  (or the overview button).

### Zones (tile rectangles, `gx` columns x `gy` rows, both inclusive)

| Zone | gx | gy | Notes |
|---|---|---|---|
| Forest | 0 - 7 | 0 - 21 | The whole left strip, no meadow. A tree on every tile of a 1-tile grid (every tree a plot). |
| Landing (cut trunks) | 7 | 0 - 2 | Stack of trunks at the forest's edge, next to the ingress road. |
| Ingress road | 8 - 9 | 0 - 21 | One way, `+gy`. Enters at the top from behind the trees, leaves at the bottom-left edge. |
| Courtyard (west) | 10 - 12 | 0 - 21 | Paved. |
| Trunk pile (entrance) | 10 - 12 | 12 - 16 | Logging truck loads at the landing (gy 0 - 2), drives down the road and stops at gy 12 - 16 to unload. |
| Factory shed | 13 - 41 | 4 - 16 | Floor; back wall along `gy = 3`; chimney at the back right. No roof. |
| F1 lane | 13 - 14 | 13 - 15 | pile → debarker (runs along `gx`). |
| Debarker | 15 - 17 | 13 - 15 | One machine. Bark heap beside it. |
| Storage | 18 - 20 | 6 - 10 | Peeled trunks wait here for a free saw. Beside the aisle F2, north of the line (F2 brings and takes them from the aisle side). |
| F2 approach | 18 - 20 | 13 - 15 | The debarker's output side to the aisle F2, in line with the debarker; F2 waits here. |
| Aisle F2 | 21 - 23 | 4 - 16 | debarker / storage → row 1. Runs along `gy`; the storage lies along its west side. |
| **Row 1: saws 1** | 24 - 26 | 4 - 16 | 3 slots (3 x 3 tiles) at gy **13 - 15, 9 - 11, 5 - 7** (bought in this order, leftmost on screen first). |
| Aisle F3 | 27 - 29 | 4 - 16 | row 1 → row 2. |
| **Row 2: saws 2** (optional) | 30 - 32 | 4 - 16 | 3 slots at the same gy. |
| Aisle F4 | 33 - 35 | 4 - 16 | row 2 → row 3. |
| **Row 3: planers** (optional) | 36 - 38 | 4 - 16 | 3 slots at the same gy. |
| Aisle F5 | 39 - 41 | 4 - 16 | the last row → loading yard. |
| Loading yard | 42 - 45 | 12 - 16 | Pallets of whatever the line makes. Courtyard paving around it (gx 42 - 45, all gy). |
| Delivery road | 46 - 47 | 0 - 20 | One way, `+gy`. Enters at the top (from town, over the top-right edge); the delivery truck stops at gy 12 - 16 to load. |
| Exit road + ramp | 46 - 54 | 19 - 20 | The delivery road turns toward `+gx` and leaves over the bottom-right edge of the map. |

The first machine of each row starts in the leftmost slot (gy 13 - 15), in line with the pile, debarker, storage and loading yard; the other two are lots for sale. The shed has
room for 9 machines.

Top-down map (`gx` across 0 - 54, `gy` down 0 - 21):

```
gx    0         1         2         3         4         5
      012345678901234567890123456789012345678901234567890123 4
gy0   TTTTTTTLrrccc.............................ccccdd.......     T trees   L landing   . grass
gy1   TTTTTTTLrrccc.............................ccccdd.......     r ingress road   c courtyard paving   P trunk pile
gy2   TTTTTTTLrrccc.............................ccccdd.......     w shed back wall   H shed floor   D debarker   K storage
gy3   TTTTTTTTrrcccwwwwwwwwwwwwwwwwwwwwwwwwwwwwwccccdd.......     1 F1 lane   a debarker-to-aisle way   2 3 4 5 aisles F2 - F5
gy4   TTTTTTTTrrcccHHHHHHHH222HHH333HHH444HHH555ccccdd.......     S saw 1 slots (row 1)   W saw 2 slots (row 2)
gy5   TTTTTTTTrrcccHHHHHHHH222SSS333WWW444NNN555ccccdd.......     N planer slots (row 3)
gy6   TTTTTTTTrrcccHHHHHKKK222SSS333WWW444NNN555ccccdd.......     B loading yard   d delivery road   e exit road
gy7   TTTTTTTTrrcccHHHHHKKK222SSS333WWW444NNN555ccccdd.......
gy8   TTTTTTTTrrcccHHHHHKKK222HHH333HHH444HHH555ccccdd.......
gy9   TTTTTTTTrrcccHHHHHKKK222SSS333WWW444NNN555ccccdd.......
gy10  TTTTTTTTrrcccHHHHHKKK222SSS333WWW444NNN555ccccdd.......
gy11  TTTTTTTTrrcccHHHHHHHH222SSS333WWW444NNN555ccccdd.......
gy12  TTTTTTTTrrPPPHHHHHHHH222HHH333HHH444HHH555BBBBdd.......
gy13  TTTTTTTTrrPPP11DDDaaa222SSS333WWW444NNN555BBBBdd.......
gy14  TTTTTTTTrrPPP11DDDaaa222SSS333WWW444NNN555BBBBdd.......
gy15  ggggggggrrPPP11DDDaaa222SSS333WWW444NNN555BBBBdd.......
gy16  ggggggggrrPPPHHHHHHHH222HHH333HHH444HHH555BBBBdd.......
gy17  ggggggggrrccc.............................ccccdd.......
gy18  ggggggggrrccc.............................ccccdd.......
gy19  ggggggggrrccc.............................cccceeeeeeeee
gy20  ggggggggrrccc.............................cccceeeeeeeee
gy21  ggggggggrrccc.............................cccc.........
```

(The slot letters mark all three slots of a row; in the game only bought machines are machines, the rest are lots. The aisle digits fill the whole aisle.)

Where it lands on the world (px): the forest is top-left (x 510 - 1920, y 200 - 905), the pile at about (1215, 1030), the debarker at (1535, 1190), the storage at about (2000, 960), the first
machine of row 1 at (2110, 1480), of row 2 at (2495, 1670), of row 3 at (2880, 1865), the loading yard at (3295, 2040), the delivery dock at (3520, 2150), the exit ramp at the
bottom right (x 3400 - 3700, y about 2400 - 2650). A 3 x 3 machine is 384 px wide on the 2048 canvas.

### Things that move

- **Logging truck**: enters at the top of the ingress road, stops at the landing (loads the trunks cut so far), drives down along the forest to gy 12 - 16, unloads onto the pile,
  leaves at the bottom-left. A new trip starts when it is gone (trip time, capacity = upgrades; more trucks are an upgrade too).
- **Delivery truck**: enters at the top of the delivery road, stops at gy 12 - 16 and loads (each piece is sold as it goes on), then drives down and out through the exit ramp.
- **Forklifts**: shuttle along their aisle (`gy` direction, across the flow) between the machines of the row before and the row after (carry N items per trip,
  speed and number = upgrades). They face two directions along each axis, so the sprite needs the back view and the front view; mirroring gives the other two.
- **Machines**: work in place while they have input and room for output (a log slides in at the left side and the product comes out at the right).
- **Lumberjacks**: idle (a "tap me" bounce), chopping, carrying the trunk to the landing, replanting.

### Tapping

Tap a lumberjack that is idle = chop / replant. Tap a machine, the debarker, the storage, a forklift, a truck or the supervisor = upgrade bubble (level, effect, price in the
usual `priceTag` style; `pay()` takes the coins or shakes the wallet). Tap an empty lot = buy a machine there. A "!" over a part means the next upgrade is affordable.

## Rules as built (slice 1: `idleLogic.ts`, `idleData.ts`, `idleView.ts`)

The logic is Phaser-free and simulates **everything that moves in tile coordinates** (the lumberjack, the forklifts, the trucks), so "tap to sale" is one loop in a test; the scene only draws what it finds in
the state and calls `earn()` for the `sold` events `tick()` returns. `tick(s, dt)` runs in 0.05 s steps inside, so a long frame cannot skip a phase.

- **Stocks** (`StockId`, capacities in `CAP`): `landing`, `pile`, `storage`, `yard`: the open-air places, drawn as stacks of logs on their pads. A full one backs the line up, and nothing is lost or made
  (`piecesInLine()` and its test).
- **Machines hold one piece** (`debarker`, `saw1`: `state` = `empty | working | done`): a forklift can put a piece on one only when it is `empty`, which starts the work (`workS`); when the work is over the
  machine is `done` and the **finished piece stays on it** (drawn on the belt at its output end) until a forklift takes it, which makes the machine `empty` again. A machine that works, or still holds a
  finished piece, is "not free": a forklift that brings a piece **waits with it** until it is (`drop` phase). A piece being worked on lies on top of its machine, with a progress bar.
- **Forklift brains** (`decide`, run again after every pick-up and every drop; hand-overs between *stations*, `STATIONS` in `idleLayout.ts`: `pile`, `debarkerIn`, `debarkerOut`, `storage`, `sawIn0..2`, `out11..out32`, `yard`;
  `Hauler.job` is the next station and whether it picks or drops there). Without tap time (`active`) a forklift picks nothing up, it only puts down what it holds (F1 on the debarker, F2 on a free saw, `out` in the yard) and then rests with the rest.
  - `f1` takes what the pile has (up to its capacity) and puts the trunks on the debarker one after another, waiting there while it is busy.
  - `f2` is **a buffer on wheels**: it takes every finished peeled trunk off the debarker until its forks are full (it rests at the debarker's output side, `debarkerOut`, with what it holds), and **the moment a saw 1 is empty and it holds a trunk it brings one** (saws come first; it puts down one and thinks again, so with several trunks it goes from saw to saw).
    It fetches from the storage only when its forks are empty and a saw waits (as many as there are empty saws). **With full forks, no saw that needs a trunk and the debarker busy again (working or done), it puts ONE trunk in the storage and drives back to its rest place.**
  - `out` collects the product of the last built row (a square log, up to a bundle of planks) from finished machine after machine **until its forks are full, and only then drives to the yard**; with nothing finished it waits where it stands (`'stay'`). It also takes a piece when the yard is full (the saw can work again) and waits with it at the yard. With no tap time left it takes what it has to the yard, however little (with the forklift manager it always waits until it is full).
  Two stations on the same aisle are driven between straight along the aisle (`routeBetween`). It drives from station to station through the main lane (`via` points: up the aisle to the
  storage, along the lane to the saw), then goes home (`FORKLIFT_HOME`) when it has nothing to do.
- **Who works by itself and who needs a tap.** By itself: the machines and the delivery truck. By tap: the **worker** in the forest (one job per tap) and the **forklifts and the logging truck**: a tap sets
  one working for `TUNING.activeS` (30 s; a tap on one that works already gives it the full time again). It starts trips only while the time lasts, finishes the trip it is on, and parks. A bobbing 👆 shows over
  whatever has something to do and is waiting (the worker when a tree is ready or a stump waits, a forklift whose source stock has a piece, the truck when the landing has a trunk), and a yellow bar over a
  working vehicle shows the time left.
- **Forest and trees.** Every tree is the same size (`TREE_SIZE`) and stands on a regular grid: `FOREST_TREES` (idleLayout.ts), one every `TREE_GAP` = 2 tiles, 1 tile in from the forest's edge (3 x 7 = 21 trees), listed from the cutter's
  place outwards. Every tree is a plot (`plots`): `ready -> chopping -> stump -> planting -> growing -> ready`; the lanes between the trees are free to walk. The static world draws no trees: `idleView.ts` draws
  every plot (a tree and a stump each; a sapling only shrinks while it grows).
- **Cutters** (`cutters`, tap-driven; they only chop): each waits at his own place (`cutterHome(k)`, the first beside the landing). A tap on a cutter (`tapWorker(s, k)`) sends him to the grown tree nearest to him, a tap
  on a grown tree (`tapPlot`) sends the free cutter nearest to it; stumps and saplings cannot be tapped. A tree somebody is walking to or chopping is `claimed`, so two workers never take the same one. He walks to the spot
  in front of the tree (`treeSpot`, so he is drawn over it), chops (`cutterChopS(level)`), carries the trunk to the landing (waits with it while the landing is full) and walks home. A 👆 bobs over every free cutter while
  there is a tree for him. **Without a planter nothing grows back**: 21 trees, 21 trunks (210 coins at 10 each).
- **The crew dialog** (`idleDialog.ts`, `CrewDialog`): a tap on the **log depot** (the landing pad; `hit()` kind `landing`, workers and the logging truck take precedence) opens a dialog on the HUD camera. A bobbing ⬆️ over the
  landing shows while the wallet can pay for something in it. The dialog takes its own taps (the scene hands it every pointer-down while it is open; ✕ or a tap outside closes it) and has one row each; what a row shows is
  `offer(s, item)` in `idleLogic.ts` (`locked | offer | owned`, level, price, `needs`); a button does `pay(price)` from the wallet and then `buy(s, item)`:
  - **Cutter** (`level`, one for all cutters, from 1, **no last level**): "Level n" and the price of the next one. The first upgrade costs 1 coin and each next one 30 % more than the price before it, **rounded up to whole coins and the next increase taken from the rounded price** (`priceAt` in `idleData.ts`, used by every upgrade; `cutterCost`: 1, 2,
    3, 4, 6, 8, 11, 15, 20, ...; level 29 -> 30 costs 5255). Every level a cutter needs 0.97 of the time he needed at the level before (`CUTTER_TIME_FACTOR`), for chopping a tree (`cutterChopS`: 2.5 s at level 1, 1.9 s at level 10)
    and for walking a distance (`cutterSpeed` = base speed / 0.97^(level-1)). **Every 10th cutter level hires one more cutter** (levels 10, 20, ...; `cuttersAt`); cutter levels hire no planters.
  - **Planter** (`planterLevel`, 0 = not bought): **locked until the cutters are at level 10** (`PLANTER_UNLOCK_LEVEL`). The first level, which buys him, costs **10 coins** (`PLANTER_FIRST_COST`), each next one 30 % more, rounded the same way (`planterCost`: 10,
    13, 17, 23, 30, ...). Each level makes every planter 0.97 of the time faster (`planterPlantS`, `planterSpeed`). **Planter level 1 (the purchase) hires the first planter, and every 10th planter level one more** (10, 20, ...; `plantersAt`); planter levels hire no cutters.
  - **Manager** (`hasManager(s)`: cutter level >= 10, `MANAGER_UNLOCK_LEVEL`): **not bought and not drawn**, he comes by himself at cutter level 10 (the same level that opens the planters). With him every free cutter goes to the nearest grown tree and every free planter to the nearest stump (`step()` taps for them), so no taps are needed; the 👆 over the workers is gone.
  New workers appear at their own places (`cutterHome(k)` beside the landing, `planterHome(k)` further down; columns of 5).
- **Planters** (`planters`; blue shirt) are tap-driven like the cutters: each waits at his own place (`planterHome(k)`) **until tapped**. A tap on a planter (`tapPlanter`) sends him to the stump nearest to him, a tap on a stump (`tapPlot`) sends the
  free planter nearest to it (a grown tree sends a cutter, a stump a planter). He walks to the spot in front of the stump (`treeSpot`), plants (`planterPlantS`), **walks home and waits again**, one stump per tap; the sapling grows
  for `growS` and is a tree again. A 👆 bobs over every free planter while there is a stump for him. Without a planter nothing grows back.
- **With the manager** (cutter level 10) nobody needs a tap any more: `step()` sends every free cutter to the nearest grown tree and every free planter to the nearest stump (the 👆 hints are gone), and the forest runs by itself.
- **The factory dialog** (`UpgradeDialog` again, `idleDialog.ts`): a tap on the **debarker** (`hit()` kind `machine`, forklifts and trucks take precedence) opens it; a ⬆️ over the debarker shows while something in it
  can be bought. Five rows, each a level and the price of the next (30 % more each time, 10 % for the machines; with more than four rows the panel packs them closer so it fits the screen) (`offer()`; the price grows like the cutter's: 30 % more each time, rounded up):
  - **Forklifts** (`forkliftLevel`, one for the three; first level 3 coins, `forkliftCost`): every level they drive and handle in 0.97 of the time (`forkliftSpeed`, `forkliftHandleS`), and **at levels 20, 30 and 40 they can carry one more piece
    at the same time, up to 4** (`forkliftCapacity`: 1 below level 20, 2 from 20, 3 from 30, 4 from 40). A forklift picks up as many as it can carry (`pickCount`) and puts them down one at a time as the place has room (`carrying` is a count,
    drawn as that many stacked pieces on the forks). F1 and F2 take more than a machine can take at once (F1 queues at the debarker with the rest; F2 keeps them on its forks for the saws), the output forklift waits at the yard until there is room.
  - **Forklift manager** (`hasForkliftManager(s)`: forklift level >= 10, `FORKLIFT_MANAGER_UNLOCK_LEVEL`): **not bought and not drawn**, he comes by himself at forklift level 10 (a separate one from the forest's manager). With him the three
    forklifts are always on (`step()` keeps `active` at `activeS`): no taps, no time bars, no fingers; the logging truck has its own manager (below). A forklift that carries more than one waits for a full load, and with him it never runs out of time.
  - **Logging truck** (`truckLevel`; first level 3 coins, `truckCost`): every level it drives and loads (`truckItemS` per piece) in 0.97 of the time (`truckSpeed`, `truckItemS`).
  - **Exit trucks** (`deliveryLevel`, a level of their own, the same prices; `deliveryTrucksAt`): every level they drive and load in 0.97 of the time, and **every 50 levels one more exit truck is bought** (`DELIVERY_TRUCK_LEVELS`; levels 50, 100, ... = 2, 3, ... trucks). The trucks **wait for the loading ramp in a line** on the delivery road (`queueRank`, `queueSpot`, `QUEUE_SPACING` = 5 tiles; the order
    they came in, `Truck.ticket`): the first stands at the dock and loads, **only one loads at a time**, the others stand behind it up the road and pull up one place each time the one in front has loaded and left. A new truck comes in from the top of the road (it starts with the gap behind it, so it arrives at once) and queues at the back. A truck that has sold its load drives out, is away for `truckGapS`, and queues again.
  - **Truck manager** (`hasTruckManager(s)`: logging truck level >= 10, `TRUCK_MANAGER_UNLOCK_LEVEL`; the exit trucks' level does not count): **not bought and not drawn**, he comes by himself at level 10. With him the logging truck keeps making rounds by itself (`active` kept at `activeS`; no tap, time bar or
    finger; the delivery truck always was automatic). With the three managers (forest, forklifts, trucks) the whole line runs by itself. Nothing about managers is saved: they follow from the levels.
  - **The debarker and every saw and planer** (`Machine.level`, each its own; first level 3 coins, then **10 % more** each time, rounded up from the rounded price: 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, ...; `machineCost`, the machines are the only upgrade that gets dearer more slowly): **each level makes what is sold 3 % more valuable and the machine work in 0.97 of the time** (`machineWorkS`) (`machineFactor` = 1.03^(level-1));
    how the levels make up the price of a piece is under "Rows of machines, planks and prices" below. The factory dialog has the debarker; a saw or planer (or its row's label) opens the row's dialog. - **Forklift F3** (`FORKLIFT_F3_LEVEL` = 50): at forklift level 50 a fourth forklift joins (`syncForklifts`, last in `haulers`): a second output forklift. It works like the output forklift (`isOutput`), rests behind the second machine of the last row and prefers the machine at the far end of the row; both unload in the yard.
- **Forklifts** (`haulers`): take 0.3 s to pick up or put down. The output forklift's drive to the yard is a long straight one along the front of the shed over the unbuilt rows; its lane `OUT_LANE_GY` is the front edge of the shed floor, which no machine covers. Routes are in `idleLayout.ts` (`STATIONS`, `LOGGING_ROUTE`, `DELIVERY_ROUTE`) and tested against the zones.
- **Logging truck**: **parked on the east lane of the ingress road in front of the pile.** The ingress road is two lanes wide (`INGRESS_LANE`), so the truck drives a loop: when tapped (and while the landing has a
  trunk) it drives up the east lane, over to the west lane, stops at the landing (which lies along the west lane), loads (one piece per `truckItemS`, until the landing is empty or it is full), drives down the west
  lane, crosses back and parks at the pile to unload. While its time lasts it starts another round whenever the landing has a trunk; with the time up it finishes the round and parks. (This replaces the old
  "one-way, +gy" ingress road with a truck coming from off the map.)
- **Delivery truck** (automatic): starts **parked at the dock**, loads from the yard one piece at a time (`truckItemS` each) **up to `capacity` = 5, and fewer if the yard has fewer: it leaves as soon as it is full or the yard is empty** (it never leaves empty: with nothing to take it waits for the first piece; `Stop.waitOne`). **While the output forklift is putting a load down in the yard (`outUnloading`) a truck that is not full waits and takes all of it**; a full one drives off and the rest waits for the next truck.
  **Each piece is sold the moment it is loaded** (one `sold` event per piece, its worth from the yard; whole coins are paid and the fraction is kept on the truck, `Truck.value`, for the next piece; the scene shows a floating coin and amount at the truck), then the truck drives down the delivery road and out along the exit road, and a new truck comes after `truckGapS`.
- Units: tree -> trunk -> peeled trunk -> square log. How many planks per log and the prices of planks are not decided; the price only has to rise along the chain.
- **Tuning** (all in `idleData.ts`, first guesses): chop 2.5 s (level 1), plant 1.5 s, grow 15 s, worker 2.5 tiles/s (level 1); trucks 4 tiles/s, 1 s per piece, delivery gap 6 s, logging truck capacity 5; forklift 3 tiles/s, 0.3 s to
  pick or drop; **active window 30 s**; debarker 10.2 s, saw 40.8 s (four passes) per piece at level 1; caps: landing 21 (7 across x 3 high), pile 52 (13 across x 4 high), storage 6, yard 6 (a machine holds 1); **truck capacity 18** (`loggingCapacity` / `deliveryCapacity`: two 3 x 3 stacks, a trip takes up to 18 pieces, so a sale is up to 180 coins; logs that arrive while the truck is away wait in the yard for the next one); **a square log sells for 100 coins** (`PRICE.logs`; it was 10: ten times the coins per piece, with plank 50 and planed plank 100, the level costs unchanged).
  With a truck that takes one piece (the tests set `capacity = 1` for the chain tests) and every tap made the moment it is needed, the first sale comes about 34 s after tapping the worker.
- Idle progress while the app is closed: not decided (the other minigames do not keep time while closed). **The upgrades are saved** (`core/idleSave.ts`, `idle-save`, cleaned of garbage on load, erased by `resetProgress()`): the levels of the cutters, planters, forklifts, trucks, debarker and saw and the three managers, so they survive leaving the sawmill and coming back from the city. `IdleMill.create()` starts a fresh line (no stock, all trees grown, nobody on the road) and puts the saved upgrades on it (`applyUpgrades`, which also hires the workers the levels bring); every purchase saves (`upgradesOf`). Nothing else is saved yet. Coins are the shared wallet.
- Depth-sorting moving things: every standing block of the static world is its own Graphics with the depth `x + y + w + d` (the tile sum of its front corner), trees (each its own object, depth = the tile sum of its foot) at `TREE_SIZE` = 0.6 of the base shapes, about one tile wide, the ground at depth -1; the zone labels at depth 4000 (`LABEL_DEPTH`), over everything that stands, under the bars (5000), the hints (5001) and the popups (6000), so a label is never hidden behind a building or tree;
  movers use the same key from their tile position every frame (`setDepth` re-sorts the world `Layer`, checked). A mover is one Graphics redrawn when its heading or cargo changes (`drawParts()` draws its blocks group by
  group from the back to the front of the screen for the current heading).
- Testing from the console: `__game.scene.getScene('IdleMill').speed = 8` multiplies the clock (and `sc.state` is the whole line). The Browser pane runs the page at about 1 fps while it is hidden: front the tab first.

## Rows of machines, planks and prices (invented numbers, all in `idleData.ts`)

- **At the start** the factory has the debarker and **one saw 1** (row 1, slot 0, level 1); every other lot is empty. A machine bought on a lot starts at level 1, empty; its levels cost `machineCost` like every machine's (3 coins, then 10 % more, rounded up).
- **What opens a lot** (`slotOffer(s, row, slot)`: `built | offer | locked`): the **second machine of a row** when the row is at level **50** (`SECOND_UNLOCK_LEVEL`), the **third** at level **75** (`THIRD_UNLOCK_LEVEL`); the **first machine of the next row** when the first machine of the row before it is at level **100** (`ROW_UNLOCK_LEVEL`): saw 2 needs saw 1 at 100, the planer needs saw 2 at 100. Lots are bought in slot order.
- **Machine prices** (`idleData.ts`): the first machine of a row costs `ROW_PRICE` (row 1 free, row 2 20 000, row 3 200 000). The **second machine costs 2x** (`SECOND_MACHINE_FACTOR`) and the **third 5x** (`THIRD_MACHINE_FACTOR`) **everything the row's first machine has cost so far at the moment of buying**: its price plus every level (`machineTotalCost(row, level)`; the second and third machines' own levels are not counted). A new machine **starts at the row's level** and adds its bonus to the row at once. **All machines of a row share one level**: one upgrade, `upgradeRow`, raises them all, and costs the level price (`machineCost`: 3 coins, then 10 % more) **times the number of machines** (`offer(s, 'm1')`). Old saves with different levels in a row are levelled to the highest on load. First guesses to tune: the 2x / 5x factors, 50 / 75, `ROW_PRICE`. For scale: machine 1 to level 50 costs about 7 700 in all (a second machine about 15 400 in row 1), to level 75 about 100 000 (a third machine about 500 000).
- **Row to row, by itself** (`passOn` in `idleLogic.ts`, every tick): a `done` machine of a row that has another row after it gives its pieces, one at a time, to the first `empty` machine of the next row; with none free it keeps them. Nothing is carried by a forklift between rows; F3 - F5 do not exist.
  Only the **last built row** (`lastRow`) hands goods to the output forklift, and that forklift waits behind the first machine of the last built row (`machineOutId(lastRow, 0)`).
- **Planks**: a saw 2 turns one log into `PLANKS_PER_LOG` = 4 planks (`Machine.out` = pieces lying on a `done` machine); a planer takes one plank at a time and stacks each planed plank on its output (`Machine.out`, up to `PLANKS_PER_LOG`) as it is made, working on the next plank while the stack has room; with a full stack it is `done` and waits for the output forklift, and works again once some are taken. Base prices `PRICE`: log 100, plank 50 (half), planed 100 (twice a plank); a log is worth 100 as a log, 200 as four planks, 400 as four planed planks.
  Times at level 1: saw 1 40.8 s (four passes of 10.2 s), saw 2 6 s, planer 3 s, debarker 10.2 s (the debarker and saw 1 start slow so that their speed cap, `MIN_PASS_S` per pass, is reached at level 100: 10.2 x 0.97^99 = 0.5).
- **Milestone levels** (`machineMilestones`, `MACHINE_MILESTONE_FACTOR` = 2): a machine's price factor is 1.03^(level - 1) **times 2 for every milestone it has reached: levels 10, 25, 50, then every 50 (100, 150, ...)**: x2 at 10, x4 at 25, x8 at 50, x16 at 100, x32 at 150. It only changes the price (the speed stays 0.97 per level).
- **Worth of a piece** (`pieceValue`, noted down when the piece enters the yard, so pieces already there keep what they were worth): the base price of what the last built row makes, times (1 + the bonus of **each stage it went through**): the debarker, then every built row up to the last. The stages **add up** (1 + what each stage adds on top of 1; they used to multiply, and the price then grew like the factor to the power of the number of stages, e.g. 1.3e7 per planed plank with every machine at level 50, against 7.7e3 coins to get there); within a row **the machines add up** too
  (`stageFactor` = 1 + the sum of (machine factor - 1)): a first saw at +50 % and a second at +80 % make the row +130 % (x2.3); a new machine at level 1 adds nothing. The yard keeps the sum (`yardValue`), the delivery truck takes its pieces' worth with them
  (`Truck.value`) and the sale is that sum rounded to whole coins. (This replaces `salePrice` and the single `sawLevel`.)
- **Planks are small**: where the last built row is 2 or 3, the loading yard, the delivery truck and the output forklift hold `PLANKS_PER_LOG` = 4 times as many pieces (`pieceMultiplier`, `yardCap`), so building a row does not cut the money per trip.
- **Stations** (`idleLayout.ts`): `sawIn0..2` (F2 puts a trunk on saw 1 of that slot, at the aisle F2 level with the saw; F2 gives it to the first free one, before using the storage) and `out{row}{slot}` (the output forklift takes the product behind a machine, in the aisle after its row), both reached along the aisle from the main lane. The output lane to the yard is
  `OUT_LANE_GY` = 16.5, the front edge of the shed floor, which no machine, built or not, covers.
- **Big numbers** (`core/format.ts`, `formatNumber`, used by `coinCounter`, `priceTag` and the dialogs): below 1000 as they are, then 3 significant digits and the suffixes K, M, B, T, aa, ab, ... az, ba, ... zz (1.5K, 123M, 4.56T, 1aa).
- **Save**: `idle-save` keeps `deliveryLevel` (the exit trucks' level; it also gives the number of trucks), `debarkerLevel` and `machines: [{row, slot, level}]` (the first saw 1 is always there); `applyUpgrades` leaves out a saved machine whose lot could not have been bought (no machine before it).
- **Views** (`idleView.ts`): machines are drawn when they appear in `state.machines` (`machineView`), an empty lot shows its plus and price when `slotOffer` says `offer` (`updateLot`), a ⬆️ shows over a machine whose next level the wallet can pay; a tap on the plus buys (`IdleMill.buyLot`), a tap on the debarker opens the factory dialog (forklifts, trucks, managers, debarker), a tap on a saw or planer, or on its row's label (Saws 1, Saws 2, Planers; `IdleView.setRowLabels`, hit kind `row`) opens the one upgrade dialog of that row (`machineDialogs`, one per row) that levels all its machines. The plus on a lot shows the current price of that machine.
  The yard's stack and the output forklift's and the truck's cargo are coloured by what the last built row makes. The HUD's three product counters show the yard under logs, planks or planed planks by `lastRow`.

## Open questions

- Plank counts, prices, upgrade cost curves, how many levels per part, the exact price growth of the 2nd and 3rd machine in a row, the price of unlocking rows 2 and 3.
- Can the debarker also be multiplied later (there is free floor around it)?
- Whether the supervisor is one upgrade or levels (faster tapping, then also replanting). Levels beyond 10 for the cutter, and levels for the planter.
- What the stars are (the stage needs `starsEarned`): milestones such as first sale, row 2 built, row 3 built, all 9 machines bought, N coins earned.
- Saving the line itself (stock, tree states): not done, only the upgrades are saved.
- The door's icon (it reuses `mill-icon` for now) and its building on the country road.
- Performance: 21 trees (and 21 stumps) are separate Graphics now; a bigger forest may need them as sprites or one render texture.
- Art: every sprite is an SVG in `src/art/` (isometric), rasterised at 1.5x. List to draw: ground tiles (grass, paved, road), trees (2-3 stages),
  lumberjack, supervisor, trunk, peeled trunk, square log, rough plank, planed plank, pallet, logging truck, delivery truck, forklift (front/back), debarker, saw 1, saw 2, planer,
  storage area (a heap of peeled trunks), an empty lot with a "for sale" sign, shed wall + chimney, heaps (bark, sawdust, wood shavings), signs.

## The pieces and the trucks (one look everywhere)

Design sheet: `docs/minigames/idle-pieces-sample.svg` (generated by `idle-pieces-sample.py`). Every piece is `PIECE_L` x `PIECE_D` (1.4 x 0.35 tiles) and `PIECE_H` high wherever it lies (`idleDraw.ts`: `drawPiece`, `drawPieces`):
trunk (dark round) -> peeled trunk (medium round, rings on the end) -> cant (medium block) -> boards (medium, a quarter of the height each, four to a cant, shown as lines) -> planed boards (light).
Piles lie along gx where the pad is long enough, else along gy. The trucks (`idleTruck.ts`) are a long-nose tractor and a flatbed with two stacks of 3 x 3 pieces; the load shows how full the truck is (`cargo / capacity` of 18 places), and the same code turns the truck to the four headings.
The forklifts (`idleForklift.ts`, design: `docs/minigames/idle-forklift-sample.svg`) carry up to 4 pieces lying across the forks, two deep and stacked, filled from the mast out; boards lie across as one stack of up to 4.
The debarker (`idleDebarker.ts`, design: `docs/minigames/idle-debarker-sample.svg`, idea A) is a belt through a thick orange ring: while it works the trunk slides along the belt (`trunkX(progress)`), its dark half behind the ring and its peeled half in front, four blades turn round the hole and bark chips fall; a finished trunk waits at the belt's output end. The old 3 x 3 box is gone; the belt, the ring and the pieces are separate objects so they sort around the ring (`DEPTH`).
The log saw (saw 1; `idleSaw.ts` draws, `idleSawPose.ts` is the Phaser-free timing, tested in `idleSaw.test.ts`; design: `docs/minigames/idle-logsaw-shuttle-sample.svg`, generated by `idle-logsaw-shuttle-sample.py`; the other ideas are `idle-logsaw-sample.svg` and `idle-logsaw1-sample.svg`) is ONE fixed circular saw standing behind the belt on a blue frame. A trunk is sawn in `PASSES` = 4 passes, each a quarter of the work time (`workS`): the trunk slides forward through the disc (a flat is cut on the far side, a slab falls behind the saw, sawdust flies), slides back, and **rolls a quarter by itself** on powered rollers in the belt (no turntable); the fourth pass goes on to the belt's end, where the square log lies (the standard cant block; the belt is only the 3-tile lot, `BELT_LEN` = 3.0, so the log rests at `X_OUT` = 1.6 with its end on the belt's end). The output forklift of row 1 stops heads-on right there (`OUT_STATION_X` = 3.714 from the machine's left edge, in the aisle's first tile, the log touching the second column of pieces on its forks) and backs out to the aisle's middle (`via`, gx1 + 2.3) before driving to the yard; the other rows' stations are unchanged. The saw stands at `SAW_X` = 1.5 and the trunk rests at `X_START` = 0.05 (all in `idleSawPose.ts`). The trunk is drawn as a real cross-section (a circle cut by the flats sawn so far, `flats` at `FLAT` = 0.9 of the radius), so the flats show up one by one. Saw 2 and the planer are still the old flat blocks (`drawMachine`).
**Speed cap** (`MIN_PASS_S` = 0.5 s, `MIN_WORK_S` in `idleData.ts`, applied in `setLevel`): one trunk's pass through the debarker never takes less than 0.5 s, and neither does one pass through the saw, which makes four per trunk, so the saw never needs less than 2 s per trunk (the debarker 0.5 s). Higher levels still make the machine's output worth more (`machineFactor`), they only stop making it quicker; both caps are reached at level 100 (the debarker 10.2 s -> 0.5 s, the saw 40.8 s -> 2 s per trunk).
The debarker is turned so that its belt runs along gy (input end north, output end south), which lets the forklifts, whose load lies across their forks, put a trunk on it and take one off from the side: F1 drives in along gx from the west to `STATIONS.debarkerIn` (gy `LANE_GY - 1.3`), F2 from the east to `debarkerOut` (gy `LANE_GY + 1.5`); a station may have an `approach` waypoint between its `via` (on the lane) and its `pos`, so the last leg is along gx. The peeled trunk waits on the belt's output end.

**Machine progress bars:** the debarker and the log saw (saw 1) are animated and show their state by the animation, so they have no progress bar; the plank saw and the planer (flat blocks for now) still show a bar.
