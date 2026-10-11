import type { Rect } from '../player/CollisionAssist';
import { factoryTuning as t } from './config';

/** The outer flame tips and mouth edges forgive a graze; the hot core hurts. */
export function ovenFireBounds(oven: Rect): Rect {
  const side = Math.min(t.ovenFireInsetX, oven.width / 4);
  const top = Math.min(t.ovenFireInsetTop, oven.height / 3);
  return {
    x: oven.x + side,
    y: oven.y + top,
    width: oven.width - side * 2,
    height: oven.height - top,
  };
}
