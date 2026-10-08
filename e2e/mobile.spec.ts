import { test, expect, devices } from '@playwright/test';
test.describe('phone controls', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('multi-touch supports movement, jumping and dash; orientation pauses without changing physics', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?test');
    await page.waitForFunction(() => Boolean(window.__sophie));
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    const start = await page.evaluate(() => window.__sophie!.snapshot());
    const pad = (await page.locator('.touch-pad').boundingBox())!;
    const z = (await page
      .getByRole('button', { name: 'Jump', exact: true })
      .boundingBox())!;
    const x = (await page
      .getByRole('button', { name: 'Dash', exact: true })
      .boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const direction = {
      id: 1,
      x: pad.x + pad.width * 0.87,
      y: pad.y + pad.height * 0.5,
    };
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [direction],
    });
    await expect
      .poll(async () => page.evaluate(() => window.__sophie!.snapshot().x))
      .toBeGreaterThan(start.x + 10);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        direction,
        { id: 2, x: z.x + z.width / 2, y: z.y + z.height / 2 },
      ],
    });
    await expect
      .poll(async () => page.evaluate(() => window.__sophie!.snapshot().y))
      .toBeLessThan(start.y - 10);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        direction,
        { id: 2, x: z.x + z.width / 2, y: z.y + z.height / 2 },
        { id: 3, x: x.x + x.width / 2, y: x.y + x.height / 2 },
      ],
    });
    await expect
      .poll(async () =>
        page.evaluate(() => window.__sophie!.snapshot().charges),
      )
      .toBe(0);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('heading', { name: 'Rotate your device to play' }),
    ).toBeVisible();
    await expect(page.locator('.touch-controls')).toHaveCount(0);
    const portrait = await page.evaluate(() => window.__sophie!.snapshot());
    await page.waitForTimeout(150);
    const frozen = await page.evaluate(() => window.__sophie!.snapshot());
    expect(frozen.x).toBe(portrait.x);
    expect(frozen.y).toBe(portrait.y);
    expect(frozen.physics).toEqual(start.physics);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    await page.keyboard.press('KeyR');
    await expect
      .poll(async () =>
        page.evaluate(() => window.__sophie!.snapshot().charges),
      )
      .toBe(1);
    const resetX = await page.evaluate(() => window.__sophie!.snapshot().x);
    await page.keyboard.down('ArrowRight');
    await expect
      .poll(async () => page.evaluate(() => window.__sophie!.snapshot().x))
      .toBeGreaterThan(resetX + 10);
    await page.keyboard.up('ArrowRight');
    expect(errors).toEqual([]);
    const box = await page.locator('.game-shell').boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(390);
  });
});
test.describe('desktop with a touchscreen', () => {
  test.use({
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
  });
  test('never mounts touch hit targets or a rotate message, even in a tall narrow window', async ({
    page,
  }) => {
    await page.goto('/?test');
    await page.waitForFunction(() => Boolean(window.__sophie));
    for (const size of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator('.touch-controls,.rotate-overlay')).toHaveCount(
        0,
      );
      await expect(page.locator('#app')).not.toHaveClass(/mobile/);
    }
    await page.keyboard.down('ArrowRight');
    await expect
      .poll(async () => page.evaluate(() => window.__sophie!.snapshot().x))
      .toBeGreaterThan(170);
    await page.keyboard.up('ArrowRight');
  });
});
