import { atticEscape } from '../levels/atticEscape';
import { chase } from '../levels/chase';
import { warehouse } from '../levels/warehouse';
import { interlude1 } from '../story/interlude1';
export const sceneDestinations = [
  atticEscape,
  warehouse,
  interlude1,
  chase,
] as const;
