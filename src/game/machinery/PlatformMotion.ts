import type { MovingPlatformDefinition } from '../levels/types';
/** Absolute simulation time makes reversals and endpoint pauses independent of FPS. */
export function platformPosition(
  def: MovingPlatformDefinition,
  timeMs: number,
) {
  const dx = def.end.x - def.start.x,
    dy = def.end.y - def.start.y;
  const travelMs = (Math.hypot(dx, dy) / def.speed) * 1000;
  if (!travelMs) return { ...def.start };
  const pause = def.pauseMs ?? 0;
  const cycle = 2 * (travelMs + pause);
  const t = (((timeMs + (def.phaseMs ?? 0)) % cycle) + cycle) % cycle;
  const amount =
    t < pause
      ? 0
      : t < pause + travelMs
        ? (t - pause) / travelMs
        : t < 2 * pause + travelMs
          ? 1
          : 1 - (t - 2 * pause - travelMs) / travelMs;
  const eased =
    def.easing === 'sine' ? (1 - Math.cos(Math.PI * amount)) / 2 : amount;
  return { x: def.start.x + dx * eased, y: def.start.y + dy * eased };
}
export function standingOn(
  body: { x: number; y: number; width: number; height: number },
  surface: { x: number; y: number; width: number },
  vy: number,
) {
  return (
    vy >= 0 &&
    Math.abs(body.y + body.height - surface.y) < 0.6 &&
    body.x + body.width > surface.x &&
    body.x < surface.x + surface.width
  );
}
