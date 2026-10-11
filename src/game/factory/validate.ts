import type { LevelDefinition } from '../levels/types';
import { overlaps } from '../player/CollisionAssist';

export function validateFactory(level: LevelDefinition) {
  const f = level.factory!;
  const fail = (reason: string): never => {
    throw new Error(`Invalid factory: ${reason}`);
  };
  if (
    level.checkpoints.length !== 1 ||
    level.checkpoints[0]?.id !== f.checkpointId
  )
    fail('exactly one midpoint checkpoint is required');
  const cp = level.checkpoints[0]!;
  if (cp.spawn.x <= f.midpoint.shelly.x || cp.spawn.x >= f.final.triggerX)
    fail('checkpoint must follow the first confrontation');
  if (
    level.conveyors?.some((b) =>
      level.platforms.some(
        (p) => p.id === b.platformId && overlaps(p, cp.area),
      ),
    ) ||
    f.ovens.some((o) => overlaps(o, cp.area)) ||
    f.rollZones.some((z) => cp.spawn.x >= z.fromX && cp.spawn.x <= z.toX)
  )
    fail('checkpoint must be free of machinery and rolls');
  for (const c of [f.midpoint, f.final])
    if (
      !c.pizza.requiresDash ||
      c.pizza.x >= c.shelly.x ||
      c.triggerX >= c.pizza.x
    )
      fail('pizza must precede its blocking Shelly along the dash route');
  for (const zone of f.rollZones)
    if (!(
      zone.left < zone.fromX &&
      zone.fromX < zone.toX &&
      zone.toX <= zone.right
    ))
      fail('invalid roll zone');
  for (const oven of f.ovens)
    if (
      ![oven.x, oven.y, oven.width, oven.height].every(Number.isFinite) ||
      oven.width <= 0 ||
      oven.height <= 0
    )
      fail('invalid oven');
}
