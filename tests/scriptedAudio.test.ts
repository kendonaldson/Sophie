import { expect, it, vi } from 'vitest';
import { FinalSling, slingTiming } from '../src/game/events/FinalSling';
import { ChaseFinale } from '../src/game/chase/ChaseFinale';
import { chaseTuning as t } from '../src/game/chase/config';
import { chase } from '../src/game/levels/chase';
import { warehouse } from '../src/game/levels/warehouse';
import { sfxConfig } from '../src/game/audio/config';
import { Sfx } from '../src/game/audio/Sfx';
import type { Player } from '../src/game/player/Player';
import { physics } from '../src/game/config/physics';
const output = () => ({
  jimmySuperJumpAnticipation: vi.fn(),
  jimmySuperJump: vi.fn(),
});
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
  const result = {
    feet: { x, y },
    sprite,
    place(p: { x: number; y: number }) {
      this.feet = { ...p };
    },
    respawn(p: { x: number; y: number }) {
      this.feet = { ...p };
    },
  };
  return result as unknown as Player;
}
const c = sfxConfig.jimmySuperJump;
it('Level 2 sounds during compression and exactly at launch, reaching both arc peaks with the sweep', () => {
  const sfx = output(),
    sophie = actor(8750, 340),
    jimmy = actor(8620, 320);
  const f = new FinalSling(warehouse.finale!, sophie, jimmy, sfx);
  const launch =
    slingTiming.freezeMs + slingTiming.catchMs + slingTiming.contactMs;
  f.step(launch - c.anticipationMs - 1);
  expect(sfx.jimmySuperJumpAnticipation).not.toHaveBeenCalled();
  f.step(1);
  expect(f.phase).toBe('contact');
  expect(sfx.jimmySuperJumpAnticipation).toHaveBeenCalledOnce();
  f.step(c.anticipationMs - 1);
  expect(sfx.jimmySuperJump).not.toHaveBeenCalled();
  f.step(1);
  expect(f.phase).toBe('sling');
  expect(sfx.jimmySuperJump).toHaveBeenCalledOnce();
  f.step(c.launchMs - 20);
  const before = [sophie.feet.y, jimmy.feet.y];
  f.step(20);
  const peak = [sophie.feet.y, jimmy.feet.y];
  f.step(20);
  for (const [i, dog] of [sophie, jimmy].entries()) {
    expect(peak[i]!).toBeLessThan(before[i]!);
    expect(dog.feet.y).toBeGreaterThan(peak[i]!);
  }
  f.step(slingTiming.flightMs);
  expect(f.done).toBe(true);
  expect(sophie.feet).toEqual(warehouse.finale!.landing);
  expect(jimmy.feet).toEqual(warehouse.finale!.jimmyLanding);
  expect(sfx.jimmySuperJump).toHaveBeenCalledOnce();
});
it('Level 3 aligns compression/takeoff/exit and leaves an empty silent beat before the punchline', () => {
  const sfx = output(),
    def = chase.chase!;
  const f = new ChaseFinale(
    def.deadEnd,
    { sophie: def.deadEnd.sophie, jimmy: def.deadEnd.jimmy },
    def.view.top,
    sfx,
  );
  const launch =
    t.settleMs + t.gotchaMs + t.quietMs + t.homeMs + t.lookMs + t.crouchMs;
  f.tick(launch - c.anticipationMs - 1);
  expect(sfx.jimmySuperJumpAnticipation).not.toHaveBeenCalled();
  f.tick(1);
  expect(f.state.phase).toBe('crouch');
  expect(sfx.jimmySuperJumpAnticipation).toHaveBeenCalledOnce();
  f.tick(c.anticipationMs - 1);
  expect(sfx.jimmySuperJump).not.toHaveBeenCalled();
  f.tick(1);
  expect(f.state.phase).toBe('launch');
  expect(sfx.jimmySuperJump).toHaveBeenCalledOnce();
  f.tick(c.launchMs - 10);
  expect(f.actors.jimmy.y + physics.collisionInsetBottom).toBeGreaterThan(
    def.view.top,
  );
  f.tick(10);
  for (const dog of Object.values(f.actors))
    expect(dog.y + physics.collisionInsetBottom).toBeLessThan(def.view.top);
  expect(f.line).toBeUndefined();
  f.tick(c.releaseMs);
  f.tick(t.emptyMs - c.releaseMs - 1);
  expect(f.line).toBeUndefined();
  f.tick(1);
  expect(f.line?.text).toBe('WHAT IN THE WORLD?!');
  f.tick(10000);
  expect(sfx.jimmySuperJump).toHaveBeenCalledOnce();
});
it.each(['disabled', 'unsupported'] as const)(
  'both finales finish normally with %s audio',
  (mode) => {
    const factory = vi.fn(() => undefined);
    const sfx = new Sfx(sfxConfig, factory);
    if (mode === 'disabled') sfx.setEnabled(false);
    sfx.unlockFromGesture();
    const def = chase.chase!;
    const chaseFinale = new ChaseFinale(
      def.deadEnd,
      { sophie: def.deadEnd.sophie, jimmy: def.deadEnd.jimmy },
      def.view.top,
      sfx,
    );
    const sophie = actor(8750, 340),
      jimmy = actor(8620, 320);
    const sling = new FinalSling(warehouse.finale!, sophie, jimmy, sfx);
    for (let i = 0; i < 1400; i++) {
      chaseFinale.tick(10);
      sling.step(10);
    }
    expect(chaseFinale.state.phase).toBe('complete');
    expect(sling.done).toBe(true);
    expect(sophie.feet).toEqual(warehouse.finale!.landing);
    expect(factory).toHaveBeenCalledTimes(mode === 'disabled' ? 0 : 1);
  },
);
