import { expect, test, devices } from '@playwright/test';

const chapters = [
  { name: 'rooftops', url: '/?test', track: 'rooftop-dash.mp3' },
  {
    name: 'warehouse',
    url: '/?test&level=warehouse',
    track: 'factory-pulse.mp3',
  },
  { name: 'chase', url: '/?test&level=the-chase', track: 'pixel-dash.mp3' },
];

for (const chapter of chapters)
  test(`${chapter.name}: music starts on input, loops at the end, and preserves position across pause and retry`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(chapter.url);
    await page.waitForFunction(() => Boolean(window.__sophie));
    const music = page.locator('audio');
    await expect(music).toHaveCount(1);
    await expect(music).toHaveAttribute(
      'src',
      `/assets/audio/${chapter.track}`,
    );
    await expect(music).toHaveJSProperty('paused', true);
    await expect(music).toHaveJSProperty('loop', true);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
      .toBeGreaterThan(0);
    await music.evaluate((a: HTMLAudioElement) => {
      a.currentTime = a.duration - 0.25;
    });
    await expect
      .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
      .toBeLessThan(2);
    await expect(music).toHaveJSProperty('paused', false);

    await music.evaluate((a: HTMLAudioElement) => {
      a.currentTime = 20;
    });
    await page.keyboard.press('Escape');
    await expect(music).toHaveJSProperty('paused', true);
    const pausedAt = await music.evaluate(
      (a: HTMLAudioElement) => a.currentTime,
    );
    await page.waitForTimeout(150);
    expect(await music.evaluate((a: HTMLAudioElement) => a.currentTime)).toBe(
      pausedAt,
    );
    await page.getByRole('button', { name: 'Keep exploring' }).click();
    await expect
      .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
      .toBeGreaterThan(pausedAt);
    await page.keyboard.press('KeyR');
    await expect(music).toHaveCount(1);
    await expect(music).toHaveJSProperty('paused', false);
    expect(
      await music.evaluate((a: HTMLAudioElement) => a.currentTime),
    ).toBeGreaterThan(20);

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(music).toHaveJSProperty('paused', true);
    expect(errors).toEqual([]);
  });

test('an unavailable track does not prevent keyboard gameplay', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/assets/audio/rooftop-dash.mp3', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.goto('/?test');
  await page.waitForFunction(() => Boolean(window.__sophie));
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(() => page.evaluate(() => window.__sophie!.snapshot().x))
    .toBeGreaterThan(190);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

test.describe('mobile music', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  for (const chapter of chapters)
    test(`${chapter.name}: touch controls activate music and portrait pauses it until landscape returns`, async ({
      page,
    }) => {
      await page.goto(chapter.url);
      const music = page.locator('audio');
      await expect(music).toHaveJSProperty('paused', true);
      await page.getByRole('button', { name: 'Jump', exact: true }).tap();
      await expect
        .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
        .toBeGreaterThan(0);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(music).toHaveJSProperty('paused', true);
      const pausedAt = await music.evaluate(
        (a: HTMLAudioElement) => a.currentTime,
      );
      await page.setViewportSize({ width: 844, height: 390 });
      await expect
        .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
        .toBeGreaterThan(pausedAt);
      await expect(music).toHaveCount(1);
    });
});
