import { defineConfig } from 'vitest/config';
const basePath = process.env.SITE_BASE_PATH || '/';
if (
  !basePath.startsWith('/') ||
  basePath.startsWith('//') ||
  /[?#]/.test(basePath)
) {
  throw new Error('SITE_BASE_PATH must be a URL path such as / or /Sophie/.');
}
export default defineConfig({
  base: basePath.endsWith('/') ? basePath : `${basePath}/`,
  test: { include: ['tests/**/*.test.ts'] },
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
    chunkSizeWarningLimit: 1600,
  },
});
