import { raceHome } from '../levels/raceHome';
import { maintenance } from '../levels/maintenance';
import { pizzaFactory } from '../levels/pizzaFactory';
import { balloons } from '../levels/balloons';
import { interlude2 } from '../story/interlude2';
import { atticEscape } from '../levels/atticEscape';
import { chase } from '../levels/chase';
import { skyscraper } from '../levels/skyscraper';
import { warehouse } from '../levels/warehouse';
import { interlude1 } from '../story/interlude1';
import { interlude3 } from '../story/interlude3';
export const storyScenes = {
  'interlude-1': 'Interlude1',
  'interlude-2': 'Interlude2',
  'interlude-3': 'Interlude3',
} as const;
export type StoryId = keyof typeof storyScenes;
export function storySceneKey(id: string) {
  return Object.hasOwn(storyScenes, id)
    ? storyScenes[id as StoryId]
    : undefined;
}
export const sceneDestinations = [
  atticEscape,
  warehouse,
  interlude1,
  chase,
  skyscraper,
  interlude2,
  balloons,
  maintenance,
  interlude3,
  pizzaFactory,
  raceHome,
] as const;
