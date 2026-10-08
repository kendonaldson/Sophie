import type { PlayerPhysicsConfig } from '../config/physics';
export interface Direction {
  x: number;
  y: number;
}
export class DashController {
  charges = 1;
  groundedMs = 0;
  remainingMs = 0;
  direction: Direction = { x: 1, y: 0 };
  constructor(private readonly config: Readonly<PlayerPhysicsConfig>) {}
  get active() {
    return this.remainingMs > 0;
  }
  get rechargeProgress() {
    return Math.min(1, this.groundedMs / this.config.groundedDashRechargeMs);
  }
  tick(ms: number, grounded: boolean): boolean {
    const wasActive = this.active;
    this.remainingMs = Math.max(0, this.remainingMs - ms);
    this.groundedMs = grounded ? this.groundedMs + ms : 0;
    if (this.groundedMs + 1e-6 >= this.config.groundedDashRechargeMs)
      this.charges = Math.max(this.charges, 1);
    return wasActive && !this.active;
  }
  start(x: number, y: number, facing: number, infinite = false): boolean {
    if (this.active || (!infinite && this.charges === 0)) return false;
    if (x === 0 && y === 0) x = facing;
    const length = Math.hypot(x, y);
    this.direction = { x: x / length, y: y / length };
    if (!infinite) this.charges--;
    this.remainingMs = this.config.dashDurationMs;
    // Spending a charge begins a fresh recovery interval on valid ground.
    this.groundedMs = 0;
    return true;
  }
  collectTreat() {
    this.charges = Math.min(this.config.maxDashCharges, this.charges + 1);
  }
  cancel() {
    this.remainingMs = 0;
  }
  reset() {
    this.charges = 1;
    this.groundedMs = 0;
    this.remainingMs = 0;
    this.direction = { x: 1, y: 0 };
  }
}
