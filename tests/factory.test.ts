import { describe, expect, it } from 'vitest';
import { ShellyRoll } from '../src/game/factory/ShellyRoll';
import { ShellyBlocker } from '../src/game/factory/ShellyBlocker';
import {
  FactoryStory,
  factoryDialogue,
} from '../src/game/factory/FactoryStory';
import { factoryTuning as t } from '../src/game/factory/config';
import { pizzaFactory } from '../src/game/levels/pizzaFactory';
import { validateLevel, type LevelDefinition } from '../src/game/levels/types';
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
    expect(r.deflect({ x: 1, y: 0 })).toBe(false);
  });
  it('deflects a rolling shell once, immediately clearing its body and swept damage', () => {
    const r = roll();
    expect(r.deflect({ x: 1, y: 0 })).toBe(false);
    r.tick(t.rollAppearMs + t.rollAlignMs + t.rollTelegraphMs + 400, 500);
    const crossing = { x: 690, y: 475, width: 30, height: 25 };
    expect(r.hits(crossing)).toBe(true);
    expect(r.deflect({ x: 1, y: 0 })).toBe(true);
    expect(r.phase).toBe('deflected');
    expect(r.lockedY).toBeUndefined();
    expect(r.hits(crossing)).toBe(false);
    expect(r.hits(r.body)).toBe(false);
    expect(r.deflect({ x: -1, y: 0 })).toBe(false);
    expect(r.direction).toBe(1);
    expect(r.start(100, 800, 500)).toBe(false);
  });
  it.each([
    { dash: { x: 1, y: 0 }, incoming: -1 as const, away: 1 },
    { dash: { x: -1, y: -1 }, incoming: -1 as const, away: -1 },
    { dash: { x: 0, y: -1 }, incoming: -1 as const, away: 1 },
    { dash: { x: 0, y: 1 }, incoming: 1 as const, away: -1 },
  ])(
    'launches up and away for dash $dash and incoming direction $incoming',
    ({ dash, incoming, away }) => {
      const r = new ShellyRoll();
      r.count = incoming === -1 ? 0 : 1;
      r.tick(t.rollGraceMs, 500);
      r.start(100, 800, 500);
      r.tick(t.rollAppearMs + t.rollAlignMs + t.rollTelegraphMs + 200, 500);
      const before = { x: r.x, y: r.feetY };
      expect(r.deflect(dash)).toBe(true);
      expect(r.direction).toBe(away);
      r.tick(100, 500);
      expect(Math.sign(r.x - before.x)).toBe(away);
      expect(r.feetY).toBeLessThan(before.y);
      expect(r.hits(r.body)).toBe(false);
    },
  );
  it('can deflect the damaging sweep on the frame a roll ends', () => {
    const r = roll();
    const rollMs = (700 * 1000) / t.rollSpeed;
    r.tick(
      t.rollAppearMs + t.rollAlignMs + t.rollTelegraphMs + rollMs + 1,
      500,
    );
    const crossing = { x: 450, y: 475, width: 30, height: 25 };
    expect(r.phase).toBe('trail');
    expect(r.hits(crossing)).toBe(true);
    expect(r.deflect({ x: 1, y: 0 })).toBe(true);
    expect(r.phase).toBe('deflected');
    expect(r.hits(crossing)).toBe(false);
  });
  it('uses a deterministic flight, freezes without elapsed time, then starts the usual cooldown', () => {
    const a = roll(),
      b = roll();
    for (const r of [a, b]) {
      r.tick(t.rollAppearMs + t.rollAlignMs + t.rollTelegraphMs + 200, 500);
      r.deflect({ x: 1, y: 0 });
    }
    expect(a.tick(300, 200)).toEqual([]);
    for (let n = 0; n < 300; n++) expect(b.tick(1, 800)).toEqual([]);
    expect(a.x).toBeCloseTo(b.x, 7);
    expect(a.feetY).toBeCloseTo(b.feetY, 7);
    const frozen = { x: a.x, y: a.feetY, elapsed: a.elapsed };
    a.tick(0, 100);
    expect({ x: a.x, y: a.feetY, elapsed: a.elapsed }).toEqual(frozen);
    a.tick(t.rollDeflectMs - 300, 500);
    expect(a.phase).toBe('hidden');
    expect(a.cooldown).toBe(t.rollCooldownMs);
    expect(a.hits(a.body)).toBe(false);
    expect(a.deflect({ x: 1, y: 0 })).toBe(false);
    expect(a.start(100, 800, 500)).toBe(false);
    a.tick(t.rollCooldownMs, 500);
    expect(a.start(100, 800, 500)).toBe(true);
    expect(a.direction).toBe(1);
  });
  it('cancels a deflection on reset without carrying flight or damage into a retry', () => {
    const r = roll();
    r.tick(t.rollAppearMs + t.rollAlignMs + t.rollTelegraphMs + 200, 500);
    r.deflect({ x: 1, y: 0 });
    r.tick(200, 500);
    r.reset();
    expect(r.phase).toBe('hidden');
    expect(r.elapsed).toBe(0);
    expect(r.cooldown).toBe(t.rollGraceMs);
    expect(r.hits(r.body)).toBe(false);
    r.tick(t.rollGraceMs, 500);
    expect(r.start(100, 800, 500)).toBe(true);
    expect(r.direction).toBe(-1);
    expect(r.x).toBe(800);
    expect(r.feetY).toBe(410);
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
  it('retries the final checkpoint immediately, including if its dialogue was interrupted', () => {
    const story = new FactoryStory();
    story.final();
    expect(story.phase).toBe('final-dialogue');
    story.tick(100);
    story.reset(true, true);
    expect(story.phase).toBe('final');
    expect(story.scripted).toBe(false);
    expect(story.line).toBeUndefined();
    expect(story.elapsed).toBe(0);
    story.final();
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
describe('factory route and checkpoints', () => {
  it('validates the suspended route, mixed belts, moving trays, and two dash-only pizzas', () => {
    expect(() => validateLevel(pizzaFactory)).not.toThrow();
    expect(pizzaFactory.conveyors!.some((c) => c.speed > 0)).toBe(true);
    expect(pizzaFactory.conveyors!.some((c) => c.speed < 0)).toBe(true);
    expect(pizzaFactory.movingPlatforms).toHaveLength(4);
    expect(pizzaFactory.factory!.midpoint.pizza.requiresDash).toBe(true);
    expect(pizzaFactory.factory!.final.pizza.requiresDash).toBe(true);
  });
  it('returns first-half failures to the start and second-half failures to a stationary, protected midpoint', () => {
    const checkpoints = new Checkpoints(pizzaFactory);
    expect(pizzaFactory.checkpoints).toHaveLength(2);
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
  it('earns the final runway checkpoint only on landing and never loses it by backtracking', () => {
    const checkpoints = new Checkpoints(pizzaFactory);
    const [midpoint, final] = pizzaFactory.checkpoints;
    checkpoints.update(midpoint!.spawn, true);
    const arrival = {
      x: pizzaFactory.factory!.final.triggerX,
      y: final!.spawn.y,
    };
    expect(checkpoints.update(arrival, false)).toBe(false);
    expect(checkpoints.id).toBe(midpoint!.id);
    expect(checkpoints.update(arrival, true)).toBe(true);
    expect(checkpoints.id).toBe(pizzaFactory.factory!.finalCheckpointId);
    expect(checkpoints.spawn).toEqual(pizzaFactory.factory!.final.staging);
    expect(checkpoints.update(midpoint!.spawn, true)).toBe(false);
    expect(checkpoints.spawn).toEqual(final!.spawn);
    checkpoints.reset();
    expect(checkpoints.id).toBe('spawn');
    expect(checkpoints.spawn).toEqual(pizzaFactory.playerSpawn);
  });
  it.each([
    [
      'missing final checkpoint',
      (level: LevelDefinition) => level.checkpoints.pop(),
    ],
    [
      'reversed checkpoint order',
      (level: LevelDefinition) => level.checkpoints.reverse(),
    ],
    [
      'unknown final checkpoint',
      (level: LevelDefinition) => {
        level.factory!.finalCheckpointId = 'missing-final';
      },
    ],
    [
      'trigger outside final checkpoint',
      (level: LevelDefinition) => {
        level.checkpoints[1]!.area.x = level.factory!.final.triggerX + 1;
      },
    ],
    [
      'staging outside final checkpoint',
      (level: LevelDefinition) => {
        level.checkpoints[1]!.area.width = 40;
      },
    ],
  ])('rejects %s', (_description, invalidate) => {
    const level = structuredClone(pizzaFactory);
    invalidate(level);
    expect(() => validateLevel(level)).toThrow(/checkpoint/);
  });
  it.each([
    [
      'airborne anchor',
      (level: LevelDefinition) => {
        const cp = level.checkpoints[1]!;
        cp.spawn.y -= 4;
      },
    ],
    [
      'edge anchor',
      (level: LevelDefinition) => {
        const cp = level.checkpoints[1]!;
        cp.spawn.x = 11570;
      },
    ],
    [
      'moving belt',
      (level: LevelDefinition) => {
        level.conveyors!.push({ platformId: 'final-runway', speed: 90 });
      },
    ],
    [
      'oven',
      (level: LevelDefinition) => {
        level.factory!.ovens.push({
          id: 'checkpoint-oven',
          ...level.checkpoints[1]!.area,
        });
      },
    ],
    [
      'roll lane',
      (level: LevelDefinition) => {
        level.factory!.rollZones.push({
          id: 'checkpoint-roll',
          fromX: 11220,
          toX: 11400,
          left: 11120,
          right: 11580,
        });
      },
    ],
  ])(
    'rejects an unsafe final checkpoint with %s',
    (_description, invalidate) => {
      const level = structuredClone(pizzaFactory);
      invalidate(level);
      expect(() => validateLevel(level)).toThrow(/checkpoint/);
    },
  );
});
