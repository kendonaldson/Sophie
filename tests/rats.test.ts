import { describe, expect, it } from 'vitest';
import { overlaps } from '../src/game/player/CollisionAssist';
import {
  ratBody,
  ratPosition,
  ratTuning,
  type RatDefinition,
} from '../src/game/rats/RatMotion';
import { ratAppearance } from '../src/game/rats/appearance';

const patrol: RatDefinition = {
  id: 'test-rat',
  left: 100,
  right: 400,
  floorY: 450,
  speed: 150,
  offset: 0,
  direction: 1,
};

describe('rat patrols', () => {
  it('moves at a constant fast speed and reverses at each endpoint', () => {
    expect(ratPosition(patrol, 0)).toEqual({ x: 100, y: 450, direction: 1 });
    expect(ratPosition(patrol, 1000)).toEqual({ x: 250, y: 450, direction: 1 });
    expect(ratPosition(patrol, 2000)).toEqual({
      x: 400,
      y: 450,
      direction: -1,
    });
    expect(ratPosition(patrol, 3000)).toEqual({
      x: 250,
      y: 450,
      direction: -1,
    });
    expect(ratPosition(patrol, 4000)).toEqual(ratPosition(patrol, 0));
  });

  it('supports either initial direction and a fixed initial position', () => {
    const rat = { ...patrol, direction: -1 as const, offset: 60 };
    expect(ratPosition(rat, 0)).toEqual({ x: 340, y: 450, direction: -1 });
    expect(ratPosition(rat, 1000)).toEqual({ x: 190, y: 450, direction: -1 });
    expect(ratPosition(rat, 1600)).toEqual({ x: 100, y: 450, direction: 1 });
    expect(ratPosition(rat, 2000)).toEqual({ x: 160, y: 450, direction: 1 });
  });

  it('stays bounded through long frames and restarts exactly from elapsed zero', () => {
    for (const direction of [-1, 1] as const) {
      const rat = { ...patrol, direction, offset: 125 };
      const start = ratPosition(rat, 0);
      for (let ms = 0; ms < 60000; ms += 137) {
        const p = ratPosition(rat, ms);
        expect(p.x).toBeGreaterThanOrEqual(rat.left);
        expect(p.x).toBeLessThanOrEqual(rat.right);
        expect(p.y).toBe(rat.floorY);
      }
      expect(ratPosition(rat, 60000)).toEqual(start);
      expect(ratPosition(rat, 0)).toEqual(start);
    }
  });

  it('depends only on elapsed time, independent of frame partitions', () => {
    const smallSteps = Array.from({ length: 120 }, () => 1000 / 120).reduce(
      (sum, ms) => sum + ms,
      0,
    );
    expect(ratPosition(patrol, smallSteps).x).toBeCloseTo(
      ratPosition(patrol, 1000).x,
    );
    expect(ratPosition(patrol, 12500)).toEqual(ratPosition(patrol, 500));
  });
});

describe('rat collision and art anchors', () => {
  it('allows an ear-level jump and tail/nose near misses but catches the torso', () => {
    const body = ratBody({ x: 200, y: 450 });
    expect(body).toEqual({ x: 188, y: 435, width: 24, height: 15 });
    expect(overlaps(body, { x: 180, y: 410, width: 30, height: 25 })).toBe(
      false,
    );
    expect(overlaps(body, { x: 156, y: 425, width: 30, height: 25 })).toBe(
      false,
    );
    expect(overlaps(body, { x: 215, y: 425, width: 30, height: 25 })).toBe(
      false,
    );
    expect(overlaps(body, { x: 170, y: 425, width: 30, height: 25 })).toBe(
      true,
    );
  });

  it('centers the torso when mirrored and anchors its collision feet to the floor', () => {
    expect(ratAppearance.anchorX).toBe(ratAppearance.frameSize / 2);
    expect(ratAppearance.footY - ratTuning.bodyHeight).toBeGreaterThan(0);
    expect(ratAppearance.footY).toBeLessThan(ratAppearance.frameSize);
    expect(ratBody(ratPosition(patrol, 750)).y + ratTuning.bodyHeight).toBe(
      patrol.floorY,
    );
    expect(ratTuning.bodyWidth).toBeLessThan(ratTuning.drawSize / 2);
  });
});
