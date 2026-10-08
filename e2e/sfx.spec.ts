import { devices, expect, test, type Page } from '@playwright/test';

interface ToneRecord {
  waveform: string;
  pitch: number;
  duration: number;
  at: number;
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
        const record = { waveform: '', pitch: 0, duration: 0, at: 0 };
        const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
        // The instantaneous value can still be its default before the audio
        // thread processes this quantum. Probe scheduled pitch instead.
        node.frequency.setValueAtTime = (value, when) => {
          record.pitch = value;
          return setFrequency(value, when);
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
