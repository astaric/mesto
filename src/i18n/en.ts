// English source of truth for all player-facing text. Keys are English and namespaced by area
// (`stage.*`, `quest.*`, ...). `sl.ts` must define every key, which `tsc` enforces.
// Placeholders look like `{n}`. Emoji that carry meaning live inside the strings.
export const en = {
  // Shared
  'common.again': 'Again!',
  'common.bravo': 'Well done!',
  'common.yum': 'Yum!',

  // Title / menus
  'title.play': 'Play!',
  'select.title': 'Pick a game!',
  'map.go': "Let's go!",
  'ui.reload': 'Hold to restart the game',

  // Game cards on the select screen
  'select.food': 'Funny food!',
  'select.city': 'City',
  'select.farm': 'Hunt!',
  'select.octopus': 'Octopus',
  'select.forest': 'Forest',
  'select.pizza': 'Pizza',

  // Journey titles (stage map header)
  'journey.food': 'Funny food',
  'journey.city': 'City',
  'journey.farm': 'Farm',
  'journey.forest': 'Forest',
  'journey.pizza': 'Pizza',
  'journey.octopus': 'Octopus',

  // Stage labels on the stage map
  'stage.crumbs': 'Crumbs!',
  'stage.poof': 'Poof!',
  'stage.feed': 'Feed!',
  'stage.toCity': 'To the city!',
  'stage.checkout': 'Checkout!',
  'stage.pets': 'Animals!',
  'stage.sweets': 'Sweets!',
  'stage.fish': 'Fish!',
  'stage.home': 'Home!',
  'stage.eggs': 'Eggs!',
  'stage.cut': 'Cutting!',
  'stage.hens': 'Hens!',
  'stage.pigs': 'Piglets!',
  'stage.all': 'Everything!',
  'stage.forest': 'Forest!',
  'stage.pizza': 'Pizza!',
  'stage.hunt': 'Hunt!',
  'stage.cook': 'Cooking!',
  'stage.munch': 'Munch!',

  // Finales
  'finale.food': 'Rrrig! Delicious!',
  'finale.farm': 'Well done, hunter!',
  'finale.forest': 'Well done, forester!',
  'finale.meal': 'Enjoy your meal!',

  // Minigames
  'crumbs.title': 'Catch the crumbs!',
  'transform.tap': 'Tap the chicken!',
  'transform.done': 'Ta-da! Time for nuggets!',
  'feed.nugget': 'Throw the nugget in its mouth!',
  'feed.monster': 'Feed the monster!',
  'city.hint': 'Walk into a building!',
  'checkout.scan': 'Scan the items!',
  'pets.choose': 'Pick an animal!',
  'pets.friend': 'New friend!',
  'sweets.choose': 'Pick a dessert!',
  'sweets.decorate': 'Decorate it!',
  'fishShop.choose': 'Pick a fish!',
  'fishShop.fish': 'Fish',
  'fishShop.octopus': 'Octopus',
  'fishShop.wrapped': 'Wrapped!',
  'eggs.collect': 'Collect the eggs!',
  'cut.drag': 'Drag across the lines!',
  'cut.done': 'All cut up!',
  'octopus.catch': 'Catch the octopuses!',
  'cook.title': 'Cook it!',
  'farm.shoot': 'Shoot them!',
  'farm.hint': '👆 drag to walk',

  // Pizza
  'pizza.make': 'Make a pizza!',
  'pizza.bake': 'Bake!',
  'pizza.margherita': 'Margherita',
  'pizza.romana': 'Romana',
  'pizza.mushroom': 'Mushroom',
  'pizza.fourSeasons': 'Four Seasons',
  'pizza.tuna': 'Tuna',
  'pizza.frankfurter': 'Frankfurter',
  'pizza.karst': 'Karst',
  'pizza.harlekin': 'Harlekin',

  // Forest run
  'forest.hint': '👆 Tap an enemy to shoot\n◀ ▶ bottom left: move',
  'forest.questDone': 'Quest complete! ⭐',
  'forest.noBunny': 'Not the bunny! −50',
  'forest.saved': '🐰 Saved!',
  'forest.gameOver': 'End of the path!',
  'forest.distance': 'Distance: {n} m',
  'forest.quests': 'Quests: {done}    ⭐ {score}',
  'forest.newRecord': '🏆 New record!',
  'forest.record': 'Record: {n} m',
  'forest.finish': 'Finish',

  // Forest quests ({n} is progress like "2/5")
  'quest.mushroom': '🍄 Shoot mushrooms {n}',
  'quest.bat': '🦇 Shoot bats {n}',
  'quest.spider': '🕷️ Shoot spiders {n}',
  'quest.bear': '🐻 Defeat bears {n}',
  'quest.troll': '👹 Defeat the troll!',
  'quest.coin': '🪙 Collect coins {n}',
  'quest.chest': '🧰 Open chests {n}',
  'quest.bunny': '🐰 Save bunnies {n}',
  'quest.honey': '🍯 Collect honey {n}',
  'quest.meters': '👟 Run {n} m',
  'quest.nohit': '🛡️ {n} m without a hit',
  'quest.slime': '🟢 Shoot slimes {n}',
  'quest.golem': '🗿 Defeat golems {n}',
  'quest.snowman': '⛄ Shoot snowmen {n}',
  'quest.wolf': '🐺 Defeat wolves {n}',
  'quest.polar': '🐻‍❄️ Defeat polar bears {n}',
  'quest.imp': '😈 Shoot imps {n}',
  'quest.skull': '💀 Shoot fire skulls {n}',
  'quest.demon': '👿 Defeat the demon!',

  // Forest worlds (banner shown when you enter one)
  'biome.forest': 'Forest!',
  'biome.cave': 'Cave!',
  'biome.arctic': 'Arctic world!',
  'biome.hell': 'Hell!',
  'forest.boss': '👿 Dodge the fireballs!',
  'forest.victory': 'Victory!',
  'forest.shop': 'Weapons',

  // Weapon shop
  'stage.arsenal': 'Weapons!',
  'shop.title': 'Pick a weapon!',
  'shop.owned': 'Yours',
  'shop.equipped': '✔ In hand',
  'shop.go': 'To the forest!',
  'weapon.pistol': 'Pistol',
  'weapon.shotgun': 'Shotgun',
  'weapon.smg': 'Machine gun',
  'weapon.laser': 'Laser rifle',
  'weapon.rocket': 'Rocket launcher',
} as const;

export type Key = keyof typeof en;
