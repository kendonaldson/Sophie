import type { LevelDefinition } from '../levels/types';
import { overlaps } from '../player/CollisionAssist';
import { pizzaRushConfig } from '../pizza/config';

export function validateFactory(level: LevelDefinition) {
  const f = level.factory!;
  const fail = (reason: string): never => {
    throw new Error(`Invalid factory: ${reason}`);
  };
  if (
    level.checkpoints.length !== 2 ||
    level.checkpoints[0]?.id !== f.checkpointId ||
    level.checkpoints[1]?.id !== f.finalCheckpointId
  )
    fail('ordered midpoint and final-runway checkpoints are required');
  const cp = level.checkpoints[0]!;
  if (cp.spawn.x <= f.midpoint.shelly.x || cp.spawn.x >= f.final.triggerX)
    fail('checkpoint must follow the first confrontation');
  const final = level.checkpoints[1]!;
  if (
    final.spawn.x < f.final.triggerX ||
    final.spawn.x >= f.final.pizza.x ||
    final.spawn.y !== f.final.staging.y ||
    final.area.x > f.final.triggerX ||
    final.area.x + final.area.width < f.final.staging.x ||
    final.area.y > f.final.staging.y ||
    final.area.y + final.area.height < f.final.staging.y
  )
    fail(
      'final checkpoint must cover the dialogue runway before the last jump',
    );
  for (const checkpoint of level.checkpoints)
    if (
      level.conveyors?.some((b) =>
        level.platforms.some(
          (p) => p.id === b.platformId && overlaps(p, checkpoint.area),
        ),
      ) ||
      f.ovens.some((o) => overlaps(o, checkpoint.area)) ||
      f.rollZones.some(
        (z) => checkpoint.spawn.x >= z.fromX && checkpoint.spawn.x <= z.toX,
      )
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
  for (const pizza of f.pizzas)
    if (
      ![pizza.x, pizza.y].every(Number.isFinite) ||
      pizza.x < 0 ||
      pizza.x > level.width ||
      pizza.y < 0 ||
      pizza.y > level.height ||
      f.ovens.some((oven) =>
        overlaps(
          {
            x: pizza.x - pizzaRushConfig.pickupRadius,
            y: pizza.y - pizzaRushConfig.pickupRadius,
            width: pizzaRushConfig.pickupRadius * 2,
            height: pizzaRushConfig.pickupRadius * 2,
          },
          oven,
        ),
      )
    )
      fail('traversal pizza must be inside the level and clear of ovens');
  for (const oven of f.ovens)
    if (
      ![oven.x, oven.y, oven.width, oven.height].every(Number.isFinite) ||
      oven.width <= 0 ||
      oven.height <= 0
    )
      fail('invalid oven');
}
