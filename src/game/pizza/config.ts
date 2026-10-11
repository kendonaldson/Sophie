import type { PlayerPhysicsConfig } from '../config/physics';

/** Initial balancing values, shared by every gameplay pizza pickup. */
export const pizzaRushConfig = {
  pizzaRushDurationMs: 5000,
  pizzaRunSpeedMultiplier: 3,
  pizzaGroundAccelerationMultiplier: 1.4,
  pizzaAirAccelerationMultiplier: 1.15,
  pizzaDashSpeedMultiplier: 2.25,
  pizzaDashDurationMultiplier: 1.2,
  pickupDashBurstMs: 260,
  runningAnimationRate: 1.35,
  pickupRespawnMs: 3000,
  pickupRadius: 18,
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
  } satisfies PlayerPhysicsConfig;
}
