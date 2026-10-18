import { atticEscape } from '../src/game/levels/atticEscape';
import { warehouse } from '../src/game/levels/warehouse';
import { chase } from '../src/game/levels/chase';
import { skyscraper } from '../src/game/levels/skyscraper';
import { balloons } from '../src/game/levels/balloons';
import { maintenance } from '../src/game/levels/maintenance';
import { pizzaFactory } from '../src/game/levels/pizzaFactory';
import { birdAppearance } from '../src/game/birds/appearance';
import { ratAppearance } from '../src/game/rats/appearance';
import { jimmyAppearance } from '../src/game/companion/config';
import { marqueeAppearance } from '../src/game/balloons/config';
import { superJumpAppearance } from '../src/game/superJump/appearance';
import { shellyAppearance } from '../src/game/shelly/appearance';
import { pizzaAppearance } from '../src/game/pizza/appearance';
import {
  pizzaDashAppearance,
  pizzaPickupAppearance,
} from '../src/game/pizza/dashAppearance';

/** Only prepared game assets: source artwork stays out of the offline download. */
export const offlinePublicAssets = [
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'assets/sophie.png',
  ...[
    birdAppearance,
    ratAppearance,
    jimmyAppearance,
    marqueeAppearance,
    superJumpAppearance,
    shellyAppearance,
    pizzaAppearance,
    pizzaDashAppearance,
    pizzaPickupAppearance,
  ].map(({ asset }) => asset),
  ...[
    atticEscape,
    warehouse,
    chase,
    skyscraper,
    balloons,
    maintenance,
    pizzaFactory,
  ].flatMap(({ music }) => (music ? [music] : [])),
];
