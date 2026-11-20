# Adding a minigame

A recipe, so a new minigame does not start with reading the other ones. Read this and `src/scenes/minigames/barnyard/CowMilk.ts`
(105 lines, a complete small game) and start writing. Open another scene only for the variant you need (see **Variants**).

## The checklist (every new minigame touches these, nothing else is needed)

1. **Scene** `src/scenes/minigames/<Name>.ts` (or a folder `<area>/` when it has several files): `class Name extends StageScene`,
   `constructor() { super('Name'); }` (the key is the class name). Skeleton: see **Skeleton**.
2. **Register** in `src/scenes/registry.ts`: one `import` and the class name in the `scenes` object. `SceneKey` is derived from it.
3. **Stage** in `src/core/stages.ts`, `journeys.city.stages`: `{ id, scene: 'Name', icon, label: 'stage.<id>' }`.
   `icon` is a texture key (an SVG in `src/art`); `id` is unique in the journey. It shows up in the `GameSelect` list by itself.
   A stage that is part of a series (`food`, `farm`, `octopus`) goes into that journey's `stages` instead and has no building.
4. **Building** (city stages only) in `src/scenes/city/town.ts`, `spots`: a row with the **same `id`**
   (`{ id, x, base: TOP_BASE | BOTTOM_BASE, w: 460, wall, roof, gable? }`). `city/draw.ts` draws it from the row, including the
   door, sign (the stage's `icon` and `label`) and stars; there is nothing to draw by hand. Rows are full where
   they are: `buildings in a row do not overlap` and `holds every farm building, inside the world` in `town.test.ts` tell you
   when a position does not work (the country road between `TOWN_E` and `FARM_X` has no buildings yet).
   Things that are not a plain building (a gate, the lookout tower, the boat in its pond) have a `kind` and their own `add*` in `draw.ts`.
5. **Text** in `src/i18n/en.ts` **and** `sl.ts` (the Slovene one is `Record<Key, string>`, so a missing key fails `tsc`):
   `stage.<id>` (label of the door/card) and `<id>.title` (the instruction at the top of the scene), plus whatever else shows.
   Namespaced keys, English key names, Slovene only as a value.
6. **Art** `src/art/<name>.svg`, English file names; auto-loaded by `Boot` under the file name without extension. The art
   is rasterised at 1.5x, so a sprite's display size is its SVG size times 1.5 times its scale. Reuse what exists first
   (`ls src/art | grep <word>`). A texture key in a table that has no file fails a test (`src/test/art.ts`).
7. **Sound**: reuse `sfx.*` (list in `src/core/sfx.ts`: pop, boing, whoosh, chomp, burp, yay, beep, coin, poof, bang, cluck,
   chop, crack, splash, sizzle, hurt, reload, click, growl, ding, chest, shotgun, moo, baa, snip, squirt, oink ...). A new
   sound is a one-line `tone()` entry in `sfx`.
8. **Logic + test** when there are rules (counts, thresholds, scoring): a Phaser-free `<name>Logic.ts` and `<name>Logic.test.ts`
   next to it (see `barnyard/barnyardLogic.ts`). The scene only draws and wires input. Never import Phaser in the logic file.
9. **Docs**: one short paragraph in `CLAUDE.md` if it adds a rule the others must know; the game's own details go in
   `docs/minigames/<area>.md` (create it if the game is new).
10. **Done** = `npm run build` and `npm test` pass, the game was played in the browser (`preview_start` with `dev`), commit.

Other things a game may need: a saved value (a new module in `src/core/` using `storage.ts`, plus a line in `resetProgress()` in
`core/reset.ts` and its test), a shop first (`enterStage()` in `stages.ts` redirects, as for the lookout and the forest gate),
`data` for reusing one scene with different settings (`Stage.data`, read in `init(d)` and kept in a field, as `FarmShoot` and `FeedMonster` do; `create()` then resets the rest).

## Skeleton

```ts
import { W, H } from '../../core/layout';          // 2048 x 1536 design size, lay out in these coordinates (use what you need)
import { StageScene } from '../../core/MiniGame';
import { counter, hudTitle, type Counter } from '../../core/ui';
import { starsFor } from '../../core/stars';
import { t } from '../../i18n';

const GOAL = 5;

export class Name extends StageScene {
  private goal!: Counter;
  private done = false;
  private misses = 0;

  constructor() { super('Name'); }

  create(): void {
    // Every bit of state is reset here: the same scene object is reused when the player plays again.
    this.done = false; this.misses = 0;
    this.backdrop(0xcfeaff);                          // background colour + fade in + the ◀ button (depth 9000)
    this.goal = counter(this, GOAL);                  // "0 / 5" under the title
    hudTitle(this, t('name.title'));                  // call t() here or later, never at module top level
    // ... objects, tweens, input
  }

  private succeed(): void {
    if (this.done) return;
    this.done = true;
    this.time.delayedCall(300, () => this.win(starsFor(this.misses), { pay: true }));
  }
}
```

`win(stars, { message?, ms?, pay? })` shows the banner, stars and jingle, banks the stars and leaves. `pay: true` pays
2/4/6 coins by stars (for games that do not earn per action). A game that cannot be played badly gives `win(3, ...)`.
Override `onBack()` to bank something before the ◀ button leaves.

## Helpers (do not hand-roll these)

| Need | Use | File |
|---|---|---|
| Title across the top, `fade` for busy games | `hudTitle(scene, s, { fade? })` | `core/ui.ts` |
| "n / goal" counter with pulse | `counter(scene, goal)` -> `.set(n)`, `.add()`, `.value`, `.reached` | `core/ui.ts` |
| Wallet top-right | `coinCounter(scene)` -> `.refresh()` | `core/ui.ts` |
| Price under a shop item, take coins | `priceTag(scene, x, y, price)`, `pay(scene, wallet, price)` (false + shake if too poor) | `core/ui.ts` |
| Earn coins during play | `earn(n)` | `core/profile.ts` |
| Outlined HUD text | `outlined(text)` | `core/ui.ts` |
| Big text | `text(scene, x, y, s, size = 80)` | `core/touch.ts` |
| Big tap button | `tapButton(scene, x, y, label, onTap)`; round glyph button `circleButton`; guard a handler against double taps `guardedTap` | `core/touch.ts`, `core/ui.ts` |
| Drag something sideways | `dragX(scene, container, minX, maxX)` | `core/touch.ts` |
| Touch stick + arrows/WASD | `new Joystick({ r, zone, x?, y?, axis? })`, `joy.read()` each frame, `joy.owns(p)` in your own `pointerdown` | `core/Joystick.ts` |
| Star rule | `starsFor(misses, limits = [2, 5])`: 3 stars <= 2 misses, 2 <= 5, else 1 | `core/stars.ts` |
| Fade to another scene | `fadeToScene(keyOrFn, data?, ms?)` (a function is called after the fade); `fadeInScene(bg)` | `core/GameScene.ts` |
| Colours and font | `INK`, `CREAM`, `FADE_RGB`, `FONT` (no literals in scenes) | `core/theme.ts` |
| Kitchen / barn / meadow scenery | `tiledWall`, `puff` in `minigames/kitchen.ts`; `barnInterior`, `meadow`, `shelf` in `barnyard/scenery.ts` | |
| Saved values | `readItem`/`writeItem`/`readJson`/`writeJson`, never `localStorage` | `core/storage.ts` |

Input: up to 3 simultaneous pointers. Audio starts from a tap (`unlockAudio()` is already called by the first button).
Depth is set by hand; the ◀ button is at 9000 and the win banner at 8000, HUD at <= 1000.

## Variants (open only the one you need)

| The game is like... | Look at |
|---|---|
| tap things until a count is reached | `barnyard/CowMilk.ts` (the reference), `EggCollect.ts` |
| drag over things | `barnyard/SheepShear.ts`; drag an item to a target: `barnyard/PigFeed.ts` |
| things pop up, tap them | `barnyard/RabbitFeed.ts`, `FarmShoot.ts` (also data-driven via `Stage.data`) |
| steer something sideways | `CrumbCatch.ts` (`dragX`); tap at the right moment: `FeedMonster.ts` (also takes `Stage.data`) |
| order of steps (cook, build) | `PizzaMaker.ts` + `pizzaData.ts`, `Cook.ts`, `FishCut.ts` |
| a shop | `SweetShop.ts`, `FishShop.ts`, `PetShop.ts`, `hunt/HuntShop.ts` |
| walk around with a joystick | `hunt/HuntLookout.ts`, and the town `CityHub.ts` |
| first-person / pseudo-3D | `forest/ForestRun.ts` (`docs/minigames/forest.md`) |

## Pitfalls that cost time before

- All per-play state belongs in `create()` (or a fresh `newRun()`-style object), not in field initialisers only: "Play again" reuses the scene.
- `t()` inside `create()`/methods only; the language is read at startup and can change.
- All code in English (identifiers, comments, file names, texture keys, ids). Slovene appears only as values in `sl.ts`.
- A scene that reacts to taps and also has a `Joystick` must ask `joy.owns(p)` first.
- Do not advance `progress.index` or call `scene.start` yourself to leave: use `win()` / `finish()` / the ◀ button, which route through
  `advanceFlow()` so hubs, series and the game list all work.
- A new saved key must be added to `resetProgress()`.
