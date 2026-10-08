import { describe, expect, it } from 'vitest';
import { ForcedScroll } from '../src/game/rendering/ForcedScroll';
import { chase } from '../src/game/levels/chase';
import { validateLevel } from '../src/game/levels/types';
import { Checkpoints } from '../src/game/levels/Checkpoints';
import { ChaseRecovery } from '../src/game/chase/ChaseRecovery';
import { ChaseFinale } from '../src/game/chase/ChaseFinale';
import { chaseTuning as t } from '../src/game/chase/config';
import { physics } from '../src/game/config/physics';
const def = chase.chase!;
describe('forced scrolling', () => {
  it('advances independently of a stationary player and never moves backward', () => {
    const camera = new ForcedScroll(def.scroll);
    camera.step(1000, 180);
    expect(camera.x).toBe(134);
    camera.step(1000, 0);
    expect(camera.x).toBe(268);
    camera.step(10, 1200);
    expect(camera.x).toBe(1200 - def.scroll.lookAhead);
    camera.step(10, 0);
    expect(camera.x).toBeGreaterThan(910);
  });
  it('ramps through the configured section speeds without an abrupt jump', () => {
    const camera = new ForcedScroll(def.scroll);
    camera.step(1000, 1700);
    expect(camera.speed).toBe(146);
    camera.step(100, 3000);
    expect(camera.speed).toBeCloseTo(147.2);
    camera.step(1000, 3000);
    expect(camera.speed).toBe(156);
    camera.step(2000, 5100);
    expect(camera.speed).toBe(172);
  });
  it('integrates speed changes consistently across time partitions', () => {
    const c = {
      ...def.scroll,
      lookAhead: 10000,
      stages: [{ fromX: 0, speed: 172 }],
    };
    const once = new ForcedScroll(c),
      split = new ForcedScroll(c);
    once.step(5000, 0);
    for (let i = 0; i < 600; i++) split.step(5000 / 600, 0);
    expect(split.x).toBeCloseTo(once.x, 7);
    expect(split.speed).toBe(once.speed);
  });
  it('fails exactly at the left boundary and disables both pressure and failure at the dead end', () => {
    const camera = new ForcedScroll(def.scroll);
    camera.step(1000, 180);
    expect(camera.overtaken(camera.boundary + 0.01)).toBe(false);
    expect(camera.overtaken(camera.boundary)).toBe(true);
    const x = camera.x;
    camera.stop();
    camera.step(5000, 6000);
    expect(camera.x).toBe(x);
    expect(camera.overtaken(-1000)).toBe(false);
  });
});
describe('chase geometry and recovery', () => {
  it('validates and always retries from the beginning without progression checkpoints', () => {
    expect(() => validateLevel(chase)).not.toThrow();
    expect(chase.checkpoints).toEqual([]);
    const cp = new Checkpoints(chase);
    cp.update(def.deadEnd.sophie, true);
    expect(cp.spawn).toEqual(chase.playerSpawn);
  });
  it.each(['speed', 'view', 'companion', 'stage'] as const)(
    'rejects invalid %s chase configuration',
    (field) => {
      const bad = structuredClone(chase);
      if (field === 'speed') bad.chase!.scroll.initialSpeed = 0;
      if (field === 'view') bad.chase!.view.height = 2000;
      if (field === 'companion') bad.companionSpawn = undefined;
      if (field === 'stage')
        bad.chase!.scroll.stages = [{ fromX: 100, speed: NaN }];
      expect(() => validateLevel(bad)).toThrow(/chase configuration/);
    },
  );
  it('makes the bulldozer taller than even a generously bounded jump plus one upward dash', () => {
    const dozer = chase.platforms.find((p) => p.id === 'bulldozer')!;
    const jump = physics.jumpVelocity ** 2 / (2 * physics.gravity);
    const dash = (physics.dashSpeed * physics.dashDurationMs) / 1000;
    const coast =
      (physics.dashSpeed * physics.dashExitMomentumRetention) ** 2 /
      (2 * physics.gravity);
    expect(420 - dozer.y).toBeGreaterThan(
      jump + dash + coast + physics.cornerCorrectionPixels,
    );
    expect(chase.treats).toHaveLength(2);
    expect(chase.treats[1]!.y).toBeLessThan(chase.treats[0]!.y);
  });
  it('prefers the recent traversal trail over stale ground far behind the camera', () => {
    const recovery = new ChaseRecovery(chase.fallY);
    for (let i = 0; i <= 60; i++)
      recovery.record(10, { x: 500 + i * 2, y: 320 - i, vx: 200, vy: -100 });
    const now = { x: 620, y: 260, vx: 200, vy: -100 };
    expect(recovery.target(100, now)!.x).toBeCloseTo(560);
    expect(recovery.target(550, now)).toEqual(now);
  });
  it('can recover a missed airborne jump but cannot rescue an actually overtaken pair', () => {
    const recovery = new ChaseRecovery(chase.fallY);
    const now = { x: 600, y: 250, vx: 339, vy: -339 };
    expect(recovery.target(599, now)).toBeUndefined();
    expect(recovery.target(580, now)).toEqual(now);
    expect(recovery.target(610, now)).toBeUndefined();
  });
});
describe('the skyscraper punchline', () => {
  const create = () =>
    new ChaseFinale(
      def.deadEnd,
      { sophie: { x: 6700, y: 420 }, jimmy: { x: 6640, y: 420 } },
      def.view.top,
    );
  it('stages the pair before the two off-screen lines, then anticipates the launch', () => {
    const f = create();
    expect(f.line).toBeUndefined();
    f.tick(t.settleMs);
    expect(f.actors).toEqual({
      sophie: def.deadEnd.sophie,
      jimmy: def.deadEnd.jimmy,
    });
    expect(f.line).toEqual({ speaker: 'offscreen', text: 'Gotcha.' });
    f.tick(t.gotchaMs);
    expect(f.line).toBeUndefined();
    f.tick(t.quietMs);
    expect(f.line?.text).toBe("Okay, let's get you two home.");
    f.tick(t.homeMs);
    expect(f.state.phase).toBe('look');
    f.tick(t.lookMs);
    expect(f.state.phase).toBe('crouch');
    expect(f.fade).toBe(0);
  });
  it('clears both dogs above the frame before an empty beat, the joke, fade, and ending', () => {
    const f = create();
    f.tick(
      t.settleMs + t.gotchaMs + t.quietMs + t.homeMs + t.lookMs + t.crouchMs,
    );
    expect(f.state.phase).toBe('launch');
    f.tick(t.launchMs);
    expect(f.state.phase).toBe('empty');
    expect(f.line).toBeUndefined();
    for (const p of Object.values(f.actors))
      expect(p.y + physics.collisionInsetBottom).toBeLessThan(def.view.top);
    f.tick(t.emptyMs);
    expect(f.line).toEqual({
      speaker: 'offscreen',
      text: 'WHAT IN THE WORLD?!',
    });
    expect(f.fade).toBe(0);
    f.tick(t.punchlineMs + t.fadeMs / 2);
    expect(f.fade).toBeCloseTo(0.5);
    f.tick(t.fadeMs / 2);
    expect(f.state.phase).toBe('complete');
    expect(f.fade).toBe(1);
  });
  it('is independent of frame partitions', () => {
    const a = create(),
      b = create();
    a.tick(6100);
    for (let i = 0; i < 732; i++) b.tick(6100 / 732);
    expect(b.state.phase).toBe(a.state.phase);
    expect(b.actors.sophie.y).toBeCloseTo(a.actors.sophie.y);
    expect(b.actors.jimmy.y).toBeCloseTo(a.actors.jimmy.y);
  });
});
