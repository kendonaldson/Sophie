import { describe, expect, it, vi } from 'vitest';
import { PizzaPower } from '../src/game/pizza/PizzaPower';
import { pizzaRushConfig as c } from '../src/game/pizza/config';
import { PizzaPickup } from '../src/game/pizza/PizzaPickup';
import { pizzaDashPose } from '../src/game/pizza/dashAppearance';
import { PlayerController } from '../src/game/player/PlayerController';
import { physics } from '../src/game/config/physics';
import { noInput } from '../src/game/input/Input';

const actor = () => {
  const sfx = {
    jump: vi.fn(),
    dash: vi.fn(),
    pizzaPowerUp: vi.fn(),
    superPizzaDash: vi.fn(),
  };
  const power = new PizzaPower(c.pizzaRushDurationMs);
  return { sfx, power, player: new PlayerController(physics, sfx, power) };
};
const body = { x: 85, y: 75, width: 30, height: 25 };
const ground = { vx: 0, vy: 0, grounded: true };

describe('reusable Pizza Rush', () => {
  it('runs at 2x for eight seconds, then restores ordinary movement without changing jump or dash rules', () => {
    const { player, power, sfx } = actor();
    const pickup = new PizzaPickup({ id: 'pizza', x: 100, y: 88 });
    expect(pickup.collect(body, player)).toBe(true);
    expect(power.durationMs).toBe(c.pizzaRushDurationMs);
    expect(power.remainingMs).toBe(8000);
    expect(power.fraction).toBe(1);
    expect(player.movementConfig.maxRunSpeed).toBe(physics.maxRunSpeed * 2);
    expect(player.movementConfig.gravity).toBe(physics.gravity);
    expect(player.movementConfig.jumpVelocity).toBe(physics.jumpVelocity);
    expect(player.dash.charges).toBe(1);
    expect(sfx.pizzaPowerUp).toHaveBeenCalledOnce();
    expect(sfx.superPizzaDash).not.toHaveBeenCalled();
    let motion = ground;
    for (let n = 0; n < 799; n++)
      motion = player.step(10, { ...noInput(), moveX: 1 }, motion);
    motion = player.step(9, { ...noInput(), moveX: 1 }, motion);
    expect(power.active).toBe(true);
    expect(power.remainingMs).toBe(1);
    expect(motion.vx).toBe(360);
    motion = player.step(1, { ...noInput(), moveX: 1 }, motion);
    expect(power.active).toBe(false);
    expect(power.remainingMs).toBe(0);
    expect(power.fraction).toBe(0);
    expect(player.movementConfig).toBe(physics);
    expect(motion.vx).toBe(180);
    expect(player.dash.charges).toBe(1);
  });
  it('expires deterministically and refreshes on another pickup', () => {
    const a = new PizzaPower(3000),
      b = new PizzaPower(3000);
    a.activate();
    b.activate();
    a.tick(2100);
    for (let n = 0; n < 21; n++) b.tick(100);
    expect(a.remainingMs).toBe(b.remainingMs);
    expect(a.fraction).toBeCloseTo(0.3);
    a.activate();
    expect(a.remainingMs).toBe(3000);
    a.tick(3000);
    expect(a.active).toBe(false);
    b.tick(-100);
    expect(b.remainingMs).toBe(900);
  });
  it('clears power on ordinary player restoration without modifying Jimmy', () => {
    const { player, power } = actor();
    const jimmy = new PlayerController(physics);
    player.collectPizza();
    player.dash.collectTreat();
    player.reset();
    expect(power.active).toBe(false);
    expect(player.dash.charges).toBe(1);
    expect(jimmy.collectPizza()).toBe(false);
    expect(jimmy.movementConfig).toBe(physics);
    expect(jimmy.dash.charges).toBe(1);
  });
  it('retains all treat-charge rules while active and after expiration', () => {
    const { player, power } = actor();
    player.collectPizza();
    player.dash.collectTreat();
    player.dash.collectTreat();
    expect(player.dash.charges).toBe(2);
    player.step(
      8,
      { ...noInput(), dashPressed: true, moveX: 1 },
      { ...ground, grounded: false },
    );
    expect(player.dash.charges).toBe(1);
    power.tick(c.pizzaRushDurationMs);
    expect(player.dash.charges).toBe(1);
    player.dash.cancel();
    player.dash.start(1, 0, 1);
    player.dash.tick(5000, false);
    expect(player.dash.charges).toBe(0);
    player.dash.tick(499, true);
    expect(player.dash.charges).toBe(0);
    player.dash.tick(1, true);
    expect(player.dash.charges).toBe(1);
  });
  it.each([false, true])(
    'recharges only the baseline charge after grounded recovery, with powered=%s',
    (powered) => {
      const { player } = actor();
      if (powered) player.collectPizza();
      player.step(8, { ...noInput(), dashPressed: true, moveX: 1 }, ground);
      expect(player.dash.charges).toBe(0);
      const recoveryMs = powered ? 250 : 500;
      player.step(recoveryMs / 2, noInput(), ground);
      expect(player.dash.charges).toBe(0);
      expect(player.dash.rechargeProgress).toBe(0.5);
      player.step(recoveryMs / 2 - 1, noInput(), ground);
      expect(player.dash.charges).toBe(0);
      expect(player.dash.rechargeProgress).toBeCloseTo(
        (recoveryMs - 1) / recoveryMs,
      );
      player.step(1, noInput(), ground);
      expect(player.dash.charges).toBe(1);
      expect(player.dash.rechargeProgress).toBe(1);
      player.step(1000, noInput(), ground);
      expect(player.dash.charges).toBe(1);
      player.dash.collectTreat();
      player.step(1000, noInput(), ground);
      expect(player.dash.charges).toBe(2);
    },
  );
  it('requires continuous ground contact for the faster powered recharge', () => {
    const { player, power } = actor();
    player.collectPizza();
    player.step(8, { ...noInput(), dashPressed: true, moveX: 1 }, ground);
    player.step(249, noInput(), ground);
    expect(player.dash.charges).toBe(0);
    player.step(1000, noInput(), { ...ground, grounded: false });
    expect(power.active).toBe(true);
    expect(player.dash.charges).toBe(0);
    expect(player.dash.rechargeProgress).toBe(0);
    player.step(249, noInput(), ground);
    expect(player.dash.charges).toBe(0);
    player.step(1, noInput(), ground);
    expect(player.dash.charges).toBe(1);
  });
  it('restores the ordinary recovery threshold when power expires before a refill', () => {
    const { player, power } = actor();
    player.collectPizza();
    player.step(8, { ...noInput(), dashPressed: true, moveX: 1 }, ground);
    power.tick(power.remainingMs - 250);
    player.step(249, noInput(), ground);
    expect(power.active).toBe(true);
    expect(player.dash.charges).toBe(0);
    expect(player.dash.rechargeProgress).toBeCloseTo(249 / 250);
    player.step(1, noInput(), ground);
    expect(power.active).toBe(false);
    expect(player.dash.charges).toBe(0);
    expect(player.dash.rechargeProgress).toBe(0.5);
    player.step(249, noInput(), ground);
    expect(player.dash.charges).toBe(0);
    player.step(1, noInput(), ground);
    expect(player.dash.charges).toBe(1);
  });
  it('requires an active dash for confrontation slices, and allows a missed attempt to recover', () => {
    const { player } = actor();
    const pickup = new PizzaPickup({
      id: 'teaching',
      x: 100,
      y: 88,
      requiresDash: true,
    });
    expect(pickup.collect(body, player)).toBe(false);
    player.dash.start(1, 0, 1);
    expect(pickup.collect(body, player)).toBe(true);
    expect(pickup.collect(body, player)).toBe(false);
    pickup.tick(c.pickupRespawnMs - 1);
    expect(pickup.available).toBe(false);
    pickup.tick(1);
    expect(pickup.available).toBe(true);
    pickup.reset(true);
    pickup.tick(10000);
    expect(pickup.available).toBe(false);
    pickup.reset();
    expect(pickup.available).toBe(true);
  });
});

describe('Super Pizza Dash', () => {
  it.each([false, true])(
    'restores air control after the ordinary dash duration, with powered=%s',
    (powered) => {
      const { player, power } = actor();
      if (powered) player.collectPizza();
      const speed = physics.dashSpeed * (powered ? 2 : 1);
      let motion = player.step(
        8,
        { ...noInput(), dashPressed: true, moveX: 1 },
        { ...ground, grounded: false },
      );
      expect(motion.vx).toBe(speed);
      expect(player.dash.remainingMs).toBe(physics.dashDurationMs);
      expect(player.dash.charges).toBe(0);
      const reverse = { ...noInput(), moveX: -1 as const };
      motion = player.step(physics.dashDurationMs - 1, reverse, motion);
      expect(player.dash.active).toBe(true);
      expect(motion.vx).toBe(speed);
      expect(motion.vy).toBe(0);
      motion = player.step(1, reverse, motion);
      expect(player.dash.active).toBe(false);
      expect(player.state).toBe('Airborne');
      expect(motion.vx).toBeLessThan(speed * physics.dashExitMomentumRetention);
      expect(motion.vy).toBeGreaterThan(0);
      const exitSpeed = motion.vx;
      motion = player.step(40, reverse, motion);
      expect(motion.vx).toBeLessThan(exitSpeed);
      expect(player.dash.charges).toBe(0);
      expect(power.active).toBe(powered);
    },
  );
  it('transforms the paid-for current dash immediately, preserves aim, and spends no extra charge', () => {
    const { player, sfx } = actor();
    player.step(
      8,
      { ...noInput(), dashPressed: true, moveX: 1, aimY: -1 },
      { ...ground, grounded: false },
    );
    const direction = { ...player.dash.direction };
    player.dash.tick(120, false);
    expect(player.dash.charges).toBe(0);
    player.collectPizza();
    expect(player.dash.charges).toBe(0);
    expect(player.dash.direction).toEqual(direction);
    expect(player.dash.remainingMs).toBe(physics.dashDurationMs);
    let motion = player.step(8, noInput(), { vx: 0, vy: 0, grounded: false });
    expect(motion.vx).toBeCloseTo(
      (physics.dashSpeed * c.pizzaDashSpeedMultiplier) / Math.SQRT2,
    );
    expect(motion.vy).toBeCloseTo(-motion.vx);
    expect(sfx.dash).toHaveBeenCalledOnce();
    expect(sfx.superPizzaDash).toHaveBeenCalledOnce();
    motion = player.step(physics.dashDurationMs - 9, noInput(), motion);
    expect(player.dash.active).toBe(true);
    expect(player.dash.direction).toEqual(direction);
    player.step(1, noInput(), motion);
    expect(player.dash.active).toBe(false);
    expect(player.state).toBe('Airborne');
    expect(player.dash.charges).toBe(0);
  });
  it('uses the special sound for each powered dash, then restores the ordinary sound', () => {
    const { player, sfx, power } = actor();
    player.collectPizza();
    player.step(8, { ...noInput(), dashPressed: true, moveX: 1 }, ground);
    expect(sfx.superPizzaDash).toHaveBeenCalledOnce();
    expect(sfx.dash).not.toHaveBeenCalled();
    player.dash.cancel();
    player.dash.collectTreat();
    power.tick(c.pizzaRushDurationMs);
    player.step(8, { ...noInput(), dashPressed: true, moveX: 1 }, ground);
    expect(sfx.dash).toHaveBeenCalledOnce();
    expect(sfx.superPizzaDash).toHaveBeenCalledOnce();
  });
  it.each([
    [1, 0, 0, false, 0],
    [-1, 0, 0, true, 0],
    [1, -1, 2, false, 0],
    [-1, -1, 2, true, 0],
    [0, -1, 2, false, -45],
    [1, 1, 4, false, 0],
    [-1, 1, 4, true, 0],
    [0, 1, 4, false, 45],
  ])(
    'maps dash direction %s,%s to measured artwork',
    (x, y, frame, flipX, angle) => {
      expect(pizzaDashPose({ x: Number(x), y: Number(y) }, 0)).toEqual({
        frame,
        flipX,
        angle,
      });
      expect(pizzaDashPose({ x: Number(x), y: Number(y) }, 70).frame).toBe(
        Number(frame) + 1,
      );
    },
  );
});
