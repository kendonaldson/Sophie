import { balloons } from '../levels/balloons';
import { interlude2 } from '../story/interlude2';
import { atticEscape } from '../levels/atticEscape';
import { chase } from '../levels/chase';
import { skyscraper } from '../levels/skyscraper';
import { warehouse } from '../levels/warehouse';
import { interlude1 } from '../story/interlude1';
export const sceneDestinations = [
  atticEscape,
  warehouse,
  interlude1,
  chase,
  skyscraper,
  interlude2,
  balloons,
] as const;
