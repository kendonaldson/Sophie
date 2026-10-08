export interface PlayerPhysicsConfig {
  maxRunSpeed: number;
  groundAcceleration: number;
  groundDeceleration: number;
  airAcceleration: number;
  airDeceleration: number;
  overspeedDrag: number;
  gravity: number;
  maxFallSpeed: number;
  jumpVelocity: number;
  jumpCutMultiplier: number;
  coyoteTimeMs: number;
  jumpBufferMs: number;
  dashSpeed: number;
  dashDurationMs: number;
  dashJumpWindowMs: number;
  dashJumpMomentumRetention: number;
  dashExitMomentumRetention: number;
  maxDashCharges: 2;
  groundedDashRechargeMs: number;
  collisionInsetX: number;
  collisionInsetTop: number;
  collisionInsetBottom: number;
  cornerCorrectionPixels: number;
  edgeForgivenessPixels: number;
}
export const physics: Readonly<PlayerPhysicsConfig> = {
  maxRunSpeed: 180,
  groundAcceleration: 1800,
  groundDeceleration: 2100,
  airAcceleration: 1000,
  airDeceleration: 180,
  overspeedDrag: 65,
  gravity: 900,
  maxFallSpeed: 600,
  jumpVelocity: -310,
  jumpCutMultiplier: 0.45,
  coyoteTimeMs: 105,
  jumpBufferMs: 120,
  dashSpeed: 480,
  dashDurationMs: 170,
  dashJumpWindowMs: 190,
  dashJumpMomentumRetention: 0.9,
  dashExitMomentumRetention: 0.45,
  maxDashCharges: 2,
  groundedDashRechargeMs: 500,
  collisionInsetX: 17,
  collisionInsetTop: 33,
  collisionInsetBottom: 6,
  cornerCorrectionPixels: 5,
  edgeForgivenessPixels: 3,
};
export const simulation = {
  stepMs: 1000 / 120,
  maxFrameMs: 100,
  respawnMs: 180,
  endingFadeMs: 650,
} as const;
