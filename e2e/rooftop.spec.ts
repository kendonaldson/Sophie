import { test, expect, devices, type Page } from '@playwright/test';
import { interlude2 as c, rooftopLines } from '../src/game/story/interlude2';
const snapshot = (page: Page) =>
  page.evaluate(() => window.__sophieStory!.snapshot());
const tick = (page: Page, ms: number) =>
  page.evaluate((ms) => window.__sophieStory!.tick(ms), ms);
async function open(page: Page) {
  await page.goto('/?test#debug');
  await page
    .getByRole('combobox', { name: 'Debug level' })
    .selectOption('interlude-2');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.waitForFunction(
    () => window.__sophieStory?.snapshot().storyId === 'interlude-2',
  );
  await page.evaluate(() => window.__sophieStory!.manual(true));
  await tick(page, c.arrivalMs + c.stepOffMs + c.minimumLineMs);
}
async function next(page: Page) {
  await tick(page, c.minimumLineMs);
  await page.keyboard.press('KeyX');
  const state = await snapshot(page);
  if (state.phase === 'pause')
    await tick(page, rooftopLines[state.index + 1]!.pauseBeforeMs!);
  if (state.phase === 'edge-walk') await tick(page, c.edgeWalkMs);
}
test('rooftop dialogue, real sleep poses, daylight balloons, combined jump, ending and replay', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const night = await snapshot(page);
  expect(night.environment).toBe('night');
  expect(night.animations).toEqual({ sophie: 'idle', jimmy: 'jimmy-sit' });
  expect(night.balloons).toHaveLength(0);
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(0);
  for (let i = 0; i < 11; i++) {
    expect((await snapshot(page)).line).toEqual(rooftopLines[i]);
    await expect(page.locator('.story-bubble')).toHaveAttribute(
      'aria-label',
      `${rooftopLines[i]!.speaker === 'jimmy' ? 'jimmy' : 'sophie'}: ${rooftopLines[i]!.text}`,
    );
    await next(page);
  }
  expect((await snapshot(page)).animations.sophie).toBe('walk');
  const asleep = await tick(page, c.returnMs);
  expect(asleep.animations).toEqual({ sophie: 'sleep', jimmy: 'jimmy-sleep' });
  await tick(page, c.sleepHoldMs + c.nightFadeMs + c.overnightMs);
  expect((await snapshot(page)).environment).toBe('day');
  expect((await snapshot(page)).actors).toEqual(asleep.actors);
  await tick(page, c.morningFadeMs + c.morningSleepMs);
  const day = await snapshot(page);
  expect(day.geometry).toEqual(night.geometry);
  expect(day.balloons).toHaveLength(4);
  expect(day.animations).toEqual({ sophie: 'idle', jimmy: 'jimmy-sleep' });
  for (let i = 11; i < rooftopLines.length; i++) {
    const s = await snapshot(page);
    expect(s.line).toEqual(rooftopLines[i]);
    if (i === 13) expect(s.animations.jimmy).toBe('jimmy-sit');
    if (i === 20) expect(s.animations.jimmy).toBe('jimmy-idle');
    await next(page);
  }
  expect((await snapshot(page)).animations.jimmy).toBe('jimmy-walk');
  await tick(page, c.joinMs + c.readyMs + c.crouchMs);
  const jump = await snapshot(page);
  expect(jump.combinedJump).toMatchObject({
    visible: true,
    texture: 'sophie-jimmy-super-jump',
    frame: 3,
  });
  expect(
    Object.values(jump.actors).every((a) => 'visible' in a && !a.visible),
  ).toBe(true);
  expect(
    (await tick(page, c.launchMs - 1)).combinedJump!.bottom,
  ).toBeGreaterThan(0);
  await tick(page, 1);
  expect((await snapshot(page)).combinedJump!.visible).toBe(false);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  await tick(page, c.emptyMs + c.endingFadeMs);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'attic-escape',
  );
  await expect(page.locator('.story-ui')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test.describe('mobile rooftop story', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('native Continue, keyboard, portrait freeze, pause, restart and debug story routing', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: 'Continue · X' }).click();
    expect((await snapshot(page)).index).toBe(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    const before = await snapshot(page);
    await tick(page, 10000);
    await page.keyboard.press('KeyX');
    expect(await snapshot(page)).toEqual(before);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    await tick(page, c.minimumLineMs);
    await page.keyboard.press('KeyX');
    expect((await snapshot(page)).index).toBe(2);
    await page.keyboard.press('Escape');
    const paused = await snapshot(page);
    await tick(page, 10000);
    expect(await snapshot(page)).toEqual(paused);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await page.waitForFunction(
      () =>
        window.__sophieStory!.snapshot().index === -1 &&
        !window.__sophieStory!.snapshot().paused,
    );
    await expect(page.locator('.story-ui')).toHaveCount(1);
    await expect(page.locator('.touch-controls')).toHaveCount(0);
    await page
      .getByRole('combobox', { name: 'Debug level' })
      .selectOption('interlude-1');
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await page.waitForFunction(
      () => window.__sophieStory?.snapshot().storyId === 'interlude-1',
    );
    await page
      .getByRole('combobox', { name: 'Debug level' })
      .selectOption('interlude-2');
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await page.waitForFunction(
      () => window.__sophieStory?.snapshot().storyId === 'interlude-2',
    );
    await expect(page.locator('.story-ui')).toHaveCount(1);
  });
});
