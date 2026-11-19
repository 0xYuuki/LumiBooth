import { defineConfig } from '@playwright/test';
import process from 'node:process';

const publicServer = {
  command: 'npm run preview -- --host 127.0.0.1 --port 4185 --strictPort',
  url: 'http://127.0.0.1:4185',
};
const staffServer = {
  command: 'npm run preview:staff -- --host 127.0.0.1 --port 4187 --strictPort',
  url: 'http://127.0.0.1:4187',
};

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
  webServer: process.env.LUMI_TEST_STAFF === 'true' ? [publicServer, staffServer] : publicServer,
});
