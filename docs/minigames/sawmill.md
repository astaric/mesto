# Sawmill (`Sawmill`)

A brick factory in the forest clearing, across the gate from the lookout (`Spot.kind: 'factory'`, `addFactory` in `city/draw.ts`: `factory.svg`,
chimney smoke, the door is in the middle of its front). The stage `mill` plays `Sawmill` in `src/scenes/minigames/sawmill/`; the icon is
`mill-icon.svg`. It is an open-ended tycoon: it never calls `win()`, the stars come from three goals and are banked when something is reached and
again when leaving (`onBack()` → `leave()`).

**The chain.** One tree = one log (`TREE_HP` = 6 axe damage); one log = `PLANKS_PER_LOG` = 4 planks; planks are made into one of 10 products
(1 to 4 planks each, `PRODUCTS` in `millData.ts`, `WORK_PER_PLANK` = 3 hammer taps per plank) which are sold for coins into the shared wallet
(`earn()`). The price per plank never goes down along the list (a test), so a harder product is never a worse deal.

**The scene** is a stock bar (logs, planks) over one panel that is rebuilt for the open tab (`showTab`): *Chop* (tap the tree; the axe swings, the
tree falls, a log flies to the stock bar), *Saw* (tap: a log goes on the bench on the first tap, every tap cuts planks off it), *Make* (a card per
product; tapping one takes its planks and opens the bench overlay where hammer taps fill a bar and make the faint product solid), *Sell* (tap a card
to sell one, or "Sell all"), *Shop* (equipment and workers, `pay()` takes the coins, a click on a row buys the next tier). Chop/Saw update their
own objects (`updateHp`, `updateSaw`); the other panels are simply rebuilt by `sync()` after every change. `sync()` also saves and checks goals.

**Equipment** (`AXES`, `SAWS`, `TOOLS`, a tier index each in the save; tier 0 is free): the axe's `power` is damage per hit (the last tier fells a
tree in one), the saw's is planks per tap (the last cuts a whole log), the tools' is how many times faster hammering is.

**Workers** (`WORKERS`: lumberjack fells a tree, sawyer saws a log, carpenter makes the product picked last, seller sells the dearest item in stock;
levels 1 to 3, each faster) work only while the scene is open: `update()` runs `workersTick()` and the panel shows a hop of the worker and the
result. A worker with nothing to do waits with a full clock instead of banking time.

**Stars** (`goalsReached()`): 1 for the first sale, 1 for all four workers hired, 1 for each of the 10 products made at least once. They are shown
as goal lines at the top of the Shop tab.

**Leaving.** The log on the bench is cut into its remaining planks (`closeBench`) and a half-made product gives its planks back (`cancelJob`), so nothing
is lost; then the stock is saved and the stars are banked.

The rules are Phaser-free in `millLogic.ts` (`chopHit`, `loadBench`/`sawTap`, `startJob`/`hammerTap`, `sellOne`/`sellAll`/`sellBest`, `buyGear`,
`buyWorker`, `workersTick`, `goalsReached`) with the tables in `millData.ts`; the scene only draws and wires input. The stock, equipment and workers
are saved in `core/millSave.ts` (`mill-save`, cleaned of garbage on load, erased by `resetProgress()`); coins are in the wallet.

Art: `src/art/` `log`, `plank`, `mill-axe-1..4`, `mill-saw-1..3`, `mill-tool-1..3`, `wood-<product>` (10), `mill-icon`, `factory`. The art is
rasterised at 1.5x, so a sprite's display size is its SVG size times 1.5 times the scale.
