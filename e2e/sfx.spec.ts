import { devices, expect, test, type Page } from '@playwright/test';
import { sfxConfig } from '../src/game/audio/config';

interface ToneRecord {
  waveform: string;
  pitch: number;
  duration: number;
  at: number;
  peakPitch?: number;
  peakAfter?: number;
}
declare global {
  interface Window {
    __sfxProbe: {
      contexts: AudioContext[];
      tones: ToneRecord[];
      noiseBursts: number;
      activeSources: number;
    };
  }
}
async function probeAudio(page: Page) {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    const probe = (window.__sfxProbe = {
      contexts: [] as AudioContext[],
      tones: [] as ToneRecord[],
      noiseBursts: 0,
      activeSources: 0,
    });
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts.push(this);
      }
      createOscillator() {
        const node = super.createOscillator();
        const start = node.start.bind(node),
          stop = node.stop.bind(node);
        let at = 0;
        const record: ToneRecord = {
          waveform: '',
          pitch: 0,
          duration: 0,
          at: 0,
        };
        const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
        // The instantaneous value can still be its default before the audio
        // thread processes this quantum. Probe scheduled pitch instead.
        node.frequency.setValueAtTime = (value, when) => {
          record.pitch = value;
          return setFrequency(value, when);
        };
        const setCurve = node.frequency.setValueCurveAtTime.bind(
          node.frequency,
        );
        node.frequency.setValueCurveAtTime = (values, when, duration) => {
          record.pitch = values[0]!;
          record.peakPitch = values[values.length - 1]!;
          record.peakAfter = duration;
          return setCurve(values, when, duration);
        };
        node.start = (when = 0) => {
          at = when;
          record.at = when;
          record.waveform = node.type;
          probe.tones.push(record);
          probe.activeSources++;
          start(when);
        };
        node.stop = (when?: number) => {
          if (when !== undefined) record.duration = when - at;
          stop(when);
        };
        node.addEventListener('ended', () => probe.activeSources--, {
          once: true,
        });
        return node;
      }
      createBufferSource() {
        const node = super.createBufferSource();
        const start = node.start.bind(node);
        node.start = (when?: number, offset?: number, duration?: number) => {
          probe.noiseBursts++;
          probe.activeSources++;
          start(when, offset, duration);
        };
        node.addEventListener('ended', () => probe.activeSources--, {
          once: true,
        });
        return node;
      }
    };
  });
}
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}
const audioState = (page: Page) =>
  page.evaluate(() => ({
    contexts: window.__sfxProbe.contexts.length,
    state: window.__sfxProbe.contexts[0]?.state,
    tones: window.__sfxProbe.tones,
    noise: window.__sfxProbe.noiseBursts,
    active: window.__sfxProbe.activeSources,
  }));

test('keyboard gesture unlocks one context; successful jumps/dashes sound once and failed dashes are silent', async ({
  page,
}) => {
  await probeAudio(page);
  const errors = collectErrors(page);
  await page.goto('/?test');
  await page.waitForFunction(() => window.__sophie?.snapshot().grounded);
  expect((await audioState(page)).contexts).toBe(0);
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' })),
  );
  expect((await audioState(page)).contexts).toBe(0);
  await page.keyboard.down('KeyZ');
  await expect.poll(async () => (await audioState(page)).state).toBe('running');
  await expect
    .poll(
      async () =>
        (await audioState(page)).tones.filter(
          (tone) => tone.waveform === 'square',
        ).length,
    )
    .toBe(1);
  await page.keyboard.up('KeyZ');
  await page.evaluate(() => {
    window.__sophie!.manual(true);
    window.__sophie!.restart();
    window.__sophie!.manual(true);
    window.__sophie!.advance(4);
    window.__sophie!.advance(1, { jumpPressed: true, jumpHeld: true });
    window.__sophie!.advance(12, { jumpHeld: true });
    window.__sophie!.advance(1, { dashPressed: true, aimY: -1 });
    window.__sophie!.advance(25);
  });
  const before = await audioState(page);
  expect(before.contexts).toBe(1);
  expect(
    before.tones.filter((tone) => tone.waveform === 'square'),
  ).toHaveLength(2);
  expect(before.noise).toBe(1);
  expect(
    before.tones.find((tone) => tone.waveform === 'square')!.duration,
  ).toBeCloseTo(0.11);
  expect(
    before.tones.find((tone) => tone.waveform === 'triangle')!.duration,
  ).toBeCloseTo(0.14);
  const failed = await page.evaluate(() =>
    window.__sophie!.advance(1, { dashPressed: true }),
  );
  expect(failed.charges).toBe(0);
  expect((await audioState(page)).noise).toBe(1);
  await expect.poll(async () => (await audioState(page)).active).toBe(0);
  await page.evaluate(() => window.__sfxProbe.contexts[0]!.suspend());
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await audioState(page)).state).toBe('running');
  expect((await audioState(page)).contexts).toBe(1);
  await expect(page.locator('audio')).toHaveJSProperty('paused', false);
  expect(errors).toEqual([]);
});

test('dialogue reveals letters with bounded boops, distinct voices, responsive advance and clean replay', async ({
  page,
}) => {
  await probeAudio(page);
  const errors = collectErrors(page);
  await page.goto('/?test#debug');
  await page
    .getByRole('combobox', { name: 'Debug level', exact: true })
    .selectOption('interlude-1');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  const bubble = page.locator('.story-bubble');
  await expect(bubble).toHaveAttribute('data-speaker', 'sophie');
  await expect
    .poll(async () => (await audioState(page)).tones.length)
    .toBeGreaterThan(1);
  const partial = await bubble.locator('p').textContent();
  expect(partial!.length).toBeLessThan(73);
  await page.waitForFunction(() => window.__sophieStory?.snapshot().canAdvance);
  await page.keyboard.press('KeyX');
  await expect(bubble).toHaveAttribute('data-speaker', 'jimmy');
  await expect(bubble.locator('p')).toHaveText("I've practiced a lot.");
  const tones = (await audioState(page)).tones;
  expect(tones.some((tone) => tone.pitch >= 615 && tone.pitch <= 705)).toBe(
    true,
  );
  expect(tones.some((tone) => tone.pitch >= 405 && tone.pitch <= 475)).toBe(
    true,
  );
  expect(tones.length).toBeLessThan(25);
  expect(tones.every((tone) => Math.abs(tone.duration - 0.03) < 0.001)).toBe(
    true,
  );
  for (let i = 1; i < tones.length; i++)
    expect(tones[i]!.at - tones[i - 1]!.at).toBeGreaterThanOrEqual(0.064);
  await page.keyboard.press('KeyX');
  await expect(bubble).toHaveAttribute('data-speaker', 'sophie');
  await expect
    .poll(async () => (await audioState(page)).tones.length)
    .toBeGreaterThan(tones.length + 1);
  await page.keyboard.press('Escape');
  const pausedCount = (await audioState(page)).tones.length;
  await page.waitForTimeout(200);
  expect((await audioState(page)).tones).toHaveLength(pausedCount);
  await expect.poll(async () => (await audioState(page)).active).toBe(0);
  await page
    .getByRole('combobox', { name: 'Debug level', exact: true })
    .selectOption('attic-escape');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__sophie));
  await expect(page.locator('.story-ui')).toHaveCount(0);
  expect((await audioState(page)).contexts).toBe(1);
  await page.keyboard.press('KeyZ');
  await expect.poll(async () => (await audioState(page)).active).toBe(0);
  expect(errors).toEqual([]);
});

test('unavailable Web Audio does not prevent keyboard gameplay or dialogue', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  const errors = collectErrors(page);
  await page.goto('/?test#debug');
  await page.waitForFunction(() => Boolean(window.__sophie));
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(() => page.evaluate(() => window.__sophie!.snapshot().x))
    .toBeGreaterThan(190);
  await page.keyboard.up('ArrowRight');
  await page
    .getByRole('combobox', { name: 'Debug level', exact: true })
    .selectOption('interlude-1');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('.story-bubble p')).toContainText(
    'Thanks for the help back there.',
  );
  await page.keyboard.press('KeyX');
  await expect(page.locator('.story-bubble p')).toHaveText(
    "I've practiced a lot.",
  );
  expect(errors).toEqual([]);
});

test.describe('mobile procedural audio', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('first touch unlocks audio; jump, dash and mobile dialogue reuse it alongside music', async ({
    page,
  }) => {
    await probeAudio(page);
    const errors = collectErrors(page);
    await page.goto('/?test#debug');
    await page.waitForFunction(() => window.__sophie?.snapshot().grounded);
    expect((await audioState(page)).contexts).toBe(0);
    await page.getByRole('button', { name: 'Jump', exact: true }).tap();
    await expect
      .poll(async () => (await audioState(page)).state)
      .toBe('running');
    await page.getByRole('button', { name: 'Dash', exact: true }).tap();
    await expect.poll(async () => (await audioState(page)).noise).toBe(1);
    await expect(page.locator('audio')).toHaveJSProperty('paused', false);
    await page
      .getByRole('combobox', { name: 'Debug level', exact: true })
      .selectOption('interlude-1');
    await page.getByRole('button', { name: 'Load', exact: true }).tap();
    await expect(page.locator('.story-bubble')).toHaveAttribute(
      'data-speaker',
      'sophie',
    );
    await page.getByRole('button', { name: 'Continue · X', exact: true }).tap();
    await expect(page.locator('.story-bubble')).toHaveAttribute(
      'data-speaker',
      'jimmy',
    );
    await expect(page.locator('.story-bubble p')).toHaveText(
      "I've practiced a lot.",
    );
    expect((await audioState(page)).contexts).toBe(1);
    await expect.poll(async () => (await audioState(page)).active).toBe(0);
    expect(errors).toEqual([]);
  });
});

test('the chase reuses interlude audio for movement and off-screen dialogue, including pause and cleanup', async ({
  page,
}) => {
  await probeAudio(page);
  const errors = collectErrors(page);
  await page.goto('/?test#debug');
  const select = page.getByRole('combobox', {
    name: 'Debug level',
    exact: true,
  });
  const load = page.getByRole('button', { name: 'Load', exact: true });
  await select.selectOption('interlude-1');
  await load.click();
  await expect
    .poll(async () => (await audioState(page)).tones.length)
    .toBeGreaterThan(0);
  await select.selectOption('the-chase');
  await load.click();
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'the-chase',
  );
  await page.evaluate(() => window.__sophie!.manual(true));
  await expect(page.locator('.chase-ui p')).toHaveText(
    "Run, Jimmy, or we'll be caught!",
  );
  expect((await audioState(page)).contexts).toBe(1);
  // The new streamed music element activates on the first gameplay gesture.
  await page.keyboard.press('KeyA');
  await expect(page.locator('audio')).toHaveJSProperty('paused', false);
  const beforeMove = await audioState(page);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.advance(1, { jumpPressed: true, jumpHeld: true });
    a.advance(12, { jumpHeld: true });
    a.advance(1, { dashPressed: true, aimY: -1 });
  });
  const afterMove = await audioState(page);
  expect(afterMove.noise).toBe(beforeMove.noise + 1);
  expect(
    afterMove.tones.filter((tone) => tone.waveform === 'square'),
  ).toHaveLength(1);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.chaseSection(6730);
    a.advance(1);
    a.advance(110);
  });
  await expect(page.locator('.chase-ui p')).toHaveText('Gotcha.');
  const gotcha = await audioState(page);
  expect(
    gotcha.tones.some((tone) => tone.pitch >= 305 && tone.pitch <= 355),
  ).toBe(true);
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
  // Advance to a longer line and pause its reveal before it can finish.
  await page.evaluate(() => window.__sophie!.advance(215));
  await expect(page.locator('.chase-ui .story-bubble')).toHaveAttribute(
    'aria-label',
    "offscreen: Okay, let's get you two home.",
  );
  await expect
    .poll(async () => (await audioState(page)).tones.length)
    .toBeGreaterThan(gotcha.tones.length);
  await page.keyboard.press('Escape');
  const paused = await audioState(page);
  const text = await page.locator('.chase-ui p').textContent();
  await page.waitForTimeout(220);
  expect((await audioState(page)).tones).toHaveLength(paused.tones.length);
  expect(await page.locator('.chase-ui p').textContent()).toBe(text);
  await select.selectOption('attic-escape');
  await load.click();
  await expect(page.locator('.chase-ui')).toHaveCount(0);
  await expect.poll(async () => (await audioState(page)).active).toBe(0);
  expect((await audioState(page)).contexts).toBe(1);
  expect(errors).toEqual([]);
});

for (const available of [true, false])
  test(`Jimmy's two scripted launches complete with ${available ? 'shared procedural' : 'unavailable'} audio`, async ({
    page,
  }) => {
    await probeAudio(page);
    if (!available)
      await page.addInitScript(() => {
        Object.defineProperty(window, 'AudioContext', { value: undefined });
        Object.defineProperty(window, 'webkitAudioContext', {
          value: undefined,
        });
      });
    const errors = collectErrors(page);
    await page.goto('/?test&level=warehouse');
    await page.waitForFunction(() => window.__sophie?.snapshot().jimmy);
    await page.evaluate(() => {
      window.__sophie!.manual(true);
      window.__sophie!.advance(430);
    });
    await page.keyboard.press('KeyA');
    const ordinary = await page.evaluate(() => {
      const a = window.__sophie!;
      a.advance(1, { jumpPressed: true, jumpHeld: true });
      return a.advance(40, { jumpHeld: true });
    });
    expect(ordinary.jimmy!.vy).toBeLessThan(0);
    expect(
      (await audioState(page)).tones.filter(
        (t) => t.pitch === sfxConfig.jimmySuperJump.anticipationStartFrequency,
      ),
    ).toHaveLength(0);
    expect(
      (await audioState(page)).tones.filter((t) => t.peakPitch),
    ).toHaveLength(0);
    await expect.poll(async () => (await audioState(page)).active).toBe(0);
    const sling = await page.evaluate(() => {
      const a = window.__sophie!;
      a.checkpoint('final-runway');
      a.advance(100, { moveX: 1 });
      a.advance(9, { moveX: 1, dashPressed: true });
      let s = a.advance(20, { moveX: 1, jumpPressed: true, jumpHeld: true });
      for (let i = 0; i < 140 && !s.finale; i++)
        s = a.advance(1, { moveX: 1, jumpHeld: true });
      return s;
    });
    expect(sling.finale).toBe('freeze');
    await expect.poll(async () => (await audioState(page)).active).toBe(0);
    await page.evaluate(() => {
      const a = window.__sophie!;
      for (let i = 0; i < 300 && a.snapshot().finale !== 'sling'; i++)
        a.advance(1);
    });
    const afterSling = await audioState(page);
    const lowSprings = afterSling.tones.filter(
      (t) => t.pitch === sfxConfig.jimmySuperJump.anticipationStartFrequency,
    );
    expect(lowSprings).toHaveLength(available ? 1 : 0);
    const launches = afterSling.tones.filter((t) => t.peakPitch);
    expect(launches).toHaveLength(available ? 1 : 0);
    if (available) {
      expect(launches[0]!.peakPitch).toBe(
        sfxConfig.jimmySuperJump.endFrequency,
      );
      expect(launches[0]!.peakAfter).toBeCloseTo(
        sfxConfig.jimmySuperJump.launchMs / 1000,
      );
    }
    const landed = await page.evaluate(() => window.__sophie!.advance(150));
    expect(landed.finaleComplete).toBe(true);
    expect(landed.grounded).toBe(true);
    const moved = await page.evaluate(() =>
      window.__sophie!.advance(10, { moveX: 1 }),
    );
    expect(moved.x).toBeGreaterThan(landed.x);
    await expect(page.locator('audio')).toHaveJSProperty('volume', 0.5);

    await page.evaluate(() => {
      const a = window.__sophie!;
      a.loadLevel('the-chase');
      a.manual(true);
      a.chaseSection(6730);
      a.advance(1);
      for (let i = 0; i < 800 && a.snapshot().chase!.phase !== 'launch'; i++)
        a.advance(1);
    });
    expect(
      (await audioState(page)).tones.filter((t) => t.peakPitch),
    ).toHaveLength(available ? 2 : 0);
    await expect(page.locator('audio')).toHaveJSProperty('volume', 0);
    await expect(page.locator('audio')).toHaveJSProperty('paused', true);
    // Interrupt a live sweep: no hanging spring, replay on resume, or music restart.
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await audioState(page)).active).toBe(0);
    await page.keyboard.press('Escape');
    const empty = await page.evaluate(() => window.__sophie!.advance(30));
    expect(empty.chase!.phase).toBe('empty');
    expect(empty.y + 6).toBeLessThan(120);
    expect(empty.jimmy!.y + 6).toBeLessThan(120);
    const joke = await page.evaluate(() => window.__sophie!.advance(80));
    expect(joke.chase!.line).toBe('WHAT IN THE WORLD?!');
    await expect(page.locator('.chase-ui p')).toHaveText('WHAT IN THE WORLD?!');
    await page.evaluate(() => window.__sophie!.advance(400));
    await expect(
      page.getByRole('heading', { name: 'TO BE CONTINUED' }),
    ).toBeVisible();
    expect(
      (await audioState(page)).tones.filter((t) => t.peakPitch),
    ).toHaveLength(available ? 2 : 0);
    expect((await audioState(page)).contexts).toBe(available ? 1 : 0);
    await expect(page.locator('audio')).toHaveJSProperty('paused', true);
    expect(errors).toEqual([]);
  });
