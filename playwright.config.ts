import { defineConfig, devices } from '@playwright/test';

/**
 * ChrisShop Playwright UI & Integration Test Configuration
 *
 * Tier 1 (Fast PR Gate) Testing Architecture
 * Supports:
 * - Dynamic port & base URL resolution for parallel worktree isolation (PLAYWRIGHT_PORT, PLAYWRIGHT_BASE_URL)
 * - Multi-device matrix: Desktop Chromium, Desktop WebKit, Mobile Safari (iPhone 14, iPhone SE), Mobile Chrome (Pixel 7)
 * - Automatic Next.js local dev server lifecycle management
 * - Rich test artifacts: trace on first retry, screenshot on failure, video on failure
 */

const PORT = process.env.PLAYWRIGHT_PORT || process.env.PORT || '3000';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/ui',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'desktop-webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-safari-iphone-14',
      use: {
        ...devices['iPhone 14'],
      },
    },
    {
      name: 'mobile-safari-iphone-se',
      use: {
        ...devices['iPhone SE'],
      },
    },
    {
      name: 'mobile-chrome-pixel-7',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @chrishop/web exec next dev -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          PORT,
          NODE_ENV: 'development',
        },
      },
});
