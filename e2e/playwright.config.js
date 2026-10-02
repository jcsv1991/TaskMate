// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { TIMEZONE } = require('./support/api');

const API_PORT = process.env.E2E_API_PORT || '5055';
const WEB_PORT = process.env.E2E_WEB_PORT || '4173';
const API_URL = `http://127.0.0.1:${API_PORT}/api`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const MONGO_URI = process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017/taskmate_e2e';

module.exports = defineConfig({
  testDir: './tests',
  // Each test creates its own user, so files and tests can run side by side.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  // Screenshots for the README are generated on demand (`npm run screenshots`), not on every run.
  grepInvert: process.env.E2E_SCREENSHOTS ? undefined : /@screenshots/,
  grep: process.env.E2E_SCREENSHOTS ? /@screenshots/ : undefined,
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'en-US',
    timezoneId: TIMEZONE, // west of UTC: the zone that exposes calendar-date bugs
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node server.js',
      cwd: '../backend',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: API_PORT,
        MONGO_URI,
        JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret',
        RATE_LIMIT_ENABLED: 'false',
        CORS_ORIGIN: '*',
      },
    },
    {
      // Production build of the real frontend, pointed at the local API.
      command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      cwd: '../frontend',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
