import { expect, test, type Page } from '@playwright/test';
import { warehouse } from '../src/game/levels/warehouse';
import type { PlayerIntent } from '../src/game/input/Input';
async function boot(page: Page) {
  await page.goto('/?test&level=warehouse');
  await page.waitForFunction(() => window.__sophie?.snapshot().jimmy);
  await page.evaluate(() => window.__sophie!.manual(true));
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.__sophie!.snapshot());
const advance = (
  page: Page,
  frames: number,
  input: Partial<PlayerIntent> = {},
) =>
  page.evaluate(
    ({ frames, input }) => window.__sophie!.advance(frames, input),
    { frames, input },
  );
const checkpoint = (page: Page, id: string) =>
  page.evaluate((id) => window.__sophie!.checkpoint(id), id);
test('warehouse introduction and Jimmy mirror walking, jumping, and a diagonal dash after 300 ms', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await expect(page.locator('.dialogue')).toContainText(
    'Things get a lot harder from here.',
  );
  await advance(page, 210);
  await expect(page.locator('.dialogue')).toContainText(
    'Want me to come with you?',
  );
  await advance(page, 220);
  expect((await snapshot(page)).jimmy?.enabled).toBe(true);
  await expect(page.locator('.dialogue')).toBeHidden();
  const before = await snapshot(page);
  const first = await advance(page, 20, { moveX: 1 });
  expect(first.x).toBeGreaterThan(before.x);
  expect(first.jimmy!.x).toBe(before.jimmy!.x);
  const walking = await advance(page, 20, { moveX: 1 });
  expect(walking.jimmy!.x).toBeGreaterThan(first.jimmy!.x);
  expect(walking.jimmy!.x).toBeLessThan(walking.x);
  const jump = await advance(page, 20, {
    moveX: 1,
    jumpPressed: true,
    jumpHeld: true,
  });
  expect(jump.y).toBeLessThan(warehouse.playerSpawn.y);
  expect(jump.jimmy!.vy).toBe(0);
  const mirroredJump = await advance(page, 20, { moveX: 1, jumpHeld: true });
  expect(mirroredJump.jimmy!.vy).toBeLessThan(0);
  await advance(page, 1, { moveX: 1, aimY: -1, dashPressed: true });
  const mirroredDash = await advance(page, 36);
  expect(mirroredDash.jimmy!.state).toBe('Dashing');
  expect(mirroredDash.jimmy!.vx).toBeGreaterThan(0);
  expect(mirroredDash.jimmy!.vy).toBeLessThan(0);
  expect(errors).toEqual([]);
});

test('horizontal and vertical platforms carry both dogs and transfer jump velocity', async ({
  page,
}) => {
  await boot(page);
  await advance(page, 420);
  for (const id of ['pallet-one', 'cargo-hoist']) {
    await page.evaluate((id) => window.__sophie!.platform(id), id);
    const before = await snapshot(page);
    const start = before.machinery!.find((p) => p.id === id)!;
    const after = await advance(page, 240);
    const end = after.machinery!.find((p) => p.id === id)!;
    expect(after.y).toBeCloseTo(end.y, 4);
    expect(after.x - end.x).toBeCloseTo(before.x - start.x, 4);
    expect(after.jimmy!.y).toBeCloseTo(end.y, 4);
    expect(after.jimmy!.x - end.x).toBeCloseTo(before.jimmy!.x - start.x, 4);
    expect(after.grounded).toBe(true);
    const jump = await advance(page, 1, { jumpPressed: true, jumpHeld: true });
    const surface = jump.machinery!.find((p) => p.id === id)!;
    expect(jump.vy).toBeCloseTo(
      jump.physics.jumpVelocity + jump.physics.gravity / 120 + surface.vy,
      3,
    );
    expect(jump.vx).toBeCloseTo(surface.vx, 3);
  }
});

test('conveyors carry idle actors while steering remains responsive; shutters open predictably', async ({
  page,
}) => {
  await boot(page);
  await checkpoint(page, 'conveyors');
  await page.evaluate(() => window.__sophie!.place({ x: 1300, y: 1300 }));
  const start = await snapshot(page);
  const carried = await advance(page, 120);
  expect(carried.x - start.x).toBeCloseTo(45, 2);
  const against = await advance(page, 60, { moveX: -1 });
  expect(against.x).toBeLessThan(carried.x - 30);
  await checkpoint(page, 'shutter');
  const states = new Set<boolean>();
  for (let i = 0; i < 12; i++)
    states.add((await advance(page, 60)).gates![0]!.open);
  expect([...states].sort()).toEqual([false, true]);
  const through = await page.evaluate(() => {
    const a = window.__sophie!;
    for (let i = 0; i < 900 && a.snapshot().x < 3150; i++)
      a.advance(1, { moveX: 1 });
    return a.snapshot();
  });
  expect(through.x).toBeGreaterThan(3150);
  expect(through.respawning).toBe(false);
});

test('Jimmy cannot take treats or mutate Sophie charges; recovery and respawn reconcile him', async ({
  page,
}) => {
  await boot(page);
  await checkpoint(page, 'treat-chain');
  const initial = await snapshot(page);
  const bone = warehouse.treats[0]!;
  await page.evaluate(
    (p) => window.__sophie!.place({ x: p.x, y: p.y + 12 }, true),
    bone,
  );
  const untouched = await advance(page, 1);
  expect(untouched.treats).not.toContain(bone.id);
  expect(untouched.charges).toBe(initial.charges);
  await page.evaluate(
    (p) => window.__sophie!.place({ x: p.x, y: p.y + 12 }),
    bone,
  );
  const collected = await advance(page, 1);
  expect(collected.treats).toContain(bone.id);
  expect(collected.charges).toBe(2);
  await page.keyboard.press('KeyR');
  const reset = await advance(page, 24);
  expect(reset.checkpoint).toBe('treat-chain');
  expect(Math.abs(reset.x - reset.jimmy!.x)).toBeLessThan(80);
  expect(reset.y).toBe(reset.jimmy!.y);
  expect(reset.charges).toBe(1);
  expect(reset.treats).not.toContain(bone.id);
  await page.evaluate(() => window.__sophie!.place({ x: 100, y: 1690 }, true));
  const recovered = await advance(page, 40);
  expect(recovered.jimmy!.recoveries).toBeGreaterThan(reset.jimmy!.recoveries);
  expect(recovered.jimmy!.x).toBeLessThan(recovered.x);
  expect(recovered.x - recovered.jimmy!.x).toBeLessThan(100);
  expect(recovered.charges).toBe(1);
});

test('elevator boards both dogs, travels for 6.5 seconds, and opens onto the upper floor', async ({
  page,
}) => {
  await boot(page);
  await checkpoint(page, 'elevator');
  await advance(page, 150, { moveX: 1 });
  const boarded = await snapshot(page);
  expect(boarded.elevator).toBe('closing');
  await advance(page, 120);
  const riding = await snapshot(page);
  expect(riding.elevator).toBe('riding');
  const moving = await advance(page, 360);
  expect(moving.y).toBeLessThan(riding.y - 100);
  expect(moving.y).toBe(moving.jimmy!.y);
  expect(moving.elevator).toBe('riding');
  const top = await advance(page, 530);
  expect(top.elevator).toBe('arrived');
  expect(top.y).toBe(warehouse.elevator!.topY);
  expect(top.jimmy!.y).toBe(top.y);
  await expect(page.locator('.dialogue')).toContainText('DING');
  const upstairs = await advance(page, 225, { moveX: 1 });
  expect(upstairs.checkpoint).toBe('upper-floor');
});

test('the final attempt freezes, Jimmy catches and slings both dogs, then the Level 2 door ends the game', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await checkpoint(page, 'final-runway');
  await advance(page, 100, { moveX: 1 });
  await advance(page, 9, { moveX: 1, dashPressed: true });
  const launched = await advance(page, 20, {
    moveX: 1,
    jumpPressed: true,
    jumpHeld: true,
  });
  expect(launched.finale).toBeUndefined();
  let frozen = launched;
  for (let i = 0; i < 140 && !frozen.finale; i++)
    frozen = await advance(page, 1, { moveX: 1, jumpHeld: true });
  expect(frozen.finale).toBe('freeze');
  const still = await advance(page, 20, {
    moveX: -1,
    jumpPressed: true,
    dashPressed: true,
  });
  expect(still.x).toBeCloseTo(frozen.x, 4);
  expect(still.y).toBeCloseTo(frozen.y, 4);
  expect((await advance(page, 35)).finale).toBe('catch');
  expect((await advance(page, 65)).finale).toBe('contact');
  expect((await advance(page, 35)).finale).toBe('sling');
  const landed = await advance(page, 160);
  expect(landed.finaleComplete).toBe(true);
  expect(landed.grounded).toBe(true);
  expect(landed.y).toBe(warehouse.finale!.landing.y);
  expect(landed.jimmy!.y).toBe(warehouse.finale!.jimmyLanding.y);
  expect(landed.ending).toBe(false);
  const moved = await advance(page, 10, { moveX: 1 });
  expect(moved.x).toBeGreaterThan(landed.x);
  await advance(page, 240, { moveX: 1 });
  await advance(page, 180);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible();
  expect((await snapshot(page)).levelId).toBe('warehouse');
  await page.getByRole('button', { name: 'Play again' }).click();
  expect((await snapshot(page)).levelId).toBe('attic-escape');
  expect(errors).toEqual([]);
});

test('both dogs traverse the introductory pallets and rising hoist with normal movement', async ({
  page,
}) => {
  await boot(page);
  const route = await page.evaluate(() => {
    const a = window.__sophie!;
    const tick = (n: number, input: Partial<PlayerIntent> = {}) =>
      a.advance(n, input);
    const until = (
      condition: (s: ReturnType<typeof a.snapshot>) => boolean,
      input: Partial<PlayerIntent> = {},
    ) => {
      for (let i = 0; i < 1500; i++) {
        const s = a.snapshot();
        if (s.respawning) throw new Error(`Route fell at ${s.x}, ${s.y}`);
        if (condition(s)) return s;
        tick(1, input);
      }
      throw new Error('Route timed out');
    };
    const jump = { moveX: 1 as const, jumpHeld: true };
    a.checkpoint('loading');
    until((s) => s.x >= 414, { moveX: 1 });
    until((s) => s.machinery!.find((p) => p.id === 'pallet-one')!.x < 515);
    tick(1, { ...jump, jumpPressed: true });
    until((s) => s.grounded, jump);
    const first = tick(40);
    until(
      (s) => s.x >= s.machinery!.find((p) => p.id === 'pallet-one')!.x + 115,
      { moveX: 1 },
    );
    tick(6, { moveX: 1, dashPressed: true });
    tick(1, { ...jump, jumpPressed: true });
    until((s) => s.grounded, jump);
    const second = tick(40);
    a.checkpoint('hoist');
    until((s) => s.x >= 2318, { moveX: 1 });
    until((s) => s.machinery!.find((p) => p.id === 'cargo-hoist')!.y > 1190);
    tick(1, { ...jump, jumpPressed: true });
    until((s) => s.x >= 2450, jump);
    until((s) => s.grounded);
    until((s) => s.machinery!.find((p) => p.id === 'cargo-hoist')!.y < 1000);
    until((s) => s.x >= 2520, { moveX: 1 });
    tick(1, { ...jump, jumpPressed: true });
    tick(30, jump);
    tick(1, { ...jump, aimY: -1, dashPressed: true });
    until((s) => s.grounded, jump);
    const catwalk = tick(60);
    return { first, second, catwalk };
  });
  for (const s of [route.first, route.second, route.catwalk]) {
    expect(s.grounded).toBe(true);
    expect(s.jimmy!.y).toBeCloseTo(s.y, 1);
    expect(s.jimmy!.recoveries).toBe(0);
  }
  expect(route.first.y).toBe(1320);
  expect(route.second.y).toBe(1300);
  expect(route.catwalk.y).toBe(900);
});

test('both dogs land the two moving-pallet treat chains using normal inputs', async ({
  page,
}) => {
  await boot(page);
  for (const setup of [
    {
      checkpoint: 'treat-chain',
      takeoff: 4305,
      treat: 'freight-treat',
      pallet: 'hanging-refill',
    },
    {
      checkpoint: 'upper-chain',
      takeoff: 7098,
      treat: 'upper-treat',
      pallet: 'upper-hanging',
    },
  ]) {
    const result = await page.evaluate((setup) => {
      const a = window.__sophie!;
      a.checkpoint(setup.checkpoint);
      const tick = (n: number, input: Partial<PlayerIntent> = {}) =>
        a.advance(n, input);
      const until = (
        condition: (s: ReturnType<typeof a.snapshot>) => boolean,
        input: Partial<PlayerIntent> = {},
      ) => {
        for (let i = 0; i < 500; i++) {
          const s = a.snapshot();
          if (s.respawning) throw new Error(`Chain fell at ${s.x}, ${s.y}`);
          if (condition(s)) return s;
          tick(1, input);
        }
        throw new Error('Chain timed out');
      };
      const jump = { moveX: 1 as const, jumpHeld: true };
      until((s) => s.x >= setup.takeoff, { moveX: 1 });
      tick(9, { moveX: 1, dashPressed: true });
      tick(1, { ...jump, jumpPressed: true });
      const spent = a.snapshot();
      const collected = until((s) => s.treats.includes(setup.treat), jump);
      tick(1, { ...jump, aimY: -1, dashPressed: true });
      const landed = until((s) => s.grounded, jump);
      const together = tick(65);
      return { spent, collected, landed, together };
    }, setup);
    expect(result.spent.charges).toBe(0);
    expect(result.collected.charges).toBe(1);
    expect(result.landed.charges).toBe(0);
    const surface = result.together.machinery!.find(
      (p) => p.id === setup.pallet,
    )!;
    expect(result.together.y).toBe(surface.y);
    expect(result.together.jimmy!.y).toBe(surface.y);
    expect(result.together.jimmy!.recoveries).toBe(0);
    expect(result.together.x).toBeGreaterThan(surface.x);
  }
});

test('retry during the elevator restores Jimmy and clears the lift presentation', async ({
  page,
}) => {
  await boot(page);
  await checkpoint(page, 'elevator');
  await advance(page, 150, { moveX: 1 });
  await advance(page, 120);
  expect((await snapshot(page)).elevator).toBe('riding');
  await page.keyboard.press('KeyR');
  const reset = await advance(page, 24);
  expect(reset.elevator).toBe('waiting');
  expect(reset.jimmy!.enabled).toBe(true);
  expect(reset.y).toBe(warehouse.elevator!.bottomY);
  await expect(page.locator('.dialogue')).toBeHidden();
});

test('Jimmy waits at a closed shutter and resumes after it opens even when Sophie stops', async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('shutter');
    a.place({ x: 3140, y: 900 });
    a.place({ x: 3035, y: 900 }, true);
    a.advance(1);
    for (let i = 0; i < 600 && a.snapshot().gates![0]!.open; i++) a.advance(1);
    a.advance(40, { moveX: 1 });
    const waiting = a.advance(190);
    const through = a.advance(160);
    return { waiting, through };
  });
  expect(result.waiting.jimmy!.x).toBeCloseTo(3035, 1);
  expect(result.waiting.jimmy!.recoveries).toBe(0);
  expect(result.through.jimmy!.x).toBeGreaterThan(3100);
  expect(result.through.jimmy!.recoveries).toBe(0);
  expect(result.through.x).toBeCloseTo(result.waiting.x, 2);
});
