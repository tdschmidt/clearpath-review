import { defineConfig, chromium } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'clearpath-browser-tests-'));
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = existsSync(chromium.executablePath())
  ? undefined
  : existsSync(systemChrome) ? systemChrome : undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    browserName: 'chromium',
    launchOptions: { executablePath },
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3101/api/health',
    env: { PORT: '3101', DATA_DIR: dataDir, SEED_DEMO: '1' },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
