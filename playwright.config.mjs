import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: 'test/playwright.spec.mjs',
  timeout: 15000,
  expect: { timeout: 8000 },
  use: {
    baseURL: 'http://localhost:4001',
    headless: true,
  },
  webServer: {
    command: 'node server/index.js',
    port: 4001,
    timeout: 8000,
    reuseExistingServer: true,
  },
});
