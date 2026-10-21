import { expect, test } from '@playwright/test';
import { epilogueLines } from '../../src/game/story/epilogue';

test('production epilogue plays automatically through the last line and THE END under the Pages path', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(response.url());
  });
  await page.goto('./#debug');
  await page
    .getByRole('combobox', { name: 'Debug level' })
    .selectOption('epilogue');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.chapter')).toContainText('Epilogue');
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await expect(page.locator('#dash-hud')).toBeHidden();
  await expect(page.locator('.story-next')).toBeHidden();
  const music = page.locator('audio');
  await expect(music).toHaveCount(1);
  await expect(music).toHaveJSProperty('loop', false);
  await expect(music).not.toHaveAttribute('src');
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
  await page.keyboard.press('KeyX');
  await page.keyboard.press('Space');
  await expect(page.locator('.epilogue-end')).toBeVisible();
  await expect(bubble).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
