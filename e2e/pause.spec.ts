import { test, expect, devices, type Page } from '@playwright/test';

const snapshot = (page: Page) =>
  page.evaluate(() => window.__sophie!.snapshot());
async function open(page: Page) {
  await page.goto('/?test#debug');
  await page.waitForFunction(() => window.__sophie?.snapshot().grounded);
  await page.evaluate(() => window.__sophie!.manual(true));
}
const pause = (page: Page) =>
  page.getByRole('button', { name: 'Pause game', exact: true }).click();
const resume = (page: Page) =>
  page.getByRole('button', { name: 'Continue', exact: true }).click();
test('pause offers the three actions, Continue preserves play, and R still retries a checkpoint', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('#retry')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('combo');
    a.advance(20, { moveX: 1 });
  });
  const before = await snapshot(page);
  await pause(page);
  await expect(page.locator('#overlay button')).toHaveText([
    'Restart',
    'Full Screen',
    'Continue',
  ]);
  await expect(
    page.getByRole('button', { name: 'Continue', exact: true }),
  ).toBeFocused();
  await page.evaluate(() =>
    window.__sophie!.advance(120, { moveX: 1, jumpPressed: true }),
  );
  expect((await snapshot(page)).x).toBe(before.x);
  await resume(page);
  expect((await snapshot(page)).paused).toBe(false);
  expect((await snapshot(page)).checkpoint).toBe('combo');
  await page.keyboard.press('KeyR');
  const retry = await page.evaluate(() => window.__sophie!.advance(24));
  expect(retry.checkpoint).toBe('combo');
  expect(retry.x).toBe(2570);
  await pause(page);
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).paused).toBe(false);
});
test('Restart begins the selected chapter again, including during a lift', async ({
  page,
}) => {
  await open(page);
  for (const id of [
    'attic-escape',
    'warehouse',
    'the-chase',
    'skyscraper',
  ] as const) {
    await page.evaluate((id) => {
      const a = window.__sophie!;
      a.loadLevel(id);
      if (id === 'attic-escape') a.checkpoint('combo');
      else if (id === 'warehouse') a.checkpoint('upper-chain');
      else if (id === 'the-chase') a.chaseSection(4430);
      else {
        a.checkpoint('first-lift');
        a.platform('east-lift');
        a.advance(150);
      }
    }, id);
    await pause(page);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    const s = await snapshot(page);
    expect(s.levelId).toBe(id);
    expect(s.checkpoint).toBe('spawn');
    expect(s.charges).toBe(1);
    expect(s.treats).toEqual([]);
    expect(s.paused).toBe(false);
    expect(s.respawning).toBe(false);
    if (id === 'skyscraper') expect(s.climb!.phase).toBe('arrival');
    if (id === 'the-chase') expect(s.chase!.attempts).toBe(0);
    await expect(page.locator('#overlay')).toBeHidden();
  }
});
test('Restart restarts Interlude 1 and scene changes keep one set of menu handlers', async ({
  page,
}) => {
  await open(page);
  const selector = page.getByRole('combobox', {
    name: 'Debug level',
    exact: true,
  });
  await selector.selectOption('interlude-1');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.waitForFunction(() => window.__sophieStory);
  await page.evaluate(() => {
    const a = window.__sophieStory!;
    a.manual(true);
    a.tick(5000);
  });
  await pause(page);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.waitForFunction(() => {
    const story = window.__sophieStory?.snapshot();
    return story?.index === 0 && !story.paused;
  });
  expect(
    await page.evaluate(() => window.__sophieStory!.snapshot().paused),
  ).toBe(false);
  await selector.selectOption('warehouse');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await pause(page);
  expect((await snapshot(page)).paused).toBe(true);
  await resume(page);
  expect((await snapshot(page)).paused).toBe(false);
});

test('real fullscreen includes the app, grows the viewport, exits cleanly, and preserves paused physics', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const before = await snapshot(page);
  const original = (await page.locator('.game-shell').boundingBox())!;
  await pause(page);
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id))
    .toBe('app');
  await expect(page.locator('#app')).toHaveClass(/is-fullscreen/);
  await expect
    .poll(async () => (await page.locator('.game-shell').boundingBox())!.height)
    .toBeGreaterThan(original.height);
  expect((await snapshot(page)).paused).toBe(true);
  expect((await snapshot(page)).physics).toEqual(before.physics);
  await page.evaluate(() => window.__sophie!.advance(120, { moveX: 1 }));
  expect((await snapshot(page)).x).toBe(before.x);
  await expect(
    page.getByRole('button', { name: 'Exit Full Screen', exact: true }),
  ).toBeVisible();
  // Exiting outside the menu must update both its label and the layout.
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('#app')).not.toHaveClass(/is-fullscreen/);
  await expect(
    page.getByRole('button', { name: 'Full Screen', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await page.locator('.game-shell').boundingBox())!.height)
    .toBe(original.height);
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id))
    .toBe('app');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect((await snapshot(page)).checkpoint).toBe('spawn');
  expect(await page.evaluate(() => document.fullscreenElement?.id)).toBe('app');
  await pause(page);
  await page
    .getByRole('button', { name: 'Exit Full Screen', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement))
    .toBeNull();
  await resume(page);
  expect((await snapshot(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});

test('prefixed fullscreen APIs also enter and exit with the same menu state', async ({
  page,
}) => {
  // Chromium exposes these compatibility APIs too; hide the standard surface
  // to exercise the fallback using real fullscreen, not a simulated CSS state.
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(Document.prototype, 'exitFullscreen', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(Document.prototype, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    });
  });
  await open(page);
  await pause(page);
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (document as Document & { webkitFullscreenElement?: Element })
            .webkitFullscreenElement?.id,
      ),
    )
    .toBe('app');
  await expect(page.locator('#app')).toHaveClass(/is-fullscreen/);
  await page
    .getByRole('button', { name: 'Exit Full Screen', exact: true })
    .click();
  await expect(page.locator('#app')).not.toHaveClass(/is-fullscreen/);
  expect((await snapshot(page)).paused).toBe(true);
  await resume(page);
  expect((await snapshot(page)).paused).toBe(false);
});

for (const unavailable of [true, false])
  test(`fullscreen ${unavailable ? 'unsupported' : 'rejection'} leaves Restart and Continue usable`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((unavailable) => {
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        configurable: true,
        value: unavailable
          ? undefined
          : () => Promise.reject(new Error('Denied')),
      });
      Object.defineProperty(HTMLElement.prototype, 'webkitRequestFullscreen', {
        configurable: true,
        value: undefined,
      });
    }, unavailable);
    await open(page);
    await pause(page);
    const button = page.getByRole('button', {
      name: 'Full Screen',
      exact: true,
    });
    if (unavailable) await expect(button).toBeDisabled();
    else await button.click();
    await expect(page.locator('#fullscreen-status')).toContainText(
      unavailable ? 'isn’t available' : 'couldn’t change',
    );
    await expect(page.locator('#app')).not.toHaveClass(/is-fullscreen/);
    await resume(page);
    expect((await snapshot(page)).paused).toBe(false);
    await pause(page);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    expect((await snapshot(page)).checkpoint).toBe('spawn');
    expect(errors).toEqual([]);
  });

test.describe('mobile pause and fullscreen', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('all menu actions fit and fullscreen retains touch input and orientation handling', async ({
    page,
  }) => {
    await open(page);
    await pause(page);
    const shell = (await page.locator('.game-shell').boundingBox())!;
    for (const name of ['Restart', 'Full Screen', 'Continue']) {
      const b = (await page
        .getByRole('button', { name, exact: true })
        .boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(shell.y);
      expect(b.y + b.height).toBeLessThanOrEqual(shell.y + shell.height);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Full Screen', exact: true }).tap();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement?.id))
      .toBe('app');
    await expect
      .poll(
        async () => (await page.locator('.game-shell').boundingBox())!.height,
      )
      .toBeGreaterThan(shell.height);
    await page.getByRole('button', { name: 'Continue', exact: true }).tap();
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('.pad-direction')).toHaveCount(4);
    await page.evaluate(() => window.__sophie!.manual(false));
    const jump = (await page
      .getByRole('button', { name: 'Jump', exact: true })
      .boundingBox())!;
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { id: 1, x: jump.x + jump.width / 2, y: jump.y + jump.height / 2 },
      ],
    });
    await expect.poll(async () => (await snapshot(page)).y).toBeLessThan(510);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.evaluate(() => window.__sophie!.manual(true));
    // Emulate physical rotation without resizing the native fullscreen window,
    // which current Chromium rejects through Browser.setWindowBounds.
    const rotate = (width: number, height: number) =>
      session.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        screenWidth: width,
        screenHeight: height,
        deviceScaleFactor: 1,
        mobile: true,
        screenOrientation: {
          type: width > height ? 'landscapePrimary' : 'portraitPrimary',
          angle: width > height ? 90 : 0,
        },
      });
    await rotate(390, 844);
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    const before = await snapshot(page);
    await page.evaluate(() => window.__sophie!.advance(120));
    expect((await snapshot(page)).y).toBe(before.y);
    await rotate(844, 390);
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    await pause(page);
    await page
      .getByRole('button', { name: 'Exit Full Screen', exact: true })
      .tap();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement))
      .toBeNull();
    await resume(page);
    await expect(page.locator('.touch-controls')).toBeVisible();
  });
});
