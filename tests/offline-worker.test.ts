import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { installOfflineWorker } from '../src/offline/worker';
import type { OfflineManifest, OfflineReply } from '../src/offline/protocol';

const origin = 'https://example.test';
const base = '/Sophie/';
const client = { id: 'player', url: `${origin}${base}` };
const files = new Map([
  [`${base}index.html`, '<html>game</html>'],
  [`${base}game.js`, 'game()'],
  [`${base}music.mp3`, '0123456789'],
]);
const manifest = (version = 'first'): OfflineManifest => ({
  version,
  base,
  totalBytes: [...files.values()].reduce((sum, body) => sum + body.length, 0),
  assets: [...files].map(([url, body]) => ({
    url,
    bytes: body.length,
    revision: createHash('sha256').update(body).digest('hex'),
  })),
});

class MemoryCaches {
  stores = new Map<string, Map<string, Response>>();
  async has(name: string) {
    return this.stores.has(name);
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    const data = this.stores.get(name)!;
    const url = (request: Request | URL | string) =>
      request instanceof Request ? request.url : String(request);
    return {
      keys: async () => [...data.keys()].map((key) => new Request(key)),
      match: async (request: Request | URL | string) =>
        data.get(url(request))?.clone(),
      put: async (request: Request | URL | string, response: Response) => {
        data.set(url(request), response.clone());
      },
    };
  }
}

interface FakeEvent {
  waitUntil(promise: Promise<unknown>): void;
  respondWith?(promise: Promise<Response>): void;
  data?: unknown;
  ports?: unknown[];
  source?: typeof client;
  request?: Request;
}

function worker(version = 'first', caches = new MemoryCaches()) {
  const handlers = new Map<string, (event: FakeEvent) => void>();
  const fetch = vi.fn<
    (input: string | URL | Request, options?: RequestInit) => Promise<Response>
  >(async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const body = files.get(url.pathname);
    return new Response(body ?? 'not found', { status: body ? 200 : 404 });
  });
  const clients = {
    matchAll: vi.fn(async () => [client]),
    claim: vi.fn(async () => undefined),
  };
  const skipWaiting = vi.fn(async () => undefined);
  installOfflineWorker(
    {
      location: new URL(origin),
      caches,
      crypto: globalThis.crypto,
      fetch,
      clients,
      skipWaiting,
      addEventListener: (type: string, callback: (event: FakeEvent) => void) =>
        handlers.set(type, callback),
    } as unknown as ServiceWorkerGlobalScope,
    manifest(version),
  );
  const lifecycle = async (name: 'install' | 'activate') => {
    let pending: Promise<unknown> | undefined;
    handlers.get(name)!({
      waitUntil(promise) {
        pending = promise;
      },
    });
    await pending;
  };
  const message = async (
    type: 'STATUS' | 'DOWNLOAD' | 'ACTIVATE',
    activeVersion?: string,
    onReply?: (reply: OfflineReply) => void,
  ) => {
    let pending: Promise<unknown> | undefined;
    const replies: OfflineReply[] = [];
    handlers.get('message')!({
      data: { type, activeVersion },
      source: client,
      ports: [
        {
          postMessage: (reply: OfflineReply) => {
            replies.push(reply);
            onReply?.(reply);
          },
          close() {},
        },
      ],
      waitUntil(promise) {
        pending = promise;
      },
    });
    await pending;
    return replies;
  };
  const get = async (path: string, navigation = false, range?: string) => {
    const request = new Request(`${origin}${path}`, {
      headers: range ? { Range: range } : {},
    });
    if (navigation)
      Object.defineProperty(request, 'mode', { value: 'navigate' });
    let pending: Promise<Response> | undefined;
    handlers.get('fetch')!({
      request,
      waitUntil() {},
      respondWith(promise) {
        pending = promise;
      },
    });
    return pending;
  };
  return { lifecycle, message, get, caches, fetch, clients, skipWaiting };
}

describe('offline release lifecycle', () => {
  it('keeps slow downloads alive with progress heartbeats', async () => {
    vi.useFakeTimers();
    try {
      const game = worker();
      const received: OfflineReply[] = [];
      game.fetch.mockImplementationOnce(
        (_input, options) =>
          new Promise((resolve, reject) => {
            setTimeout(
              () => resolve(new Response(files.get(`${base}index.html`))),
              65_000,
            );
            options?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      );
      const pending = game.message('DOWNLOAD', undefined, (reply) =>
        received.push(reply),
      );
      await vi.waitFor(() => expect(game.fetch).toHaveBeenCalledOnce());
      await vi.advanceTimersByTimeAsync(60_000);
      expect(
        received.filter((reply) => reply.type === 'PROGRESS').length,
      ).toBeGreaterThanOrEqual(12);
      expect(received.at(-1)).toMatchObject({
        type: 'PROGRESS',
        completed: 0,
        downloading: true,
      });
      await vi.advanceTimersByTimeAsync(5_000);
      expect((await pending).at(-1)?.ready).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still aborts a stalled file after the download deadline', async () => {
    vi.useFakeTimers();
    try {
      const game = worker();
      game.fetch.mockImplementationOnce(
        (_input, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      );
      const pending = game.message('DOWNLOAD');
      await vi.waitFor(() => expect(game.fetch).toHaveBeenCalledOnce());
      await vi.advanceTimersByTimeAsync(300_000);
      expect((await pending).at(-1)).toMatchObject({
        type: 'ERROR',
        ready: false,
        error: 'The download timed out. Check your connection and try again.',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('installs without downloading, then verifies the whole opted-in package', async () => {
    const game = worker();
    await game.lifecycle('install');
    expect(game.fetch).not.toHaveBeenCalled();
    expect((await game.message('STATUS')).at(-1)?.ready).toBe(false);
    const replies = await game.message('DOWNLOAD');
    expect(replies.filter((reply) => reply.type === 'PROGRESS')).toHaveLength(
      4,
    );
    expect(replies.at(-1)).toMatchObject({
      type: 'STATUS',
      ready: true,
      downloading: false,
      completed: 3,
      downloadedBytes: manifest().totalBytes,
    });
    expect(game.fetch).toHaveBeenCalledTimes(3);
    await game.message('DOWNLOAD');
    expect(game.fetch).toHaveBeenCalledTimes(3);
  });

  it('rejects mismatched contents at unchanged asset URLs and permits retry', async () => {
    const game = worker();
    game.fetch.mockResolvedValueOnce(new Response('other html here!'));
    expect((await game.message('DOWNLOAD')).at(-1)).toMatchObject({
      type: 'ERROR',
      ready: false,
    });
    expect(game.caches.stores.size).toBe(0);
    expect((await game.message('DOWNLOAD')).at(-1)?.ready).toBe(true);
  });

  it('detects eviction even with a completion marker and repairs the package', async () => {
    const game = worker();
    await game.message('DOWNLOAD');
    const cache = [...game.caches.stores.values()][0]!;
    cache.delete(`${origin}${base}music.mp3`);
    expect((await game.message('STATUS')).at(-1)?.ready).toBe(false);
    expect(await (await game.get(base, true))?.text()).toBe(
      '<html>game</html>',
    );
    expect((await game.message('DOWNLOAD')).at(-1)?.ready).toBe(true);
  });

  it('keeps the complete previous release playable after a failed update', async () => {
    const old = worker();
    await old.message('DOWNLOAD');
    const update = worker('second', old.caches);
    update.fetch.mockRejectedValueOnce(new TypeError('Offline'));
    await expect(update.lifecycle('install')).rejects.toThrow('Offline');
    expect((await old.message('STATUS')).at(-1)?.ready).toBe(true);
    expect(old.caches.stores.size).toBe(1);
    expect(await (await old.get(`${base}?level=7`, true))?.text()).toBe(
      '<html>game</html>',
    );
    expect(update.skipWaiting).not.toHaveBeenCalled();
  });

  it('keeps available game files when repairing an evicted asset fails offline', async () => {
    const game = worker();
    await game.message('DOWNLOAD');
    [...game.caches.stores.values()][0]!.delete(`${origin}${base}music.mp3`);
    game.fetch.mockRejectedValueOnce(new TypeError('Offline'));
    expect((await game.message('DOWNLOAD')).at(-1)?.ready).toBe(false);
    expect(await (await game.get(base, true))?.text()).toBe(
      '<html>game</html>',
    );
    expect((await game.message('DOWNLOAD')).at(-1)?.ready).toBe(true);
  });

  it('falls back to the network when offline storage access fails', async () => {
    const game = worker();
    vi.spyOn(game.caches, 'has').mockRejectedValue(new Error('Storage denied'));
    expect(await (await game.get(`${base}index.html`))?.text()).toBe(
      '<html>game</html>',
    );
    expect(game.fetch).toHaveBeenCalledOnce();
  });

  it('stages updates and requires explicit restart with no other game tab', async () => {
    const old = worker();
    await old.message('DOWNLOAD');
    const update = worker('second', old.caches);
    await update.lifecycle('install');
    expect((await update.message('STATUS')).at(-1)?.ready).toBe(true);
    expect(update.skipWaiting).not.toHaveBeenCalled();
    update.clients.matchAll.mockResolvedValue([
      client,
      { ...client, id: 'other' },
    ]);
    expect((await update.message('ACTIVATE')).at(-1)?.error).toContain(
      'other Sophie tabs',
    );
    expect(update.skipWaiting).not.toHaveBeenCalled();
    update.clients.matchAll.mockResolvedValue([client]);
    expect((await update.message('ACTIVATE')).at(-1)?.type).toBe('ACTIVATING');
    expect(update.skipWaiting).toHaveBeenCalledOnce();
    await update.lifecycle('activate');
    expect(old.caches.stores.size).toBe(2);
    update.clients.matchAll.mockResolvedValue([]);
    await update.lifecycle('activate');
    expect(old.caches.stores.size).toBe(1);
  });

  it('serves cached navigations, ranges, and the manifest only within its scope', async () => {
    const game = worker();
    await game.message('DOWNLOAD');
    game.fetch.mockRejectedValue(new TypeError('Offline'));
    expect(
      await (await game.get(`${base}index.html?test=1`, true))?.text(),
    ).toBe('<html>game</html>');
    const range = await game.get(`${base}music.mp3`, false, 'bytes=3-5');
    expect(range?.status).toBe(206);
    expect(await range?.text()).toBe('345');
    const offlineManifest = await game.get(`${base}offline-manifest.json`);
    expect(await offlineManifest?.json()).toMatchObject({ version: 'first' });
    expect(await game.get('/another-app/index.html', true)).toBeUndefined();
    expect(await game.get(`${base}unknown.html`, true)).toBeUndefined();
  });

  it('bounds release storage while retaining the active release instead of an unused staged update', async () => {
    const old = worker();
    await old.message('DOWNLOAD');
    await worker('unused-staged', old.caches).lifecycle('install');
    const update = worker('third', old.caches);
    await update.lifecycle('install');
    expect(old.caches.stores.size).toBe(3);
    expect((await update.message('ACTIVATE', 'first')).at(-1)?.type).toBe(
      'ACTIVATING',
    );
    await update.lifecycle('activate');
    expect([...old.caches.stores.keys()]).toEqual([
      `sophie-offline:${encodeURIComponent(base)}:first`,
      `sophie-offline:${encodeURIComponent(base)}:third`,
    ]);
  });
});
