import { describe, expect, it } from 'vitest';
import {
  tunnelTuning as t,
  type MaintenanceDefinition,
} from '../src/game/maintenance/config';
import { TunnelExit } from '../src/game/maintenance/TunnelExit';

const destination: MaintenanceDefinition['destination'] = {
  triggerX: 9440,
  sophie: { x: 9470, y: 500 },
  jimmy: { x: 9415, y: 500 },
  hatch: { x: 9580, y: 404, width: 128, height: 96 },
};
const exit = () =>
  new TunnelExit(destination, {
    sophie: { x: 9440, y: 500 },
    jimmy: { x: 9400, y: 500 },
  });

describe('maintenance service-hatch ending', () => {
  it('gathers, holds, walks, leaves an empty floor, and fades without another scene', () => {
    const f = exit();
    expect(f.state.phase).toBe('gather');
    expect(f.actors.sophie.pose).toBe('walk');
    f.tick(t.gatherMs);
    expect(f.state.phase).toBe('hold');
    expect(f.actors.sophie).toMatchObject({
      ...destination.sophie,
      pose: 'idle',
    });
    expect(f.actors.jimmy).toMatchObject({
      ...destination.jimmy,
      pose: 'idle',
    });
    f.tick(t.exitHoldMs);
    expect(f.state.phase).toBe('walk');
    f.tick(f.walkMs + 0.001);
    expect(f.state.phase).toBe('empty');
    expect(Object.values(f.actors).every((a) => !a.visible)).toBe(true);
    expect(f.fade).toBe(0);
    f.tick(t.emptyMs);
    expect(f.state.phase).toBe('fade');
    f.tick(t.fadeMs / 2);
    expect(f.fade).toBeCloseTo(0.5, 4);
    f.tick(t.fadeMs / 2);
    expect(f.state.phase).toBe('complete');
    expect(f.fade).toBe(1);
  });

  it('lets Sophie start walking first and brings Jimmy through at the same walking speed', () => {
    const f = exit();
    f.tick(t.gatherMs + t.exitHoldMs + 200);
    expect(f.actors.sophie.pose).toBe('walk');
    expect(f.actors.sophie.x).toBe(destination.sophie.x + t.walkSpeed * 0.2);
    expect(f.actors.jimmy).toMatchObject({
      ...destination.jimmy,
      pose: 'idle',
    });
    f.tick(t.followDelayMs);
    expect(f.actors.jimmy.pose).toBe('walk');
    expect(f.actors.jimmy.x).toBe(destination.jimmy.x + t.walkSpeed * 0.2);
    expect(f.actors.sophie.x).toBeGreaterThan(f.actors.jimmy.x);
    expect(f.actors.sophie.flipX).toBe(false);
    expect(f.actors.jimmy.flipX).toBe(false);
  });

  it('clamps recovery to safe walking distance, grounds both dogs, and faces backwards when gathering left', () => {
    const f = new TunnelExit(destination, {
      sophie: { x: 9530, y: 470 },
      jimmy: { x: 500, y: 1400 },
    });
    const reach = (t.walkSpeed * t.gatherMs) / 1000;
    expect(f.actors.sophie).toMatchObject({ x: 9530, y: 500, flipX: true });
    expect(f.actors.jimmy).toMatchObject({
      x: destination.jimmy.x - reach,
      y: 500,
      flipX: false,
    });
    f.tick(t.gatherMs / 2);
    expect(f.actors.sophie.x).toBe(9500);
    expect(f.actors.jimmy.x).toBe(destination.jimmy.x - reach / 2);
    f.tick(t.gatherMs / 2);
    expect(f.actors.sophie.flipX).toBe(false);
    expect(f.actors.sophie.x).toBe(destination.sophie.x);
    expect(f.actors.jimmy.x).toBe(destination.jimmy.x);
  });

  it('fades each dog only inside the hatch and hides both before the empty-floor hold', () => {
    const f = exit(),
      inside = destination.hatch.x + 72;
    f.tick(
      t.gatherMs +
        t.exitHoldMs +
        ((inside - 12 - destination.sophie.x) / t.walkSpeed) * 1000,
    );
    expect(f.state.phase).toBe('walk');
    expect(f.actors.sophie.x).toBeGreaterThan(destination.hatch.x);
    expect(f.actors.sophie.alpha).toBeCloseTo(0.5);
    expect(f.actors.jimmy.alpha).toBe(1);
    const end = t.gatherMs + t.exitHoldMs + f.walkMs;
    f.tick(end - f.elapsed + 1);
    expect(f.state.phase).toBe('empty');
    for (const actor of Object.values(f.actors)) {
      expect(actor.x).toBe(inside);
      expect(actor.alpha).toBe(0);
      expect(actor.visible).toBe(false);
    }
    f.tick(t.emptyMs + t.fadeMs + 1000);
    expect(Object.values(f.actors).every((a) => !a.visible)).toBe(true);
  });

  it('uses elapsed time independently of frame partitions and ignores negative ticks', () => {
    const a = exit(),
      b = exit();
    a.tick(3180);
    for (let i = 0; i < 318; i++) b.tick(10);
    expect(b.state).toEqual(a.state);
    expect(b.actors).toEqual(a.actors);
    expect(b.fade).toBe(a.fade);
    b.tick(-500);
    expect(b.actors).toEqual(a.actors);
  });
});
