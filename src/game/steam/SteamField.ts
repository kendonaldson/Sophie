import type { SfxOutput } from '../audio/Sfx';
import { overlaps, type Rect } from '../player/CollisionAssist';
import {
  steamCycleMs,
  steamState,
  validateSteamDefinition,
  type SteamDefinition,
} from './SteamCycle';

export class SteamField {
  elapsed = 0;

  constructor(
    private readonly definitions: readonly SteamDefinition[],
    private readonly sfx?: Pick<SfxOutput, 'steamHiss' | 'steamBurst'>,
  ) {
    definitions.forEach(validateSteamDefinition);
  }

  step(ms: number, audibleBounds?: Rect) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const previous = this.elapsed;
    this.elapsed += ms;
    for (const definition of this.definitions) {
      const state = steamState(definition, this.elapsed);
      if (audibleBounds && !overlaps(audibleBounds, state.bounds)) continue;
      const hissAt = definition.clearMs + definition.warningMs;
      const phaseAt =
        state.phase === 'hiss' ? hissAt : hissAt + definition.hissMs;
      if (state.phase !== 'hiss' && state.phase !== 'active') continue;
      const cycle = steamCycleMs(definition);
      const offset = (definition.phaseMs ?? 0) - phaseAt;
      if (
        Math.floor((previous + offset) / cycle) ===
        Math.floor((this.elapsed + offset) / cycle)
      )
        continue;
      // No offscreen or old-phase audio backlog when a long frame skips a tell.
      if (state.phase === 'hiss') this.sfx?.steamHiss();
      else this.sfx?.steamBurst();
    }
  }

  collide(body: Rect) {
    return this.definitions.some((definition) => {
      const state = steamState(definition, this.elapsed);
      return state.active && overlaps(body, state.bounds);
    });
  }

  reset() {
    this.elapsed = 0;
  }

  snapshot() {
    return this.definitions.map((definition) => ({
      ...definition,
      ...steamState(definition, this.elapsed),
    }));
  }
}
