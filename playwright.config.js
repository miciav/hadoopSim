import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 5173',
    url: 'http://localhost:5173/index.html',
    reuseExistingServer: true,
    timeout: 20000
  }
});
