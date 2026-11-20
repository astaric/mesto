---
name: new-minigame
description: Use when adding or changing a minigame, stage, shop or town building in this game (a new scene in src/scenes/minigames, a new door in the city, a new entry in journeys). Gives the checklist of files to touch and the shared helpers so you do not have to survey the existing scenes.
---

# New minigame

1. Read `docs/new-minigame.md` (checklist, skeleton, helper table, variants, pitfalls).
2. Read `src/scenes/minigames/barnyard/CowMilk.ts` as the reference scene. Open one more scene only if the **Variants** table
   in the doc points to it for what you need, and a `docs/minigames/<area>.md` only if you are changing that game.
3. Do **not** survey the other minigames or the files in `src/core/`: the helper table in the doc has their signatures. Read a
   helper's file only when the doc does not cover what you need, and then add the missing line to the doc.
4. Follow the checklist: scene, `registry.ts`, `stages.ts`, `town.ts` spot, `en.ts` + `sl.ts`, art, logic + test, docs.
5. `npm run build` and `npm test`, play it in the browser (`preview_start` with `dev`), commit (project rule).
6. If you had to explore because the doc was wrong or silent, fix the doc in the same commit.
