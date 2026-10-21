import { readFile } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { extname, resolve, sep } from 'node:path';
import type { OfflineManifest } from '../../src/offline/protocol';

/** An isolated deployment whose next release can fail without changing dist. */
export async function startOfflineServer() {
  const directory = resolve('dist');
  const manifest: OfflineManifest = JSON.parse(
    await readFile(resolve(directory, 'offline-manifest.json'), 'utf8'),
  );
  const worker = await readFile(resolve(directory, 'sw.js'), 'utf8');
  const workerBody = worker.slice(worker.indexOf('\n') + 1);
  let version = manifest.version;
  let failedPath: string | undefined;
  let failInstallation = false;
  const requests: { path: string; status: number }[] = [];
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
  };

  async function serve(request: IncomingMessage, response: ServerResponse) {
    const path = new URL(request.url!, 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    if (path === failedPath) {
      requests.push({ path, status: 503 });
      response.writeHead(503).end('Download interrupted');
      return;
    }
    const relative = path.slice(manifest.base.length) || 'index.html';
    const file = resolve(directory, relative);
    if (
      !path.startsWith(manifest.base) ||
      !file.startsWith(`${directory}${sep}`)
    ) {
      response.writeHead(404).end();
      return;
    }
    let body: Buffer;
    if (relative === 'sw.js')
      body = Buffer.from(
        `const __OFFLINE_MANIFEST__ = ${JSON.stringify({ ...manifest, version })};\n${workerBody}${
          failInstallation
            ? '\nself.addEventListener("install", event => event.waitUntil(new Promise((resolve, reject) => setTimeout(() => reject(new Error("Installation interrupted")), 100))));'
            : ''
        }`,
      );
    else if (relative === 'offline-manifest.json')
      body = Buffer.from(JSON.stringify({ ...manifest, version }));
    else {
      try {
        body = await readFile(file);
      } catch {
        requests.push({ path, status: 404 });
        response.writeHead(404).end();
        return;
      }
    }
    response.setHeader(
      'Content-Type',
      mime[extname(file)] ?? 'application/octet-stream',
    );
    response.setHeader('Accept-Ranges', 'bytes');
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '');
    let status = 200;
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(
        Number(range[2] || body.length - 1),
        body.length - 1,
      );
      if (start >= body.length || end < start) {
        response.setHeader('Content-Range', `bytes */${body.length}`);
        response.writeHead(416).end();
        return;
      }
      response.setHeader(
        'Content-Range',
        `bytes ${start}-${end}/${body.length}`,
      );
      body = body.subarray(start, end + 1);
      status = 206;
    }
    response.setHeader('Content-Length', body.length);
    requests.push({ path, status });
    response
      .writeHead(status)
      .end(request.method === 'HEAD' ? undefined : body);
  }
  const server = createServer((request, response) => {
    void serve(request, response).catch(() => response.writeHead(500).end());
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Server did not bind.');
  return {
    manifest,
    requests,
    url: `http://127.0.0.1:${address.port}${manifest.base}`,
    setVersion(next: string) {
      version = next;
    },
    failAsset(path?: string) {
      failedPath = path;
    },
    failInstallation(fail: boolean) {
      failInstallation = fail;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    },
  };
}

export type OfflineServer = Awaited<ReturnType<typeof startOfflineServer>>;
