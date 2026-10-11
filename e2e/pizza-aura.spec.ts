import { expect, test } from '@playwright/test';

test('Pizza Rush stays visible at rest, follows movement, and expires after eight seconds', async ({
  page,
}) => {
  await page.goto('/?test&level=pizza-factory');
  await page.waitForFunction(() => Boolean(window.__sophie));
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.manual(true);
    a.loadLevel('pizza-factory');
    a.advance(2000);
    a.checkpoint('factory-midpoint');
    // The optional slice sits above a stationary prep counter, so standing
    // below it cannot refresh the power while we observe its full lifetime.
    a.place({ x: 9650, y: 775 });
    a.advance(1);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__sophie!.snapshot().factory!.pizza.aura.visible,
      ),
    )
    .toBe(false);
  const pickup = await page.evaluate(() => {
    const a = window.__sophie!;
    let s = a.advance(1, { jumpPressed: true, jumpHeld: true });
    for (let n = 0; n < 60 && !s.factory!.pizza.active; n++)
      s = a.advance(1, { jumpHeld: true });
    return s;
  });
  expect(pickup.factory!.pizza.remainingMs).toBe(8000);
  expect(pickup.grounded).toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__sophie!.snapshot().factory!.pizza.aura.visible,
      ),
    )
    .toBe(true);
  const idle = await page.evaluate(() => {
    const a = window.__sophie!;
    let s = a.snapshot();
    for (let n = 0; n < 240 && !s.grounded; n++) s = a.advance(1);
    return s;
  });
  expect(idle.grounded).toBe(true);
  expect(idle.vx).toBe(0);
  expect(idle.factory!.pizza.active).toBe(true);
  await expect(page.locator('#pizza-rush')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__sophie!.snapshot().factory!.pizza.aura.visible,
      ),
    )
    .toBe(true);
  const running = await page.evaluate(() =>
    window.__sophie!.advance(30, { moveX: 1 }),
  );
  expect(running.vx).toBe(360);
  expect(running.x).toBeGreaterThan(idle.x);
  expect(running.grounded).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = window.__sophie!.snapshot();
        return s.factory!.pizza.aura.x - Math.round(s.x);
      }),
    )
    .toBe(0);
  const almostExpired = await page.evaluate(() => {
    const a = window.__sophie!;
    const frames = Math.ceil(
      a.snapshot().factory!.pizza.remainingMs / (1000 / 120),
    );
    return a.advance(frames - 1);
  });
  expect(almostExpired.respawning).toBe(false);
  expect(almostExpired.factory!.pizza.remainingMs).toBeGreaterThan(0);
  expect(almostExpired.factory!.pizza.remainingMs).toBeLessThanOrEqual(
    1000 / 120,
  );
  expect(almostExpired.factory!.pizza.active).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__sophie!.snapshot().factory!.pizza.aura.visible,
      ),
    )
    .toBe(true);
  const expired = await page.evaluate(() => window.__sophie!.advance(2));
  expect(expired.factory!.pizza.active).toBe(false);
  expect(expired.factory!.pizza.movement.maxRunSpeed).toBe(180);
  expect(expired.charges).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__sophie!.snapshot().factory!.pizza.aura.visible,
      ),
    )
    .toBe(false);
  await expect(page.locator('#pizza-rush')).toBeHidden();
});
