import { test, expect, devices } from '@playwright/test';
import { atticEscape } from '../src/game/levels/atticEscape';
test.describe('phone controls', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('all eight arrows aim real touch dashes, including diagonals while dragging and holding X', async ({
    page,
  }) => {
    await page.goto('/?test');
    await page.waitForFunction(() => Boolean(window.__sophie));
    await expect(page.locator('.pad-direction')).toHaveCount(8);
    const pad = (await page.locator('.touch-pad').boundingBox())!;
    const dash = (await page
      .getByRole('button', { name: 'Dash', exact: true })
      .boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const center = {
      id: 1,
      x: pad.x + pad.width / 2,
      y: pad.y + pad.height / 2,
    };
    const active = page.locator('.pad-direction.active');
    for (const [x, y] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]) {
      // Start near the apex of a normal jump so downward dashes are measurable
      // before the roof collision. Direction and dash come from real touch events.
      await page.evaluate(() => {
        const a = window.__sophie!;
        a.manual(true);
        a.restart();
        a.advance(35, { jumpPressed: true, jumpHeld: true });
        a.manual(false);
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [center],
      });
      await expect(active).toHaveCount(0);
      const direction = {
        id: 1,
        x: center.x + x! * pad.width * 0.28,
        y: center.y + y! * pad.height * 0.28,
      };
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [direction],
      });
      await expect(active).toHaveCount(1);
      await expect(active).toHaveAttribute('data-x', String(x));
      await expect(active).toHaveAttribute('data-y', String(y));
      const dashed = page.waitForFunction(
        () => {
          const s = window.__sophie!.snapshot();
          return s.state === 'Dashing' ? s : false;
        },
        undefined,
        { polling: 'raf' },
      );
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          direction,
          { id: 2, x: dash.x + dash.width / 2, y: dash.y + dash.height / 2 },
        ],
      });
      const snapshot = await (await dashed).jsonValue();
      if (!snapshot) throw new Error('Touch dash did not start');
      const length = Math.hypot(x!, y!);
      expect(snapshot.vx).toBeCloseTo(
        (snapshot.physics.dashSpeed * x!) / length,
      );
      expect(snapshot.vy).toBeCloseTo(
        (snapshot.physics.dashSpeed * y!) / length,
      );
      expect(snapshot.charges).toBe(0);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await expect(active).toHaveCount(0);
    }
    // Pointer capture preserves diagonal aim outside the visible pad. The center
    // dead zone and cancellation both release direction and its highlight.
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [center],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: pad.x + pad.width + 12, y: pad.y - 12 }],
    });
    await expect(active).toHaveAttribute('data-x', '1');
    await expect(active).toHaveAttribute('data-y', '-1');
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [center],
    });
    await expect(active).toHaveCount(0);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: center.x - 28, y: center.y - 28 }],
    });
    await expect(active).toHaveCount(1);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
    await expect(active).toHaveCount(0);
  });
  test('the final rooftop gap can be crossed with touch dash then held jump without a second dash', async ({
    page,
  }) => {
    await page.goto('/?test');
    await page.waitForFunction(() => Boolean(window.__sophie));
    const pad = (await page.locator('.touch-pad').boundingBox())!;
    const dash = (await page
      .getByRole('button', { name: 'Dash', exact: true })
      .boundingBox())!;
    const jump = (await page
      .getByRole('button', { name: 'Jump', exact: true })
      .boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const direction = {
      id: 1,
      x: pad.x + pad.width * 0.87,
      y: pad.y + pad.height / 2,
    };
    const factory = atticEscape.platforms.find((p) => p.id === 'warehouse')!;
    const dashFinger = {
      id: 2,
      x: dash.x + dash.width / 2,
      y: dash.y + dash.height / 2,
    };
    for (const delayMs of [60, 100]) {
      // Set up on the last safe roof, then use real held touch controls and
      // release X before pressing Z, as with a single right thumb.
      await page.evaluate(() => {
        const a = window.__sophie!;
        a.manual(true);
        a.checkpoint('combo');
        a.place({ x: 2680, y: 388 });
        a.advance(1);
        a.manual(false);
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [direction, dashFinger],
      });
      await page.waitForFunction(
        () => window.__sophie!.snapshot().state === 'Dashing',
      );
      await page.waitForTimeout(delayMs);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        // CDP ends the listed contact; the D-pad finger remains held.
        touchPoints: [dashFinger],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          direction,
          { id: 2, x: jump.x + jump.width / 2, y: jump.y + jump.height / 2 },
        ],
      });
      const result = await page.waitForFunction((x) => {
        const s = window.__sophie!.snapshot();
        return s.respawning || (s.grounded && s.x >= x - 15) ? s : false;
      }, factory.x);
      const landed = await result.jsonValue();
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      if (!landed) throw new Error('Final touch jump did not finish');
      expect(landed.respawning, `touch delay ${delayMs} ms`).toBe(false);
      expect(landed.grounded).toBe(true);
      expect(landed.y).toBeCloseTo(factory.y, 0);
    }
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
