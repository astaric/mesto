# Fishing boat

A fishing boat moored in a pond south-east of the town (`Spot.kind: 'ship'`, `addShip` in `city/draw.ts`: the pond is a solid rect,
the door is at the foot of a wooden jetty on its near edge, `boat.svg` floats in it). The stage `boat` plays `FishingBoat` in
`src/scenes/minigames/fishing/`; the icon is `boat-icon.svg`.

You stand on the deck and fish swim past under the boat, small ones (`sea-fish-small.svg`) and big ones (the existing `fish.svg`). Pick the
small or the big net with the two buttons at the bottom (each shows its net and the fish it is for), tap on the water and the net
flies from the deck rail to that spot, with a rope. **A net only catches fish of its own size**: a big fish is too big for the small
net, a small fish slips through the mesh of the big one (the fish bolts away with a puff). Win = 6 small + 6 big
(`QUOTA`; a kind that is full no longer swims by). Stars by misses (`MISS_LIMITS` 4/9: a cast that caught nothing is a miss),
pays by stars once (`win(stars, { pay: true })`).

The rules are Phaser-free in `fishingLogic.ts` (`resolveCast`: which fish are inside the net's radius and which of them it
catches; `aimAt`: a tap within `ASSIST_RADIUS` of a fish throws where that fish will be when the net lands, so a child need not
lead a moving fish; `nextKind`: the kind still missing more is more likely to swim by). The scene only draws and wires input. The net
radius (`NET_RADIUS`) is the single size that the picture, the buttons and the catch area are all derived from.
