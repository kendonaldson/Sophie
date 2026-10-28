import { expect, test } from '@playwright/test';
import { epilogue as c, epilogueLines } from '../../src/game/story/epilogue';
import { progressStorageKey } from '../../src/game/progress/ProgressStore';

test('production epilogue reaches THE END and resets saved progress under the Pages path', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(response.url());
  });
  await page.goto('./');
  await expect(page.locator('#section')).toHaveText('Open air');
  const saveKey = progressStorageKey(new URL('.', page.url()).pathname);
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, destinationId: 'epilogue' }),
    );
  }, saveKey);
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.chapter')).toContainText('Epilogue');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await expect(page.locator('#dash-hud')).toBeHidden();
  await expect(page.locator('.story-next')).toBeHidden();
  const music = page.locator('audio');
  await expect(music).toHaveCount(1);
  await expect(music).toHaveJSProperty('loop', false);
  if (c.music)
    await expect(music).toHaveAttribute(
      'src',
      new URL(c.music, page.url()).pathname,
    );
  else await expect(music).not.toHaveAttribute('src');
  expect(
    await page.evaluate(() => [window.__sophie, window.__sophieStory]),
  ).toEqual([undefined, undefined]);
  const bubble = page.locator('.story-bubble');
  for (const line of epilogueLines) {
    await expect(bubble.locator('p')).toHaveText(line.text, { timeout: 20000 });
    await expect(bubble).toHaveAttribute('data-speaker', line.speaker);
    await expect(page.locator('.epilogue-end')).toBeHidden();
  }
  await expect(bubble).toBeHidden({ timeout: 6000 });
  await expect(page.locator('.epilogue-end')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.epilogue-end')).toHaveText('THE END');
  await expect(page.locator('#fade')).toHaveCSS('opacity', '1');
  await expect(music).toHaveJSProperty('volume', 0);
  await expect(music).toHaveJSProperty('paused', true);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), saveKey),
  ).toBeNull();
  await page.keyboard.press('KeyX');
  await page.keyboard.press('Space');
  await expect(page.locator('.epilogue-end')).toBeVisible();
  await expect(bubble).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#section')).toHaveText('Open air');
  await expect(page.locator('#dash-hud')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), saveKey),
    )
    .toEqual({
      version: 1,
      destinationId: 'attic-escape',
      checkpointId: 'start',
    });
  expect(errors).toEqual([]);
});
