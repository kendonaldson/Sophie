import { expect, test, type Page } from '@playwright/test';
import type { PlayerIntent } from '../src/game/input/Input';
import type { GameSnapshot } from '../src/game/scenes/TestApi';
async function boot(page: Page, manual = false) {
  await page.goto('/?test');
  await page.waitForFunction(() => Boolean(window.__sophie));
  if (manual)
    await page.evaluate(() => {
      window.__sophie!.manual(true);
      window.__sophie!.restart();
    });
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.__sophie!.snapshot());
const advance = (
  page: Page,
  frames: number,
  intent: Partial<PlayerIntent> = {},
) =>
  page.evaluate(
    ({ frames, intent }) => window.__sophie!.advance(frames, intent),
    { frames, intent },
  );
async function runTo(page: Page, x: number) {
  return page.evaluate((target) => {
    const a = window.__sophie!;
    for (let i = 0; i < 1000 && a.snapshot().x < target; i++)
      a.advance(1, { moveX: 1 });
    if (a.snapshot().x < target)
      throw new Error(
        `Could not reach ${target}: ${JSON.stringify(a.snapshot())}`,
      );
    return a.snapshot();
  }, x);
}
async function reachFinalRoof(page: Page, dashStart = 2140, dashFrames = 12) {
  await advance(page, 70);
  await runTo(page, 407);
  await advance(page, 80, { moveX: 1, jumpPressed: true, jumpHeld: true });
  await runTo(page, 657);
  await advance(page, 80, { moveX: 1, jumpPressed: true, jumpHeld: true });
  await runTo(page, 939);
  await advance(page, 80, { moveX: 1, jumpPressed: true, jumpHeld: true });
  await runTo(page, 1366);
  await advance(page, 15, { moveX: 1, jumpPressed: true, jumpHeld: true });
  await advance(page, 21, { moveX: 1, dashPressed: true, jumpHeld: true });
  let s = await advance(page, 50, { moveX: 1, jumpHeld: true });
  expect(s.grounded).toBe(true);
  expect(s.x).toBeGreaterThan(1540);
  await runTo(page, 1788);
  await expect(
    page.getByRole('heading', { name: 'High jump', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.tutorial-card')).toContainText(
    'While rising, hold ↑ and press X.',
  );
  await advance(page, 22, { moveX: 1, jumpPressed: true, jumpHeld: true });
  await advance(page, 21, { aimY: -1, dashPressed: true, jumpHeld: true });
  s = await advance(page, 45, { moveX: 1, jumpHeld: true });
  expect(s.y).toBeLessThan(388);
  expect(s.checkpoint).toBe('high');
  await runTo(page, dashStart);
  await expect(
    page.getByRole('heading', { name: 'Long jump', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.tutorial-card')).toContainText(
    'Immediately press and hold Z / Space to jump.',
  );
  await advance(page, dashFrames, { moveX: 1, dashPressed: true });
  s = await advance(page, 76, { moveX: 1, jumpPressed: true, jumpHeld: true });
  expect(s.vx).toBeGreaterThan(s.physics.maxRunSpeed);
  expect(s.checkpoint).toBe('long');
  await runTo(page, 2746);
  s = await snapshot(page);
  expect(s.charges).toBe(1);
  expect(s.checkpoint).toBe('combo');
  await expect(page.locator('.tutorial-card')).toBeHidden();
}
test('first long-jump gap allows earlier takeoff and varied dash-to-jump timing', async ({
  page,
}) => {
  await boot(page, true);
  for (const [dashStart, dashFrames] of [
    [2110, 12],
    [2140, 6],
    [2140, 18],
  ]) {
    await page.evaluate(() => window.__sophie!.restart());
    await reachFinalRoof(page, dashStart, dashFrames);
    const landed = await snapshot(page);
    expect(landed.grounded).toBe(true);
    expect(landed.checkpoint).toBe('combo');
  }
});
test('loads Level 1 without console errors; real keyboard movement, jump, dash, pause', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await boot(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#dash-hud')).toHaveAttribute(
    'aria-label',
    /1 of 2/,
  );
  const start = await snapshot(page);
  expect(start.levelId).toBe('attic-escape');
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await snapshot(page)).x)
    .toBeGreaterThan(start.x + 18);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('KeyZ');
  await expect
    .poll(async () => (await snapshot(page)).y)
    .toBeLessThan(start.y - 15);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await snapshot(page)).charges).toBe(0);
  await page.keyboard.up('KeyZ');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'A little breather.' }),
  ).toBeVisible();
  const paused = await snapshot(page);
  await page.waitForTimeout(100);
  expect((await snapshot(page)).x).toBe(paused.x);
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect.poll(async () => (await snapshot(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});
test('full route uses high jump, long jump, treat recharge, second dash, factory ending', async ({
  page,
}) => {
  await boot(page, true);
  await page.keyboard.press('ArrowRight');
  const music = page.locator('audio');
  await expect
    .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(0);
  await music.evaluate((a: HTMLAudioElement) => {
    a.currentTime = 20;
  });
  await reachFinalRoof(page);
  await advance(page, 24, { moveX: 1, jumpPressed: true, jumpHeld: true });
  let s = await advance(page, 21, {
    moveX: 1,
    aimY: -1,
    dashPressed: true,
    jumpHeld: true,
  });
  expect(s.charges).toBe(0);
  expect(s.grounded).toBe(false);
  s = await advance(page, 40, { moveX: 1, jumpHeld: true });
  expect(s.treats).toContain('crossing-treat');
  expect(s.charges).toBe(1);
  expect(s.grounded).toBe(false);
  s = await advance(page, 21, { moveX: 1, dashPressed: true, jumpHeld: true });
  expect(s.charges).toBe(0);
  s = await advance(page, 70, { moveX: 1, jumpHeld: true });
  expect(s.grounded).toBe(true);
  expect(s.x).toBeGreaterThan(3100);
  await runTo(page, 3430);
  await advance(page, 110, { moveX: 1 });
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible();
  expect(
    await page
      .locator('#overlay')
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe('rgb(0, 0, 0)');
  const end = await snapshot(page);
  await expect(music).toHaveJSProperty('paused', true);
  await advance(page, 100, { moveX: 1, jumpPressed: true, dashPressed: true });
  expect((await snapshot(page)).x).toBe(end.x);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(music).toHaveJSProperty('paused', false);
  expect(
    await music.evaluate((a: HTMLAudioElement) => a.currentTime),
  ).toBeLessThan(5);
  s = await advance(page, 1);
  expect(s.x).toBe(160);
  expect(s.charges).toBe(1);
  expect(s.ending).toBe(false);
});
test('missing the final treat gives no airborne recharge and quickly returns to safe anchor', async ({
  page,
}) => {
  await boot(page, true);
  await reachFinalRoof(page);
  await advance(page, 24, { moveX: 1, jumpPressed: true, jumpHeld: true });
  let s = await advance(page, 21, {
    moveX: 1,
    dashPressed: true,
    jumpHeld: true,
  });
  expect(s.charges).toBe(0);
  let airFrames = 0;
  for (let i = 0; i < 240; i++) {
    s = await advance(page, 1, { moveX: 1, dashPressed: i === 40 });
    if (s.respawning) break;
    expect(s.charges).toBe(0);
    expect(s.grounded).toBe(false);
    airFrames++;
  }
  expect(airFrames).toBeGreaterThan(100);
  expect(s.respawning).toBe(true);
  expect(s.treats).not.toContain('crossing-treat');
  s = await advance(page, 24);
  expect(s.x).toBe(2570);
  expect(s.y).toBe(388);
  expect(s.vx).toBe(0);
  expect(s.vy).toBe(0);
  expect(s.charges).toBe(1);
  expect(s.respawning).toBe(false);
});
test('collected traversal treat returns after a failed attempt', async ({
  page,
}) => {
  await boot(page, true);
  await reachFinalRoof(page);
  await advance(page, 24, { moveX: 1, jumpPressed: true, jumpHeld: true });
  await advance(page, 21, {
    moveX: 1,
    aimY: -1,
    dashPressed: true,
    jumpHeld: true,
  });
  let s = await advance(page, 40, { moveX: 1, jumpHeld: true });
  expect(s.treats).toContain('crossing-treat');
  await advance(page, 190);
  s = await advance(page, 24);
  expect(s.checkpoint).toBe('combo');
  expect(s.treats).not.toContain('crossing-treat');
  expect(s.charges).toBe(1);
});
test('resize leaves physics unchanged and keeps the world sharp and DOM HUD usable', async ({
  page,
}) => {
  await boot(page, true);
  const results: GameSnapshot[] = [];
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__sophie!.restart());
    await advance(page, 70);
    await advance(page, 30, { moveX: 1, jumpPressed: true, jumpHeld: true });
    results.push(await snapshot(page));
    const canvas = page.locator('canvas');
    expect(
      await canvas.evaluate((c) => getComputedStyle(c).imageRendering),
    ).toMatch(/pixelated|crisp-edges/);
    expect(
      await canvas.evaluate(
        (c) => (c as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled,
      ),
    ).toBe(false);
    await expect(page.locator('#dash-hud')).toBeVisible();
    const hud = await page.locator('#dash-hud').boundingBox();
    expect(hud!.x).toBeGreaterThanOrEqual(0);
    expect(hud!.x + hud!.width).toBeLessThanOrEqual(viewport.width);
    const sizing = await canvas.evaluate((c) => {
      const a = c as HTMLCanvasElement,
        r = c.getBoundingClientRect();
      return { x: r.width / a.width, y: r.height / a.height };
    });
    expect(sizing.x).toBeCloseTo(sizing.y, 2);
  }
  for (const result of results.slice(1)) {
    expect(result.physics).toEqual(results[0]!.physics);
    expect(result.x).toBeCloseTo(results[0]!.x, 5);
    expect(result.y).toBeCloseTo(results[0]!.y, 5);
    expect(result.vx).toBeCloseTo(results[0]!.vx, 5);
  }
});
