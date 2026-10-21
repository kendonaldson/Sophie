import { describe, expect, it } from 'vitest';
import { raceHome } from '../src/game/levels/raceHome';
import { validateLevel } from '../src/game/levels/types';
import { Checkpoints } from '../src/game/levels/Checkpoints';
import { physics } from '../src/game/config/physics';
import { pizzaMovementConfig } from '../src/game/pizza/config';
import { steamState } from '../src/game/steam/SteamCycle';
import { platformPosition } from '../src/game/machinery/PlatformMotion';
import { overlaps } from '../src/game/player/CollisionAssist';

const race = raceHome.race!;

describe('race-home route', () => {
  it('links six recognizable environments with four sparse pizza moments', () => {
    expect(() => validateLevel(raceHome)).not.toThrow();
    expect(race.bands.map((band) => band.mode)).toEqual([
      'street',
      'construction',
      'balloons',
      'rooftops',
      'maintenance',
      'neighborhood',
    ]);
    expect(race.pizzas).toHaveLength(4);
    expect(
      race.pizzas.map(
        (pizza) =>
          race.bands.find(
            (band) => pizza.x >= band.fromX && pizza.x < band.toX,
          )!.mode,
      ),
    ).toEqual(['street', 'construction', 'balloons', 'maintenance']);
    expect(raceHome.sections.every((section) => !section.tutorial)).toBe(true);
    expect(
      raceHome.platforms.some((platform) => platform.style === 'car'),
    ).toBe(true);
    expect(raceHome.conveyors).toHaveLength(1);
  });

  it('earns safe checkpoints only on ground, restores every resource, and preserves progress', () => {
    const checkpoints = new Checkpoints(raceHome);
    for (const cp of raceHome.checkpoints) {
      expect(checkpoints.update(cp.spawn, false)).toBe(false);
      expect(checkpoints.update(cp.spawn, true)).toBe(true);
      expect(checkpoints.spawn).toEqual(cp.spawn);
      expect(checkpoints.id).toBe(cp.id);
    }
    expect(checkpoints.update(raceHome.checkpoints[0]!.spawn, true)).toBe(
      false,
    );
    expect(checkpoints.id).toBe('race-home-approach');
    expect(
      race.challenges.flatMap((challenge) => challenge.treats).sort(),
    ).toEqual(raceHome.treats.map((treat) => treat.id).sort());
    expect(
      race.challenges.flatMap((challenge) => challenge.pizzas).sort(),
    ).toEqual(race.pizzas.map((pizza) => pizza.id).sort());
  });

  it('saves broad powered landings beyond the exact respawn position', () => {
    const checkpoints = new Checkpoints(raceHome);
    for (const [x, y, id] of [
      [1358, 1940, 'race-scaffold'],
      [4341, 1420, 'race-jimmy-launch'],
      [9615, 1100, 'race-city-roofs'],
    ] as const) {
      expect(checkpoints.update({ x, y }, false)).toBe(false);
      expect(checkpoints.update({ x, y }, true)).toBe(true);
      expect(checkpoints.id).toBe(id);
      expect(checkpoints.spawn).toEqual(
        raceHome.checkpoints.find((checkpoint) => checkpoint.id === id)!.spawn,
      );
    }
  });

  it('resets steam clear and moving crowns/lifts to reachable deterministic starts', () => {
    for (const steam of race.steam)
      expect(steamState(steam, 0).phase).toBe('clear');
    const surfaces = raceHome.movingPlatforms!;
    expect(surfaces).toHaveLength(3);
    for (const surface of surfaces) {
      expect(platformPosition(surface, 0)).toEqual(surface.start);
      expect(platformPosition(surface, 1000)).toEqual(
        platformPosition(
          surface,
          [250, 500, 250].reduce((a, b) => a + b),
        ),
      );
      expect(surface.width).toBeGreaterThanOrEqual(180);
    }
    const balloon = surfaces.find(
      (surface) => surface.id === 'race-moving-balloon',
    )!;
    expect(balloon).toMatchObject({
      height: 8,
      collision: 'top-only',
      easing: 'sine',
    });
    for (const crown of raceHome.platforms.filter(
      (platform) => platform.style === 'balloon',
    ))
      expect(crown).toMatchObject({ height: 8, collision: 'top-only' });
  });

  it('reserves the construction-to-balloon gap for Jimmy even with powered momentum and two charges', () => {
    const c = pizzaMovementConfig(physics);
    const dashTime = c.dashDurationMs / 1000;
    // Generously allow maximum horizontal speed while every dash also adds
    // its full upward travel. The real controller cannot do both at once.
    const height =
      c.jumpVelocity ** 2 / (2 * c.gravity) +
      c.maxDashCharges * c.dashSpeed * dashTime;
    const descent = Math.max(
      0,
      height + race.superJump.landing.y - race.superJump.staging.y,
    );
    const airborne =
      -c.jumpVelocity / c.gravity +
      c.maxDashCharges * dashTime +
      Math.sqrt((2 * descent) / c.gravity);
    const conservativeReach = c.dashSpeed * airborne + 64;
    const firstCrown = raceHome.platforms.find(
      (platform) => platform.id === 'race-first-balloon',
    )!;
    expect(firstCrown.x - race.superJump.runwayEnd).toBeGreaterThan(
      conservativeReach,
    );
    expect(
      raceHome.treats.some(
        (treat) => treat.x > race.superJump.runwayEnd && treat.x < firstCrown.x,
      ),
    ).toBe(false);
    expect(
      race.pizzas.some(
        (pizza) => pizza.x > race.superJump.runwayEnd && pizza.x < firstCrown.x,
      ),
    ).toBe(false);
  });

  it('leaves an uncluttered playable approach to the familiar attic', () => {
    const d = race.destination;
    expect(d.attic.x - d.triggerX).toBeGreaterThan(400);
    expect(d.attic.x - d.triggerX).toBeLessThan(900);
    expect(raceHome.atticOpening).toEqual(d.attic);
    for (const point of [d.sophie, d.jimmy, d.attic]) {
      const body = { x: point.x - 15, y: point.y - 25, width: 30, height: 25 };
      expect(
        raceHome.platforms.some(
          (platform) => platform.y < point.y && overlaps(body, platform),
        ),
      ).toBe(false);
    }
    expect(race.rats.every((rat) => rat.right < d.triggerX)).toBe(true);
    expect(race.birds.every((bird) => bird.right < d.triggerX)).toBe(true);
  });

  it.each([
    'broken band',
    'unsafe checkpoint',
    'missing pizza reset',
    'missing crown art',
    'hot restart',
    'short Jimmy gap',
    'blocked attic',
  ])('rejects %s', (bad) => {
    const level = structuredClone(raceHome),
      d = level.race!;
    if (bad === 'broken band') d.bands[1]!.fromX += 20;
    if (bad === 'unsafe checkpoint') {
      level.checkpoints[0]!.spawn = {
        x: d.rats[0]!.left,
        y: d.rats[0]!.floorY,
      };
      level.checkpoints[0]!.area = {
        x: d.rats[0]!.left - 38,
        y: 1442,
        width: 76,
        height: 16,
      };
    }
    if (bad === 'missing pizza reset') d.challenges[0]!.pizzas = [];
    if (bad === 'missing crown art') d.variants.pop();
    if (bad === 'hot restart')
      d.steam[0]!.phaseMs =
        d.steam[0]!.clearMs + d.steam[0]!.warningMs + d.steam[0]!.hissMs;
    if (bad === 'short Jimmy gap')
      d.superJump.runwayEnd = d.superJump.landing.x - 300;
    if (bad === 'blocked attic') d.destination.attic.y -= 100;
    expect(() => validateLevel(level)).toThrow();
  });
});
