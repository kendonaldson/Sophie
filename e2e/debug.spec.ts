import { test, expect } from '@playwright/test';
import { atticEscape } from '../src/game/levels/atticEscape';
import { warehouse } from '../src/game/levels/warehouse';

test('debug selector follows the hash, resets complete levels, and keeps keyboard navigation out of gameplay', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?test');
  await page.waitForFunction(() => Boolean(window.__sophie));
  const selector = page.getByRole('combobox', {
    name: 'Debug level',
    exact: true,
  });
  const load = page.getByRole('button', { name: 'Load', exact: true });
  await expect(selector).toHaveCount(0);
  const before = await page.evaluate(() => {
    const a = window.__sophie!;
    a.manual(true);
    a.checkpoint('combo');
    location.hash = 'debug';
    return a.snapshot();
  });
  await expect(selector).toBeVisible();
  await expect(selector).toHaveValue(atticEscape.id);
  expect(await page.evaluate(() => window.__sophie!.snapshot())).toEqual(
    before,
  );
  await selector.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('KeyX');
  await page.keyboard.press('KeyZ');
  await page.keyboard.press('KeyR');
  expect(await page.evaluate(() => window.__sophie!.advance(1))).toMatchObject({
    x: before.x,
    charges: before.charges,
    respawning: false,
    grounded: true,
  });
  await selector.selectOption(warehouse.id);
  // Loading from pause resumes a new chapter and restores its own resources.
  await page.getByRole('button', { name: 'Pause game' }).click();
  await load.click();
  const fresh = await page.evaluate(() => window.__sophie!.advance(1));
  expect(fresh).toMatchObject({
    levelId: warehouse.id,
    ...warehouse.playerSpawn,
    charges: 1,
    paused: false,
    ending: false,
    respawning: false,
    treats: [],
    intro: true,
  });
  expect(fresh.jimmy).toBeDefined();
  expect(fresh.machinery?.length).toBeGreaterThan(0);
  await expect(page.locator('audio')).toHaveAttribute(
    'src',
    /factory-pulse\.mp3$/,
  );
  await page.evaluate(() =>
    window.__sophie!.advance(430, { moveX: 1, dashPressed: true }),
  );
  await load.click();
  expect(await page.evaluate(() => window.__sophie!.advance(1))).toMatchObject({
    ...warehouse.playerSpawn,
    charges: 1,
    intro: true,
  });
  await selector.selectOption(atticEscape.id);
  await load.click();
  const rooftops = await page.evaluate(() => window.__sophie!.advance(1));
  expect(rooftops).toMatchObject({
    levelId: atticEscape.id,
    ...atticEscape.playerSpawn,
    charges: 1,
  });
  expect(rooftops.jimmy).toBeUndefined();
  expect(rooftops.machinery).toBeUndefined();
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveAttribute(
    'src',
    /rooftop-dash\.mp3$/,
  );
  // A normal chapter transition also updates the selector's current level.
  await page.evaluate((exit) => {
    const a = window.__sophie!;
    a.place({ x: exit.x + 10, y: exit.y + exit.height });
    a.advance(90);
  }, atticEscape.exit);
  await expect(selector).toHaveValue(warehouse.id);
  await page.evaluate(() => {
    location.hash = 'other';
  });
  await expect(selector).toHaveCount(0);
  await expect(page.locator('.chapter')).toBeVisible();
  expect((await page.evaluate(() => window.__sophie!.snapshot())).levelId).toBe(
    warehouse.id,
  );
  await page.evaluate(() => {
    location.hash = 'debug';
  });
  await expect(selector).toHaveValue(warehouse.id);
  await page.evaluate(() => window.__sophie!.manual(false));
  expect(errors).toEqual([]);
});
