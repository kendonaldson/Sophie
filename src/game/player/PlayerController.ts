import type { PlayerPhysicsConfig } from '../config/physics';
import { touchTiming } from '../config/touch';
import type { PlayerIntent } from '../input/Input';
import { DashController } from './DashController';
import type { SfxOutput } from '../audio/Sfx';
export type PlayerState = 'Grounded' | 'Airborne' | 'Dashing';
export interface Motion {
  vx: number;
  vy: number;
  grounded: boolean;
}
export interface MovementResult extends Motion {
  jumped: boolean;
  dashed: boolean;
}
export const approach = (value: number, target: number, amount: number) =>
  value < target
    ? Math.min(target, value + amount)
    : Math.max(target, value - amount);
export class PlayerController {
  readonly dash: DashController;
  state: PlayerState = 'Airborne';
  facing: -1 | 1 = 1;
  private coyoteMs = 0;
  private bufferMs = 0;
  private dashJumpMs = 0;
  private dashJumpVelocity = 0;
  private canCutJump = false;
  private pendingDash?: { ms: number; x: number; y: number; facing: -1 | 1 };
  constructor(
    readonly config: Readonly<PlayerPhysicsConfig>,
    private readonly sfx?: Pick<SfxOutput, 'jump' | 'dash'>,
  ) {
    this.dash = new DashController(config);
  }
  step(ms: number, input: PlayerIntent, motion: Motion): MovementResult {
    const dt = ms / 1000,
      c = this.config;
    let { vx, vy, grounded } = motion;
    let jumped = false,
      dashed = false;
    this.coyoteMs = grounded ? c.coyoteTimeMs : Math.max(0, this.coyoteMs - ms);
    this.bufferMs = input.jumpPressed
      ? input.jumpSource === 'touch'
        ? Math.max(c.jumpBufferMs, touchTiming.jumpBufferMs)
        : c.jumpBufferMs
      : Math.max(0, this.bufferMs - ms);
    this.dashJumpMs = Math.max(0, this.dashJumpMs - ms);
    if (this.pendingDash) {
      this.pendingDash.ms -= ms;
      if (this.pendingDash.ms <= 0) this.pendingDash = undefined;
    }
    if (input.moveX) this.facing = input.moveX;
    if (input.dashPressed) {
      // Remember the direction of the tap, even if the thumb moves before a refill.
      this.pendingDash =
        input.dashSource === 'touch'
          ? {
              ms: touchTiming.dashBufferMs,
              x: input.moveX,
              y: input.aimY,
              facing: this.facing,
            }
          : undefined;
    }
    const dashEnded = this.dash.tick(ms, grounded);
    if (dashEnded) {
      vx *= c.dashExitMomentumRetention;
      vy *= c.dashExitMomentumRetention;
    }
    const request =
      this.pendingDash ??
      (input.dashPressed
        ? { x: input.moveX, y: input.aimY, facing: this.facing }
        : undefined);
    const touchDash = this.pendingDash !== undefined;
    if (request && this.dash.start(request.x, request.y, request.facing)) {
      this.pendingDash = undefined;
      dashed = true;
      this.sfx?.dash();
      this.canCutJump = false;
      this.dashJumpMs = 0;
      if (grounded && this.dash.direction.y === 0) {
        this.dashJumpMs = touchDash
          ? Math.max(c.dashJumpWindowMs, touchTiming.dashJumpWindowMs)
          : c.dashJumpWindowMs;
        this.dashJumpVelocity =
          this.dash.direction.x * c.dashSpeed * c.dashJumpMomentumRetention;
      }
    }
    if (this.dash.active) {
      vx = this.dash.direction.x * c.dashSpeed;
      vy = this.dash.direction.y * c.dashSpeed;
    }
    if (this.bufferMs > 0 && (this.coyoteMs > 0 || this.dashJumpMs > 0)) {
      if (this.dashJumpMs > 0) vx = this.dashJumpVelocity;
      this.dash.cancel();
      this.dashJumpMs = 0;
      vy = c.jumpVelocity;
      grounded = false;
      jumped = true;
      this.sfx?.jump();
      this.coyoteMs = 0;
      this.bufferMs = 0;
      this.pendingDash = undefined;
      this.canCutJump = true;
    }
    if (!this.dash.active) {
      if (grounded) {
        vx = approach(
          vx,
          input.moveX * c.maxRunSpeed,
          (input.moveX ? c.groundAcceleration : c.groundDeceleration) * dt,
        );
        vy = Math.max(0, vy);
      } else {
        const target = input.moveX * c.maxRunSpeed;
        // Same-direction overspeed decays gently, preserving the long-jump impulse.
        // Reversing direction immediately uses normal air acceleration.
        const sameOverspeed =
          input.moveX !== 0 &&
          Math.sign(vx) === input.moveX &&
          Math.abs(vx) > c.maxRunSpeed;
        vx = approach(
          vx,
          target,
          (sameOverspeed
            ? c.overspeedDrag
            : input.moveX
              ? c.airAcceleration
              : c.airDeceleration) * dt,
        );
      }
      if (!input.jumpHeld && this.canCutJump && vy < 0) {
        vy *= c.jumpCutMultiplier;
        this.canCutJump = false;
      }
      vy = Math.min(c.maxFallSpeed, vy + c.gravity * dt);
    }
    this.state = this.dash.active
      ? 'Dashing'
      : grounded
        ? 'Grounded'
        : 'Airborne';
    return { vx, vy, grounded, jumped, dashed };
  }
  clearBufferedInput() {
    this.bufferMs = 0;
    this.pendingDash = undefined;
    this.dashJumpMs = 0;
    this.dashJumpVelocity = 0;
  }
  reset() {
    this.dash.reset();
    this.coyoteMs = 0;
    this.clearBufferedInput();
    this.canCutJump = false;
    this.state = 'Airborne';
    this.facing = 1;
  }
}
