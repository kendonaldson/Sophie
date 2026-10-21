import { expect, test } from '@playwright/test';

test('production Race Home loads its reused assets, opening, and controls under the Pages path', async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [],
    assets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(response.url());
    if (response.url().includes('/assets/')) assets.push(response.url());
  });
  await page.goto('./#debug');
  const selector = page.getByRole('combobox', { name: 'Debug level' });
  await selector.selectOption('race-home');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('.chapter')).toContainText('Chapter 08');
  await expect(page.locator('.dialogue p')).toHaveText(
    'The kids are going home from school!',
  );
  await expect(page.locator('.dialogue')).toHaveAttribute(
    'data-speaker',
    'JIMMY',
  );
  await expect(page.locator('.dialogue p')).toHaveText(
    "Let's take a shortcut.\nWe'll get back in time.",
    { timeout: 5000 },
  );
  await expect(page.locator('.dialogue')).toBeHidden({ timeout: 6000 });
  const music = page.locator('audio');
  await expect(music).toHaveAttribute(
    'src',
    new URL('assets/audio/race-home.mp3', baseURL!).pathname,
  );
  await expect(music).toHaveJSProperty('loop', true);
  await expect(music).toHaveJSProperty('error', null);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  expect(
    await page.evaluate(() => [window.__sophie, window.__sophieStory]),
  ).toEqual([undefined, undefined]);
  for (const asset of [
    'sophie.png',
    'jimmy.png',
    'sparrow.png',
    'rat-atlas.png',
    'pizza-dash-atlas.png',
    'rotating-pizza-atlas.png',
  ])
    expect(assets).toContain(new URL(`assets/${asset}`, baseURL!).href);
  await page.keyboard.down('KeyZ');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('KeyX');
  await expect(page.locator('#dash-hud')).toHaveAttribute(
    'aria-label',
    '0 of 2 dash charges available',
  );
  await page.keyboard.up('KeyZ');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'A little breather.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('.dialogue p')).toHaveText(
    'The kids are going home from school!',
  );
  await selector.selectOption('attic-escape');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('#section')).toHaveText('Open air');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.dialogue')).toBeHidden();
  expect(errors).toEqual([]);
});
