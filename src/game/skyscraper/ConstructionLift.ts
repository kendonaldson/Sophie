import { climbTuning as t, type ConstructionLiftDefinition } from './config';
/** A committed ride: deterministic boarding, ascent, and an optional summit pause. */
export class ConstructionLift {
  elapsed = 0;
  constructor(readonly definition: ConstructionLiftDefinition) {}
  step(ms: number) {
    this.elapsed += ms;
  }
  get phase() {
    const d = this.definition;
    return this.elapsed < t.boardingMs
      ? 'boarding'
      : this.elapsed < t.boardingMs + d.rideMs
        ? 'riding'
        : d.destination
          ? 'arrived'
          : this.elapsed < t.boardingMs + d.rideMs + t.roofHoldMs
            ? 'view'
            : this.elapsed <
                t.boardingMs + d.rideMs + t.roofHoldMs + t.endingFadeMs
              ? 'fade'
              : 'complete';
  }
  get y() {
    const d = this.definition,
      p = Math.max(0, Math.min(1, (this.elapsed - t.boardingMs) / d.rideMs));
    return d.bottomY + (d.topY - d.bottomY) * p * p * (3 - 2 * p);
  }
  get fade() {
    return Math.max(
      0,
      Math.min(
        1,
        (this.elapsed - t.boardingMs - this.definition.rideMs - t.roofHoldMs) /
          t.endingFadeMs,
      ),
    );
  }
}
