import { describe, expect, it } from 'vitest';
import { physics as config } from '../src/game/config/physics';
import { DashController } from '../src/game/player/DashController';
import {
  PlayerController,
  type Motion,
} from '../src/game/player/PlayerController';
import { noInput, type PlayerIntent } from '../src/game/input/Input';
const dt = 1000 / 120;
const intent = (values: Partial<PlayerIntent> = {}) => ({
  ...noInput(),
  ...values,
});
const ground: Motion = { vx: 0, vy: 0, grounded: true };
const air: Motion = { vx: 0, vy: 0, grounded: false };
describe('dash capacity and recovery', () => {
  it('starts at one, consumes one, and refuses zero', () => {
    const d = new DashController(config);
    expect(d.charges).toBe(1);
    expect(d.start(1, 0, 1)).toBe(true);
    expect(d.charges).toBe(0);
    d.tick(200, false);
    expect(d.start(1, 0, 1)).toBe(false);
  });
  it.each([0, 1, 2])(
    'treat adds exactly one at %i, capped at two',
    (charges) => {
      const d = new DashController(config);
      d.charges = charges;
      d.collectTreat();
      expect(d.charges).toBe(Math.min(2, charges + 1));
    },
  );
  it('treat immediately enables the next airborne dash', () => {
    const d = new DashController(config);
    d.start(1, 0, 1);
    d.tick(config.dashDurationMs, false);
    d.collectTreat();
    expect(d.start(1, 0, 1)).toBe(true);
    expect(d.charges).toBe(0);
  });
  it('requires 500ms continuously grounded', () => {
    const d = new DashController(config);
    d.charges = 0;
    d.tick(499, true);
    expect(d.charges).toBe(0);
    d.tick(1, true);
    expect(d.charges).toBe(1);
  });
  it('leaving the ground resets recovery and airborne time never recharges', () => {
    const d = new DashController(config);
    d.charges = 0;
    d.tick(490, true);
    d.tick(10000, false);
    expect(d.charges).toBe(0);
    expect(d.groundedMs).toBe(0);
    d.tick(499, true);
    expect(d.charges).toBe(0);
    d.tick(1, true);
    expect(d.charges).toBe(1);
  });
  it.each([1, 2])('ground preserves %i charges', (charges) => {
    const d = new DashController(config);
    d.charges = charges;
    d.tick(10000, true);
    expect(d.charges).toBe(charges);
  });
  it('a fresh ground dash starts a full recovery interval', () => {
    const d = new DashController(config);
    d.tick(1000, true);
    d.start(1, 0, 1);
    d.tick(499, true);
    expect(d.charges).toBe(0);
    d.tick(1, true);
    expect(d.charges).toBe(1);
  });
  it.each([
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])('normalizes direction %i,%i', (x, y) => {
    const d = new DashController(config);
    d.start(x, y, 1);
    expect(Math.hypot(d.direction.x, d.direction.y)).toBeCloseTo(1);
    expect(Math.sign(d.direction.x)).toBe(x);
    expect(Math.sign(d.direction.y)).toBe(y);
  });
});
describe('jump feel', () => {
  it('permits a coyote jump, but only within its window', () => {
    const p = new PlayerController(config);
    p.step(dt, intent(), ground);
    p.step(70, intent(), air);
    expect(
      p.step(dt, intent({ jumpPressed: true, jumpHeld: true }), air).jumped,
    ).toBe(true);
    p.reset();
    p.step(dt, intent(), ground);
    p.step(110, intent(), air);
    expect(
      p.step(dt, intent({ jumpPressed: true, jumpHeld: true }), air).jumped,
    ).toBe(false);
  });
  it('buffers a jump until landing and consumes it once', () => {
    const p = new PlayerController(config);
    p.step(dt, intent({ jumpPressed: true, jumpHeld: true }), air);
    p.step(75, intent({ jumpHeld: true }), air);
    const jumped = p.step(dt, intent({ jumpHeld: true }), ground);
    expect(jumped.jumped).toBe(true);
    expect(p.step(dt, intent({ jumpHeld: true }), jumped).jumped).toBe(false);
  });
  it('expired jump buffer does not jump on landing', () => {
    const p = new PlayerController(config);
    p.step(dt, intent({ jumpPressed: true }), air);
    p.step(140, intent(), air);
    expect(p.step(dt, intent(), ground).jumped).toBe(false);
  });
  it('early release cuts upward velocity exactly once', () => {
    const p = new PlayerController(config);
    const jump = p.step(
      dt,
      intent({ jumpPressed: true, jumpHeld: true }),
      ground,
    );
    const cut = p.step(dt, intent(), jump);
    expect(cut.vy).toBeCloseTo(
      jump.vy * config.jumpCutMultiplier + (config.gravity * dt) / 1000,
    );
    const next = p.step(dt, intent(), cut);
    expect(next.vy).toBeCloseTo(cut.vy + (config.gravity * dt) / 1000);
  });
});
function flight(kind: 'normal' | 'high' | 'long', stepMs = dt) {
  const p = new PlayerController(config);
  let m: Motion = { ...ground, vx: config.maxRunSpeed };
  let x = 0,
    y = 0,
    minY = 0;
  if (kind === 'long')
    m = p.step(stepMs, intent({ moveX: 1, dashPressed: true }), m);
  m = p.step(
    stepMs,
    intent({ moveX: 1, jumpHeld: true, jumpPressed: true }),
    m,
  );
  for (let time = 0; time < 2000; time += stepMs) {
    m = p.step(
      stepMs,
      intent({
        moveX: 1,
        jumpHeld: true,
        aimY: kind === 'high' ? -1 : 0,
        dashPressed: kind === 'high' && time >= 200 && time < 200 + stepMs,
      }),
      { ...m, grounded: false },
    );
    x += (m.vx * stepMs) / 1000;
    y += (m.vy * stepMs) / 1000;
    minY = Math.min(y, minY);
    if (y >= 0) break;
  }
  return { x, height: -minY };
}
describe('combos and control', () => {
  it('dash-jump preserves the configured impulse', () => {
    const p = new PlayerController(config);
    const dash = p.step(dt, intent({ moveX: 1, dashPressed: true }), ground);
    const jump = p.step(
      dt,
      intent({ moveX: 1, jumpPressed: true, jumpHeld: true }),
      dash,
    );
    expect(jump.vx).toBeCloseTo(
      config.dashSpeed * config.dashJumpMomentumRetention -
        (config.overspeedDrag * dt) / 1000,
    );
    expect(jump.jumped).toBe(true);
    expect(p.dash.active).toBe(false);
    expect(flight('long').x).toBeGreaterThan(flight('normal').x * 2);
    // A 270px teaching gap needs landing margin for an early takeoff.
    expect(flight('long').x).toBeGreaterThan(300);
  });
  it('jump then upward diagonal dash reaches higher roofs', () => {
    expect(flight('high').height).toBeGreaterThan(flight('normal').height + 60);
  });
  it('normal air steering resumes immediately on dash completion', () => {
    const p = new PlayerController(config);
    const dash = p.step(dt, intent({ moveX: 1, dashPressed: true }), air);
    const end = p.step(config.dashDurationMs, intent({ moveX: 1 }), dash);
    expect(p.state).toBe('Airborne');
    expect(end.vx).toBeGreaterThan(0);
    const right = p.step(dt, intent({ moveX: 1 }), { ...end, vx: 0 });
    expect(right.vx).toBeGreaterThan(0);
    const left = p.step(dt, intent({ moveX: -1 }), end);
    expect(left.vx).toBeLessThan(end.vx);
  });
  it('holding and releasing jump produce materially different heights', () => {
    const p = new PlayerController(config);
    let m = p.step(dt, intent({ jumpPressed: true, jumpHeld: true }), ground);
    let y = 0,
      minY = 0;
    for (let i = 0; i < 100; i++) {
      m = p.step(dt, intent(), { ...m, grounded: false });
      y += (m.vy * dt) / 1000;
      minY = Math.min(minY, y);
    }
    expect(-minY).toBeLessThan(flight('normal').height * 0.5);
  });
  it('supplied time steps preserve jump shape at 60 and 120 Hz', () => {
    expect(
      Math.abs(
        flight('normal', 1000 / 60).height -
          flight('normal', 1000 / 120).height,
      ),
    ).toBeLessThan(5);
  });
  it('reset clears all transient movement and restores a single dash', () => {
    const p = new PlayerController(config);
    p.step(
      dt,
      intent({ dashPressed: true, moveX: -1, jumpPressed: true }),
      ground,
    );
    p.reset();
    expect(p.dash.charges).toBe(1);
    expect(p.dash.active).toBe(false);
    expect(p.dash.groundedMs).toBe(0);
    expect(p.facing).toBe(1);
    expect(p.step(dt, intent(), air).jumped).toBe(false);
  });
});
