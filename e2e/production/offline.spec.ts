import { expect, test as base, type Page } from '@playwright/test';
import type { OfflineManifest } from '../../src/offline/protocol';
import { startOfflineServer, type OfflineServer } from './offlineServer';

const test = base.extend<{ offlineSite: OfflineServer }>({
  offlineSite: async ({ baseURL }, use) => {
    const site = await startOfflineServer();
    try {
      expect(new URL(site.url).pathname).toBe(new URL(baseURL!).pathname);
      await use(site);
    } finally {
      await site.close();
    }
  },
});

test.setTimeout(60000);

async function openOfflinePanel(page: Page) {
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.locator('#offline-panel summary').click();
  await expect(page.locator('#offline-download')).toBeEnabled();
}

async function downloadGame(page: Page, site: OfflineServer) {
  await page.goto(`${site.url}#debug`);
  await expect(page.locator('#section')).toHaveText('Open air');
  await openOfflinePanel(page);
  await page.locator('#offline-download').click();
  await expect(page.locator('#offline-summary')).toHaveText('Ready offline', {
    timeout: 20000,
  });
  await expect(page.locator('#offline-status')).toContainText(
    'All chapters and music',
  );
}

async function currentManifest(page: Page): Promise<OfflineManifest> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return (
      await fetch(new URL('offline-manifest.json', registration.scope))
    ).json();
  });
}

async function checkForUpdate(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Update did not settle')),
        20000,
      );
      registration.addEventListener(
        'updatefound',
        () => {
          const worker = registration.installing!;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' || worker.state === 'redundant') {
              clearTimeout(timer);
              resolve(worker.state);
            }
          });
        },
        { once: true },
      );
      void registration.update().catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  });
}

test('a complete download reopens offline with every runtime asset and seekable looping music', async ({
  page,
  context,
  offlineSite,
}) => {
  await downloadGame(page, offlineSite);
  await page.close();
  await context.setOffline(true);
  const reopened = await context.newPage();
  const errors: string[] = [];
  reopened.on('pageerror', (error) => errors.push(error.message));
  const navigation = await reopened.goto(`${offlineSite.url}#debug`);
  expect(navigation?.fromServiceWorker()).toBe(true);
  await expect(reopened.locator('canvas')).toBeVisible();
  await expect(reopened.locator('#section')).toHaveText('Open air');
  expect(
    await reopened.evaluate(() => [window.__sophie, window.__sophieStory]),
  ).toEqual([undefined, undefined]);

  // Reload-style fetches cannot fall back to the HTTP cache from the online visit.
  const downloaded = await reopened.evaluate(async (manifest) => {
    const result = [];
    for (const asset of manifest.assets) {
      const response = await fetch(asset.url, { cache: 'reload' });
      const bytes = await response.arrayBuffer();
      const revision = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (byte) => byte.toString(16).padStart(2, '0'),
      ).join('');
      result.push({
        url: asset.url,
        status: response.status,
        bytes: bytes.byteLength,
        revision,
      });
    }
    return result;
  }, offlineSite.manifest);
  expect(downloaded).toEqual(
    offlineSite.manifest.assets.map((asset) => ({ ...asset, status: 200 })),
  );
  const installManifest = await reopened.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    )!;
    return (await fetch(link.href, { cache: 'reload' })).json();
  });
  expect(installManifest).toMatchObject({
    name: 'Sophie',
    start_url: offlineSite.manifest.base,
    scope: offlineSite.manifest.base,
    display: 'standalone',
    icons: [192, 512].map((size) => ({
      src: `${offlineSite.manifest.base}icons/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })),
  });

  const ranges = await reopened.evaluate(async (assets) => {
    const result = [];
    for (const asset of assets.filter((asset) => asset.url.endsWith('.mp3'))) {
      const full = new Uint8Array(await (await fetch(asset.url)).arrayBuffer());
      for (const [range, start, length] of [
        ['bytes=0-63', 0, 64],
        ['bytes=-64', full.length - 64, 64],
        [`bytes=${asset.bytes - 128}-`, full.length - 128, 128],
      ] as const) {
        const response = await fetch(asset.url, {
          headers: { Range: range },
          cache: 'reload',
        });
        const body = new Uint8Array(await response.arrayBuffer());
        result.push({
          status: response.status,
          contentRange: response.headers.get('Content-Range'),
          expectedRange: `bytes ${start}-${start + length - 1}/${full.length}`,
          length: body.length,
          expectedLength: length,
          matches: body.every((value, index) => value === full[start + index]),
        });
      }
      const beyond = await fetch(asset.url, {
        headers: { Range: `bytes=${asset.bytes}-` },
        cache: 'reload',
      });
      result.push({
        status: beyond.status,
        contentRange: beyond.headers.get('Content-Range'),
        expectedRange: `bytes */${asset.bytes}`,
        length: (await beyond.arrayBuffer()).byteLength,
        expectedLength: 0,
        matches: true,
      });
    }
    return result;
  }, offlineSite.manifest.assets);
  expect(ranges.length).toBeGreaterThanOrEqual(28);
  for (const range of ranges) {
    expect(range.status).toBe(range.length ? 206 : 416);
    expect(range.contentRange).toBe(range.expectedRange);
    expect(range.length).toBe(range.expectedLength);
    expect(range.matches).toBe(true);
  }

  for (const [level, section, track] of [
    ['warehouse', 'A friend inside', 'factory-pulse.mp3'],
    ['maintenance-tunnels', 'Maintenance Tunnels', 'maintenance-tunnel.mp3'],
  ] as const) {
    await reopened
      .getByRole('combobox', { name: 'Debug level', exact: true })
      .selectOption(level);
    await reopened.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(reopened.locator('#section')).toHaveText(section);
    const music = reopened.locator('audio');
    await expect(music).toHaveAttribute(
      'src',
      new URL(`assets/audio/${track}`, offlineSite.url).pathname,
    );
    await reopened.keyboard.press('ArrowRight');
    await expect
      .poll(() =>
        music.evaluate((audio: HTMLAudioElement) => audio.currentTime),
      )
      .toBeGreaterThan(0);
    await expect(music).toHaveJSProperty('loop', true);
    await music.evaluate((audio: HTMLAudioElement) => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 1)
        throw new Error('Music metadata did not load');
      audio.currentTime = audio.duration - 0.2;
    });
    await expect
      .poll(() =>
        music.evaluate(
          (audio: HTMLAudioElement) => audio.currentTime < audio.duration / 2,
        ),
      )
      .toBe(true);
    await expect(music).toHaveJSProperty('paused', false);
    await expect(music).toHaveJSProperty('error', null);
  }
  expect(errors).toEqual([]);
});

test('a failed first worker installation leaves the online game playable and permits retry', async ({
  page,
  offlineSite,
}) => {
  offlineSite.failInstallation(true);
  await page.goto(offlineSite.url);
  await expect(page.locator('canvas')).toBeVisible();
  await openOfflinePanel(page);
  await expect(page.locator('#offline-status')).toContainText(
    'Offline setup couldn’t start',
  );
  await expect(page.locator('#offline-download')).toHaveText(
    'Try download again',
  );
  await expect(page.locator('#offline-summary')).toHaveText('Not downloaded');

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('KeyX');
  await expect(page.locator('#dash-hud')).toHaveAttribute(
    'aria-label',
    '0 of 2 dash charges available',
  );
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  offlineSite.failInstallation(false);
  await page
    .getByRole('button', { name: 'Try download again', exact: true })
    .click();
  await expect(page.locator('#offline-summary')).toHaveText('Ready offline', {
    timeout: 20000,
  });
  await expect(page.locator('#offline-status')).toContainText(
    'All chapters and music',
  );
});

test('an interrupted first download stays unavailable and an incomplete cache can be repaired', async ({
  page,
  context,
  offlineSite,
}) => {
  const track = offlineSite.manifest.assets.find((asset) =>
    asset.url.endsWith('/pizza-dash.mp3'),
  )!;
  offlineSite.failAsset(track.url);
  await page.goto(offlineSite.url);
  await openOfflinePanel(page);
  await page.locator('#offline-download').click();
  await expect(page.locator('#offline-status')).toContainText(
    'Could not download',
    { timeout: 20000 },
  );
  await expect(page.locator('#offline-summary')).toHaveText('Not downloaded');
  expect(
    offlineSite.requests.some(
      (request) => request.path === track.url && request.status === 503,
    ),
  ).toBe(true);
  offlineSite.failAsset();
  await page.locator('#offline-download').click();
  await expect(page.locator('#offline-summary')).toHaveText('Ready offline', {
    timeout: 20000,
  });

  // Simulate browser storage losing a single file after an otherwise complete download.
  await page.evaluate(async (url) => {
    for (const name of await caches.keys())
      await (await caches.open(name)).delete(url);
  }, track.url);
  await page.locator('#offline-panel summary').click();
  await page.locator('#offline-panel summary').click();
  await expect(page.locator('#offline-summary')).toHaveText('Not downloaded');
  await context.setOffline(true);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page.locator('canvas')).toBeVisible();
  await openOfflinePanel(page);
  await page.locator('#offline-download').click();
  await expect(page.locator('#offline-status')).toContainText('try again', {
    timeout: 20000,
  });
  await expect(page.locator('#offline-summary')).toHaveText('Not downloaded');
  // A failed repair must preserve the surviving chapter code and art.
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page.locator('canvas')).toBeVisible();
  await context.setOffline(false);
  await openOfflinePanel(page);
  await page.locator('#offline-download').click();
  await expect(page.locator('#offline-summary')).toHaveText('Ready offline', {
    timeout: 20000,
  });
  await context.setOffline(true);
  const response = await page.reload();
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.locator('canvas')).toBeVisible();
  expect(
    await page.evaluate(
      async (url) =>
        (await (await fetch(url, { cache: 'reload' })).arrayBuffer())
          .byteLength,
      track.url,
    ),
  ).toBe(track.bytes);
});

test('an interrupted background update keeps the previous complete version playable offline', async ({
  page,
  context,
  offlineSite,
}) => {
  await downloadGame(page, offlineSite);
  const track = offlineSite.manifest.assets.find((asset) =>
    asset.url.endsWith('/pizza-dash.mp3'),
  )!;
  offlineSite.setVersion(`${offlineSite.manifest.version}-interrupted`);
  offlineSite.failAsset(track.url);
  expect(await checkForUpdate(page)).toBe('redundant');
  expect(
    offlineSite.requests.some(
      (request) => request.path === track.url && request.status === 503,
    ),
  ).toBe(true);
  expect((await currentManifest(page)).version).toBe(
    offlineSite.manifest.version,
  );
  await expect(page.locator('#offline-summary')).toHaveText('Ready offline');
  await expect(page.locator('#offline-update')).toBeHidden();
  await page.close();
  await context.setOffline(true);
  const reopened = await context.newPage();
  expect((await reopened.goto(offlineSite.url))?.fromServiceWorker()).toBe(
    true,
  );
  await expect(reopened.locator('canvas')).toBeVisible();
  expect((await currentManifest(reopened)).version).toBe(
    offlineSite.manifest.version,
  );
  expect(
    await reopened.evaluate(
      async (url) => (await (await fetch(url)).arrayBuffer()).byteLength,
      track.url,
    ),
  ).toBe(track.bytes);
});

test('a staged update waits for restart and protects other open games', async ({
  page,
  context,
  offlineSite,
}) => {
  await downloadGame(page, offlineSite);
  await page.evaluate(() => {
    document.body.dataset.originalDocument = 'still-playing';
  });
  const nextVersion = `${offlineSite.manifest.version}-next`;
  offlineSite.setVersion(nextVersion);
  expect(await checkForUpdate(page)).toBe('installed');
  await expect(page.locator('#offline-update')).toBeVisible();
  expect((await currentManifest(page)).version).toBe(
    offlineSite.manifest.version,
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-original-document',
    'still-playing',
  );

  const otherGame = await context.newPage();
  await otherGame.goto(offlineSite.url);
  await expect(otherGame.locator('canvas')).toBeVisible();
  await page.bringToFront();
  await page.locator('#offline-update').click();
  await expect(page.locator('#offline-status')).toContainText(
    'Close other Sophie tabs',
  );
  expect((await currentManifest(otherGame)).version).toBe(
    offlineSite.manifest.version,
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-original-document',
    'still-playing',
  );

  await otherGame.close();
  await Promise.all([
    page.waitForEvent('load'),
    page.locator('#offline-update').click(),
  ]);
  await expect(page.locator('canvas')).toBeVisible();
  expect((await currentManifest(page)).version).toBe(nextVersion);
  await context.setOffline(true);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page.locator('canvas')).toBeVisible();
  expect((await currentManifest(page)).version).toBe(nextVersion);
});
