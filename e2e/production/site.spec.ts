import { rooftopLines } from '../../src/game/story/interlude2';
import { devices, expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { interludeLines } from '../../src/game/story/interlude1';

test('production interlude hands off to the playable chase without exposing test APIs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./#debug');
  await page
    .getByRole('combobox', { name: 'Debug level', exact: true })
    .selectOption('interlude-1');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  const bubble = page.locator('.story-bubble');
  for (const [index, line] of interludeLines.entries()) {
    await expect(bubble.locator('p')).toHaveText(line.text);
    await expect(bubble).toHaveAttribute('data-speaker', line.speaker);
    if (index < interludeLines.length - 1)
      await page
        .getByRole('button', { name: 'Continue · X', exact: true })
        .click();
  }
  await expect(page.locator('.chase-ui p')).toHaveText(
    "Run, Jimmy, or we'll be caught!",
  );
  await expect(page.locator('#section')).toHaveText('The Chase');
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => [window.__sophie, window.__sophieStory]),
  ).toEqual([undefined, undefined]);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveAttribute(
    'src',
    /assets\/audio\/pixel-dash.mp3$/,
  );
  await expect(page.locator('audio')).toHaveJSProperty('loop', true);
  await expect(page.locator('.story-ui')).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Debug level', exact: true })
    .selectOption('attic-escape');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('#section')).toHaveText('Open air');
  await expect(page.locator('.chase-ui')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('deployed debug selector on mobile', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('loads either chapter using #debug on the Pages base path', async ({
    page,
    baseURL,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./#debug');
    const selector = page.getByRole('combobox', {
      name: 'Debug level',
      exact: true,
    });
    const load = page.getByRole('button', { name: 'Load', exact: true });
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue('attic-escape');
    const infinite = page.getByRole('checkbox', {
      name: 'Infinite dash',
      exact: true,
    });
    await expect(infinite).not.toBeChecked();
    await infinite.tap();
    await expect(infinite).toBeChecked();
    await expect(page.locator('.pad-direction')).toHaveCount(4);
    expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
    await selector.selectOption('warehouse');
    await load.tap();
    await expect(infinite).toBeChecked();
    await expect(page.locator('#world')).toHaveAttribute(
      'aria-label',
      'Sophie and Jimmy exploring a warehouse',
    );
    const music = page.locator('audio');
    await expect(music).toHaveAttribute(
      'src',
      new URL('assets/audio/factory-pulse.mp3', baseURL!).pathname,
    );
    await expect(music).toHaveJSProperty('loop', true);
    await expect
      .poll(() =>
        music.evaluate((audio: HTMLAudioElement) => audio.currentTime),
      )
      .toBeGreaterThan(0);
    await selector.selectOption('skyscraper');
    await load.tap();
    await expect(page.locator('#section')).toHaveText('Up from here');
    await expect(music).toHaveAttribute(
      'src',
      new URL('assets/audio/city-lights-above.mp3', baseURL!).pathname,
    );
    await expect(music).toHaveJSProperty('loop', true);
    await expect(page.locator('.touch-controls')).toBeVisible();
    await page.getByRole('button', { name: 'Jump', exact: true }).tap();
    expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
    await page.getByRole('button', { name: 'Pause game' }).tap();
    await selector.selectOption('attic-escape');
    await load.tap();
    await expect(page.locator('#section')).toHaveText('Open air');
    await expect(
      page.getByRole('button', { name: 'Pause game' }),
    ).toBeVisible();
    await expect(music).toHaveAttribute(
      'src',
      new URL('assets/audio/rooftop-dash.mp3', baseURL!).pathname,
    );
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(music).toHaveCount(1);
    for (const size of [
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      const box = (await page.locator('.debug-level-selector').boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      const pause = (await page.locator('#pause').boundingBox())!;
      const checkbox = (await infinite.boundingBox())!;
      expect(checkbox.x).toBeGreaterThanOrEqual(box.x);
      expect(checkbox.x + checkbox.width).toBeLessThanOrEqual(
        box.x + box.width,
      );
      expect(box.x + box.width).toBeLessThanOrEqual(pause.x);
      expect(pause.x + pause.width).toBeLessThanOrEqual(size.width);
    }
    await page.evaluate(() => {
      location.hash = '';
    });
    await expect(selector).toHaveCount(0);
    await expect(infinite).toHaveCount(0);
    await expect(page.locator('.chapter')).toBeVisible();
    expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

test('built application loads assets, draws, accepts input, and survives resize under its base path', async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  const assets: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('requestfailed', (r) => {
    // Media streams may cancel a metadata range before requesting the playback range.
    if (
      r.resourceType() === 'media' &&
      r.failure()?.errorText === 'net::ERR_ABORTED'
    )
      return;
    errors.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    if (r.url().includes('/assets/')) assets.push(r.url());
  });
  await page.goto('./?test&level=warehouse');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => assets.some((url) => url.endsWith('/assets/sophie.png')))
    .toBe(true);
  await expect(page.locator('#section')).toHaveText('Open air');
  expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
  // Keep a sample in the test's page context; no production debug API is needed.
  await page.waitForTimeout(180);
  await canvas.evaluate((c) => {
    const a = c as HTMLCanvasElement;
    (window as Window & { pixelBaseline?: Uint8ClampedArray }).pixelBaseline = a
      .getContext('2d')!
      .getImageData(0, 0, a.width, a.height).data;
  });
  await page.keyboard.down('ArrowRight');
  const music = page.locator('audio');
  await expect
    .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(0);
  expect(await music.evaluate((a: HTMLAudioElement) => a.currentSrc)).toBe(
    new URL('assets/audio/rooftop-dash.mp3', baseURL!).href,
  );
  await expect(music).toHaveJSProperty('loop', true);
  await expect(music).toHaveJSProperty('error', null);
  await page.waitForTimeout(520);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(music).toHaveJSProperty('paused', true);
  await expect(
    page.getByRole('heading', { name: 'A little breather.' }),
  ).toBeVisible();
  const changedFraction = await canvas.evaluate((c) => {
    const a = c as HTMLCanvasElement,
      after = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
    const before = (window as Window & { pixelBaseline?: Uint8ClampedArray })
      .pixelBaseline!;
    let changed = 0;
    for (let i = 0; i < after.length; i += 4)
      if (
        after[i] !== before[i] ||
        after[i + 1] !== before[i + 1] ||
        after[i + 2] !== before[i + 2]
      )
        changed++;
    return changed / (a.width * a.height);
  });
  expect(changedFraction).toBeGreaterThan(0.0025);
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id))
    .toBe('app');
  await expect(music).toHaveJSProperty('paused', true);
  await page
    .getByRole('button', { name: 'Exit Full Screen', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement))
    .toBeNull();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  expect(
    await canvas.evaluate((c) => getComputedStyle(c).imageRendering),
  ).toMatch(/pixelated|crisp-edges/);
  expect(
    await canvas.evaluate(
      (c) => (c as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled,
    ),
  ).toBe(false);
  await expect(page.locator('#dash-hud')).toBeVisible();
  const hud = await page.locator('#dash-hud').boundingBox();
  expect(hud!.x + hud!.width).toBeLessThanOrEqual(390);
  expect(assets.every((url) => url.startsWith(baseURL!))).toBe(true);
  expect(errors).toEqual([]);
});

test('built URLs and original/generated images use the configured deployment path', async ({
  request,
  baseURL,
}) => {
  const html = readFileSync('dist/index.html', 'utf8');
  const basePath = new URL(baseURL!).pathname;
  const urls = Array.from(
    html.matchAll(/(?:src|href)="([^"]+)"/g),
    (match) => match[1]!,
  );
  expect(urls.length).toBeGreaterThan(2);
  for (const url of urls) {
    expect(url.startsWith(basePath)).toBe(true);
    const response = await request.get(new URL(url, baseURL!).href);
    expect(response.ok(), url).toBe(true);
  }
  for (const file of [
    'assets/sophie.png',
    'assets/sophie-source.png',
    'assets/jimmy.png',
    'assets/sparrow.png',
    'assets/sparrow-sprite.png',
  ]) {
    const response = await request.get(new URL(file, baseURL!).href);
    expect(response.ok()).toBe(true);
    const bytes = await response.body();
    expect(Array.from(bytes.subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(bytes.length).toBeGreaterThan(1000);
  }
  for (const file of [
    'rooftop-dash.mp3',
    'factory-pulse.mp3',
    'pixel-dash.mp3',
    'city-lights-above.mp3',
  ]) {
    const track = await request.get(
      new URL(`assets/audio/${file}`, baseURL!).href,
    );
    expect(track.ok()).toBe(true);
    expect(await track.body()).toEqual(
      readFileSync(`public/assets/audio/${file}`),
    );
  }
});

test('production rooftop finishes after the overnight conversation and loads the combined atlas under the Pages path', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const missing: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) missing.push(response.url());
  });
  await page.goto('./#debug');
  await page
    .getByRole('combobox', { name: 'Debug level', exact: true })
    .selectOption('interlude-2');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  for (const line of rooftopLines) {
    await expect(page.locator('.story-bubble')).toHaveAttribute(
      'aria-label',
      `${line.speaker}: ${line.text}`,
      { timeout: 15000 },
    );
    await page
      .getByRole('button', { name: 'Continue · X', exact: true })
      .click();
  }
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible({ timeout: 10000 });
  expect(
    await page.evaluate(() => [window.__sophie, window.__sophieStory]),
  ).toEqual([undefined, undefined]);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('#section')).toHaveText('Open air');
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});
