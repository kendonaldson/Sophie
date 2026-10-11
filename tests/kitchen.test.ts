import { expect, it, vi } from 'vitest';
import { KitchenDirector } from '../src/game/story/KitchenDirector';
import { interlude3 as c, kitchenLines } from '../src/game/story/interlude3';
import { PizzaPower } from '../src/game/pizza/PizzaPower';
import { physics } from '../src/game/config/physics';

const audio = () => ({
  jump: vi.fn(),
  dash: vi.fn(),
  pizzaPower: vi.fn(),
  pizzaSpeed: vi.fn(),
});
function reach(d: KitchenDirector, id: string) {
  for (let n = 0; n < 50000 && d.beat?.id !== id && d.phase !== 'complete'; n++)
    d.tick(1);
  expect(d.beat?.id).toBe(id);
}

it('automatically delivers the ordered dialogue and ends only after both dogs leave and Shelly holds', () => {
  const sfx = audio(),
    d = new KitchenDirector(sfx);
  const lines: string[] = [];
  for (let n = 0; n < 5000 && d.phase !== 'complete'; n++) {
    if (d.line && lines.at(-1) !== d.line.text) lines.push(d.line.text);
    if (d.line?.speaker === 'shelly' && d.line.text.includes('steal'))
      expect(d.pizzaTaken).toBe(true);
    if (d.phase === 'hold') {
      expect(d.actors.sophie.visible).toBe(false);
      expect(d.actors.jimmy.visible).toBe(false);
      expect(d.actors.shelly).toMatchObject({
        visible: true,
        pose: 'determined',
      });
      expect(d.fade).toBe(0);
    }
    d.tick(10);
  }
  expect(lines).toEqual(kitchenLines.map((l) => l.text));
  expect(d.phase).toBe('complete');
  expect(d.fade).toBe(1);
  expect(d.power.active).toBe(false);
  expect(sfx.jump).toHaveBeenCalledOnce();
  expect(sfx.dash).toHaveBeenCalledOnce();
  expect(sfx.pizzaPower).toHaveBeenCalledOnce();
  expect(sfx.pizzaSpeed).toHaveBeenCalledTimes(2);
  d.tick(100000);
  d.advance();
  expect(sfx.pizzaPower).toHaveBeenCalledOnce();
});

it('reveals Shelly between the dogs and pizza, then spends an ordinary dash over him before activating pizza', () => {
  const sfx = audio(),
    d = new KitchenDirector(sfx);
  expect(d.actors.shelly.visible).toBe(false);
  d.tick(c.arrivalDelayMs / 2);
  expect(d.actors.sophie.pose).toBe('walk');
  expect(d.actors.jimmy.pose).toBe('idle');
  reach(d, 'walk');
  expect(d.actors.sophie.pose).toBe('walk');
  reach(d, 'run');
  expect(d.actors.sophie.pose).toBe('run');
  reach(d, 'line-3');
  expect(d.actors.sophie.x).toBeLessThan(d.actors.shelly.x);
  expect(d.actors.shelly.x).toBeLessThan(c.pizzaX);
  reach(d, 'dash');
  expect(d.dash.active).toBe(true);
  expect(d.dash.charges).toBe(0);
  const x = d.actors.sophie.x;
  d.tick(c.dashMs / 2);
  expect(d.actors.sophie.x - x).toBeCloseTo(
    (physics.dashSpeed * c.dashMs) / 2000,
  );
  expect(d.actors.sophie.y).toBeLessThan(d.actors.shelly.y - 100);
  expect(d.power.active).toBe(false);
  d.tick(c.dashMs / 2);
  expect(d.dash.active).toBe(false);
  expect(d.actors.sophie.x).toBeGreaterThan(d.actors.shelly.x);
  reach(d, 'activation');
  expect(d.actors.sophie).toMatchObject({ x: c.pizzaX, y: c.pizzaY });
  expect(d.pizzaTaken).toBe(true);
  expect(d.power.active).toBe(true);
  expect(sfx.pizzaPower).toHaveBeenCalledOnce();
});

it('makes only Sophie extremely fast and starts Jimmy running immediately at her instruction', () => {
  const d = new KitchenDirector();
  reach(d, 'return');
  const beforeReturn = d.actors.sophie.x;
  d.tick(100);
  expect(beforeReturn - d.actors.sophie.x).toBeCloseTo(
    physics.dashSpeed * 3 * 0.1,
  );
  reach(d, 'escape');
  expect(d.line?.text).toBe('Jimmy, run!');
  expect(d.actors.jimmy.pose).toBe('run');
  d.tick(c.exitDelayMs);
  const before = d.actors;
  d.tick(100);
  expect(d.actors.sophie.x - before.sophie.x).toBeCloseTo(c.powerSpeed * 0.1);
  expect(d.actors.jimmy.x - before.jimmy.x).toBeCloseTo(
    physics.maxRunSpeed * 0.1,
  );
  d.tick(400);
  expect(d.actors.sophie.visible).toBe(false);
  expect(d.actors.jimmy.visible).toBe(true);
  reach(d, 'fade');
  d.tick(c.fadeOutMs / 2);
  expect(d.fade).toBeCloseTo(0.5);
});

it('is deterministic across large and partitioned ticks, and a fresh scene restores the pizza and ordinary Sophie', () => {
  const aAudio = audio(),
    bAudio = audio();
  const a = new KitchenDirector(aAudio),
    b = new KitchenDirector(bAudio);
  reach(a, 'activation');
  reach(b, 'activation');
  const ms = c.activationMs + 110;
  a.tick(ms);
  for (let i = 0; i < ms; i++) b.tick(1);
  expect(a.phase).toBe(b.phase);
  expect(a.actors).toEqual(b.actors);
  expect(aAudio.pizzaPower).toHaveBeenCalledTimes(
    bAudio.pizzaPower.mock.calls.length,
  );
  const fresh = new KitchenDirector();
  expect(fresh.pizzaTaken).toBe(false);
  expect(fresh.power.active).toBe(false);
  expect(fresh.dash.charges).toBe(1);
  fresh.advance();
  expect(fresh.phase).toBe('arrival');
  reach(fresh, 'line-0');
  fresh.advance();
  expect(fresh.line?.text).toBe('We did it!');
  fresh.tick(c.minimumLineMs);
  fresh.advance();
  expect(fresh.phase).toBe('pause');
});

it('keeps temporary pizza state reusable and idempotent without changing shared physics', () => {
  const p = new PizzaPower();
  expect(p.speedMultiplier).toBe(1);
  expect(p.activate()).toBe(true);
  expect(p.activate()).toBe(false);
  expect(p.speedMultiplier).toBe(3);
  expect(physics.maxRunSpeed).toBe(180);
  p.reset();
  expect(p.speedMultiplier).toBe(1);
  expect(p.activate()).toBe(true);
});
