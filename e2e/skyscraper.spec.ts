import { test, expect, devices, type Page } from '@playwright/test';
import { climbTuning as t } from '../src/game/skyscraper/config';
const state = (page: Page) => page.evaluate(() => window.__sophie!.snapshot());
async function open(page: Page) {
  await page.goto('/?test&level=skyscraper#debug');
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'skyscraper',
  );
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.manual(true);
    a.loadLevel('skyscraper');
  });
}
test('arrives from below, restores ordinary keyboard control, and keeps desktop free of touch UI', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const start = await state(page);
  expect(start.intro).toBe(true);
  expect(start.y).toBeGreaterThan(4400);
  expect(start.jimmy!.y).toBeGreaterThan(4400);
  const landed = await page.evaluate(() => window.__sophie!.advance(110));
  expect(landed.intro).toBe(false);
  expect(landed.grounded).toBe(true);
  expect(landed.y).toBe(4300);
  expect(landed.charges).toBe(1);
  expect(landed.jimmy!.enabled).toBe(true);
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await page.evaluate(() => window.__sophie!.manual(false));
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyZ');
  await expect.poll(async () => (await state(page)).y).toBeLessThan(4290);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('KeyZ');
  expect(errors).toEqual([]);
});
test('bone chains and the straight-up ladder clear with shared physics across desktop and touch timing windows', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const r of [
      {
        cp: 'first-chain',
        x: 1599,
        y: 3940,
        dir: 1 as const,
        n: 2,
        end: 3770,
        bones: ['first-chain-bone'],
        vertical: false,
      },
      {
        cp: 'west-chain',
        x: 2001,
        y: 3430,
        dir: -1 as const,
        n: 3,
        end: 3194,
        bones: ['west-chain-one', 'west-chain-two'],
        vertical: false,
      },
      {
        cp: 'last-chain',
        x: 1789,
        y: 2070,
        dir: 1 as const,
        n: 3,
        end: 1834,
        bones: ['bird-chain-one', 'bird-chain-two'],
        vertical: false,
      },
      {
        cp: 'vertical-ladder',
        x: 865,
        y: 3020,
        dir: -1 as const,
        n: 3,
        end: 2740,
        bones: ['ladder-one', 'ladder-two'],
        vertical: true,
      },
    ])
      for (const dashSource of [undefined, 'touch'] as const)
        for (const wait of [26, 30, 34])
          for (const interval of [22, 26, 30]) {
            a.checkpoint(r.cp);
            a.place({ x: r.vertical ? r.x : r.x - r.dir * 30, y: r.y });
            a.advance(r.vertical ? 2 : 26, { moveX: r.vertical ? 0 : r.dir });
            a.advance(wait, {
              moveX: r.vertical ? 0 : r.dir,
              jumpPressed: true,
              jumpHeld: true,
            });
            for (let i = 0; i < r.n; i++)
              a.advance(interval, {
                moveX: r.vertical && i < 2 ? 0 : r.dir,
                aimY: -1,
                jumpHeld: true,
                dashPressed: true,
                dashSource,
              });
            const s = a.advance(r.vertical ? 65 : 60, {
              moveX: r.dir,
              jumpHeld: true,
            });
            results.push({
              cp: r.cp,
              dashSource,
              wait,
              interval,
              landed: s.grounded && s.y === r.end,
              bones: r.bones.every((b) => s.treats.includes(b)),
              charges: s.charges,
            });
          }
    return results;
  });
  for (const r of results) {
    expect(r.landed, JSON.stringify(r)).toBe(true);
    expect(r.bones).toBe(true);
    expect(r.charges).toBeLessThanOrEqual(2);
  }
});
test('retries restore the current chain, deterministic birds and cargo, and baseline resources without losing earlier progress', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('first-chain');
    a.place({ x: 1680, y: 3840 });
    a.advance(1);
    a.checkpoint('west-chain');
    const initial = a.snapshot();
    for (const p of [
      { x: 1920, y: 3330 },
      { x: 1855, y: 3265 },
    ]) {
      a.place(p);
      a.advance(1);
    }
    const collected = a.snapshot();
    a.advance(60);
    a.place({ x: 1900, y: a.snapshot().climb!.fallBoundary + 10 });
    a.advance(1);
    const failed = a.snapshot();
    const reset = a.advance(22);
    return { initial, collected, failed, reset };
  });
  expect(result.collected.treats).toEqual([
    'first-chain-bone',
    'west-chain-one',
    'west-chain-two',
  ]);
  expect(result.collected.charges).toBe(2);
  expect(result.failed.respawning).toBe(true);
  expect(result.reset.checkpoint).toBe('west-chain');
  expect(result.reset.treats).toEqual(['first-chain-bone']);
  expect(result.reset.charges).toBe(1);
  expect(result.reset.vx).toBe(0);
  expect(result.reset.vy).toBe(0);
  expect(result.reset.climb!.birds).toEqual(result.initial.climb!.birds);
  expect(result.reset.machinery).toEqual(result.initial.machinery);
});
test('both construction lifts board the pair, advance the safe floor, and preserve leftward companion recovery', async ({
  page,
}) => {
  await open(page);
  for (const [cp, lift, destination, section, frames, bottom] of [
    ['first-lift', 'east-lift', 'west-chain', 1, 446, 3540],
    ['west-lift', 'west-hoist', 'bird-introduction', 2, 470, 2410],
  ] as const) {
    const board = await page.evaluate(
      ({ cp, lift }) => {
        const a = window.__sophie!;
        a.checkpoint(cp);
        a.platform(lift);
        return a.advance(1);
      },
      { cp, lift },
    );
    expect(board.climb!.phase).toBe('boarding');
    const arrived = await page.evaluate(
      (n) => window.__sophie!.advance(n),
      frames,
    );
    expect(arrived.checkpoint).toBe(destination);
    expect(arrived.climb!.section).toBe(section);
    expect(arrived.climb!.phase).toBe('climb');
    expect(Math.abs(arrived.jimmy!.y - arrived.y)).toBeLessThan(30);
    await expect
      .poll(async () => (await state(page)).climb!.camera.y + t.viewHeight)
      .toBeLessThan(bottom + 1);
    const recovered = await page.evaluate(() => {
      const a = window.__sophie!;
      a.place({ x: 50, y: 4400 }, true);
      return a.advance(1);
    });
    expect(recovered.respawning).toBe(false);
    expect(recovered.jimmy!.recoveries).toBeGreaterThan(0);
    const reset = await page.evaluate(() => {
      const a = window.__sophie!;
      a.place({ x: 1500, y: 4400 });
      a.advance(1);
      return a.advance(22);
    });
    expect(reset.checkpoint).toBe(destination);
    expect(reset.climb!.section).toBe(section);
    expect(reset.y).toBeLessThan(bottom);
  }
});
test('birds ignore Jimmy, squash no player resources, and only Sophie contact triggers the quick retry', async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('bird-introduction');
    const bird = a.snapshot().climb!.birds[0]!;
    a.place({ x: bird.x, y: bird.y + 12 }, true);
    const jimmy = a.advance(1);
    a.place({ x: bird.x, y: bird.y + 12 });
    const hit = a.advance(1);
    const frozen = a.advance(10);
    const reset = a.advance(12);
    return { jimmy, hit, frozen, reset };
  });
  expect(r.jimmy.respawning).toBe(false);
  expect(r.jimmy.charges).toBe(1);
  expect(r.jimmy.treats).toEqual([]);
  expect(r.hit.respawning).toBe(true);
  expect(r.hit.climb!.birds[0]!.hit).toBe(true);
  expect(r.hit.climb!.birds[0]!.frame).toBe(8);
  expect(r.frozen.climb!.birds).toEqual(r.hit.climb!.birds);
  expect(r.reset.respawning).toBe(false);
  expect(r.reset.checkpoint).toBe('bird-introduction');
  expect(r.reset.charges).toBe(1);
});
test('bird flight poses follow their travel direction and replay on retry', async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('bird-introduction');
    const initial = a.snapshot().climb!.birds;
    const later = a.advance(1200).climb!.birds;
    a.checkpoint('bird-introduction');
    return { initial, later, replayed: a.advance(1200).climb!.birds };
  });
  expect(r.initial[0]!.direction).toBe(1);
  expect(r.later[0]!.direction).toBe(-1);
  for (const b of r.later)
    expect(b.direction === 1 ? [0, 1, 2, 3] : [4, 5, 6, 7]).toContain(b.frame);
  expect(r.replayed).toEqual(r.later);
});
test('final lift holds the city view, fades into Interlude 2, and cleans up gameplay', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.keyboard.press('KeyA');
  const music = page.locator('audio');
  await expect(music).toHaveAttribute('src', /city-lights-above.mp3$/);
  await expect(music).toHaveJSProperty('loop', true);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('summit-lift');
    a.platform('summit-hoist');
    a.advance(1);
    a.advance(700);
  });
  const ride = await state(page);
  expect(ride.climb!.phase).toBe('riding');
  expect(ride.y).toBeLessThan(1834);
  expect(ride.y).toBeGreaterThan(490);
  await expect(music).toHaveJSProperty('volume', 0.5);
  await expect(music).toHaveJSProperty('paused', false);
  await page.evaluate(() => window.__sophie!.advance(405));
  expect((await state(page)).climb!.phase).toBe('view');
  expect((await state(page)).y).toBe(490);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  await page.evaluate(() => window.__sophie!.advance(270));
  expect((await state(page)).climb!.phase).toBe('fade');
  const volume = await music.evaluate((a: HTMLAudioElement) => a.volume);
  expect(volume).toBeGreaterThan(0);
  expect(volume).toBeLessThan(0.5);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__sophie!.advance(100));
  await expect(music).toHaveJSProperty('volume', volume);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__sophie!.advance(150));
  await page.waitForFunction(
    () => window.__sophieStory?.snapshot().storyId === 'interlude-2',
  );
  expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.locator('.story-ui')).toHaveCount(1);
  await expect(page.locator('#app')).not.toHaveClass(/climb-scripted/);
  expect(errors).toEqual([]);
});
test.describe('mobile skyscraper', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('uses four arrows with full-axis touch, freezes birds and lifts in portrait, and restores input after boarding', async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => window.__sophie!.advance(110));
    await expect(page.locator('.pad-direction')).toHaveCount(4);
    await expect(page.locator('.touch-controls')).toBeVisible();
    await page.evaluate(() => window.__sophie!.checkpoint('bird-introduction'));
    const before = await state(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    await page.evaluate(() => window.__sophie!.advance(120));
    expect((await state(page)).climb!.birds).toEqual(before.climb!.birds);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.touch-controls')).toBeVisible();
    await page.evaluate(() => {
      const a = window.__sophie!;
      a.checkpoint('first-lift');
      a.platform('east-lift');
      a.advance(1);
    });
    await expect(page.locator('.touch-controls')).toBeHidden();
    await page.evaluate(() => window.__sophie!.advance(446));
    await expect(page.locator('.touch-controls')).toBeVisible();
    expect((await state(page)).physics).toEqual(before.physics);
  });
});
