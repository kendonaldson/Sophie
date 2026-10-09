import { test, expect, devices, type Page } from '@playwright/test';
import { chaseTuning as t } from '../src/game/chase/config';
async function openChase(page: Page) {
  await page.goto('/?test&level=the-chase#debug');
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'the-chase',
  );
  await page.evaluate(() => {
    window.__sophie!.manual(true);
    window.__sophie!.restart();
  });
}
const state = (page: Page) => page.evaluate(() => window.__sophie!.snapshot());
const tick = (page: Page, ms: number) =>
  page.evaluate(
    (ms) => window.__sophie!.advance(Math.ceil(ms / (1000 / 120))),
    ms,
  );
test('chase starts running, supports keyboard jumping/dashing, and advances independently of Sophie', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openChase(page);
  const start = await state(page);
  expect(start.vx).toBe(180);
  expect(start.jimmy!.vx).toBe(180);
  expect(start.intro).toBe(false);
  expect(start.chase!.enabled).toBe(true);
  await expect(page.locator('.chase-ui p')).toHaveText(
    "Run, Jimmy, or we'll be caught!",
  );
  await page.evaluate(() => window.__sophie!.advance(12));
  expect((await state(page)).jimmy!.vx).toBe(180);
  await page.evaluate(() => window.__sophie!.manual(false));
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyZ');
  await expect.poll(async () => (await state(page)).y).toBeLessThan(410);
  await page.keyboard.down('ArrowUp');
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await state(page)).charges).toBe(0);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('KeyZ');
  await page.keyboard.up('ArrowRight');
  await page.evaluate(() => {
    window.__sophie!.manual(true);
    window.__sophie!.restart();
  });
  const stopped = await tick(page, 900);
  const later = await tick(page, 100);
  expect(later.x).toBeCloseTo(stopped.x);
  expect(later.chase!.x).toBeGreaterThan(stopped.chase!.x);
  expect(later.characters.sort()).toEqual(['Jimmy', 'sophie'].sort());
  expect(errors).toEqual([]);
});
test('the bulldozer checkpoint restores camera, both dogs, bones, charges and later dialogue on every retry', async ({
  page,
}) => {
  await openChase(page);
  await page.evaluate(() => {
    const api = window.__sophie!;
    api.chaseSection(4430);
    api.advance(1, { moveX: 1 });
    api.advance(30, { moveX: 1, jumpPressed: true, jumpHeld: true });
    for (let i = 0; i < 3; i++)
      api.advance(24, {
        moveX: 1,
        aimY: -1,
        dashPressed: true,
        jumpHeld: true,
      });
  });
  expect((await state(page)).treats).toHaveLength(2);
  expect((await state(page)).checkpoint).toBe('before-bulldozer');
  await page.evaluate(() => {
    const a = window.__sophie!,
      s = a.snapshot();
    a.place({ x: s.chase!.boundary, y: 420 });
    a.advance(1);
  });
  expect((await state(page)).respawning).toBe(true);
  const reset = await tick(page, 190);
  expect(reset.chase!.attempts).toBe(1);
  expect(reset.x).toBeGreaterThanOrEqual(4200);
  expect(reset.x).toBeLessThan(4205);
  expect(reset.jimmy!.x).toBeGreaterThanOrEqual(4146);
  expect(reset.jimmy!.x).toBeLessThan(4151);
  expect(reset.chase!.x).toBeGreaterThanOrEqual(3910);
  expect(reset.chase!.x).toBeLessThan(3913);
  expect(reset.chase!.speed).toBe(156);
  expect(reset.charges).toBe(1);
  expect(reset.treats).toEqual([]);
  expect(reset.checkpoint).toBe('before-bulldozer');
  expect(reset.jimmy!.recoveries).toBe(0);
  expect(reset.chase!.nextCall).toBe(3);
  expect(reset.chase!.line).toBeUndefined();
  await expect(page.locator('#section')).toHaveText('Over the top');
  await expect(page.locator('#hint')).toContainText('Catch each bone');
  // Pits and keyboard retries retain the same earned checkpoint.
  await page.evaluate(() => {
    window.__sophie!.place({ x: 4300, y: 660 });
    window.__sophie!.advance(1);
  });
  const fall = await tick(page, 190);
  expect(fall.x).toBeGreaterThanOrEqual(4200);
  expect(fall.x).toBeLessThan(4205);
  expect(fall.chase!.attempts).toBe(2);
  await page.keyboard.press('KeyR');
  const retry = await tick(page, 190);
  expect(retry.checkpoint).toBe('before-bulldozer');
  expect(retry.chase!.attempts).toBe(3);
  expect(retry.x).toBeLessThan(4205);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  const restarted = await state(page);
  expect(restarted.checkpoint).toBe('spawn');
  expect(restarted.x).toBe(180);
  expect(restarted.chase!.attempts).toBe(0);
});
test('failures before reaching the runway still retry the opening of the chase', async ({
  page,
}) => {
  await openChase(page);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.chaseSection(3000);
    a.advance(1);
    a.place({ x: 3000, y: 660 });
    a.advance(1);
  });
  const reset = await tick(page, 190);
  expect(reset.checkpoint).toBe('spawn');
  expect(reset.x).toBeLessThan(185);
  expect(reset.jimmy!.x).toBeLessThan(170);
  expect(reset.chase!.x).toBeLessThan(3);
  expect(reset.chase!.speed).toBe(134);
  expect(reset.chase!.nextCall).toBe(0);
  expect(reset.chase!.line).toBe("Run, Jimmy, or we'll be caught!");
});
test('Jimmy recovers from a missed jump and a stuck position without stealing bones or failing the player', async ({
  page,
}) => {
  await openChase(page);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.chaseSection(4430);
    a.advance(30, { moveX: 1, jumpPressed: true, jumpHeld: true });
    a.place({ x: 4000, y: 700 }, true);
    a.advance(1, { moveX: 1, jumpHeld: true });
  });
  let s = await state(page);
  expect(s.jimmy!.recoveries).toBeGreaterThan(0);
  expect(s.respawning).toBe(false);
  expect(s.chase!.attempts).toBe(0);
  expect(s.charges).toBe(1);
  expect(s.treats).toEqual([]);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 4510, y: 322 }, true);
    a.advance(1, { moveX: 1, jumpHeld: true });
  });
  s = await state(page);
  expect(s.treats).toEqual([]);
  expect(s.charges).toBe(1);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.chaseSection(6750);
    a.place({ x: 5900, y: 420 }, true);
    a.advance(1, { moveX: 1 });
  });
  s = await state(page);
  expect(s.respawning).toBe(false);
  expect(s.chase!.phase).toBe('settle');
});
test('the earned checkpoint repeatedly provides a playable bulldozer approach for keyboard and touch timing', async ({
  page,
}) => {
  await openChase(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!;
    a.chaseSection(4100);
    a.advance(1, { moveX: 1 });
    const results = [];
    for (const dashSource of [undefined, 'touch'] as const) {
      for (let attempt = 0; attempt < 2; attempt++) {
        a.place({ x: a.snapshot().x, y: 660 });
        a.advance(1);
        const retry = a.advance(22);
        a.advance(154, { moveX: 1 });
        a.advance(30, { moveX: 1, jumpPressed: true, jumpHeld: true });
        for (let i = 0; i < 3; i++)
          a.advance(24, {
            moveX: 1,
            aimY: -1,
            jumpHeld: true,
            dashPressed: true,
            dashSource,
          });
        const landed = a.advance(70, { moveX: 1, jumpHeld: true });
        results.push({ retry, landed });
      }
    }
    return results;
  });
  for (const { retry, landed } of results) {
    expect(retry.checkpoint).toBe('before-bulldozer');
    expect(retry.x).toBe(4200);
    expect(retry.charges).toBe(1);
    expect(retry.treats).toEqual([]);
    expect(retry.jimmy!.vx).toBe(180);
    expect(landed.grounded).toBe(true);
    expect(landed.x).toBeGreaterThan(4680);
    expect(landed.y).toBe(184);
    expect(landed.treats).toHaveLength(2);
    expect(landed.characters.sort()).toEqual(['Jimmy', 'sophie'].sort());
  }
});
test('real physics clears the bulldozer with both bone refills across forgiving dash timings', async ({
  page,
}) => {
  await openChase(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const dashSource of [undefined, 'touch'] as const)
      for (const takeoff of [4420, 4430, 4440])
        for (const wait of [26, 30, 34])
          for (const interval of [22, 26, 30]) {
            a.restart();
            a.chaseSection(takeoff - 30);
            a.advance(26, { moveX: 1 });
            a.advance(wait, { moveX: 1, jumpHeld: true, jumpPressed: true });
            for (let i = 0; i < 3; i++)
              a.advance(interval, {
                moveX: 1,
                aimY: -1,
                jumpHeld: true,
                dashPressed: true,
                dashSource,
              });
            const s = a.advance(70, { moveX: 1, jumpHeld: true });
            results.push({
              dashSource,
              takeoff,
              wait,
              interval,
              landed: s.grounded && s.x > 4680 && s.y === 184,
              bones: s.treats.length,
            });
          }
    return results;
  });
  for (const r of results) {
    expect(r.landed, JSON.stringify(r)).toBe(true);
    expect(r.bones).toBe(2);
  }
  for (const dashes of [0, 1, 2]) {
    const s = await page.evaluate((dashes) => {
      const a = window.__sophie!;
      a.restart();
      a.chaseSection(4430);
      a.advance(30, { moveX: 1, jumpHeld: true, jumpPressed: true });
      for (let i = 0; i < dashes; i++)
        a.advance(24, {
          moveX: 1,
          aimY: -1,
          jumpHeld: true,
          dashPressed: true,
        });
      return a.advance(80, { moveX: 1, jumpHeld: true });
    }, dashes);
    expect(s.x).toBeLessThan(4680);
    expect(s.y).toBeGreaterThan(184);
  }
});
test('only the dead end stops scrolling, launches both dogs upward, and enters Level 4 after the off-screen joke', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openChase(page);
  await page.keyboard.press('KeyA');
  await expect(page.locator('audio')).toHaveJSProperty('paused', false);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.chaseSection(6680);
    a.place({ x: 6730, y: 250 });
    a.advance(1);
  });
  expect((await state(page)).chase!.phase).toBe('chase');
  await page.evaluate(() => {
    window.__sophie!.chaseSection(6730);
    window.__sophie!.advance(1);
  });
  const stopped = await state(page);
  expect(stopped.chase!.enabled).toBe(false);
  expect(stopped.chase!.phase).toBe('settle');
  const music = page.locator('audio');
  await expect(music).toHaveJSProperty('paused', false);
  await expect(music).toHaveJSProperty('volume', 0.5);
  await tick(page, t.musicFadeMs / 2);
  const volume = await music.evaluate((a: HTMLAudioElement) => a.volume);
  expect(volume).toBeGreaterThan(0);
  expect(volume).toBeLessThan(0.5);
  await page.keyboard.press('Escape');
  await tick(page, 1000);
  await expect(music).toHaveJSProperty('volume', volume);
  await page.keyboard.press('Escape');
  await tick(page, t.musicFadeMs / 2 + 10);
  await expect(music).toHaveJSProperty('volume', 0);
  await expect(music).toHaveJSProperty('paused', true);
  expect((await state(page)).chase!.phase).toBe('settle');
  await page.keyboard.press('KeyA');
  await expect(music).toHaveJSProperty('paused', true);
  await tick(page, t.settleMs - t.musicFadeMs + 10);
  await expect(page.locator('.chase-ui p')).toHaveText('Gotcha.');
  await expect(page.locator('.chase-ui .story-bubble')).toHaveAttribute(
    'data-speaker',
    'offscreen',
  );
  await tick(page, t.gotchaMs + t.quietMs);
  await expect(page.locator('.chase-ui p')).toHaveText(
    "Okay, let's get you two home.",
  );
  expect((await state(page)).chase!.x).toBe(stopped.chase!.x);
  await tick(page, t.homeMs + t.lookMs + t.crouchMs);
  const jump = (await state(page)).chase!.combinedJump!;
  expect(jump.visible).toBe(true);
  expect(jump.texture).toBe('sophie-jimmy-super-jump');
  expect(jump.frame).toBeGreaterThanOrEqual(3);
  await tick(page, t.launchMs);
  const empty = await state(page);
  expect(empty.chase!.phase).toBe('empty');
  expect(empty.y + 6).toBeLessThan(120);
  expect(empty.jimmy!.y + 6).toBeLessThan(120);
  await expect(page.locator('.chase-ui .story-bubble')).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  await tick(page, t.emptyMs);
  await expect(page.locator('.chase-ui p')).toHaveText('WHAT IN THE WORLD?!');
  expect((await state(page)).characters.sort()).toEqual(
    ['Jimmy', 'sophie'].sort(),
  );
  await tick(page, t.punchlineMs + t.fadeMs + 20);
  expect((await state(page)).levelId).toBe('skyscraper');
  expect((await state(page)).intro).toBe(true);
  expect((await state(page)).y).toBeGreaterThan(4400);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  await expect(music).toHaveAttribute('src', /city-lights-above.mp3$/);
  await expect(music).toHaveJSProperty('volume', 0.5);
  await expect(music).toHaveJSProperty('paused', false);
  await tick(page, 1100);
  expect((await state(page)).grounded).toBe(true);
  await expect(page.locator('.chase-ui')).toHaveCount(0);
  await expect(page.locator('#app')).not.toHaveClass(/chase/);
  expect(errors).toEqual([]);
});
test.describe('mobile chase', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('the earned bulldozer retry keeps the tutorial and controls, and pauses safely in portrait', async ({
    page,
  }) => {
    await openChase(page);
    await page.evaluate(() => {
      const a = window.__sophie!;
      a.chaseSection(4100);
      a.advance(1);
      a.place({ x: 4300, y: 660 });
      a.advance(1);
    });
    const retry = await tick(page, 190);
    expect(retry.checkpoint).toBe('before-bulldozer');
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('#hint')).toContainText('Catch each bone');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    const paused = await tick(page, 1500);
    expect(paused.chase).toEqual(retry.chase);
    expect(paused.x).toBe(retry.x);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.touch-controls')).toBeVisible();
    const running = await page.evaluate(() =>
      window.__sophie!.advance(40, { moveX: 1 }),
    );
    expect(running.x).toBeGreaterThan(retry.x);
    expect(running.respawning).toBe(false);
    expect(running.checkpoint).toBe('before-bulldozer');
  });
  test('keeps the full-axis four-arrow controller, freezes in portrait and hides input at the finale', async ({
    page,
  }) => {
    await openChase(page);
    await expect(page.locator('.pad-direction')).toHaveCount(4);
    await expect(page.locator('.touch-controls')).toBeVisible();
    const s = await state(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('heading', { name: 'Rotate your device to play' }),
    ).toBeVisible();
    await tick(page, 1000);
    expect((await state(page)).chase).toEqual(s.chase);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    await tick(page, 200);
    expect((await state(page)).chase!.x).toBeGreaterThan(s.chase!.x);
    await page.evaluate(() => {
      window.__sophie!.chaseSection(6730);
      window.__sophie!.advance(1);
    });
    await expect(page.locator('.touch-controls')).toBeHidden();
    await tick(page, 11000);
    expect((await state(page)).levelId).toBe('skyscraper');
    await expect(
      page.getByRole('heading', { name: 'TO BE CONTINUED' }),
    ).toHaveCount(0);
    await expect(page.locator('.touch-controls')).toBeVisible();
  });
});
