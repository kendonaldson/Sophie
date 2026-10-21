import { expect, test, type Page } from '@playwright/test';
import { atticEscape } from '../src/game/levels/atticEscape';
import { pizzaFactory } from '../src/game/levels/pizzaFactory';
import { skyscraper } from '../src/game/levels/skyscraper';
import { warehouse } from '../src/game/levels/warehouse';
import { progressStorageKey } from '../src/game/progress/ProgressStore';

const key = progressStorageKey('/');
type StorageHarness = Window & {
  progressWritesBlocked?: boolean;
  progressWriteAttempts?: number;
};
const state = (page: Page) => page.evaluate(() => window.__sophie!.snapshot());
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);

async function ready(page: Page) {
  await page.waitForFunction(() => Boolean(window.__sophie));
  await page.evaluate(() => window.__sophie!.manual(true));
}

async function earnAtticCheckpoint(page: Page) {
  await page.goto('/?test');
  await ready(page);
  await page.evaluate(
    (spawn) => {
      const game = window.__sophie!;
      game.place(spawn);
      game.advance(2);
    },
    atticEscape.checkpoints.find((cp) => cp.id === 'dash')!.spawn,
  );
  expect((await state(page)).checkpoint).toBe('dash');
}

test('an earned safe checkpoint survives reload and Restart clears the checkpoint', async ({
  page,
}) => {
  await earnAtticCheckpoint(page);
  expect(await saved(page)).toEqual({
    version: 1,
    destinationId: 'attic-escape',
    checkpointId: 'dash',
  });
  await page.evaluate(() => {
    const game = window.__sophie!;
    game.advance(8, { moveX: 1, jumpPressed: true, dashPressed: true });
  });
  await page.reload();
  await ready(page);
  expect(await state(page)).toMatchObject({
    levelId: 'attic-escape',
    checkpoint: 'dash',
    ...atticEscape.checkpoints.find((cp) => cp.id === 'dash')!.spawn,
    charges: 1,
    respawning: false,
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect((await saved(page)).checkpointId).toBe('spawn');
  await page.reload();
  await ready(page);
  expect((await state(page)).x).toBe(atticEscape.playerSpawn.x);
});

test('debug level changes and infinite dash cannot overwrite normal progress, even after removing #debug', async ({
  page,
}) => {
  await earnAtticCheckpoint(page);
  const original = await saved(page);
  await page.evaluate(() => {
    location.hash = 'debug';
  });
  await page
    .getByRole('combobox', { name: 'Debug level', exact: true })
    .selectOption('pizza-factory');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Infinite dash' }).check();
  await page.evaluate(() => {
    window.__sophie!.checkpoint('factory-midpoint');
    window.__sophie!.advance(1);
    location.hash = '';
  });
  await expect(
    page.getByRole('checkbox', { name: 'Infinite dash' }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.__sophie!.checkpoint('factory-final');
    window.__sophie!.advance(1);
  });
  expect(await saved(page)).toEqual(original);
  await page.reload();
  await ready(page);
  expect(await state(page)).toMatchObject({
    levelId: 'attic-escape',
    checkpoint: 'dash',
  });
});

test('an unchanged earned checkpoint saves once temporarily unavailable storage recovers', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    const harness = window as StorageHarness;
    harness.progressWriteAttempts = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('sophie:progress:')) {
        harness.progressWriteAttempts!++;
        if (harness.progressWritesBlocked)
          throw new DOMException('Storage unavailable', 'QuotaExceededError');
      }
      original.call(this, key, value);
    };
  });
  await page.goto('/?test');
  await ready(page);
  const attempts = await page.evaluate(
    (spawn) => {
      const harness = window as StorageHarness;
      harness.progressWritesBlocked = true;
      const game = window.__sophie!;
      game.place(spawn);
      game.advance(2);
      const before = harness.progressWriteAttempts!;
      game.advance(120);
      return { before, after: harness.progressWriteAttempts! };
    },
    atticEscape.checkpoints.find((cp) => cp.id === 'dash')!.spawn,
  );
  expect(attempts.after).toBe(attempts.before);
  expect((await state(page)).checkpoint).toBe('dash');
  expect((await saved(page)).checkpointId).not.toBe('dash');
  await page.evaluate(() => {
    (window as StorageHarness).progressWritesBlocked = false;
  });
  await expect
    .poll(async () => {
      await page.evaluate(() => window.__sophie!.advance(1));
      return (await saved(page)).checkpointId;
    })
    .toBe('dash');
});

test('Start over confirms before replacing progress and preserves downloaded files', async ({
  page,
}) => {
  await page.goto('/?test');
  await ready(page);
  await page.evaluate(async () => {
    const cache = await caches.open('progress-download-check');
    await cache.put('/download-marker', new Response('keep this download'));
    const game = window.__sophie!;
    game.loadLevel('warehouse');
    game.checkpoint('upper-chain');
    game.advance(1);
  });
  const before = await saved(page);
  await page.keyboard.press('Escape');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  expect(await saved(page)).toEqual(before);
  expect(await state(page)).toMatchObject({
    levelId: 'warehouse',
    checkpoint: 'upper-chain',
    paused: true,
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  expect(await state(page)).toMatchObject({
    levelId: 'attic-escape',
    checkpoint: 'spawn',
    paused: false,
  });
  expect(await saved(page)).toEqual({
    version: 1,
    destinationId: 'attic-escape',
    checkpointId: 'spawn',
  });
  expect(
    await page.evaluate(async () => {
      const cache = await caches.open('progress-download-check');
      return (await cache.match('/download-marker'))?.text();
    }),
  ).toBe('keep this download');
  await page.reload();
  await ready(page);
  expect((await state(page)).levelId).toBe('attic-escape');
});

test('entering an interlude saves it and a cold launch preloads its characters and restarts the conversation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?test');
  await ready(page);
  await page.evaluate((exit) => {
    const game = window.__sophie!;
    game.loadLevel('warehouse');
    game.checkpoint('together');
    game.place({ x: exit.x + 20, y: exit.y + exit.height });
    game.advance(500);
  }, warehouse.exit);
  await page.waitForFunction(() => Boolean(window.__sophieStory));
  expect(await saved(page)).toEqual({
    version: 1,
    destinationId: 'interlude-1',
  });
  await page.evaluate(() => {
    window.__sophieStory!.manual(true);
    window.__sophieStory!.tick(900);
  });
  await page.keyboard.press('KeyX');
  expect(
    await page.evaluate(() => window.__sophieStory!.snapshot().index),
  ).toBe(1);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__sophieStory));
  await page.evaluate(() => {
    window.__sophieStory!.manual(true);
    window.__sophieStory!.tick(900);
  });
  expect(
    await page.evaluate(() => window.__sophieStory!.snapshot()),
  ).toMatchObject({
    storyId: 'interlude-1',
    index: 0,
    characters: ['Sophie', 'Jimmy'],
  });
  expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
  expect(await saved(page)).toEqual({
    version: 1,
    destinationId: 'interlude-1',
  });
  expect(errors).toEqual([]);
});

test('a saved climb anchor restores its section, lifts and companion instead of replaying the arrival', async ({
  page,
}) => {
  await page.goto('/?test');
  await ready(page);
  const checkpoint = skyscraper.checkpoints.find(
    (cp) => cp.id === 'bird-introduction',
  )!;
  await page.evaluate((spawn) => {
    const game = window.__sophie!;
    game.loadLevel('skyscraper');
    game.advance(110);
    game.place(spawn);
    game.advance(2);
  }, checkpoint.spawn);
  expect((await saved(page)).checkpointId).toBe(checkpoint.id);
  await page.reload();
  await ready(page);
  const restored = await state(page);
  expect(restored).toMatchObject({
    levelId: 'skyscraper',
    checkpoint: checkpoint.id,
    ...checkpoint.spawn,
    intro: false,
    climb: { challenge: checkpoint.id, phase: 'climb' },
    jimmy: { y: checkpoint.spawn.y, enabled: true },
  });
  expect(restored.climb!.camera.y).toBeLessThan(checkpoint.spawn.y);
});

test('a saved chase checkpoint restores the scrolling camera and both runners', async ({
  page,
}) => {
  await page.goto('/?test');
  await ready(page);
  await page.evaluate(() => {
    const game = window.__sophie!;
    game.loadLevel('the-chase');
    game.chaseSection(4430);
    game.advance(1, { moveX: 1 });
  });
  expect((await saved(page)).checkpointId).toBe('before-bulldozer');
  await page.reload();
  await ready(page);
  const restored = await state(page);
  expect(restored).toMatchObject({
    levelId: 'the-chase',
    checkpoint: 'before-bulldozer',
    charges: 1,
    chase: { enabled: true, nextCall: 3 },
    jimmy: { enabled: true },
  });
  expect(restored.x).toBeGreaterThanOrEqual(4200);
  expect(restored.x).toBeLessThan(4250);
  expect(restored.chase!.x).toBeGreaterThanOrEqual(3910);
  expect(restored.chase!.x).toBeLessThan(3960);
  expect(restored.jimmy!.x).toBeGreaterThanOrEqual(4146);
});

test('the earned factory midpoint and final runway reload with resolved encounters and reset power', async ({
  page,
}) => {
  await page.goto('/?test');
  await ready(page);
  const earned = await page.evaluate(() => {
    const game = window.__sophie!;
    game.loadLevel('pizza-factory');
    game.advance(2000);
    game.place({ x: 4380, y: 960 });
    game.advance(1300);
    game.place({ x: 4580, y: 960 });
    let current = game.advance(1, { moveX: 1, dashPressed: true });
    for (let n = 0; n < 100 && !current.factory!.midpointResolved; n++)
      current = game.advance(1, { moveX: 1 });
    game.advance(130);
    for (let n = 0; n < 300 && current.checkpoint === 'spawn'; n++)
      current = game.advance(1, { moveX: 1 });
    return current;
  });
  expect(earned.checkpoint).toBe('factory-midpoint');
  expect((await saved(page)).checkpointId).toBe('factory-midpoint');
  await page.reload();
  await ready(page);
  expect(await state(page)).toMatchObject({
    checkpoint: 'factory-midpoint',
    ...pizzaFactory.checkpoints[0]!.spawn,
    charges: 1,
    jimmy: { enabled: true, y: 960 },
    factory: {
      phase: 'second-half',
      midpointResolved: true,
      pizza: { active: false },
    },
  });
  await page.evaluate(() => {
    const game = window.__sophie!;
    game.place({ x: 11170, y: 790 });
    let current = game.advance(1);
    for (let n = 0; n < 120 && !current.factory!.scripted; n++)
      current = game.advance(1, { moveX: 1 });
  });
  expect((await saved(page)).checkpointId).toBe('factory-final');
  await page.reload();
  await ready(page);
  expect(await state(page)).toMatchObject({
    checkpoint: 'factory-final',
    ...pizzaFactory.checkpoints[1]!.spawn,
    charges: 1,
    jimmy: { enabled: true, y: 790 },
    factory: {
      phase: 'final',
      scripted: false,
      midpointResolved: true,
      finalResolved: false,
      pizza: { active: false },
    },
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await saved(page)).toEqual({
    version: 1,
    destinationId: 'pizza-factory',
    checkpointId: 'spawn',
  });
  await page.reload();
  await ready(page);
  await page.evaluate(() => window.__sophie!.advance(120));
  expect(await state(page)).toMatchObject({
    levelId: 'pizza-factory',
    checkpoint: 'spawn',
    ...pizzaFactory.playerSpawn,
    factory: { phase: 'opening', midpointResolved: false },
  });
});
