import { describe, expect, it } from 'vitest';
import { ShellyRoll } from '../src/game/factory/ShellyRoll';
import { ShellyBlocker } from '../src/game/factory/ShellyBlocker';
import {
  FactoryStory,
  factoryDialogue,
} from '../src/game/factory/FactoryStory';
import { factoryTuning as t } from '../src/game/factory/config';
import { pizzaFactory } from '../src/game/levels/pizzaFactory';
import { validateLevel } from '../src/game/levels/types';
import { Checkpoints } from '../src/game/levels/Checkpoints';

const roll = () => {
  const r = new ShellyRoll();
  r.tick(t.rollGraceMs, 500);
  r.start(100, 800, 500);
  return r;
};
describe('Shelly lane rolls', () => {
  it('aligns vertically, locks before a 750ms charge, and never retargets after locking', () => {
    const r = roll();
    expect(r.phase).toBe('appear');
    expect(r.tick(t.rollAppearMs + t.rollAlignMs, 480)).toEqual(['charge']);
    expect(r.phase).toBe('charge');
    expect(r.lockedY).toBe(480);
    r.tick(500, 220);
    expect(r.feetY).toBe(480);
    expect(r.x).toBe(800);
    expect(r.tick(250, 220)).toEqual(['roll']);
    expect(r.phase).toBe('roll');
    r.tick(100, 150);
    expect(r.feetY).toBe(480);
    expect(r.x).toBe(748);
  });
  it('has identical timing and one-shot cues across partitioned elapsed time', () => {
    const a = roll(),
      b = roll();
    const cues = [];
    const ms = t.rollAppearMs + t.rollAlignMs + t.rollTelegraphMs + 300;
    for (let n = 0; n < ms; n++) cues.push(...b.tick(1, 500));
    expect(a.tick(ms, 500)).toEqual(cues);
    expect(a.phase).toBe(b.phase);
    expect(a.x).toBeCloseTo(b.x, 7);
    expect(a.feetY).toBe(b.feetY);
  });
  it('collides only with the real rolling shell, including a swept fast crossing; the fading green trail is harmless', () => {
    const r = roll();
    r.tick(t.rollAppearMs + t.rollAlignMs, 500);
    expect(r.hits(r.body)).toBe(false);
    r.tick(t.rollTelegraphMs + 400, 500);
    expect(r.hits({ x: 690, y: 475, width: 30, height: 25 })).toBe(true);
    expect(r.hits({ x: 690, y: 420, width: 30, height: 25 })).toBe(false);
    r.tick(1000, 500);
    r.tick(1, 500);
    expect(r.phase).toBe('trail');
    expect(r.hits(r.body)).toBe(false);
  });
  it('gives a meaningful cooldown and a safe deterministic reset', () => {
    const r = roll();
    r.tick(5000, 500);
    expect(r.phase).toBe('hidden');
    expect(r.cooldown).toBeGreaterThan(4000);
    expect(r.start(0, 500, 500)).toBe(false);
    r.reset();
    expect(r.cooldown).toBe(t.rollGraceMs);
    expect(r.count).toBe(0);
    expect(r.hits({ x: 0, y: 0, width: 1000, height: 1000 })).toBe(false);
  });
});
describe('confrontations and story', () => {
  it('blocks ordinary contact and spins only on a Super Pizza Dash, once', () => {
    const block = new ShellyBlocker({ x: 400, y: 500 }, t.finalSpinMs);
    expect(block.contact(block.body, false)).toBe('blocked');
    expect(block.resolved).toBe(false);
    expect(block.contact(block.body, true)).toBe('spin');
    expect(block.resolved).toBe(true);
    expect(block.contact(block.body, true)).toBeUndefined();
    block.tick(t.finalSpinMs);
    expect(block.spinMs).toBe(0);
    block.reset(true);
    expect(block.resolved).toBe(true);
    block.reset();
    expect(block.resolved).toBe(false);
  });
  it('preserves the requested opening dialogue and restores ordinary play', () => {
    const story = new FactoryStory();
    const lines: string[] = [];
    for (let n = 0; n < 2000 && story.scripted; n++) {
      if (story.line && lines.at(-1) !== story.line.text)
        lines.push(story.line.text);
      story.tick(10);
    }
    expect(lines).toEqual(factoryDialogue.opening.map((l) => l.text));
    expect(story.phase).toBe('chase');
    expect(story.scripted).toBe(false);
  });
  it('retries from the earned half without replaying long confrontations', () => {
    const story = new FactoryStory();
    story.midpoint();
    story.tick(10000);
    expect(story.phase).toBe('midpoint');
    story.reset(false);
    expect(story.phase).toBe('chase');
    story.midpoint();
    expect(story.phase).toBe('midpoint');
    story.reset(true);
    expect(story.phase).toBe('second-half');
    story.final();
    story.tick(15000);
    expect(story.phase).toBe('final');
  });
  it('holds the final reaction, lets both dogs escape, then fades before the sole ending', () => {
    const story = new FactoryStory();
    story.enter('final-spin');
    story.tick(t.finalSpinMs - 1);
    expect(story.phase).toBe('final-spin');
    story.tick(1);
    expect(story.phase).toBe('outro');
    for (let n = 0; n < 10000 && story.phase === 'outro'; n++) story.tick(1);
    expect(story.phase).toBe('escape');
    story.tick(t.escapeMs);
    expect(story.phase).toBe('empty');
    story.tick(t.emptyMs);
    expect(story.phase).toBe('fade');
    expect(story.fade).toBe(0);
    story.tick(t.fadeMs / 2);
    expect(story.fade).toBe(0.5);
    story.tick(t.fadeMs / 2);
    expect(story.phase).toBe('complete');
    expect(story.fade).toBe(1);
  });
});
describe('factory route and its only checkpoint', () => {
  it('validates the suspended route, mixed belts, moving trays, and two dash-only pizzas without a soundtrack', () => {
    expect(() => validateLevel(pizzaFactory)).not.toThrow();
    expect(pizzaFactory.music).toBeUndefined();
    expect(pizzaFactory.conveyors!.some((c) => c.speed > 0)).toBe(true);
    expect(pizzaFactory.conveyors!.some((c) => c.speed < 0)).toBe(true);
    expect(pizzaFactory.movingPlatforms).toHaveLength(4);
    expect(pizzaFactory.factory!.midpoint.pizza.requiresDash).toBe(true);
    expect(pizzaFactory.factory!.final.pizza.requiresDash).toBe(true);
  });
  it('returns first-half failures to the start and second-half failures to a stationary, protected midpoint', () => {
    const checkpoints = new Checkpoints(pizzaFactory);
    expect(pizzaFactory.checkpoints).toHaveLength(1);
    expect(checkpoints.spawn).toEqual(pizzaFactory.playerSpawn);
    checkpoints.update({ x: 4000, y: 930 }, true);
    expect(checkpoints.id).toBe('spawn');
    const cp = pizzaFactory.checkpoints[0]!;
    expect(checkpoints.update(cp.spawn, true)).toBe(true);
    expect(checkpoints.spawn).toEqual(cp.spawn);
    checkpoints.update({ x: 10000, y: 850 }, true);
    expect(checkpoints.spawn).toEqual(cp.spawn);
    const platform = pizzaFactory.platforms.find(
      (p) =>
        p.y === cp.spawn.y && cp.spawn.x > p.x && cp.spawn.x < p.x + p.width,
    )!;
    expect(
      pizzaFactory.conveyors!.some((b) => b.platformId === platform.id),
    ).toBe(false);
    expect(
      cp.spawn.x - pizzaFactory.factory!.midpoint.shelly.x,
    ).toBeGreaterThan(100);
  });
});
