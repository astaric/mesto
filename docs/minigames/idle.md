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
forest ─(logging truck)─▶ trunk pile ─F1─▶ debarker ─F2─▶ (STORAGE ─F2─▶) ROW 1: saws 1 ─F3─▶ [ROW 2: saws 2] ─F4─▶ [ROW 3: planers] ─F5─▶ loading yard ─(delivery truck)─▶ coins
 workers    ingress road   courtyard       bark off     waiting       trunk → square log     log → rough planks      rough → planed          pallets          exit road
 cut trees                                              for a saw     (cant)                 (optional)              planks (optional)
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
4. The finished peeled trunk **stays on the debarker** until **forklift F2** takes it, to the **saw** if the saw is empty, else to the **storage** (north of the line, beside the aisle F2) where peeled trunks wait for a
   free saw (capacity is an upgrade, later). F2 also feeds the saw from the storage. The saw (**row 1, saws 1**) cuts a trunk into a **square log** (the trade calls it a *cant*: a trunk sawn square on all sides;
   "beam" is the child's word); the square log **stays on the saw** until the **output forklift** takes it, so the next trunk cannot go on the saw before that.
5. **Row 2 (optional), the saws 2**: **forklifts F3** carry square logs to them and they saw the logs into **rough planks** (sawdust beside the saws).
6. **Row 3 (optional), the planers**: **forklifts F4** carry the rough planks to them. A planer smooths a rough-sawn plank on all sides and makes it even,
   giving a **planed plank** (worth more than a rough one).
7. **Forklifts F5** carry the last product to the **loading yard** next to the delivery road, where the **delivery truck** is loaded.
8. When the delivery truck is full it drives off down the **exit road** and the load is **sold**: coins go into the shared wallet (`earn()` in `core/profile.ts`).

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
- **Up to 3 machines in each row**, bought one by one, **each more expensive than the one before**. An unbought slot is an empty lot with a "for sale" sign and its
  price; tapping it buys a machine. Slots are numbered in the order they are bought, **from the screen-left end of the row**: the leftmost first (in line with the
  debarker and the storage), then the middle one, then the right one (`SLOT_GY` = 13, 9, 5). The first machine of row 2 and row 3 unlocks that row (and its price
  is the price of building it). Forklifts per aisle are bought the same way.
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
| Forest | 0 - 7 | 0 - 14 | Top left. Lumberjack plots inside (start with 1-2, up to ~6). |
| Landing (cut trunks) | 7 | 0 - 2 | Stack of trunks at the forest's edge, next to the ingress road. |
| Meadow | 0 - 7 | 15 - 21 | Open ground: supervisor's hut, pond, decoration. |
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
gy0   TTTTTTTLrrccc.............................ccccdd.......     T trees   L landing   g meadow   . grass
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
- **Delivery truck**: enters at the top of the delivery road, stops at gy 12 - 16 and waits until its load is full, then drives down and out through the exit ramp
  and the load is sold.
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
- **Forklift jobs** (`chooseJob`, hand-overs between *stations*, `STATIONS` in `idleLayout.ts`: `pile`, `debarkerIn`, `debarkerOut`, `storage`, `sawIn`, `sawOut`, `yard`): `f1` takes a trunk from the pile whenever there
  is one and brings it to the debarker (waiting there if it is not free). `f2` first clears the debarker: a finished peeled trunk goes to the saw if the saw is empty, else to the storage if it has room; with
  nothing to clear it brings a trunk from the storage to the saw when the saw is empty. `out` takes the square log off the saw to the yard when the yard has room. A forklift only takes a job where it can
  also finish it (it never picks a trunk it could not put down), apart from F1, which is meant to queue at the debarker. It drives from station to station through the main lane (`via` points: up the aisle to the
  storage, along the lane to the saw), then goes home (`FORKLIFT_HOME`) when it has nothing to do.
- **Who works by itself and who needs a tap.** By itself: the machines and the delivery truck. By tap: the **worker** in the forest (one job per tap) and the **forklifts and the logging truck**: a tap sets
  one working for `TUNING.activeS` (30 s; a tap on one that works already gives it the full time again). It starts trips only while the time lasts, finishes the trip it is on, and parks. A bobbing 👆 shows over
  whatever has something to do and is waiting (the worker when a tree is ready or a stump waits, a forklift whose source stock has a piece, the truck when the landing has a trunk), and a yellow bar over a
  working vehicle shows the time left.
- **Worker** (`worker`, one; `plots` = the first `ACTIVE_PLOTS` = 3 of `FOREST_PLOTS`, the rest are only forest, there are no idle lumberjacks any more): he waits at `WORKER_HOME` beside the landing. A tap on him
  (`tapWorker`) sends him to the first grown tree to chop, or else to the first stump to plant; a tap on a tree (`tapPlot`) sends him to that tree (grown: chop, stump: plant). He walks to the tree (`toPlot`),
  works there (`chopS` / `plantS`), and after a chop carries the trunk to the landing (waits with it while the landing is full) and walks home; after planting he walks straight home. A plot is `ready ->
  chopping -> stump -> planting -> growing -> ready`. He is free again as soon as he is home, **a sapling does not have to be grown for him to take another tree**. The forest has a clearing from every tended plot to the
  landing (`clearingOf`) so he is never hidden behind a tree.
- **Forklifts** (`haulers`): take 0.3 s to pick up or put down. The output forklift's drive to the yard is a long straight one over the unbuilt rows 2 and 3; its lane `OUT_LANE_GY` runs on the screen-front side of the
  lots so their "for sale" signs never hide it. Routes are in `idleLayout.ts` (`STATIONS`, `LOGGING_ROUTE`, `DELIVERY_ROUTE`) and tested against the zones.
- **Logging truck**: **parked on the east lane of the ingress road in front of the pile.** The ingress road is two lanes wide (`INGRESS_LANE`), so the truck drives a loop: when tapped (and while the landing has a
  trunk) it drives up the east lane, over to the west lane, stops at the landing (which lies along the west lane), loads (one piece per `truckItemS`, until the landing is empty or it is full), drives down the west
  lane, crosses back and parks at the pile to unload. While its time lasts it starts another round whenever the landing has a trunk; with the time up it finishes the round and parks. (This replaces the old
  "one-way, +gy" ingress road with a truck coming from off the map.)
- **Delivery truck** (unchanged, automatic): starts **parked at the dock**, loads from the yard one piece at a time and waits until it is full (`capacity`); then it leaves, its load is **sold at that moment**
  (`sold` event, `PRICE.logs` per piece, the scene shows a floating coin and amount at the truck), it drives down the delivery road and out along the exit road, and a new truck comes after `truckGapS`.
- Units: tree -> trunk -> peeled trunk -> square log. How many planks per log and the prices of planks are not decided; the price only has to rise along the chain.
- **Tuning** (all in `idleData.ts`, first guesses): chop 2.5 s, plant 1.5 s, grow 15 s, worker 2.5 tiles/s; trucks 4 tiles/s, 1 s per piece, delivery gap 6 s, logging truck capacity 5; forklift 3 tiles/s, 0.3 s to
  pick or drop; **active window 30 s**; debarker 4 s, saw 5 s per piece; caps: landing 10, pile 10, storage 6, yard 6 (a machine holds 1); **delivery truck capacity 1**; **a square log sells for 10 coins**.
  With every tap made the moment it is needed, the first sale comes about 34 s after tapping the worker.
- Idle progress while the app is closed: not decided (the other minigames do not keep time while closed). Nothing is saved yet (`IdleMill.create()` starts a new line every time).
- Depth-sorting moving things: every standing block of the static world is its own Graphics with the depth `x + y + w + d` (the tile sum of its front corner), trees in bands of 4 along that depth, the ground at depth -1;
  movers use the same key from their tile position every frame (`setDepth` re-sorts the world `Layer`, checked). A mover is one Graphics redrawn when its heading or cargo changes (`drawParts()` draws its blocks group by
  group from the back to the front of the screen for the current heading).
- Testing from the console: `__game.scene.getScene('IdleMill').speed = 8` multiplies the clock (and `sc.state` is the whole line). The Browser pane runs the page at about 1 fps while it is hidden: front the tab first.

## Open questions

- Plank counts, prices, upgrade cost curves, how many levels per part, the exact price growth of the 2nd and 3rd machine in a row, the price of unlocking rows 2 and 3.
- Can the debarker also be multiplied later (there is free floor around it)?
- Whether the supervisor is one upgrade or levels (faster tapping, then also replanting).
- What the stars are (the stage needs `starsEarned`): milestones such as first sale, row 2 built, row 3 built, all 9 machines bought, N coins earned.
- Saving: a new module in `core/` (`idleSave.ts`, storage via `core/storage.ts`) and a line in `resetProgress()` (`core/reset.ts`).
- The door's icon (it reuses `mill-icon` for now) and its building on the country road.
- Performance: the world has hundreds of trees and dozens of moving things; trees may be one static render texture, only the lumberjacks' plots animate.
- Art: every sprite is an SVG in `src/art/` (isometric), rasterised at 1.5x. List to draw: ground tiles (grass, paved, road), trees (2-3 stages),
  lumberjack, supervisor, trunk, peeled trunk, square log, rough plank, planed plank, pallet, logging truck, delivery truck, forklift (front/back), debarker, saw 1, saw 2, planer,
  storage area (a heap of peeled trunks), an empty lot with a "for sale" sign, shed wall + chimney, heaps (bark, sawdust, wood shavings), signs.
