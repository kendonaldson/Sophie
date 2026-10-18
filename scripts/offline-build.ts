import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, type Plugin, type ResolvedConfig } from 'vite';
import type { OfflineManifest } from '../src/offline/protocol';
import { offlinePublicAssets } from './offline-assets';

const digest = (body: string | Uint8Array) =>
  createHash('sha256').update(body).digest('hex');

export function offlineBuild(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'sophie-offline',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        const files = new Map<string, Uint8Array>();
        const webManifest = JSON.stringify({
          id: config.base,
          name: 'Sophie',
          short_name: 'Sophie',
          description: 'A pixel-art adventure starring Sophie the dachshund.',
          start_url: config.base,
          scope: config.base,
          display: 'standalone',
          orientation: 'landscape',
          background_color: '#17262a',
          theme_color: '#17262a',
          icons: [192, 512].map((size) => ({
            src: `${config.base}icons/icon-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
            purpose: 'any maskable',
          })),
        });
        files.set('manifest.webmanifest', Buffer.from(webManifest));
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.webmanifest',
          source: webManifest,
        });
        for (const [name, output] of Object.entries(bundle)) {
          if (name.endsWith('.map')) continue;
          const source = output.type === 'chunk' ? output.code : output.source;
          files.set(
            name,
            typeof source === 'string' ? Buffer.from(source) : source,
          );
        }
        for (const name of offlinePublicAssets)
          files.set(name, await readFile(resolve(config.publicDir, name)));
        if (!files.has('index.html'))
          throw new Error('Offline build requires the final index.html.');

        const workerBuild = await build({
          configFile: false,
          publicDir: false,
          logLevel: 'silent',
          build: {
            write: false,
            target: 'es2022',
            lib: {
              entry: resolve(config.root, 'src/offline/worker.ts'),
              name: 'SophieOffline',
              formats: ['iife'],
            },
          },
        });
        const workerOutput = Array.isArray(workerBuild)
          ? workerBuild[0]
          : workerBuild;
        if (!workerOutput || !('output' in workerOutput))
          throw new Error('Offline worker did not build.');
        const worker = workerOutput.output.find(
          (part) => part.type === 'chunk',
        );
        if (!worker || worker.type !== 'chunk')
          throw new Error('Offline worker bundle is missing.');
        const assets = [...files]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, source]) => ({
            url: `${config.base}${name}`,
            bytes: source.byteLength,
            revision: digest(source),
          }));
        const manifest: OfflineManifest = {
          version: digest(worker.code + JSON.stringify(assets)),
          base: config.base,
          totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
          assets,
        };
        this.emitFile({
          type: 'asset',
          fileName: 'offline-manifest.json',
          source: JSON.stringify(manifest),
        });
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: `const __OFFLINE_MANIFEST__ = ${JSON.stringify(manifest)};\n${worker.code}`,
        });
      },
    },
  };
}
