import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { BirdFlock } from '../src/game/birds/BirdFlock';
import type { BirdDefinition } from '../src/game/birds/BirdMotion';
import { RatPack } from '../src/game/rats/RatPack';
import type { RatDefinition } from '../src/game/rats/RatMotion';
import { creatureScatterTuning } from '../src/game/creatures/SmallCreatureContact';

class Sprite {
  frame = { name: '0' };
  visible = true;
  alpha = 1;
  setPosition() {
    return this;
  }
  setDisplaySize() {
    return this;
  }
  setDepth() {
    return this;
  }
  setName() {
    return this;
  }
  setOrigin() {
    return this;
  }
  setFlipX() {
    return this;
  }
  setFrame(frame: number) {
    this.frame.name = String(frame);
    return this;
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    return this;
  }
  setAlpha(alpha: number) {
    this.alpha = alpha;
    return this;
  }
  destroy() {}
}

const scene = () =>
  ({ add: { sprite: () => new Sprite() } }) as unknown as Phaser.Scene;
const bird = (id: string, x: number): BirdDefinition => ({
  id,
  left: x - 20,
  right: x + 20,
  baseY: 70,
  offset: 20,
  direction: 1,
  speed: 30,
  amplitude: 0,
  frequency: 1,
  phase: 0,
});
const rat = (id: string, x: number): RatDefinition => ({
  id,
  left: x - 20,
  right: x + 20,
  floorY: 70,
  offset: 20,
  direction: 1,
  speed: 90,
});
const body = { x: 70, y: 50, width: 60, height: 30 };
const fixture = (kind: 'bird' | 'rat') => {
  const creatures =
    kind === 'bird'
      ? new BirdFlock(scene(), [bird('one', 90), bird('two', 110)])
      : new RatPack(scene(), [rat('one', 90), rat('two', 110)]);
  const sfx = { birdSquawk: vi.fn(), ratSqueak: vi.fn() };
  return {
    creatures,
    options: { pizzaRush: true, facing: 1 as const, sfx },
    sound: kind === 'bird' ? sfx.birdSquawk : sfx.ratSqueak,
  };
};

describe.each(['bird', 'rat'] as const)('Pizza Rush %s contact', (kind) => {
  it('retains ordinary lethal contact without power or with power inactive', () => {
    const { creatures, options, sound } = fixture(kind);
    expect(creatures.collide(body)).toBe(true);
    expect(creatures.collide(body, { ...options, pizzaRush: false })).toBe(
      true,
    );
    expect(creatures.snapshot().every((c) => !c.scattered)).toBe(true);
    expect(sound).not.toHaveBeenCalled();
  });

  it('scatters every contacting creature once and stays harmless after power ends', () => {
    const { creatures, options, sound } = fixture(kind);
    expect(creatures.collide(body, options)).toBe(false);
    expect(creatures.snapshot().every((c) => c.scattered && c.visible)).toBe(
      true,
    );
    expect(sound).toHaveBeenCalledOnce();
    expect(creatures.collide(body, options)).toBe(false);
    expect(creatures.collide(body)).toBe(false);
    creatures.step(creatureScatterTuning[kind].durationMs);
    expect(creatures.snapshot().every((c) => c.scattered && !c.visible)).toBe(
      true,
    );
    expect(
      creatures.collide({ x: -1000, y: -1000, width: 2000, height: 2000 }),
    ).toBe(false);
    expect(sound).toHaveBeenCalledOnce();
  });

  it('freezes on zero-time steps, advances deterministically, and resets for an immediate retry', () => {
    const first = fixture(kind),
      second = fixture(kind);
    const initial = first.creatures.snapshot();
    first.creatures.collide(body, first.options);
    second.creatures.collide(body, second.options);
    const paused = first.creatures.snapshot();
    first.creatures.step(0);
    expect(first.creatures.snapshot()).toEqual(paused);
    first.creatures.step(400);
    for (let n = 0; n < 40; n++) second.creatures.step(10);
    expect(first.creatures.snapshot()).toEqual(second.creatures.snapshot());
    first.creatures.step(1000);
    first.creatures.reset();
    expect(first.creatures.snapshot()).toEqual(initial);
    expect(first.creatures.collide(body)).toBe(true);
    first.creatures.reset();
    first.creatures.collide(body, first.options);
    expect(first.sound).toHaveBeenCalledTimes(2);
  });
});

it('fans birds above and below the route while keeping their ordinary flight artwork', () => {
  const birds = new BirdFlock(scene(), [bird('up', 90), bird('down', 110)]);
  birds.collide(body, { pizzaRush: true, facing: 1 });
  expect(birds.snapshot().every((b) => !b.hit && b.frame === 8)).toBe(true);
  birds.step(200);
  const [up, down] = birds.snapshot();
  expect(up!.y).toBeLessThan(70);
  expect(down!.y).toBeGreaterThan(70);
  expect(up!.frame).toBeLessThan(8);
  expect(down!.frame).toBeLessThan(8);
});

it('makes rats scurry away on their feet beyond the patrol instead of bouncing or tumbling', () => {
  const rats = new RatPack(scene(), [rat('left', 90), rat('right', 110)]);
  rats.collide(body, { pizzaRush: true, facing: 1 });
  rats.step(200);
  const [left, right] = rats.snapshot();
  expect(left!.x).toBeLessThan(70);
  expect(right!.x).toBeGreaterThan(130);
  expect(left!.y).toBe(70);
  expect(right!.y).toBe(70);
  expect(left!.direction).toBe(-1);
  expect(right!.direction).toBe(1);
});

it('allows rapid squawks for a flock but bounds simultaneous contacts and clears the sound gate on retry', () => {
  const birds = new BirdFlock(scene(), [
    bird('one', 100),
    bird('two', 200),
    bird('three', 300),
  ]);
  const sfx = { birdSquawk: vi.fn(), ratSqueak: vi.fn() };
  const options = { pizzaRush: true, facing: 1 as const, sfx };
  birds.collide({ ...body, x: 70 }, options);
  birds.collide({ ...body, x: 170 }, options);
  expect(sfx.birdSquawk).toHaveBeenCalledOnce();
  birds.step(creatureScatterTuning.soundGapMs);
  birds.collide({ ...body, x: 270 }, options);
  expect(sfx.birdSquawk).toHaveBeenCalledTimes(2);
  expect(sfx.ratSqueak).not.toHaveBeenCalled();
  birds.reset();
  birds.collide({ x: 0, y: 50, width: 400, height: 30 }, options);
  expect(birds.snapshot().every((b) => b.scattered)).toBe(true);
  expect(sfx.birdSquawk).toHaveBeenCalledTimes(3);
});
