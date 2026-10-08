export interface ForcedScrollConfig {
  initialSpeed: number;
  acceleration: number;
  lookAhead: number;
  boundaryInset: number;
  stages: readonly { fromX: number; speed: number }[];
}

/** Fixed-tick world-space state. Rendering and display size never drive the chase. */
export class ForcedScroll {
  x = 0;
  speed: number;
  enabled = true;
  constructor(readonly config: ForcedScrollConfig) {
    this.speed = config.initialSpeed;
  }
  step(ms: number, playerX: number) {
    if (!this.enabled) return;
    const target =
      [...this.config.stages].reverse().find((s) => s.fromX <= playerX)
        ?.speed ?? this.config.initialSpeed;
    const dt = ms / 1000;
    const difference = target - this.speed;
    const ramp = Math.min(dt, Math.abs(difference) / this.config.acceleration);
    const next =
      this.speed + Math.sign(difference) * this.config.acceleration * ramp;
    const distance = (this.speed + next) * 0.5 * ramp + next * (dt - ramp);
    this.speed = next;
    this.x = Math.max(this.x + distance, playerX - this.config.lookAhead);
  }
  get boundary() {
    return this.x + this.config.boundaryInset;
  }
  overtaken(x: number) {
    return this.enabled && x <= this.boundary;
  }
  stop() {
    this.enabled = false;
  }
}
