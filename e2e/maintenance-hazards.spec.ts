import { devices, expect, test, type Page } from '@playwright/test';
import { maintenance } from '../src/game/levels/maintenance';
import { sfxConfig } from '../src/game/audio/config';
import { simulation } from '../src/game/config/physics';
import { steamCycleMs } from '../src/game/steam/SteamCycle';

const state = (page: Page) => page.evaluate(() => window.__sophie!.snapshot());
async function open(page: Page) {
  await page.goto('/?test&level=maintenance-tunnels#debug');
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'maintenance-tunnels',
  );
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.manual(true);
    a.loadLevel('maintenance-tunnels');
  });
}

test('opens on safe floor with Jimmy, the supplied rat animation, and music awaiting its track', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ratAsset = page.waitForResponse((r) =>
    r.url().endsWith('/assets/rat-atlas.png'),
  );
  await open(page);
  expect((await ratAsset).ok()).toBe(true);
  const initial = await state(page);
  expect(initial).toMatchObject({ x: 185, y: 500, grounded: true, charges: 1 });
  expect(initial.jimmy).toMatchObject({ x: 140, y: 500, enabled: true });
  expect(initial.maintenance!.rats).toHaveLength(
    maintenance.maintenance!.rats.length,
  );
  expect(initial.maintenance!.rats.every((r) => r.frame === 0)).toBe(true);
  await page.evaluate(() => window.__sophie!.advance(10));
  expect((await state(page)).maintenance!.rats[0]!.frame).toBe(1);
  await expect(page.locator('audio')).not.toHaveAttribute('src');
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await page.evaluate(() => window.__sophie!.manual(false));
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyZ');
  await expect.poll(async () => (await state(page)).y).toBeLessThan(490);
  await page.keyboard.up('KeyZ');
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

test('rat contact squeaks once for Sophie and quickly restores the checkpoint; Jimmy stays harmless', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    const probe = ((
      window as Window & {
        ratAudio?: { tones: { duration: number; pitch: number }[] };
      }
    ).ratAudio = { tones: [] as { duration: number; pitch: number }[] });
    window.AudioContext = class extends NativeContext {
      createOscillator() {
        const node = super.createOscillator(),
          start = node.start.bind(node),
          stop = node.stop.bind(node),
          setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
        const tone = { duration: 0, pitch: 0 };
        let at = 0;
        node.frequency.setValueAtTime = (value, when) => {
          if (!tone.pitch) tone.pitch = value;
          return setFrequency(value, when);
        };
        node.start = (when = 0) => {
          at = when;
          probe.tones.push(tone);
          start(when);
        };
        node.stop = (when?: number) => {
          if (when !== undefined) tone.duration = when - at;
          stop(when);
        };
        return node;
      }
    };
  });
  await open(page);
  await page.keyboard.press('KeyA');
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('rat-introduction');
    const initial = a.snapshot();
    const rat = initial.maintenance!.rats[0]!;
    a.place({ x: rat.x, y: rat.y }, true);
    const jimmyHit = a.advance(1);
    const target = jimmyHit.maintenance!.rats[0]!;
    a.place({ x: target.x, y: target.y });
    const sophieHit = a.advance(1);
    let reset = a.advance(10);
    for (let i = 0; i < 40 && reset.respawning; i++) reset = a.advance(1);
    return { initial, jimmyHit, sophieHit, reset };
  });
  expect(result.jimmyHit.respawning).toBe(false);
  expect(result.sophieHit.respawning).toBe(true);
  expect(result.reset).toMatchObject({
    x: 1160,
    y: 500,
    vx: 0,
    vy: 0,
    charges: 1,
    checkpoint: 'rat-introduction',
    respawning: false,
  });
  expect(result.reset.jimmy).toMatchObject({ x: 1145, y: 500, enabled: true });
  expect(result.reset.maintenance!.rats).toEqual(
    result.initial.maintenance!.rats,
  );
  const tones = await page.evaluate(
    () =>
      (
        window as Window & {
          ratAudio?: { tones: { duration: number; pitch: number }[] };
        }
      ).ratAudio!.tones,
  );
  expect(tones).toHaveLength(1);
  expect(tones[0]!.pitch).toBe(sfxConfig.ratSqueak.startFrequency);
  expect(tones[0]!.duration).toBeCloseTo(sfxConfig.ratSqueak.durationMs / 1000);
});

test('steam warns and hisses before firing, ignores Jimmy, and resets Sophie to a clear cycle', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('first-furnace');
    const initial = a.snapshot();
    const phases: string[] = [];
    for (let i = 0; i < 800; i++) {
      const s = a.advance(1),
        phase = s.maintenance!.steam[0]!.phase;
      if (phases.at(-1) !== phase) phases.push(phase);
      if (phase === 'active') break;
    }
    const steam = a.snapshot().maintenance!.steam[0]!;
    const hit = { x: steam.x + steam.width / 2, y: steam.floorY - 25 };
    a.place(hit, true);
    const jimmyHit = a.advance(1);
    a.place(hit);
    const sophieHit = a.advance(1);
    let reset = sophieHit;
    for (let i = 0; i < 40 && reset.respawning; i++) reset = a.advance(1);
    return { phases, initial, jimmyHit, sophieHit, reset };
  });
  expect(result.phases).toEqual(['clear', 'warning', 'hiss', 'active']);
  expect(result.jimmyHit.respawning).toBe(false);
  expect(result.sophieHit.respawning).toBe(true);
  expect(result.reset).toMatchObject({
    x: 1930,
    y: 500,
    charges: 1,
    respawning: false,
    checkpoint: 'first-furnace',
  });
  expect(result.reset.maintenance!.steam).toEqual(
    result.initial.maintenance!.steam,
  );
  expect(result.reset.maintenance!.rats).toEqual(
    result.initial.maintenance!.rats,
  );
});

test('failure restores challenge treats and baseline state; unspent retries retain the three-second treat return', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate((bones) => {
    const a = window.__sophie!;
    a.checkpoint('major-furnace');
    const initial = a.snapshot();
    for (const b of bones) {
      a.place({ x: b.x, y: b.y + 10 });
      a.advance(1);
    }
    const collected = a.snapshot();
    a.place({ x: 5790, y: 800 });
    let failed = a.advance(1);
    const didFail = failed.respawning;
    for (let i = 0; i < 40 && failed.respawning; i++) failed = a.advance(1);
    const reset = failed;
    a.place({ x: bones[0]!.x, y: bones[0]!.y + 10 }, true);
    const jimmyTreat = a.advance(1);
    a.place({ x: bones[0]!.x, y: bones[0]!.y + 10 });
    a.advance(1);
    a.place({ x: initial.x, y: initial.y });
    const beforeReturn = a.advance(359);
    const returned = a.advance(1);
    a.place({ x: bones[0]!.x, y: bones[0]!.y + 10 });
    const recollected = a.advance(1);
    return {
      initial,
      collected,
      didFail,
      reset,
      jimmyTreat,
      beforeReturn,
      returned,
      recollected,
    };
  }, maintenance.treats);
  expect(result.collected.treats).toEqual(maintenance.treats.map((b) => b.id));
  expect(result.collected.charges).toBe(2);
  expect(result.didFail).toBe(true);
  expect(result.reset).toMatchObject({
    x: 5650,
    y: 500,
    charges: 1,
    treats: [],
    respawning: false,
  });
  expect(result.reset.maintenance!.rats).toEqual(
    result.initial.maintenance!.rats,
  );
  expect(result.reset.maintenance!.steam).toEqual(
    result.initial.maintenance!.steam,
  );
  expect(result.jimmyTreat.treats).toEqual([]);
  expect(result.jimmyTreat.charges).toBe(1);
  expect(result.beforeReturn.treats).toEqual([maintenance.treats[0]!.id]);
  expect(result.returned.treats).toEqual([]);
  expect(result.recollected).toMatchObject({
    charges: 2,
    treats: [maintenance.treats[0]!.id],
  });
});

test('every checkpoint permits an immediate safe start, and waiting there remains safe across a full hazard cycle', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(
    ({ checkpoints, frames }) => {
      const a = window.__sophie!;
      return checkpoints.map((cp) => {
        a.checkpoint(cp.id);
        const initial = a.snapshot();
        const moving = a.advance(36, { moveX: 1 });
        a.checkpoint(cp.id);
        let failedWhileWaiting = false;
        for (let i = 0; i < frames; i++)
          if (a.advance(1).respawning) failedWhileWaiting = true;
        return { id: cp.id, initial, moving, failedWhileWaiting };
      });
    },
    {
      checkpoints: maintenance.checkpoints,
      frames:
        Math.ceil(
          Math.max(...maintenance.maintenance!.steam.map(steamCycleMs)) /
            simulation.stepMs,
        ) + 1,
    },
  );
  for (const r of results) {
    expect(r.moving.respawning, r.id).toBe(false);
    expect(r.moving.x, r.id).toBeGreaterThan(r.initial.x + 25);
    expect(r.moving.charges, r.id).toBe(1);
    expect(r.failedWhileWaiting, r.id).toBe(false);
  }
});

test('service hatch owns input, walks both dogs inside, fades after an empty hold, and replays cleanly', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 9445, y: 500 });
    a.advance(1);
    const phases = [],
      walked = { sophie: false, jimmy: false };
    for (let i = 0; i < 1000; i++) {
      const s = a.advance(1, {
        moveX: -1,
        jumpPressed: true,
        jumpHeld: true,
        dashPressed: true,
      });
      const tunnel = s.maintenance!;
      if (phases.at(-1)?.phase !== tunnel.phase) phases.push(tunnel);
      if (tunnel.phase === 'walk') {
        walked.sophie ||= tunnel.animations.sophie === 'walk';
        walked.jimmy ||= tunnel.animations.jimmy === 'jimmy-walk';
      }
      if (s.ending) break;
    }
    return { phases, walked, final: a.snapshot() };
  });
  expect(result.phases.map((p) => p.phase)).toEqual([
    'gather',
    'hold',
    'walk',
    'empty',
    'fade',
    'complete',
  ]);
  expect(result.walked).toEqual({ sophie: true, jimmy: true });
  for (const phase of result.phases.filter((p) =>
    ['empty', 'fade', 'complete'].includes(p.phase),
  ))
    expect(Object.values(phase.actors!).every((actor) => !actor.visible)).toBe(
      true,
    );
  expect(result.final).toMatchObject({
    levelId: 'maintenance-tunnels',
    ending: true,
    charges: 1,
  });
  await expect(page.locator('.story-bubble')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect
    .poll(async () => (await state(page)).levelId)
    .toBe('attic-escape');
  expect((await state(page)).maintenance).toBeUndefined();
  await expect(page.locator('#app')).not.toHaveClass(/tunnel-exit/);
  await expect(page.locator('audio')).toHaveAttribute(
    'src',
    '/assets/audio/rooftop-dash.mp3',
  );
});

test('debug chapter changes clean up an interrupted exit and reset hazards on return', async ({
  page,
}) => {
  await open(page);
  const initial = (await state(page)).maintenance!.rats;
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 9445, y: 500 });
    a.advance(120);
  });
  await expect(page.locator('#app')).toHaveClass(/tunnel-exit/);
  const selector = page.getByRole('combobox', {
      name: 'Debug level',
      exact: true,
    }),
    load = page.getByRole('button', { name: 'Load', exact: true });
  await selector.selectOption('skyscraper');
  await load.click();
  expect((await state(page)).maintenance).toBeUndefined();
  await expect(page.locator('#app')).not.toHaveClass(/tunnel-exit/);
  await selector.selectOption('maintenance-tunnels');
  await load.click();
  const returned = await state(page);
  expect(returned.maintenance!.rats).toEqual(initial);
  expect(returned.maintenance!.phase).toBe('tunnels');
  expect(returned.climb).toBeUndefined();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.locator('audio')).not.toHaveAttribute('src');
});

test.describe('mobile maintenance tunnels', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('keeps controls available during gameplay, freezes hazards in portrait and pause, and restores them after restarting the exit', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('.pad-direction')).toHaveCount(4);
    await expect(page.locator('.touch-controls')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    const portrait = await state(page);
    await page.evaluate(() => window.__sophie!.advance(800, { moveX: 1 }));
    expect((await state(page)).maintenance!.rats).toEqual(
      portrait.maintenance!.rats,
    );
    expect((await state(page)).maintenance!.steam).toEqual(
      portrait.maintenance!.steam,
    );
    await page.setViewportSize({ width: 844, height: 390 });
    await page.keyboard.press('Escape');
    const paused = await state(page);
    await page.evaluate(() => window.__sophie!.advance(800));
    expect((await state(page)).maintenance!.rats).toEqual(
      paused.maintenance!.rats,
    );
    expect((await state(page)).maintenance!.steam).toEqual(
      paused.maintenance!.steam,
    );
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.evaluate(() => {
      const a = window.__sophie!;
      a.place({ x: 9445, y: 500 });
      a.advance(1);
    });
    await expect(page.locator('.touch-controls')).toBeHidden();
    await page.keyboard.press('Escape');
    const exit = (await state(page)).maintenance;
    await page.evaluate(() => window.__sophie!.advance(1000));
    expect((await state(page)).maintenance).toEqual(exit);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    expect((await state(page)).maintenance!.phase).toBe('tunnels');
    await expect(page.locator('.touch-controls')).toBeVisible();
  });
});
