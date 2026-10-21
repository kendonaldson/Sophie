/// <reference lib="webworker" />
import { cachedResponse } from './range';
import type { OfflineManifest, OfflineReply, OfflineRequest } from './protocol';

declare const __OFFLINE_MANIFEST__: OfflineManifest;
declare const self: ServiceWorkerGlobalScope;
const downloadTimeoutMs = 5 * 60_000;
const progressHeartbeatMs = 5_000;

export function installOfflineWorker(
  scope: ServiceWorkerGlobalScope,
  manifest: OfflineManifest,
) {
  const base = new URL(manifest.base, scope.location.origin);
  const prefix = `sophie-offline:${encodeURIComponent(manifest.base)}:`;
  const cacheName = `${prefix}${manifest.version}`;
  const completeUrl = new URL('.offline-complete', base).href;
  const retainedUrl = new URL('.offline-retained', base).href;
  const manifestUrl = new URL('offline-manifest.json', base).href;
  const indexUrl = new URL('index.html', base).href;
  const assetUrls = new Set(
    manifest.assets.map((asset) => new URL(asset.url, base).href),
  );
  const ports = new Set<MessagePort>();
  let download: Promise<void> | undefined;
  let completed = 0;
  let downloadedBytes = 0;

  async function completedManifest(name: string) {
    if (!(await scope.caches.has(name))) return undefined;
    const cache = await scope.caches.open(name);
    const marker = await cache.match(completeUrl);
    if (!marker) return undefined;
    try {
      const saved: OfflineManifest = await marker.json();
      if (
        saved.base !== manifest.base ||
        !Array.isArray(saved.assets) ||
        !saved.assets.length ||
        name !== `${prefix}${saved.version}` ||
        (name === cacheName &&
          JSON.stringify(saved.assets) !== JSON.stringify(manifest.assets))
      )
        return undefined;
      return saved;
    } catch {
      return undefined;
    }
  }

  async function completeCache(name: string) {
    const saved = await completedManifest(name);
    if (!saved) return false;
    const cache = await scope.caches.open(name);
    const keys = new Set((await cache.keys()).map(({ url }) => url));
    return saved.assets.every((asset) =>
      keys.has(new URL(asset.url, base).href),
    );
  }

  async function status(
    type: OfflineReply['type'] = 'STATUS',
    error?: string,
  ): Promise<OfflineReply> {
    const ready = await completeCache(cacheName);
    return {
      type,
      version: manifest.version,
      ready,
      downloading: download !== undefined,
      completed: ready ? manifest.assets.length : download ? completed : 0,
      total: manifest.assets.length,
      downloadedBytes: ready
        ? manifest.totalBytes
        : download
          ? downloadedBytes
          : 0,
      totalBytes: manifest.totalBytes,
      ...(error ? { error } : {}),
    };
  }

  function progress() {
    const reply: OfflineReply = {
      type: 'PROGRESS',
      version: manifest.version,
      ready: false,
      downloading: true,
      completed,
      total: manifest.assets.length,
      downloadedBytes,
      totalBytes: manifest.totalBytes,
    };
    for (const port of ports) port.postMessage(reply);
  }

  async function prepareDownload() {
    if (await completeCache(cacheName)) return;
    const repairing = Boolean(await completedManifest(cacheName));
    if (!repairing) await scope.caches.delete(cacheName);
    const cache = await scope.caches.open(cacheName);
    completed = 0;
    downloadedBytes = 0;
    progress();
    try {
      for (const asset of manifest.assets) {
        if (repairing && (await cache.match(new URL(asset.url, base)))) {
          completed += 1;
          downloadedBytes += asset.bytes;
          progress();
          continue;
        }
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), downloadTimeoutMs);
        // Large music files need time on slower connections. Keep the client
        // informed while this file is transferring and being verified.
        const heartbeat = setInterval(progress, progressHeartbeatMs);
        try {
          const response = await scope.fetch(new URL(asset.url, base), {
            cache: 'no-store',
            credentials: 'same-origin',
            redirect: 'error',
            signal: abort.signal,
          });
          if (response.status !== 200)
            throw new Error(`Could not download ${asset.url}.`);
          const body = await response.arrayBuffer();
          const hash = Array.from(
            new Uint8Array(await scope.crypto.subtle.digest('SHA-256', body)),
            (byte) => byte.toString(16).padStart(2, '0'),
          ).join('');
          if (body.byteLength !== asset.bytes || hash !== asset.revision)
            throw new Error(
              'The game changed during download. Reload to retry.',
            );
          const headers = new Headers(response.headers);
          // Fetch has decoded compressed transfers; cached byte ranges address
          // these decoded bytes, not the original network representation.
          headers.delete('Content-Encoding');
          headers.delete('Content-Range');
          headers.delete('Transfer-Encoding');
          headers.delete('Vary');
          headers.set('Content-Length', String(body.byteLength));
          headers.set('Accept-Ranges', 'bytes');
          await cache.put(
            new URL(asset.url, base),
            new Response(body, { status: 200, headers }),
          );
          completed += 1;
          downloadedBytes += body.byteLength;
          progress();
        } finally {
          clearTimeout(timeout);
          clearInterval(heartbeat);
        }
      }
      await cache.put(completeUrl, Response.json(manifest));
      if (!(await completeCache(cacheName)))
        throw new Error(
          'Offline storage was cleared during download. Try again.',
        );
    } catch (error) {
      // Retain a formerly complete game's remaining files if repairing an
      // evicted file fails, so the player can still reopen it and try again.
      if (!repairing) await scope.caches.delete(cacheName);
      completed = 0;
      downloadedBytes = 0;
      throw error;
    }
  }

  function startDownload() {
    if (!download)
      download = prepareDownload().finally(() => {
        download = undefined;
      });
    return download;
  }

  async function scopedWindows() {
    const clients = await scope.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    return clients.filter((client) => {
      const url = new URL(client.url);
      return (
        url.origin === base.origin && url.pathname.startsWith(base.pathname)
      );
    });
  }

  scope.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        // The first visit only installs this small worker. An existing complete
        // download opts future releases into background staging as well.
        for (const name of await scope.caches.keys())
          if (
            name.startsWith(prefix) &&
            name !== cacheName &&
            (await completeCache(name))
          ) {
            await startDownload();
            break;
          }
      })(),
    );
  });

  scope.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        if (await completeCache(cacheName)) {
          const windows = await scopedWindows();
          const cache = await scope.caches.open(cacheName);
          const retained = await cache.match(retainedUrl);
          const previous: { version?: string } = retained
            ? await retained.json()
            : {};
          // Keep the previous active release for the document finishing its
          // restart. A newer staged cache is not necessarily the active release.
          if (
            windows.length === 0 ||
            (windows.length === 1 && previous.version)
          )
            for (const name of await scope.caches.keys())
              if (
                name.startsWith(prefix) &&
                name !== cacheName &&
                (windows.length === 0 ||
                  name !== `${prefix}${previous.version}`)
              )
                await scope.caches.delete(name);
        }
        await scope.clients.claim();
      })(),
    );
  });

  scope.addEventListener('message', (event) => {
    const request = event.data as Partial<OfflineRequest> | null;
    const port = event.ports[0];
    if (
      !port ||
      !request ||
      !['STATUS', 'DOWNLOAD', 'ACTIVATE'].includes(request.type ?? '')
    )
      return;
    const source = event.source;
    if (!source || !('url' in source) || !('id' in source)) return;
    const sourceUrl = new URL(source.url);
    if (
      sourceUrl.origin !== base.origin ||
      !sourceUrl.pathname.startsWith(base.pathname)
    )
      return;
    event.waitUntil(
      (async () => {
        try {
          if (request.type === 'DOWNLOAD') {
            ports.add(port);
            await startDownload();
          }
          if (request.type === 'ACTIVATE') {
            if (!(await completeCache(cacheName)))
              throw new Error('Download this update before restarting.');
            const windows = await scopedWindows();
            if (windows.some((client) => client.id !== source.id))
              throw new Error('Close other Sophie tabs before restarting.');
            if (typeof request.activeVersion === 'string') {
              const cache = await scope.caches.open(cacheName);
              await cache.put(
                retainedUrl,
                Response.json({ version: request.activeVersion }),
              );
            }
            port.postMessage(await status('ACTIVATING'));
            await scope.skipWaiting();
            return;
          }
          port.postMessage(await status());
        } catch (error) {
          const message =
            error instanceof Error && error.name === 'QuotaExceededError'
              ? 'Not enough storage. Free some space and try again.'
              : error instanceof Error && error.name === 'AbortError'
                ? 'The download timed out. Check your connection and try again.'
                : error instanceof Error
                  ? error.message
                  : 'Offline download failed. Please try again.';
          try {
            port.postMessage(await status('ERROR', message));
          } catch {
            port.postMessage({
              type: 'ERROR',
              version: manifest.version,
              ready: false,
              downloading: false,
              completed: 0,
              total: manifest.assets.length,
              downloadedBytes: 0,
              totalBytes: manifest.totalBytes,
              error: 'Offline storage is unavailable in this browser.',
            } satisfies OfflineReply);
          }
        } finally {
          ports.delete(port);
          port.close();
        }
      })(),
    );
  });

  scope.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' && request.method !== 'HEAD') return;
    const url = new URL(request.url);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
      return;
    if (url.href === manifestUrl) {
      event.respondWith(
        Promise.resolve(
          request.method === 'HEAD'
            ? new Response(null, {
                headers: { 'Content-Type': 'application/json' },
              })
            : Response.json(manifest),
        ),
      );
      return;
    }
    const navigation =
      request.mode === 'navigate' &&
      (url.pathname === base.pathname ||
        url.pathname === `${base.pathname}index.html`);
    const key = navigation ? indexUrl : url.href;
    if (!assetUrls.has(key)) return;
    event.respondWith(
      (async () => {
        // A missing music file must not prevent reopening the downloaded game
        // to repair it. Only a formerly complete release may serve cached files.
        try {
          if (await completedManifest(cacheName)) {
            const cache = await scope.caches.open(cacheName);
            const response = await cache.match(key);
            if (response) return cachedResponse(request, response);
          }
        } catch {
          // Storage restrictions must not prevent ordinary online play.
        }
        return scope.fetch(request);
      })(),
    );
  });
}

if (typeof __OFFLINE_MANIFEST__ !== 'undefined')
  installOfflineWorker(self, __OFFLINE_MANIFEST__);
