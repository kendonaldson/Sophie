import type { Rect } from '../player/CollisionAssist';

export interface RatDefinition {
  id: string;
  left: number;
  right: number;
  floorY: number;
  speed: number;
  /** Distance into the initial pass, measured from the starting endpoint. */
  offset: number;
  direction: -1 | 1;
}

/** Fixed-speed, endpoint-to-endpoint scurrying; no targeting or random timing. */
export function ratPosition(rat: RatDefinition, elapsedMs: number) {
  const width = rat.right - rat.left;
  const distance = rat.offset + (elapsedMs * rat.speed) / 1000;
  const cycle = ((distance % (width * 2)) + width * 2) % (width * 2);
  const forward = cycle < width;
  const progress = forward ? cycle : width * 2 - cycle;
  return {
    x: rat.direction === 1 ? rat.left + progress : rat.right - progress,
    y: rat.floorY,
    direction: (forward ? rat.direction : -rat.direction) as -1 | 1,
  };
}

export const ratTuning = {
  bodyWidth: 24,
  bodyHeight: 15,
  frameMs: 65,
  drawSize: 64,
} as const;

/** Ears, tail and nose cannot trip Sophie; only the low central torso counts. */
export function ratBody(state: { x: number; y: number }): Rect {
  return {
    x: state.x - ratTuning.bodyWidth / 2,
    y: state.y - ratTuning.bodyHeight,
    width: ratTuning.bodyWidth,
    height: ratTuning.bodyHeight,
  };
}
