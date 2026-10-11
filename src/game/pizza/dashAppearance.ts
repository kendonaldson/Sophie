import dashSheet from './dash-sheet.json';
import pickupSheet from './pickup-sheet.json';
import type { Direction } from '../player/DashController';

export const pizzaDashAppearance = dashSheet;
export const pizzaPickupAppearance = { ...pickupSheet, frameRate: 10 };

/** The source supplies horizontal and diagonal pairs. Mirror leftward poses;
 * rotate diagonal art for vertical travel around the measured body anchor. */
export function pizzaDashPose(direction: Direction, elapsed: number) {
  const beat = Math.floor(elapsed / 65) % 2;
  if (direction.y === 0)
    return { frame: beat, flipX: direction.x < 0, angle: 0 };
  const frame = (direction.y < 0 ? 2 : 4) + beat;
  return {
    frame,
    flipX: direction.x < 0,
    angle: direction.x === 0 ? (direction.y < 0 ? -45 : 45) : 0,
  };
}
