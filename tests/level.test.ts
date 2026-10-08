import { describe, expect, it } from 'vitest';
import { atticEscape } from '../src/game/levels/atticEscape';
import { validateLevel } from '../src/game/levels/types';
import { Checkpoints } from '../src/game/levels/Checkpoints';
import {
  cornerCorrection,
  edgeCorrection,
} from '../src/game/player/CollisionAssist';
import { viewportSize } from '../src/game/rendering/Viewport';
describe('level validation and safe respawns', () => {
  it('loads Attic Escape', () =>
    expect(() => validateLevel(atticEscape)).not.toThrow());
  it('rejects invalid geometry', () => {
    const level = structuredClone(atticEscape);
    level.platforms[0]!.width = -5;
    expect(() => validateLevel(level)).toThrow(/platform/);
  });
  it('rejects duplicate IDs', () => {
    const level = structuredClone(atticEscape);
    level.treats[0]!.id = level.platforms[0]!.id;
    expect(() => validateLevel(level)).toThrow(/unique/);
  });
  it('rejects unsafe checkpoint anchors', () => {
    const level = structuredClone(atticEscape);
    level.checkpoints[0]!.spawn.x = 419;
    expect(() => validateLevel(level)).toThrow(/unsafe checkpoint/);
  });
  it('changes checkpoints only on configured grounded safe areas', () => {
    const cp = new Checkpoints(atticEscape);
    expect(cp.update({ x: 850, y: 350 }, true)).toBe(false);
    expect(cp.update({ x: 800, y: 500 }, false)).toBe(false);
    expect(cp.update({ x: 800, y: 500 }, true)).toBe(true);
    expect(cp.id).toBe('basics');
    expect(cp.spawn).toEqual({ x: 800, y: 500 });
    cp.update({ x: 160, y: 520 }, true);
    expect(cp.id).toBe('basics');
    const copy = cp.spawn;
    copy.x = 0;
    expect(cp.spawn.x).toBe(800);
  });
});
describe('subtle collision assistance', () => {
  const ceiling = { x: 20, y: 20, width: 30, height: 10 };
  it('nudges a narrow upward corner clip to nearest clearance', () => {
    expect(
      cornerCorrection(
        { x: 17, y: 31, width: 4, height: 8 },
        28,
        [ceiling],
        3,
        -1,
      ),
    ).toBe(-1);
  });
  it('does not escape a full ceiling or teleport through a wall', () => {
    expect(
      cornerCorrection(
        { x: 25, y: 31, width: 10, height: 8 },
        28,
        [ceiling],
        5,
      ),
    ).toBe(0);
    expect(
      cornerCorrection(
        { x: 17, y: 31, width: 4, height: 8 },
        28,
        [ceiling, { x: 0, y: 0, width: 17, height: 100 }],
        3,
        -1,
      ),
    ).toBe(0);
  });
  it('corrects only very narrow descending platform edge misses', () => {
    const roof = { x: 20, y: 40, width: 50, height: 50 };
    expect(
      edgeCorrection({ x: 14, y: 28, width: 4, height: 10 }, 32, [roof], 3),
    ).toBe(2.5);
    expect(
      edgeCorrection({ x: 10, y: 28, width: 4, height: 10 }, 32, [roof], 3),
    ).toBe(0);
    expect(
      edgeCorrection({ x: 14, y: 41, width: 4, height: 10 }, 43, [roof], 3),
    ).toBe(0);
  });
});
describe('world viewport sizing', () => {
  it.each([
    [1280, 720],
    [1440, 650],
    [390, 400],
    [1920, 1000],
  ])('scales uniformly at %i×%i', (w, h) => {
    const v = viewportSize(w, h);
    expect(v.cssWidth / v.width).toBeCloseTo(v.cssHeight / v.height);
    expect(v.cssWidth).toBeLessThanOrEqual(w);
    expect(v.cssHeight).toBeLessThanOrEqual(h);
    expect(v.width).toBeLessThanOrEqual(960);
  });
  it('uses integer scaling when there is room', () =>
    expect(viewportSize(1280, 720).scale).toBe(2));
});
