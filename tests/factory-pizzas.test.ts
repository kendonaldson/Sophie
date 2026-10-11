import { describe, expect, it } from 'vitest';
import { pizzaFactory } from '../src/game/levels/pizzaFactory';
import { validateLevel } from '../src/game/levels/types';

describe('factory traversal pizza validation', () => {
  it('accepts the route and rejects duplicate IDs across traversal and confrontation slices', () => {
    expect(() => validateLevel(pizzaFactory)).not.toThrow();
    const level = structuredClone(pizzaFactory);
    level.factory!.pizzas[0]!.id = level.factory!.midpoint.pizza.id;
    expect(() => validateLevel(level)).toThrow('entity IDs must be unique');
  });
  it.each([
    { x: NaN, y: 900 },
    { x: -20, y: 900 },
    { x: 100, y: 1500 },
    { x: 1830, y: 970 },
  ])('rejects a slice outside the route or inside oven fire: %o', (point) => {
    const level = structuredClone(pizzaFactory);
    Object.assign(level.factory!.pizzas[0]!, point);
    expect(() => validateLevel(level)).toThrow(
      'traversal pizza must be inside the level and clear of ovens',
    );
  });
});
