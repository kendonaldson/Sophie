import { describe, expect, it } from 'vitest';
import { skyscraper } from '../src/game/levels/skyscraper';
import { validateLevel } from '../src/game/levels/types';
import { Checkpoints } from '../src/game/levels/Checkpoints';
import { birdPosition, birdTuning } from '../src/game/birds/BirdMotion';
import { physics } from '../src/game/config/physics';
import { overlaps } from '../src/game/player/CollisionAssist';
import { ClimbProgress } from '../src/game/skyscraper/ClimbProgress';
import { ConstructionLift } from '../src/game/skyscraper/ConstructionLift';
import { VerticalView } from '../src/game/skyscraper/VerticalView';
import { climbTuning as t } from '../src/game/skyscraper/config';

const def = skyscraper.skyscraper!;
describe('skyscraper route and recovery', () => {
  it('keeps every checkpoint outside bird collision envelopes so waiting and respawning are safe', () => {
    const width = 64 - physics.collisionInsetX * 2;
    const height =
      64 - physics.collisionInsetTop - physics.collisionInsetBottom;
    for (const cp of skyscraper.checkpoints)
      for (const bird of def.birds) {
        expect(
          overlaps(
            {
              x: cp.spawn.x - width / 2,
              y: cp.spawn.y - height,
              width,
              height,
            },
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
  it('validates safe ordered anchors through right, left, and right climbs', () => {
    expect(() => validateLevel(skyscraper)).not.toThrow();
    const checkpoints = new Checkpoints(skyscraper);
    for (const cp of skyscraper.checkpoints) {
      checkpoints.update(cp.spawn, true);
      expect(checkpoints.id).toBe(cp.id);
      expect(checkpoints.spawn).toEqual(cp.spawn);
    }
    checkpoints.update(skyscraper.playerSpawn, true);
    expect(checkpoints.id).toBe('summit-lift');
  });
  it('restores only the current and future challenges, including leftward and vertical bones', () => {
    const progress = new ClimbProgress(def);
    progress.atCheckpoint('west-chain');
    expect(progress.section.direction).toBe(-1);
    expect([...progress.resetTreats]).toEqual([
      'west-chain-one',
      'west-chain-two',
      'ladder-one',
      'ladder-two',
      'bird-chain-one',
      'bird-chain-two',
    ]);
    progress.atCheckpoint('vertical-ladder');
    expect([...progress.resetTreats]).toEqual([
      'ladder-one',
      'ladder-two',
      'bird-chain-one',
      'bird-chain-two',
    ]);
    expect(progress.fallBoundary(3020)).toBe(3260);
    progress.atCheckpoint('bird-introduction');
    expect(progress.section.direction).toBe(1);
    expect(progress.fallBoundary(2300)).toBe(2460);
  });
  it.each(['bird', 'bone', 'order', 'lift', 'section'] as const)(
    'rejects invalid %s definitions',
    (field) => {
      const level = structuredClone(skyscraper),
        d = level.skyscraper!;
      if (field === 'bird') d.birds[0]!.speed = NaN;
      if (field === 'bone') d.challenges[0]!.treats.push('ladder-one');
      if (field === 'order') d.challenges.reverse();
      if (field === 'lift') d.lifts[0]!.topY = d.lifts[0]!.bottomY;
      if (field === 'section') d.sections[1]!.bottom = 4500;
      expect(() => validateLevel(level)).toThrow();
    },
  );
});
describe('bird passes', () => {
  it('flies at constant horizontal speed, reverses at endpoints, and mirrors direction', () => {
    const bird = {
      ...def.birds[0]!,
      left: 100,
      right: 200,
      speed: 50,
      offset: 0,
    };
    expect(birdPosition(bird, 0).x).toBe(100);
    expect(birdPosition(bird, 1000).x).toBe(150);
    expect(birdPosition(bird, 2000)).toMatchObject({ x: 200, direction: -1 });
    expect(birdPosition(bird, 3000).x).toBe(150);
    expect(birdPosition(bird, 4000)).toMatchObject({ x: 100, direction: 1 });
    expect(birdPosition({ ...bird, direction: -1 }, 500)).toMatchObject({
      x: 175,
      direction: -1,
    });
  });
  it('keeps a small bounded wave and replays exactly from elapsed zero', () => {
    for (const bird of def.birds) {
      const initial = birdPosition(bird, 0);
      for (let ms = 0; ms < 30000; ms += 127) {
        const p = birdPosition(bird, ms);
        expect(p.x).toBeGreaterThanOrEqual(bird.left);
        expect(p.x).toBeLessThanOrEqual(bird.right);
        expect(Math.abs(p.y - bird.baseY)).toBeLessThanOrEqual(bird.amplitude);
      }
      expect(birdPosition(bird, 0)).toEqual(initial);
    }
  });
});
describe('construction lifts and camera', () => {
  it('boards before ascending, commits at the destination, and integrates by elapsed time', () => {
    const a = new ConstructionLift(def.lifts[0]!),
      b = new ConstructionLift(def.lifts[0]!);
    a.step(t.boardingMs - 1);
    expect(a.phase).toBe('boarding');
    expect(a.y).toBe(a.definition.bottomY);
    a.step(1501);
    for (let i = 0; i < 220; i++) b.step(10);
    expect(b.phase).toBe('riding');
    expect(b.y).toBeCloseTo(a.y);
    expect(a.y).toBe(3590);
    a.step(1500);
    expect(a.phase).toBe('arrived');
    expect(a.y).toBe(a.definition.topY);
  });
  it('holds the city view before fading and ending, only on the final lift', () => {
    const lift = new ConstructionLift(def.lifts[2]!);
    lift.step(t.boardingMs + lift.definition.rideMs);
    expect(lift.phase).toBe('view');
    expect(lift.fade).toBe(0);
    lift.step(t.roofHoldMs + t.endingFadeMs / 2);
    expect(lift.phase).toBe('fade');
    expect(lift.fade).toBe(0.5);
    lift.step(t.endingFadeMs / 2);
    expect(lift.phase).toBe('complete');
    expect(lift.fade).toBe(1);
  });
  it('tracks smoothly without forcing progress and cannot return to discarded floors', () => {
    const view = new VerticalView(skyscraper.width);
    view.reset({ x: 2000, y: 3430 }, 3540, -1);
    const initial = { x: view.x, y: view.y };
    view.step(2000, { x: 2000, y: 3430 }, 3540, -1);
    expect({ x: view.x, y: view.y }).toEqual(initial);
    view.step(100, { x: 1660, y: 3194 }, 3540, -1);
    expect(view.x).toBeLessThan(initial.x);
    expect(view.y).toBeLessThan(initial.y);
    view.step(10000, { x: 1500, y: 4400 }, 4400, -1);
    expect(view.y + t.viewHeight).toBeLessThanOrEqual(3540);
    view.reset({ x: 485, y: 2300 }, 2410, 1);
    view.step(10000, { x: 485, y: 4400 }, 4400, 1);
    expect(view.y + t.viewHeight).toBeLessThanOrEqual(2410);
  });
});
