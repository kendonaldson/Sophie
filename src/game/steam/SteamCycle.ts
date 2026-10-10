import type { Rect } from '../player/CollisionAssist';

export interface SteamDefinition {
  id: string;
  x: number;
  width: number;
  floorY: number;
  height: number;
  clearMs: number;
  warningMs: number;
  hissMs: number;
  activeMs: number;
  dissipateMs: number;
  phaseMs?: number;
}
export type SteamPhase =
  'clear' | 'warning' | 'hiss' | 'active' | 'dissipating';
export interface SteamState {
  phase: SteamPhase;
  progress: number;
  /** Gauge pressure and warning brightness; dissipating steam is harmless. */
  pressure: number;
  active: boolean;
  bounds: Rect;
}
export const steamCycleMs = (d: SteamDefinition) =>
  d.clearMs + d.warningMs + d.hissMs + d.activeMs + d.dissipateMs;

export function validateSteamDefinition(d: SteamDefinition) {
  if (
    !d.id ||
    ![d.x, d.floorY, d.phaseMs ?? 0].every(Number.isFinite) ||
    ![
      d.width,
      d.height,
      d.clearMs,
      d.warningMs,
      d.hissMs,
      d.activeMs,
      d.dissipateMs,
    ].every((value) => Number.isFinite(value) && value > 0)
  )
    throw new Error(`Invalid steam hazard: ${d.id}`);
}

export function steamState(d: SteamDefinition, elapsedMs: number): SteamState {
  const cycle = steamCycleMs(d);
  let remaining = (((elapsedMs + (d.phaseMs ?? 0)) % cycle) + cycle) % cycle;
  const phases: readonly [SteamPhase, number][] = [
    ['clear', d.clearMs],
    ['warning', d.warningMs],
    ['hiss', d.hissMs],
    ['active', d.activeMs],
    ['dissipating', d.dissipateMs],
  ];
  for (const [phase, duration] of phases) {
    if (remaining < duration) {
      const progress = remaining / duration;
      const pressure =
        phase === 'clear'
          ? 0
          : phase === 'warning'
            ? progress * 0.65
            : phase === 'hiss'
              ? 0.65 + progress * 0.35
              : phase === 'active'
                ? 1
                : 1 - progress;
      return {
        phase,
        progress,
        pressure,
        active: phase === 'active',
        bounds: {
          x: d.x,
          y: d.floorY - d.height,
          width: d.width,
          height: d.height,
        },
      };
    }
    remaining -= duration;
  }
  throw new Error(`Invalid steam cycle: ${d.id}`);
}
