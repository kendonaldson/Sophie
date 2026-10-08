import { defineConfig } from '@playwright/test';
import { browserOptions } from './e2e/browser';
const basePath = process.env.SITE_BASE_PATH || '/';
const baseURL = `http://127.0.0.1:4173${basePath.endsWith('/') ? basePath : `${basePath}/`}`;
export default defineConfig({
  testDir: './e2e/production',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL,
    viewport: { width: 1280, height: 800 },
    launchOptions: browserOptions,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
