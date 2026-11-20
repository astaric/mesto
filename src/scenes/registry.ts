import { Boot } from './Boot';
import { Title } from './Title';
import { GameSelect } from './GameSelect';
import { StageMap } from './StageMap';
import { Transform } from './Transform';
import { CityHub } from './CityHub';
import { CrumbCatch } from './minigames/CrumbCatch';
import { FeedMonster } from './minigames/FeedMonster';
import { Checkout } from './minigames/Checkout';
import { PetShop } from './minigames/PetShop';
import { FarmShoot } from './minigames/FarmShoot';
import { SweetShop } from './minigames/SweetShop';
import { FishShop } from './minigames/FishShop';
import { EggCollect } from './minigames/EggCollect';
import { FishCut } from './minigames/FishCut';
import { OctopusCatch } from './minigames/OctopusCatch';
import { Cook } from './minigames/Cook';
import { ForestRun } from './minigames/forest/ForestRun';
import { ForestShop } from './minigames/forest/ForestShop';
import { HuntLookout } from './minigames/hunt/HuntLookout';
import { HuntShop } from './minigames/hunt/HuntShop';
import { PizzaMaker } from './minigames/PizzaMaker';
import { CowMilk } from './minigames/barnyard/CowMilk';
import { SheepShear } from './minigames/barnyard/SheepShear';
import { PigFeed } from './minigames/barnyard/PigFeed';
import { RabbitFeed } from './minigames/barnyard/RabbitFeed';
import { FishingBoat } from './minigames/fishing/FishingBoat';

/** Every scene, under the key it passes to `super(...)` (the class name). `main.ts` registers them in this order and
 *  `SceneKey` is the only type that may name a scene, so a typo in `stages.ts` fails `tsc`. */
export const scenes = {
  Boot, Title, GameSelect, StageMap, CrumbCatch, Transform, FeedMonster, CityHub, Checkout, PetShop, FarmShoot,
  SweetShop, FishShop, EggCollect, FishCut, OctopusCatch, Cook, ForestShop, ForestRun, PizzaMaker,
  CowMilk, SheepShear, PigFeed, RabbitFeed, HuntShop, HuntLookout,
  FishingBoat,
};

export type SceneKey = keyof typeof scenes;
