import { describe, expect, it } from 'vitest';
import { balloons } from '../src/game/levels/balloons';
import { validateLevel } from '../src/game/levels/types';
import { Checkpoints } from '../src/game/levels/Checkpoints';
import { platformPosition } from '../src/game/machinery/PlatformMotion';
import { cornerCorrection, overlaps } from '../src/game/player/CollisionAssist';
import { birdTuning } from '../src/game/birds/BirdMotion';
import { PizzaFinale } from '../src/game/balloons/PizzaFinale';
import { balloonTuning as t } from '../src/game/balloons/config';
const def = balloons.balloons!;
describe('balloon level data', () => {
  it('has safe stable checkpoints in progression order and leaves music unassigned', () => {
    expect(() => validateLevel(balloons)).not.toThrow();
    expect(balloons.music).toBeUndefined();
    const cp = new Checkpoints(balloons);
    for (const anchor of balloons.checkpoints) {
      expect(cp.update(anchor.spawn, false)).toBe(false);
      expect(cp.update(anchor.spawn, true)).toBe(true);
      expect(cp.id).toBe(anchor.id);
    }
    cp.update(balloons.playerSpawn, true);
    expect(cp.id).toBe('pizza-crossing');
    const moving = balloons.movingPlatforms![0]!;
    expect(
      cp.update({ x: moving.start.x + 100, y: moving.start.y }, true),
    ).toBe(false);
  });
  it.each([
    'moving checkpoint',
    'unassigned treat',
    'missing crown art',
    'thick crown',
    'bird',
    'unsafe landing',
  ])('rejects %s', (bad) => {
    const level = structuredClone(balloons),
      d = level.balloons!;
    if (bad === 'moving checkpoint')
      level.checkpoints[0]!.spawn = { x: 2475, y: 550 };
    if (bad === 'unassigned treat') d.challenges[0]!.treats = [];
    if (bad === 'missing crown art') d.variants.pop();
    if (bad === 'thick crown') level.platforms[0]!.height = 200;
    if (bad === 'bird') d.birds[0]!.speed = NaN;
    if (bad === 'unsafe landing') d.destination.landingX = 6100;
    expect(() => validateLevel(level)).toThrow();
  });
  it('keeps waiting dogs at every checkpoint outside complete bird flight envelopes', () => {
    for (const cp of balloons.checkpoints)
      for (const bird of def.birds) {
        expect(
          overlaps(
            { x: cp.spawn.x - 15, y: cp.spawn.y - 25, width: 30, height: 25 },
            {
              x: bird.left - birdTuning.bodyWidth / 2,
              y: bird.baseY - bird.amplitude - birdTuning.bodyHeight / 2,
              width: bird.right - bird.left + birdTuning.bodyWidth,
              height: bird.amplitude * 2 + birdTuning.bodyHeight,
            },
          ),
          `${cp.id} / ${bird.id}`,
        ).toBe(false);
      }
  });
});
describe('one-way crowns and gentle movement', () => {
  it('never treats a crown as a ceiling for corner correction', () => {
    const body = { x: 17, y: 31, width: 4, height: 8 };
    const solid = { x: 20, y: 20, width: 30, height: 10 };
    expect(cornerCorrection(body, 28, [solid], 3, -1)).toBe(-1);
    expect(
      cornerCorrection(body, 28, [{ ...solid, collision: 'top-only' }], 3, -1),
    ).toBe(0);
  });
  it('eases through repeatable endpoints without changing the existing linear default', () => {
    const moving = balloons.movingPlatforms![0]!;
    const travelMs = (120 / moving.speed) * 1000;
    expect(platformPosition(moving, 0)).toEqual(moving.start);
    expect(platformPosition(moving, travelMs)).toEqual(moving.end);
    expect(platformPosition(moving, travelMs * 2)).toEqual(moving.start);
    expect(platformPosition(moving, travelMs / 2).y).toBeCloseTo(490);
    expect(platformPosition(moving, 100).y).toBeGreaterThan(
      platformPosition({ ...moving, easing: undefined }, 100).y,
    );
    for (let ms = 0; ms < travelMs * 2; ms += 137) {
      const p = platformPosition(moving, ms);
      expect(p.y).toBeGreaterThanOrEqual(moving.end.y);
      expect(p.y).toBeLessThanOrEqual(moving.start.y);
      expect(platformPosition(moving, ms + travelMs * 2).y).toBeCloseTo(p.y);
    }
  });
});
describe('pizza rooftop payoff', () => {
  const finale = () =>
    new PizzaFinale(def.destination, {
      sophie: { x: 6300, y: 450 },
      jimmy: { x: 6285, y: 450 },
    });
  it('holds the landing, introduces scent, speaks in order, walks both dogs inside, then fades', () => {
    const f = finale();
    expect(f.state.phase).toBe('landing');
    expect(f.scentMs).toBe(0);
    expect(f.line).toBeUndefined();
    f.tick(t.landingHoldMs);
    expect(f.state.phase).toBe('scent');
    expect(f.actors.sophie.pose).toBe('idle');
    f.tick(t.scentMs);
    expect(f.scentMs).toBeGreaterThan(0);
    expect(f.line?.text).toBe('Do you smell that!');
    f.tick(t.smellLineMs);
    expect(f.state.phase).toBe('beat');
    expect(f.line).toBeUndefined();
    f.tick(t.smellBeatMs);
    expect(f.line?.text).toBe("Pizza! It's pizza!");
    f.tick(t.pizzaLineMs);
    expect(f.line?.text).toBe("Let's go!");
    f.tick(t.goLineMs + 150);
    expect(f.actors.sophie.pose).toBe('walk');
    expect(f.actors.jimmy.pose).toBe('idle');
    f.tick(t.followDelayMs);
    expect(f.actors.jimmy.pose).toBe('walk');
    expect(f.actors.sophie.x).toBeGreaterThan(f.actors.jimmy.x);
    f.tick(f.walkMs - 150 - t.followDelayMs);
    expect(f.state.phase).toBe('empty');
    expect(Object.values(f.actors).every((a) => !a.visible)).toBe(true);
    expect(f.fade).toBe(0);
    f.tick(t.emptyMs + t.fadeMs / 2);
    expect(f.fade).toBeCloseTo(0.5);
    f.tick(t.fadeMs / 2);
    expect(f.state.phase).toBe('complete');
    expect(f.fade).toBe(1);
  });
  it('is independent of time-step partitioning and never consumes keyboard input', () => {
    const a = finale(),
      b = finale();
    a.tick(7350);
    for (let i = 0; i < 735; i++) b.tick(10);
    expect(b.state).toEqual(a.state);
    expect(b.actors).toEqual(a.actors);
    expect(b.fade).toBe(a.fade);
    b.tick(-100);
    expect(b.actors).toEqual(a.actors);
  });
});
