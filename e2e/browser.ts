import { existsSync } from 'node:fs';
import type { LaunchOptions } from '@playwright/test';
/** CI always uses the browser installed by Playwright. Local Linux can use Chromium. */
export const browserOptions: LaunchOptions =
  !process.env.CI && existsSync('/usr/bin/chromium')
    ? { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] }
    : {};
