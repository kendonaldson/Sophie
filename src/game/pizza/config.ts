import type { PlayerPhysicsConfig } from '../config/physics';

/** Initial balancing values, shared by every gameplay pizza pickup. */
export const pizzaRushConfig = {
  pizzaRushDurationMs: 8000,
  pizzaRunSpeedMultiplier: 2,
  pizzaGroundAccelerationMultiplier: 1.4,
  pizzaAirAccelerationMultiplier: 1.15,
  pizzaGroundedRechargeMultiplier: 0.5,
  pizzaDashSpeedMultiplier: 2,
  pizzaDashDurationMultiplier: 1,
  pickupDashBurstMs: 170,
  runningAnimationRate: 1.35,
  pickupRespawnMs: 3000,
  pickupRadius: 18,
  aura: {
    color: 0xffc45c,
    highlightColor: 0xffeab0,
    halfWidth: 34,
    halfHeight: 25,
    standingOffsetY: -7,
    pixelStep: 2,
    pulseMs: 1200,
    fillAlpha: 0.18,
    edgeAlpha: 0.54,
    pulseAlpha: 0.08,
    shimmerStepMs: 140,
  },
} as const;

export function pizzaMovementConfig(base: Readonly<PlayerPhysicsConfig>) {
  const c = pizzaRushConfig;
  return {
    ...base,
    maxRunSpeed: base.maxRunSpeed * c.pizzaRunSpeedMultiplier,
    groundAcceleration:
      base.groundAcceleration * c.pizzaGroundAccelerationMultiplier,
    airAcceleration: base.airAcceleration * c.pizzaAirAccelerationMultiplier,
    dashSpeed: base.dashSpeed * c.pizzaDashSpeedMultiplier,
    dashDurationMs: base.dashDurationMs * c.pizzaDashDurationMultiplier,
    groundedDashRechargeMs:
      base.groundedDashRechargeMs * c.pizzaGroundedRechargeMultiplier,
  } satisfies PlayerPhysicsConfig;
}
