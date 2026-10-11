import { pizzaRushConfig } from './config';
/** The story owns an unlimited lifetime; gameplay supplies a finite duration.
 * No scene, sprite, input, collision, or Jimmy state is stored here. */
export const pizzaPowerConfig = {
  speedMultiplier: pizzaRushConfig.pizzaRunSpeedMultiplier,
} as const;

export class PizzaPower {
  remainingMs = 0;
  constructor(readonly durationMs = Infinity) {}
  get active() {
    return this.remainingMs > 0;
  }
  get fraction() {
    return this.active
      ? Number.isFinite(this.durationMs)
        ? Math.min(1, this.remainingMs / this.durationMs)
        : 1
      : 0;
  }
  get speedMultiplier() {
    return this.active ? pizzaPowerConfig.speedMultiplier : 1;
  }
  activate() {
    const fresh = !this.active;
    this.remainingMs = this.durationMs;
    return fresh;
  }
  tick(ms: number) {
    const wasActive = this.active;
    if (Number.isFinite(ms))
      this.remainingMs = Math.max(0, this.remainingMs - Math.max(0, ms));
    return wasActive && !this.active;
  }
  reset() {
    this.remainingMs = 0;
  }
}
