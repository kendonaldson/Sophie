import { expect, it } from 'vitest';
import { offlinePublicAssets } from '../scripts/offline-assets';
import { sceneDestinations } from '../src/game/scenes/destinations';

it('includes every configured chapter and story soundtrack in the offline download', () => {
  for (const destination of sceneDestinations) {
    if ('music' in destination && destination.music)
      expect(offlinePublicAssets, destination.id).toContain(destination.music);
  }
});
