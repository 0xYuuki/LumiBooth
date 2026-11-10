import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    actionTimeout: 15000,
    baseURL: 'http://127.0.0.1:4185',
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4185 --strictPort',
    url: 'http://127.0.0.1:4185',
  },
});
