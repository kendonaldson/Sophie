import type { SkyscraperDefinition } from './config';
import { climbTuning as t } from './config';
/** Checkpoint order, not horizontal position, defines the switchback route. */
export class ClimbProgress {
  challenge = 0;
  constructor(readonly definition: SkyscraperDefinition) {}
  atCheckpoint(id: string) {
    this.challenge = Math.max(
      0,
      this.definition.challenges.findIndex((c) => c.checkpoint === id),
    );
  }
  get current() {
    return this.definition.challenges[this.challenge]!;
  }
  get section() {
    return this.definition.sections[this.current.section]!;
  }
  fallBoundary(spawnY: number) {
    return Math.min(this.section.bottom + 50, spawnY + t.fallMargin);
  }
  get resetTreats() {
    return new Set(
      this.definition.challenges.slice(this.challenge).flatMap((c) => c.treats),
    );
  }
}
