import { test, expect, devices, type Page } from '@playwright/test';
import { balloons } from '../src/game/levels/balloons';
const state = (page: Page) => page.evaluate(() => window.__sophie!.snapshot());
async function open(page: Page) {
  await page.goto('/?test&level=balloons#debug');
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'balloons',
  );
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.manual(true);
    a.loadLevel('balloons');
  });
}
test('starts both dogs on the first crown, loads the original marquee and supports ordinary keyboard input', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const marquee = page.waitForResponse((r) =>
    r.url().endsWith('/assets/shelly_pizza_marquee.png'),
  );
  await open(page);
  expect((await marquee).ok()).toBe(true);
  const s = await state(page);
  expect(s).toMatchObject({ x: 185, y: 550, grounded: true, charges: 1 });
  expect(s.jimmy).toMatchObject({ x: 140, y: 550, enabled: true });
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await expect(page.locator('audio')).not.toHaveAttribute('src');
  expect(
    await page
      .locator('audio')
      .evaluate((audio: HTMLAudioElement) => audio.paused),
  ).toBe(true);
  await page.evaluate(() => window.__sophie!.manual(false));
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyZ');
  await expect.poll(async () => (await state(page)).y).toBeLessThan(540);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('KeyZ');
  expect(errors).toEqual([]);
});
test('thin crowns catch descending feet but allow passage through their sides, undersides and decorative envelopes', async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 200, y: 590 });
    const rising = a.advance(20, { aimY: -1, dashPressed: true });
    const landed = a.advance(90);
    a.place({ x: 35, y: 570 });
    const side = a.advance(24, { moveX: 1, dashPressed: true });
    const below = a.advance(15, { moveX: 1 });
    a.checkpoint('moving-balloon');
    a.place({ x: 2475, y: 595 });
    const movingRise = a.advance(20, { aimY: -1, dashPressed: true });
    const movingLand = a.advance(90);
    return { rising, landed, side, below, movingRise, movingLand };
  });
  expect(r.rising.y).toBeLessThan(550);
  expect(r.landed).toMatchObject({ grounded: true, y: 550 });
  expect(r.side.x).toBeGreaterThan(120);
  expect(r.side.y).toBeGreaterThan(550);
  expect(r.side.grounded).toBe(false);
  expect(r.below.x).toBeGreaterThan(r.side.x);
  expect(r.below.y).toBeGreaterThan(r.side.y);
  expect(r.movingRise.y).toBeLessThan(550);
  expect(r.movingLand.grounded).toBe(true);
  expect(r.movingLand.y).toBeCloseTo(r.movingLand.machinery![0]!.y);
});
test('every checkpoint chain can start immediately with varied keyboard and touch dash timings', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const r of [
      {
        cp: 'balloon-start',
        edge: 320,
        target: 575,
        n: 2,
        aim: 0,
        bones: ['first-refill'],
      },
      {
        cp: 'moving-balloon',
        edge: 2120,
        target: 2375,
        n: 2,
        aim: 0,
        bones: ['moving-refill'],
      },
      {
        cp: 'high-sky',
        edge: 2955,
        target: 3240,
        n: 2,
        aim: -1,
        bones: ['high-refill'],
      },
      {
        cp: 'high-chain',
        edge: 3420,
        target: 3730,
        n: 3,
        aim: -1,
        bones: ['high-chain-one', 'high-chain-two'],
      },
      {
        cp: 'sparrow-watch',
        edge: 3970,
        target: 4100,
        n: 0,
        aim: 0,
        bones: [],
      },
      {
        cp: 'sparrow-chain',
        edge: 4290,
        target: 4540,
        n: 2,
        aim: 0,
        bones: ['bird-refill'],
      },
      {
        cp: 'sparrow-pair',
        edge: 4780,
        target: 5110,
        n: 3,
        aim: 0,
        bones: ['bird-chain-one', 'bird-chain-two'],
      },
      {
        cp: 'pizza-crossing',
        edge: 5780,
        target: 6240,
        n: 3,
        aim: 0,
        bones: ['pizza-one', 'pizza-two'],
      },
    ] as const)
      for (const dashSource of [undefined, 'touch'] as const)
        for (const wait of [28, 32, 36])
          for (const gap of [26, 30, 34]) {
            a.loadLevel('balloons');
            a.checkpoint(r.cp);
            let s = a.snapshot();
            for (let i = 0; i < 200 && s.x < r.edge; i++)
              s = a.advance(1, { moveX: 1 });
            a.advance(wait, { moveX: 1, jumpPressed: true, jumpHeld: true });
            for (let i = 0; i < r.n; i++)
              a.advance(gap, {
                moveX: 1,
                aimY: r.aim,
                dashPressed: true,
                jumpHeld: true,
                dashSource,
              });
            for (let i = 0; i < 160; i++) {
              s = a.advance(1, { moveX: 1, jumpHeld: true });
              if (s.respawning || (s.grounded && s.x > r.target - 11)) break;
            }
            results.push({
              cp: r.cp,
              dashSource,
              wait,
              gap,
              landed: !s.respawning && s.grounded && s.x > r.target - 11,
              bones: r.bones.every((b) => s.treats.includes(b)),
              charges: s.charges,
            });
          }
    return results;
  });
  for (const r of results) {
    expect(r.landed, JSON.stringify(r)).toBe(true);
    expect(r.bones, JSON.stringify(r)).toBe(true);
    expect(r.charges).toBeLessThanOrEqual(2);
  }
});
test('short connectors mix normal hops and single dashes without requiring bones', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const r of [
      { cp: 'balloon-hops', x: 775, y: 550, target: 890, ey: 530, dash: false },
      {
        cp: 'balloon-hops',
        x: 1030,
        y: 530,
        target: 1160,
        ey: 550,
        dash: false,
      },
      {
        cp: 'balloon-hops',
        x: 1340,
        y: 550,
        target: 1530,
        ey: 520,
        dash: true,
      },
      {
        cp: 'balloon-hops',
        x: 1730,
        y: 520,
        target: 1850,
        ey: 530,
        dash: false,
      },
      {
        cp: 'sparrow-pair',
        x: 5330,
        y: 225,
        target: 5520,
        ey: 310,
        dash: true,
      },
    ]) {
      a.loadLevel('balloons');
      a.checkpoint(r.cp);
      a.place({ x: r.x - 30, y: r.y });
      a.advance(26, { moveX: 1 });
      a.advance(28, { moveX: 1, jumpPressed: true, jumpHeld: true });
      if (r.dash)
        a.advance(24, {
          moveX: 1,
          aimY: -1,
          dashPressed: true,
          jumpHeld: true,
        });
      let s = a.snapshot();
      for (let i = 0; i < 150; i++) {
        s = a.advance(1, { moveX: 1, jumpHeld: true });
        if (s.respawning || (s.grounded && s.x >= r.target - 11)) break;
      }
      results.push({
        r,
        x: s.x,
        y: s.y,
        grounded: s.grounded,
        failed: s.respawning,
        treats: s.treats,
      });
    }
    return results;
  });
  for (const s of results) {
    expect(s.failed, JSON.stringify(s)).toBe(false);
    expect(s.grounded).toBe(true);
    expect(s.y).toBe(s.r.ey);
    expect(s.treats).toEqual([]);
  }
});
test('the moving balloon carries both dogs, transfers jump velocity and permits a generous onward route', async ({
  page,
}) => {
  await open(page);
  const ride = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('moving-balloon');
    a.platform('rising-balloon');
    let maxError = 0;
    for (let i = 0; i < 820; i++) {
      const s = a.advance(1);
      maxError = Math.max(
        maxError,
        Math.abs(s.y - s.machinery![0]!.y),
        Math.abs(s.jimmy!.y - s.machinery![0]!.y),
      );
    }
    const before = a.snapshot();
    const jump = a.advance(1, { jumpPressed: true, jumpHeld: true });
    return { maxError, before, jump };
  });
  expect(ride.maxError).toBeLessThan(0.6);
  expect(ride.before.checkpoint).toBe('moving-balloon');
  expect(ride.jump.vy).toBeLessThan(ride.jump.physics.jumpVelocity);
  const exits = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const ride of [0, 30, 60, 120]) {
      a.loadLevel('balloons');
      a.checkpoint('moving-balloon');
      for (let i = 0; i < 160 && a.snapshot().x < 2120; i++)
        a.advance(1, { moveX: 1 });
      a.advance(28, { moveX: 1, jumpPressed: true, jumpHeld: true });
      for (let i = 0; i < 2; i++)
        a.advance(30, { moveX: 1, dashPressed: true, jumpHeld: true });
      for (let i = 0; i < 130 && !a.snapshot().grounded; i++)
        a.advance(1, { moveX: 1, jumpHeld: true });
      a.advance(ride);
      for (let i = 0; i < 200 && a.snapshot().x < 2555; i++)
        a.advance(1, { moveX: 1 });
      a.advance(28, { moveX: 1, jumpPressed: true, jumpHeld: true });
      for (let i = 0; i < 2; i++)
        a.advance(30, { moveX: 1, dashPressed: true, jumpHeld: true });
      let s = a.snapshot();
      for (let i = 0; i < 150; i++) {
        s = a.advance(1, { moveX: 1, jumpHeld: true });
        if (s.respawning || (s.grounded && s.x > 2725)) break;
      }
      results.push({
        ride,
        landed: s.grounded && !s.respawning && s.x > 2725,
        bone: s.treats.includes('moving-exit-refill'),
      });
    }
    return results;
  });
  for (const r of exits)
    expect(r, JSON.stringify(r)).toMatchObject({ landed: true, bone: true });
});
test('retries reset the challenge treats, birds, motion, companion and baseline charge', async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 440, y: 490 });
    a.advance(1);
    a.checkpoint('pizza-crossing');
    const initial = a.snapshot();
    for (const x of [5910, 6015]) {
      a.place({ x, y: 260 });
      a.advance(1);
    }
    const collected = a.snapshot();
    a.place({ x: 5780, y: 620 });
    a.advance(1);
    const failed = a.snapshot();
    const reset = a.advance(22);
    return { initial, collected, failed, reset };
  });
  expect(r.collected.treats).toEqual([
    'first-refill',
    'pizza-one',
    'pizza-two',
  ]);
  expect(r.failed.respawning).toBe(true);
  expect(r.reset).toMatchObject({
    x: 5650,
    y: 310,
    charges: 1,
    vx: 0,
    vy: 0,
    checkpoint: 'pizza-crossing',
    treats: ['first-refill'],
  });
  expect(r.reset.jimmy).toMatchObject({ x: 5635, y: 310 });
  expect(r.reset.balloons!.birds).toEqual(r.initial.balloons!.birds);
  expect(r.reset.machinery).toEqual(r.initial.machinery);
});
test('only Sophie collects treats or fails on sparrows; Jimmy recovers without changing her run', async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('pizza-crossing');
    a.place({ x: 5910, y: 260 }, true);
    a.advance(1);
    const treat = a.snapshot();
    const bird = treat.balloons!.birds[6]!;
    a.place({ x: bird.x, y: bird.y + 12 }, true);
    a.advance(1);
    const hit = a.snapshot();
    a.place({ x: 5950, y: 980 }, true);
    a.advance(2);
    const recovered = a.snapshot();
    const target = recovered.balloons!.birds[6]!;
    a.place({ x: target.x, y: target.y + 12 });
    const failed = a.advance(1);
    return { treat, hit, recovered, failed };
  });
  expect(r.treat.treats).toEqual([]);
  expect(r.treat.charges).toBe(1);
  expect(r.hit.respawning).toBe(false);
  expect(r.recovered.respawning).toBe(false);
  expect(r.recovered.jimmy!.recoveries).toBeGreaterThan(0);
  expect(r.failed.respawning).toBe(true);
});
test('final checkpoint frames both bones, birds, roof and marquee; three dashes clear where two fail', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => window.__sophie!.checkpoint('pizza-crossing'));
  const view = (await state(page)).balloons!.camera;
  const sign = balloons.balloons!.destination.sign;
  for (const item of balloons.treats.filter((b) => b.id.startsWith('pizza-'))) {
    expect(item.x).toBeGreaterThan(view.x);
    expect(item.x).toBeLessThan(view.x + view.width);
  }
  expect(sign.x + sign.width).toBeLessThan(view.x + view.width);
  expect(sign.y).toBeGreaterThanOrEqual(view.y);
  const result = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const n of [2, 3]) {
      a.loadLevel('balloons');
      a.checkpoint('pizza-crossing');
      for (let i = 0; i < 200 && a.snapshot().x < 5780; i++)
        a.advance(1, { moveX: 1 });
      a.advance(32, { moveX: 1, jumpPressed: true, jumpHeld: true });
      for (let i = 0; i < n; i++)
        a.advance(30, { moveX: 1, dashPressed: true, jumpHeld: true });
      let s = a.snapshot();
      for (let i = 0; i < 180; i++) {
        s = a.advance(1, { moveX: 1, jumpHeld: true });
        if (s.respawning || s.balloons!.phase !== 'balloons') break;
      }
      results.push({ n, failed: s.respawning, phase: s.balloons!.phase });
    }
    return results;
  });
  expect(result).toEqual([
    { n: 2, failed: true, phase: 'balloons' },
    { n: 3, failed: false, phase: 'landing' },
  ]);
});
test('roof landing owns input, plays the scent/dialogue/walk sequence, then ends and replays cleanly', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 6310, y: 450 });
    a.advance(1);
  });
  expect((await state(page)).balloons!.phase).toBe('landing');
  const phases = await page.evaluate(() => {
    const a = window.__sophie!,
      phases = [];
    for (let i = 0; i < 2000; i++) {
      const s = a.advance(1, {
        moveX: -1,
        jumpPressed: true,
        jumpHeld: true,
        dashPressed: true,
      });
      const sky = s.balloons!;
      if (phases.at(-1)?.phase !== sky.phase) phases.push(sky);
      if (s.ending) break;
    }
    return phases;
  });
  expect(phases.map((p) => p.phase)).toEqual([
    'landing',
    'scent',
    'smell',
    'beat',
    'pizza',
    'go',
    'walk',
    'empty',
    'fade',
    'complete',
  ]);
  expect(phases.filter((p) => p.line).map((p) => p.line)).toEqual([
    'Do you smell that!',
    "Pizza! It's pizza!",
    "Let's go!",
  ]);
  expect(phases.find((p) => p.phase === 'smell')!.scentMs).toBeGreaterThan(0);
  expect(phases.find((p) => p.phase === 'walk')!.animations.sophie).toBe(
    'walk',
  );
  expect(phases.find((p) => p.phase === 'empty')!.actors!.sophie.visible).toBe(
    false,
  );
  expect(phases.find((p) => p.phase === 'empty')!.actors!.jimmy.visible).toBe(
    false,
  );
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect
    .poll(async () => (await state(page)).levelId)
    .toBe('attic-escape');
  await expect(page.locator('.balloon-ui')).toHaveCount(0);
  await expect(page.locator('.balloon-finale')).toHaveCount(0);
});
test.describe('balloon level on mobile', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('supports multitouch and a keyboard, freezes on portrait/pause, and hides controls only for the finale', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('.pad-direction')).toHaveCount(4);
    await page.evaluate(() => window.__sophie!.manual(false));
    const pad = (await page.locator('.touch-pad').boundingBox())!;
    const jump = (await page
      .getByRole('button', { name: 'Jump', exact: true })
      .boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const before = await state(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { id: 1, x: pad.x + pad.width * 0.85, y: pad.y + pad.height / 2 },
        { id: 2, x: jump.x + jump.width / 2, y: jump.y + jump.height / 2 },
      ],
    });
    await expect
      .poll(async () => (await state(page)).y)
      .toBeLessThan(before.y - 10);
    await expect
      .poll(async () => (await state(page)).x)
      .toBeGreaterThan(before.x + 4);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.evaluate(() => {
      const a = window.__sophie!;
      a.manual(true);
      a.checkpoint('pizza-crossing');
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    const portrait = await state(page);
    await page.evaluate(() => window.__sophie!.advance(1000, { moveX: 1 }));
    expect((await state(page)).x).toBe(portrait.x);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.touch-controls')).toBeVisible();
    await page.evaluate(() => {
      const a = window.__sophie!;
      a.place({ x: 6310, y: 450 });
      a.advance(260);
    });
    await expect(page.locator('.balloon-ui .story-bubble')).toHaveAttribute(
      'aria-label',
      'sophie: Do you smell that!',
    );
    await expect(page.locator('.touch-controls')).toBeHidden();
    await page.keyboard.press('Escape');
    const paused = (await state(page)).balloons;
    await page.evaluate(() => window.__sophie!.advance(1000));
    expect((await state(page)).balloons).toEqual(paused);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    expect((await state(page)).balloons!.phase).toBe('balloons');
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('.balloon-ui')).toHaveCount(1);
    await page.evaluate(() => window.__sophie!.manual(false));
    await page.keyboard.down('Space');
    await expect.poll(async () => (await state(page)).y).toBeLessThan(540);
    await page.keyboard.up('Space');
  });
});
