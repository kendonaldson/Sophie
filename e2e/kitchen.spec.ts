import { test, expect, devices, type Page } from '@playwright/test';
import { interlude3 as c } from '../src/game/story/interlude3';
import { sfxConfig } from '../src/game/audio/config';

declare global {
  interface Window {
    __pizzaAudio: { contexts: number; pitches: number[][]; noise: number };
  }
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.__sophieStory!.snapshot());
const tick = (page: Page, ms: number) =>
  page.evaluate((ms) => window.__sophieStory!.tick(ms), ms);
async function reach(page: Page, beat: string) {
  const s = await page.evaluate((beat) => {
    const api = window.__sophieStory!;
    for (
      let i = 0;
      i < 6000 &&
      api.snapshot().kitchen?.beat !== beat &&
      api.snapshot().phase !== 'complete';
      i++
    )
      api.tick(10);
    return api.snapshot();
  }, beat);
  expect(s.kitchen?.beat).toBe(beat);
  return s;
}
async function open(page: Page) {
  await page.goto('/?test#debug');
  await page
    .getByRole('combobox', { name: 'Debug level' })
    .selectOption('interlude-3');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.waitForFunction(
    () => window.__sophieStory?.snapshot().storyId === 'interlude-3',
  );
  await page.evaluate(() => window.__sophieStory!.manual(true));
}
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const probe = (window.__pizzaAudio = {
      contexts: 0,
      pitches: [] as number[][],
      noise: 0,
    });
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts++;
      }
      createOscillator() {
        const node = super.createOscillator(),
          pitches: number[] = [];
        const set = node.frequency.setValueAtTime.bind(node.frequency);
        node.frequency.setValueAtTime = (pitch, at) => {
          pitches.push(pitch);
          return set(pitch, at);
        };
        const start = node.start.bind(node);
        node.start = (at = 0) => {
          probe.pitches.push(pitches);
          start(at);
        };
        return node;
      }
      createBufferSource() {
        const node = super.createBufferSource(),
          start = node.start.bind(node);
        node.start = (at = 0, offset = 0, duration?: number) => {
          probe.noise++;
          start(at, offset, duration);
        };
        return node;
      }
    };
  });
}

test('kitchen stages Shelly, normal dash, pizza transformation, faster escape, and the sole ending', async ({
  page,
}) => {
  await observeAudio(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await open(page);
  await reach(page, 'line-0');
  expect((await snapshot(page)).characters).toEqual([
    'Shelly',
    'Sophie',
    'Jimmy',
  ]);
  await expect(page.locator('.story-bubble')).toHaveAttribute(
    'aria-label',
    'sophie: We did it!',
  );
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  const reveal = await reach(page, 'line-3');
  expect(reveal.kitchen!.shelly).toMatchObject({
    visible: true,
    texture: 'shelly',
  });
  expect(reveal.actors.sophie.x).toBeLessThan(reveal.kitchen!.shelly.x);
  expect(reveal.kitchen!.shelly.x).toBeLessThan(
    reveal.kitchen!.geometry.pizza.x,
  );
  await reach(page, 'line-5');
  await expect(page.locator('.story-bubble')).toHaveAttribute(
    'data-speaker',
    'shelly',
  );
  expect((await snapshot(page)).kitchen!.shelly.animation).toBe('shelly-talk');
  const dash = await reach(page, 'dash');
  expect(dash.kitchen).toMatchObject({
    dashActive: true,
    dashCharges: 0,
    powerActive: false,
    sophieTexture: 'sophie',
  });
  expect(
    (await tick(page, 50)).actors.sophie.x - dash.actors.sophie.x,
  ).toBeCloseTo(c.dashSpeed * 0.05);
  const power = await reach(page, 'activation');
  expect(power.kitchen).toMatchObject({
    pizzaTaken: true,
    powerActive: true,
    sophieTexture: 'super-pizza-sophie',
  });
  expect(power.actors.sophie.x).toBe(c.pizzaX);
  const sound = await page.evaluate(() => window.__pizzaAudio);
  expect(sound.contexts).toBe(1);
  expect(sound.pitches.filter((p) => p.length === 5)).toEqual([
    sfxConfig.pizzaPower.pitches,
  ]);
  const back = await reach(page, 'return');
  expect(back.actors.sophie.flipX).toBe(true);
  const fast = await tick(page, 50);
  expect(back.actors.sophie.x - fast.actors.sophie.x).toBeCloseTo(
    c.powerSpeed * 0.05,
  );
  await reach(page, 'line-9');
  await expect(page.locator('.story-bubble')).toHaveAttribute(
    'aria-label',
    "shelly: I'm not going to let you steal my pizza!",
  );
  await reach(page, 'escape');
  await expect(page.locator('.story-bubble')).toHaveAttribute(
    'aria-label',
    'sophie: Jimmy, run!',
  );
  await expect(page.getByRole('button', { name: 'Continue · X' })).toBeHidden();
  const start = await tick(page, c.exitDelayMs);
  const running = await tick(page, 100);
  expect(running.actors.jimmy.x - start.actors.jimmy.x).toBeCloseTo(
    c.jimmySpeed * 0.1,
  );
  expect(running.actors.sophie.x - start.actors.sophie.x).toBeCloseTo(
    c.powerSpeed * 0.1,
  );
  const contrast = await tick(page, 450);
  expect(contrast.actors.sophie).toMatchObject({ visible: false });
  expect(contrast.actors.jimmy).toMatchObject({ visible: true, pose: 'run' });
  const held = await reach(page, 'shelly-hold');
  expect(held.kitchen!.shelly.pose).toBe('determined');
  expect(held.fade).toBe(0);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  await reach(page, 'fade');
  expect((await tick(page, 380)).fade).toBeGreaterThan(0.4);
  await tick(page, 1000);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible();
  expect((await snapshot(page)).kitchen!.powerActive).toBe(false);
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'attic-escape',
  );
  await expect(page.locator('.story-ui')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(1);
  expect(await page.evaluate(() => window.__sophieStory)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('automatic kitchen choreography completes with unavailable audio and no advance or movement input', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  await tick(page, 50000);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible();
  expect((await snapshot(page)).phase).toBe('complete');
});

test.describe('mobile kitchen', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('freezes in portrait and pause, resets pizza on Restart, and cleans up debug chapter changes', async ({
    page,
  }) => {
    await observeAudio(page);
    await open(page);
    await reach(page, 'line-0');
    await tick(page, c.minimumLineMs);
    await page.getByRole('button', { name: 'Continue · X' }).tap();
    expect((await snapshot(page)).phase).toBe('pause');
    await reach(page, 'line-5');
    await expect(page.locator('.story-bubble p')).toHaveText(
      "Of course I'm real.",
    );
    const box = (await page.locator('.story-bubble').boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(844);
    await expect(page.locator('.touch-controls')).toHaveCount(0);
    await reach(page, 'activation');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    const portrait = await snapshot(page);
    await tick(page, 50000);
    expect(await snapshot(page)).toEqual(portrait);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    await page.keyboard.press('Escape');
    const paused = await snapshot(page);
    await tick(page, 50000);
    expect(await snapshot(page)).toEqual(paused);
    await page.getByRole('button', { name: 'Restart', exact: true }).tap();
    await page.waitForFunction(
      () => window.__sophieStory?.snapshot().phase === 'arrival',
    );
    await page.evaluate(() => window.__sophieStory!.manual(true));
    expect((await snapshot(page)).kitchen).toMatchObject({
      pizzaTaken: false,
      powerActive: false,
      sophieTexture: 'sophie',
      dashCharges: 1,
    });
    await reach(page, 'activation');
    expect(
      (await page.evaluate(() => window.__pizzaAudio)).pitches.filter(
        (p) => p.length === 5,
      ),
    ).toHaveLength(2);
    for (const id of [
      'maintenance-tunnels',
      'interlude-1',
      'interlude-2',
      'interlude-3',
    ]) {
      await page
        .getByRole('combobox', { name: 'Debug level' })
        .selectOption(id);
      await page.getByRole('button', { name: 'Load', exact: true }).tap();
      if (id === 'maintenance-tunnels') {
        await page.waitForFunction(() => Boolean(window.__sophie));
        await expect(page.locator('.story-ui')).toHaveCount(0);
        await expect(page.locator('.touch-controls')).toBeVisible();
      } else {
        await page.waitForFunction(
          (id) => window.__sophieStory?.snapshot().storyId === id,
          id,
        );
        await expect(page.locator('.story-ui')).toHaveCount(1);
        await expect(page.locator('.touch-controls')).toHaveCount(0);
      }
    }
    expect((await snapshot(page)).kitchen!.powerActive).toBe(false);
    expect(await page.evaluate(() => window.__pizzaAudio.contexts)).toBe(1);
  });
});
