import { defineConfig } from '@playwright/test';
import { browserOptions } from './e2e/browser';
export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/production/**',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 800 },
    launchOptions: browserOptions,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    env: { SITE_BASE_PATH: '/' },
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
