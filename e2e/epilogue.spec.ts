import { devices, expect, test, type Page } from '@playwright/test';
import { sfxConfig } from '../src/game/audio/config';
import {
  epilogue as c,
  epilogueBeats,
  epilogueLines,
} from '../src/game/story/epilogue';

type BeatId = (typeof epilogueBeats)[number]['id'] | 'complete';
const durationMs = epilogueBeats.reduce(
  (sum, beat) => sum + beat.durationMs,
  0,
);
const snapshot = (page: Page) =>
  page.evaluate(() => window.__sophieStory!.snapshot());
const tick = (page: Page, ms: number) =>
  page.evaluate((ms) => window.__sophieStory!.tick(ms), ms);

async function open(page: Page) {
  await page.goto('/?test#debug');
  await page.getByRole('combobox', { name: 'Debug level' }).selectOption(c.id);
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.waitForFunction(
    () => window.__sophieStory?.snapshot().storyId === 'epilogue',
  );
  await page.evaluate(() => window.__sophieStory!.manual(true));
}

async function toBeat(page: Page, beat: BeatId) {
  const state = await page.evaluate(
    ({ beat, durationMs }) => {
      const story = window.__sophieStory!;
      let state = story.snapshot();
      for (
        let elapsed = 0;
        elapsed <= durationMs && state.epilogue?.beat !== beat;
        elapsed += 50
      )
        state = story.tick(50);
      return state;
    },
    { beat, durationMs },
  );
  expect(state.epilogue!.beat).toBe(beat);
  return state;
}

interface EndingTone {
  speaker: string;
  pitch: number;
}
declare global {
  interface Window {
    __endingTones: EndingTone[];
  }
}

async function observeDialogueTones(page: Page) {
  await page.addInitScript(() => {
    window.__endingTones = [];
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      createOscillator() {
        const node = super.createOscillator();
        let pitch = 0;
        const set = node.frequency.setValueAtTime.bind(node.frequency);
        node.frequency.setValueAtTime = (value, at) => {
          pitch = value;
          return set(value, at);
        };
        const start = node.start.bind(node);
        node.start = (at) => {
          const bubble = document.querySelector<HTMLElement>('.story-bubble');
          if (bubble && !bubble.hidden && bubble.dataset.speaker)
            window.__endingTones.push({
              speaker: bubble.dataset.speaker,
              pitch,
            });
          start(at);
        };
        return node;
      }
    };
  });
}

test('the automatic ending stages the bus, unseen family, dog exit, last joke, silence, and THE END', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' && /animation|frame/i.test(message.text()))
      errors.push(message.text());
  });
  await observeDialogueTones(page);
  await open(page);
  const initial = await snapshot(page);
  expect(initial.characters).toEqual(['Sophie', 'Jimmy']);
  expect(initial.epilogue!.environment).toBe('exterior');
  expect(initial.actors.sophie).toMatchObject({ visible: false });
  expect(initial.actors.jimmy).toMatchObject({ visible: false });
  expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await expect(page.locator('.story-next')).toBeHidden();
  await expect(page.locator('#dash-hud')).toBeHidden();
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveJSProperty('loop', false);
  if (c.music)
    await expect(page.locator('audio')).toHaveAttribute(
      'src',
      new URL(c.music, page.url()).pathname,
    );
  else await expect(page.locator('audio')).not.toHaveAttribute('src');
  for (const key of ['ArrowRight', 'KeyZ', 'Space', 'KeyX', 'KeyR'])
    await page.keyboard.press(key);
  expect((await snapshot(page)).actors).toEqual(initial.actors);
  expect((await snapshot(page)).epilogue!.beat).toBe(initial.epilogue!.beat);

  await toBeat(page, 'bus-arrive');
  const moving = await tick(page, 1600);
  expect(moving.epilogue!.bus.visible).toBe(true);
  expect(moving.epilogue!.bus.x).toBeGreaterThan(c.busEntryX);
  expect(moving.epilogue!.bus.x).toBeLessThan(c.busStopX);
  const stopped = await toBeat(page, 'bus-door');
  expect(stopped.epilogue!.bus).toEqual({
    x: c.busStopX,
    visible: true,
    doorOpen: true,
  });
  expect(stopped.line).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath('bus-at-home.png') });
  await toBeat(page, 'bus-depart');
  expect((await tick(page, 1200)).epilogue!.bus.x).toBeGreaterThan(c.busStopX);
  const exteriorHold = await toBeat(page, 'exterior-hold');
  expect(exteriorHold.epilogue!.bus.visible).toBe(false);

  await toBeat(page, 'bedroom');
  const bedroom = await tick(page, c.fadeInMs);
  expect(bedroom.epilogue!.environment).toBe('bedroom');
  expect(bedroom.animations).toEqual({ sophie: 'idle', jimmy: 'jimmy-sit' });
  expect(bedroom.actors.sophie).toMatchObject({ visible: true });
  expect(bedroom.actors.jimmy).toMatchObject({ visible: true });
  expect(bedroom.characters).toEqual(['Sophie', 'Jimmy']);
  await page.screenshot({ path: testInfo.outputPath('quiet-bedroom.png') });
  const camera = bedroom.epilogue!.camera;
  const bubble = page.locator('.story-bubble');
  const humanBorders: string[] = [];
  for (const [index, line] of epilogueLines.slice(0, 6).entries()) {
    const state = await toBeat(page, `line-${index}`);
    expect(state.line).toEqual(line);
    await expect(bubble.locator('p')).toHaveText(line.text);
    await expect(bubble).toHaveAttribute('data-speaker', line.speaker);
    expect(state.characters).toEqual(['Sophie', 'Jimmy']);
    expect(state.epilogue!.camera).toEqual(camera);
    if (
      line.speaker === 'lizzy' ||
      line.speaker === 'paul' ||
      line.speaker === 'iris'
    ) {
      await expect(bubble.locator('strong')).toHaveText(
        `${line.speaker.toUpperCase()} · OFF SCREEN`,
      );
      await expect(bubble).toHaveAttribute('data-offscreen', 'true');
      expect(await bubble.evaluate((element) => element.style.right)).toBe(
        '18px',
      );
      if (index !== 2)
        humanBorders.push(
          await bubble.evaluate(
            (element) => getComputedStyle(element).borderRightColor,
          ),
        );
    }
    if (index === 1) expect(state.animations.jimmy).toBe('jimmy-idle');
    if (index === 4) {
      expect(state.actors.sophie.flipX).toBe(false);
      expect(state.actors.jimmy.flipX).toBe(false);
    }
  }
  expect(new Set(humanBorders).size).toBe(3);
  const tones = await page.evaluate(() => window.__endingTones);
  for (const speaker of ['lizzy', 'paul', 'iris'] as const) {
    const voice = tones.filter((tone) => tone.speaker === speaker);
    expect(voice.length).toBeGreaterThan(0);
    const profile = sfxConfig.dialogue.profiles[speaker];
    for (const tone of voice) {
      expect(tone.pitch).toBeGreaterThanOrEqual(
        profile.basePitch - profile.variation,
      );
      expect(tone.pitch).toBeLessThanOrEqual(
        profile.basePitch + profile.variation,
      );
    }
  }

  await toBeat(page, 'leave');
  const walking = await tick(page, 1200);
  expect(walking.animations).toEqual({ sophie: 'walk', jimmy: 'jimmy-walk' });
  expect(walking.actors.sophie.x).toBeGreaterThan(c.sophieX);
  expect(walking.actors.jimmy.x).toBeGreaterThan(c.jimmyX);
  expect(walking.epilogue!.camera).toEqual(camera);
  const reunion = await toBeat(page, 'reunion');
  expect(reunion.actors.sophie).toMatchObject({ visible: false });
  expect(reunion.actors.jimmy).toMatchObject({ visible: false });
  expect(reunion.line).toBeUndefined();
  expect(reunion.epilogue!.camera).toEqual(camera);
  await page.screenshot({ path: testInfo.outputPath('empty-bedroom.png') });
  const final = await toBeat(page, 'line-6');
  expect(final.line).toEqual(epilogueLines.at(-1));
  expect(final.epilogue!.music.volume).toBe(c.punchlineVolume);
  await expect(bubble.locator('p')).toHaveText(
    'Why does Sophie smell like pizza?',
  );
  await page.screenshot({ path: testInfo.outputPath('pizza-punchline.png') });
  await toBeat(page, 'silence');
  await expect(bubble).toBeHidden();
  const silentTones = await page.evaluate(() => window.__endingTones.length);
  await toBeat(page, 'fade');
  const halfway = await tick(page, c.fadeOutMs / 2);
  expect(halfway.fade).toBeGreaterThanOrEqual(0.5);
  expect(halfway.fade).toBeLessThan(0.55);
  expect(halfway.epilogue!.music.volume).toBeCloseTo(
    c.punchlineVolume * (1 - halfway.fade),
  );
  await expect(page.locator('.epilogue-end')).toBeHidden();
  const end = await toBeat(page, 'complete');
  expect(end.fade).toBe(1);
  expect(end.epilogue!.music.volume).toBe(0);
  expect(end.epilogue!.theEnd).toBe(true);
  expect(end.epilogue!.camera).toEqual(camera);
  expect(end.line).toBeUndefined();
  await expect(page.locator('#fade')).toHaveCSS('opacity', '1');
  await expect(page.locator('audio')).toHaveJSProperty('volume', 0);
  await expect(page.locator('.epilogue-end')).toHaveText('THE END');
  await expect(page.locator('.epilogue-end')).toBeVisible();
  await tick(page, 30000);
  await page.keyboard.press('KeyX');
  expect(await snapshot(page)).toEqual(end);
  expect(await page.evaluate(() => window.__endingTones.length)).toBe(
    silentTones,
  );
  await page.screenshot({ path: testInfo.outputPath('the-end.png') });
  expect(errors).toEqual([]);
});

test.describe('mobile epilogue', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('keeps the fixed bedroom visible, freezes in portrait and pause, and cleans up when debugging another chapter', async ({
    page,
  }) => {
    await open(page);
    await toBeat(page, 'line-0');
    await expect(page.locator('.touch-controls')).toHaveCount(0);
    await expect(page.locator('.story-next')).toBeHidden();
    const bubble = (await page.locator('.story-bubble').boundingBox())!;
    const shell = (await page.locator('.game-shell').boundingBox())!;
    expect(bubble.x).toBeGreaterThanOrEqual(shell.x);
    expect(bubble.x + bubble.width).toBeLessThanOrEqual(shell.x + shell.width);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    const portrait = await snapshot(page);
    await tick(page, durationMs);
    expect(await snapshot(page)).toEqual(portrait);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    await page.getByRole('button', { name: 'Pause game' }).tap();
    const paused = await snapshot(page);
    await tick(page, durationMs);
    expect(await snapshot(page)).toEqual(paused);
    await page.getByRole('button', { name: 'Continue', exact: true }).tap();
    expect((await snapshot(page)).paused).toBe(false);
    await toBeat(page, 'complete');
    await expect(page.locator('.epilogue-end')).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Debug level' })
      .selectOption('attic-escape');
    await page.getByRole('button', { name: 'Load', exact: true }).tap();
    await page.waitForFunction(() => Boolean(window.__sophie));
    await expect(page.locator('.epilogue-end')).toHaveCount(0);
    await expect(page.locator('.story-ui')).toHaveCount(0);
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('audio')).toHaveCount(1);
    await expect(page.locator('audio')).toHaveJSProperty('loop', true);
    expect(await page.evaluate(() => window.__sophieStory)).toBeUndefined();
  });
});
