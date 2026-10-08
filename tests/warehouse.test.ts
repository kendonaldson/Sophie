import { describe, expect, it } from 'vitest';
import { InputHistory } from '../src/game/companion/InputHistory';
import { noInput } from '../src/game/input/Input';
import {
  platformPosition,
  standingOn,
} from '../src/game/machinery/PlatformMotion';
import { warehouse } from '../src/game/levels/warehouse';
import { atticEscape } from '../src/game/levels/atticEscape';
import { validateLevel } from '../src/game/levels/types';
import { shouldStartSling, FinalSling } from '../src/game/events/FinalSling';
import type { Player } from '../src/game/player/Player';
import { physics } from '../src/game/config/physics';
describe('Jimmy input history', () => {
  it.each([5, 10, 20, 25, 50])(
    'delays by 300 ms with %i ms simulation steps',
    (ms) => {
      const history = new InputHistory(300);
      for (let t = 0; t < 300; t += ms)
        expect(history.step(ms, { ...noInput(), moveX: 1 })).toEqual(noInput());
      expect(history.step(ms, noInput()).moveX).toBe(1);
    },
  );
  it('preserves jump, dash, diagonal aim and held jump then consumes edges once', () => {
    const history = new InputHistory(300);
    const action = {
      ...noInput(),
      moveX: 1 as const,
      aimY: -1 as const,
      jumpPressed: true,
      jumpHeld: true,
      dashPressed: true,
    };
    history.step(100, action);
    history.step(100, { ...action, jumpPressed: false, dashPressed: false });
    history.step(100, noInput());
    expect(history.step(100, noInput())).toEqual(action);
    expect(history.step(100, noInput())).toEqual({
      ...action,
      jumpPressed: false,
      dashPressed: false,
    });
    expect(history.step(100, noInput())).toEqual(noInput());
  });
  it('continues the earlier action while Sophie reverses and clears pending actions on respawn', () => {
    const history = new InputHistory(300);
    history.step(300, { ...noInput(), moveX: 1, dashPressed: true });
    expect(history.step(10, { ...noInput(), moveX: -1 }).moveX).toBe(1);
    history.reset();
    expect(history.step(300, noInput())).toEqual(noInput());
    expect(history.step(1, noInput())).toEqual(noInput());
  });
});
describe('reusable moving platform motion', () => {
  const def = {
    id: 'test',
    start: { x: 100, y: 300 },
    end: { x: 200, y: 300 },
    speed: 50,
    width: 100,
    height: 20,
    pauseMs: 500,
  };
  it('pauses, traverses, reverses, and returns precisely', () => {
    expect(platformPosition(def, 400)).toEqual(def.start);
    expect(platformPosition(def, 1500)).toEqual({ x: 150, y: 300 });
    expect(platformPosition(def, 2700)).toEqual(def.end);
    expect(platformPosition(def, 4000)).toEqual({ x: 150, y: 300 });
    expect(platformPosition(def, 5000)).toEqual(def.start);
  });
  it('has the same position after arbitrary time partitions, including vertical travel', () => {
    const vertical = { ...def, end: { x: 100, y: 100 } };
    for (const steps of [
      [2500],
      [1000, 500, 1000],
      Array.from({ length: 250 }, () => 10),
    ]) {
      expect(
        platformPosition(
          vertical,
          steps.reduce((a, b) => a + b, 0),
        ),
      ).toEqual({ x: 100, y: 200 });
    }
  });
  it('carries only grounded riders overlapping the top', () => {
    expect(
      standingOn(
        { x: 120, y: 275, width: 30, height: 25 },
        { x: 100, y: 300, width: 100 },
        0,
      ),
    ).toBe(true);
    expect(
      standingOn(
        { x: 120, y: 275, width: 30, height: 25 },
        { x: 100, y: 300, width: 100 },
        -200,
      ),
    ).toBe(false);
    expect(
      standingOn(
        { x: 201, y: 275, width: 30, height: 25 },
        { x: 100, y: 300, width: 100 },
        0,
      ),
    ).toBe(false);
  });
});
describe('warehouse progression and finale', () => {
  it('validates both chapters, with a transition only on Level 1', () => {
    expect(() => validateLevel(warehouse)).not.toThrow();
    expect(atticEscape.nextLevel).toBe(warehouse.id);
    expect(warehouse.nextLevel).toBeUndefined();
  });
  it('rejects invalid machinery', () => {
    const level = structuredClone(warehouse);
    level.movingPlatforms![0]!.speed = 0;
    expect(() => validateLevel(level)).toThrow(/moving platform/);
  });
  it('only triggers during an unrecoverable airborne attempt in the final area', () => {
    const def = warehouse.finale!;
    expect(
      shouldStartSling(def, { x: def.triggerX, y: def.runwayY }, false, 120),
    ).toBe(true);
    expect(
      shouldStartSling(def, { x: def.triggerX, y: def.runwayY }, true, 120),
    ).toBe(false);
    expect(shouldStartSling(def, { x: 3000, y: def.runwayY }, false, 120)).toBe(
      false,
    );
    expect(
      shouldStartSling(
        def,
        { x: def.triggerX, y: def.runwayY - 80 },
        false,
        -200,
      ),
    ).toBe(false);
    expect(shouldStartSling(def, def.landing, false, 120)).toBe(false);
  });
  it('has a gap beyond even a deliberately generous two-charge travel bound', () => {
    // Relax horizontal/vertical coupling in Sophie's favour. A ground dash-jump
    // spends one of at most two charges. The remaining dash can rise at most
    // dashSpeed*duration + post-dash ascent, including a late below-lip recovery.
    const p = physics,
      g = p.gravity,
      jump = -p.jumpVelocity;
    const dashSeconds = p.dashDurationMs / 1000;
    const exitSpeed = p.dashSpeed * p.dashExitMomentumRetention;
    const addedHeight = p.dashSpeed * dashSeconds + exitSpeed ** 2 / (2 * g);
    const jumpHeight = jump ** 2 / (2 * g);
    const lateDashTime =
      (jump + Math.sqrt(jump ** 2 + 2 * g * addedHeight)) / g;
    const postDashTime =
      exitSpeed / g + Math.sqrt((2 * (jumpHeight + addedHeight)) / g);
    const longJumpBound =
      p.dashSpeed * (p.dashJumpWindowMs / 1000 + lateDashTime + dashSeconds) +
      exitSpeed * postDashTime +
      15 +
      p.edgeForgivenessPixels;
    const ordinaryAirTime =
      jump / g +
      2 * (dashSeconds + exitSpeed / g) +
      Math.sqrt((2 * (jumpHeight + 2 * addedHeight)) / g);
    const ordinaryBound =
      (p.maxRunSpeed * p.coyoteTimeMs) / 1000 +
      exitSpeed * ordinaryAirTime +
      2 * p.dashSpeed * dashSeconds +
      18;
    const landing = warehouse.platforms.find((p) => p.id === 'exit-dock')!;
    expect(landing.x - warehouse.finale!.runwayEnd).toBeGreaterThan(
      Math.max(longJumpBound, ordinaryBound) + 25,
    );
  });
  it('finishes both dogs exactly on safe ground independent of step partition', () => {
    function actor(x: number, y: number) {
      const sprite = {
        anims: { stop() {} },
        setFlipX() {
          return this;
        },
        setFrame() {
          return this;
        },
        setScale() {
          return this;
        },
      };
      return {
        feet: { x, y },
        sprite,
        place(p: { x: number; y: number }) {
          this.feet = { ...p };
        },
        respawn(p: { x: number; y: number }) {
          this.feet = { ...p };
        },
      };
    }
    for (const step of [8, 17, 50]) {
      const sophie = actor(8750, 320),
        jimmy = actor(8620, 320);
      const sling = new FinalSling(
        warehouse.finale!,
        sophie as unknown as Player,
        jimmy as unknown as Player,
      );
      while (!sling.done) sling.step(step);
      expect(sophie.feet).toEqual(warehouse.finale!.landing);
      expect(jimmy.feet).toEqual(warehouse.finale!.jimmyLanding);
    }
  });
});
