import { describe, expect, it } from 'vitest';
import { ovenFireBounds } from '../src/game/factory/ovenFire';
import { pizzaFactory } from '../src/game/levels/pizzaFactory';
import { overlaps } from '../src/game/player/CollisionAssist';

describe('forgiving oven fire', () => {
  it.each(pizzaFactory.factory!.ovens)(
    '$id forgives grazing the flame tips and sides while keeping its core lethal',
    (oven) => {
      const fire = ovenFireBounds(oven);
      const grazes = [
        {
          x: oven.x + oven.width / 2 - 15,
          y: oven.y - 22,
          width: 30,
          height: 25,
        },
        { x: oven.x - 28, y: fire.y + 1, width: 30, height: 25 },
        {
          x: oven.x + oven.width - 2,
          y: fire.y + 1,
          width: 30,
          height: 25,
        },
      ];
      for (const body of grazes) {
        expect(overlaps(body, oven)).toBe(true);
        expect(overlaps(body, fire)).toBe(false);
      }
      expect(
        overlaps(
          {
            x: oven.x + oven.width / 2 - 15,
            y: fire.y - 24,
            width: 30,
            height: 25,
          },
          fire,
        ),
      ).toBe(true);
      // The lower edge remains dangerous, including a fall into the wide pit.
      expect(
        overlaps(
          {
            x: oven.x + oven.width / 2 - 15,
            y: oven.y + oven.height - 1,
            width: 30,
            height: 25,
          },
          fire,
        ),
      ).toBe(true);
    },
  );

  it('keeps a positive fire core inside even a small mouth without mutating its artwork bounds', () => {
    const oven = Object.freeze({ x: 100, y: 200, width: 4, height: 3 });
    const fire = ovenFireBounds(oven);
    expect(fire.width).toBeGreaterThan(0);
    expect(fire.height).toBeGreaterThan(0);
    expect(fire.x).toBeGreaterThan(oven.x);
    expect(fire.y).toBeGreaterThan(oven.y);
    expect(fire.x + fire.width).toBeLessThan(oven.x + oven.width);
    expect(fire.y + fire.height).toBe(oven.y + oven.height);
    expect(oven).toEqual({ x: 100, y: 200, width: 4, height: 3 });
    expect(fire).not.toBe(oven);
  });
});
