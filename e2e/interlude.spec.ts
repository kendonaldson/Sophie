import { test, expect, devices, type Page } from '@playwright/test';
import { interlude1 as c, interludeLines } from '../src/game/story/interlude1';
async function openStory(page: Page) {
  await page.goto('/?test#debug');
  await page
    .getByRole('combobox', { name: 'Debug level', exact: true })
    .selectOption(c.id);
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__sophieStory));
  await page.evaluate(() => {
    window.__sophieStory!.manual(true);
    window.__sophieStory!.tick(900);
  });
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.__sophieStory!.snapshot());
const tick = (page: Page, ms: number) =>
  page.evaluate((ms) => window.__sophieStory!.tick(ms), ms);
test('Interlude 1 performs the full conversation, unseen interruption, escape, fade and immediate playable chase', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openStory(page);
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  const initial = await snapshot(page);
  expect(initial.animations).toEqual({ sophie: 'idle', jimmy: 'jimmy-sit' });
  expect(initial.actors.sophie.flipX).toBe(false);
  expect(initial.actors.jimmy.flipX).toBe(true);
  expect(initial.characters).toEqual(['Sophie', 'Jimmy']);
  expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('KeyZ');
  await page.keyboard.press('Space');
  await page.keyboard.press('KeyR');
  await tick(page, 500);
  await page.keyboard.up('ArrowRight');
  expect((await snapshot(page)).actors).toEqual(initial.actors);
  await page.keyboard.down('KeyX');
  expect((await snapshot(page)).index).toBe(1);
  await tick(page, 500);
  await page.keyboard.down('KeyX');
  expect((await snapshot(page)).index).toBe(1);
  await page.keyboard.up('KeyX');
  const bubble = page.locator('.story-bubble');
  for (let index = 1; index < interludeLines.length; index++) {
    const line = interludeLines[index]!;
    await expect(bubble).toHaveAttribute('data-speaker', line.speaker);
    await expect(bubble.locator('p')).toHaveText(line.text);
    const state = await snapshot(page);
    expect(state.characters).toEqual(['Sophie', 'Jimmy']);
    if (line.cue === 'alert') {
      expect(state.animations).toEqual({ sophie: 'idle', jimmy: 'jimmy-idle' });
      expect(state.actors.jimmy.flipX).toBe(false);
      await expect(bubble.locator('strong')).toHaveText(
        'A VOICE FROM OFF-SCREEN',
      );
      expect(
        await bubble.evaluate((el) => getComputedStyle(el).borderLeftStyle),
      ).toBe('dashed');
    }
    if (line.cue === 'walk') {
      expect(state.animations).toEqual({ sophie: 'walk', jimmy: 'jimmy-walk' });
      expect((await tick(page, 500)).actors.sophie.x).toBeGreaterThan(
        state.actors.sophie.x,
      );
    }
    await expect(
      page.getByRole('heading', { name: 'TO BE CONTINUED' }),
    ).toHaveCount(0);
    if (index === interludeLines.length - 1) break;
    await tick(page, c.minimumLineMs);
    await page.keyboard.press('KeyX');
    if ((await snapshot(page)).phase === 'pause')
      await tick(page, interludeLines[index + 1]!.pauseBeforeMs!);
  }
  const running = await tick(page, c.escapeReactionMs + 250);
  expect(running.animations).toEqual({ sophie: 'run', jimmy: 'jimmy-run' });
  expect(running.actors.sophie.x).toBeGreaterThan(c.sophieX + 80);
  let state = running;
  for (let i = 0; i < 20 && state.phase !== 'fade'; i++)
    state = await tick(page, 80);
  expect(state.phase).toBe('fade');
  for (const dog of Object.values(state.actors))
    expect(dog.x).toBeGreaterThan(c.width + 48);
  expect(state.fade).toBeGreaterThan(0);
  await tick(page, c.fadeOutMs);
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'the-chase',
  );
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  await expect(page.locator('.chase-ui p')).toHaveText(
    "Run, Jimmy, or we'll be caught!",
  );
  expect(
    await page.evaluate(() => window.__sophie!.snapshot().chase?.enabled),
  ).toBe(true);
  expect(await page.evaluate(() => window.__sophieStory)).toBeUndefined();
  await expect(page.locator('.story-ui')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(1);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__sophie!.snapshot().paused)).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__sophie!.snapshot().paused)).toBe(
    false,
  );
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(() => page.evaluate(() => window.__sophie!.snapshot().x))
    .toBeGreaterThan(180);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});
test.describe('mobile story', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('offers a native continue button, pauses in portrait and returns cleanly to touch gameplay', async ({
    page,
  }) => {
    await openStory(page);
    await expect
      .poll(() =>
        page.locator('canvas').evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          return Array.from(
            canvas
              .getContext('2d')!
              .getImageData(0, Math.floor(canvas.height / 2), 1, 1).data,
          );
        }),
      )
      .toEqual([24, 46, 56, 255]);
    const next = page.getByRole('button', {
      name: 'Continue · X',
      exact: true,
    });
    await expect(page.locator('.touch-controls')).toHaveCount(0);
    await next.tap();
    expect((await snapshot(page)).index).toBe(1);
    const bubble = (await page.locator('.story-bubble').boundingBox())!;
    const shell = (await page.locator('.game-shell').boundingBox())!;
    expect(bubble.y).toBeGreaterThanOrEqual(shell.y);
    expect(bubble.x).toBeGreaterThanOrEqual(shell.x);
    expect(bubble.x + bubble.width).toBeLessThanOrEqual(shell.x + shell.width);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('heading', { name: 'Rotate your device to play' }),
    ).toBeVisible();
    const before = await snapshot(page);
    await tick(page, 5000);
    await page.keyboard.press('KeyX');
    expect(await snapshot(page)).toEqual(before);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    await tick(page, c.minimumLineMs);
    await page.keyboard.press('KeyX');
    expect((await snapshot(page)).index).toBe(2);
    await page
      .getByRole('combobox', { name: 'Debug level', exact: true })
      .selectOption('warehouse');
    await page.getByRole('button', { name: 'Load', exact: true }).tap();
    await page.waitForFunction(
      () => window.__sophie?.snapshot().levelId === 'warehouse',
    );
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('.story-ui')).toHaveCount(0);
    await expect(page.locator('audio')).toHaveCount(1);
  });
});
