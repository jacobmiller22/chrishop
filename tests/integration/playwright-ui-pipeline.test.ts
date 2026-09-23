import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Story 4.20: GitHub Actions Playwright UI & Integration Test Suite Pipeline', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const playwrightConfigPath = path.join(rootDir, 'playwright.config.ts');
  const ciWorkflowPath = path.join(rootDir, '.github/workflows/ci.yml');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const localDevDocPath = path.join(rootDir, 'LOCAL_DEVELOPMENT.md');
  const storefrontSpecPath = path.join(rootDir, 'tests/ui/storefront-journey.spec.ts');
  const adminSpecPath = path.join(rootDir, 'tests/ui/payload-admin.spec.ts');
  const propagationSpecPath = path.join(rootDir, 'tests/ui/payload-storefront-propagation.spec.ts');
  const dropCountdownPath = path.join(rootDir, 'packages/ui/src/components/DropCountdown.tsx');
  const cartDrawerPath = path.join(rootDir, 'packages/ui/src/components/CartDrawer.tsx');

  describe('1. Playwright Setup & Multi-Device Profile Configuration', () => {
    it('should verify playwright.config.ts exists and declares multi-browser project matrix', () => {
      assert.ok(fs.existsSync(playwrightConfigPath), 'playwright.config.ts must exist');
      const content = fs.readFileSync(playwrightConfigPath, 'utf-8');

      // Browser Projects
      assert.ok(content.includes('desktop-chromium') || content.includes('chromium'), 'Must define chromium project');
      assert.ok(content.includes('desktop-webkit'), 'Must define desktop-webkit project');
      assert.ok(content.includes('mobile-safari-iphone-14'), 'Must define mobile-safari-iphone-14 project');
      assert.ok(content.includes('mobile-safari-iphone-se'), 'Must define mobile-safari-iphone-se project');
      assert.ok(content.includes('mobile-chrome-pixel-7'), 'Must define mobile-chrome-pixel-7 project');
    });

    it('should verify dynamic port allocation and worktree isolation settings in playwright.config.ts', () => {
      const content = fs.readFileSync(playwrightConfigPath, 'utf-8');

      assert.ok(content.includes('process.env.PLAYWRIGHT_PORT'), 'Must support PLAYWRIGHT_PORT env variable');
      assert.ok(content.includes('webServer:'), 'Must configure webServer block');
      assert.ok(content.includes('trace: \'on-first-retry\''), 'Must configure trace on first retry');
      assert.ok(content.includes('screenshot: \'only-on-failure\''), 'Must capture screenshot on failure');
    });
  });

  describe('2. GitHub Actions CI Binary Caching & Execution Pipeline', () => {
    it('should verify ci.yml contains playwright-ui job with intelligent binary caching', () => {
      assert.ok(fs.existsSync(ciWorkflowPath), '.github/workflows/ci.yml must exist');
      const content = fs.readFileSync(ciWorkflowPath, 'utf-8');

      assert.ok(content.includes('playwright-ui:'), 'Must declare playwright-ui job');
      assert.ok(content.includes('~/.cache/ms-playwright'), 'Must cache Playwright browser path');
      assert.ok(content.includes('actions/cache@v4'), 'Must use actions/cache@v4');
      assert.ok(content.includes('pnpm-lock.yaml'), 'Must key cache by pnpm-lock.yaml hash');
      assert.ok(content.includes('playwright install --with-deps'), 'Must install browsers on cache miss');
      assert.ok(content.includes('playwright install-deps'), 'Must install OS dependencies on cache hit fallback');
      assert.ok(content.includes('test:ui'), 'Must execute test:ui in CI');
      assert.ok(content.includes('playwright-ui-report'), 'Must archive test report artifact');
    });
  });

  describe('3. Core Storefront & Admin Critical Path Test Suites', () => {
    it('should verify tests/ui/storefront-journey.spec.ts exists and tests critical checkout flows', () => {
      assert.ok(fs.existsSync(storefrontSpecPath), 'tests/ui/storefront-journey.spec.ts must exist');
      const content = fs.readFileSync(storefrontSpecPath, 'utf-8');

      assert.ok(content.includes('drop-countdown-timer'), 'Must test drop countdown timer');
      assert.ok(content.includes('variation-radio'), 'Must test variant selection');
      assert.ok(content.includes('cart-drawer'), 'Must test slide-over cart drawer');
      assert.ok(content.includes('checkout-button'), 'Must test checkout CTA');
      assert.ok(content.includes('api/cart/create'), 'Must intercept and verify checkout API');
    });

    it('should verify tests/ui/payload-admin.spec.ts exists and tests admin authentication accessibility', () => {
      assert.ok(fs.existsSync(adminSpecPath), 'tests/ui/payload-admin.spec.ts must exist');
      const content = fs.readFileSync(adminSpecPath, 'utf-8');

      assert.ok(content.includes('/admin'), 'Must test /admin route');
      assert.ok(content.includes('email'), 'Must test email input');
      assert.ok(content.includes('password'), 'Must test password input');
      assert.ok(content.includes('submit'), 'Must test form submit');
    });

    it('should verify tests/ui/payload-storefront-propagation.spec.ts exists and tests storefront propagation & revalidation', () => {
      assert.ok(fs.existsSync(propagationSpecPath), 'tests/ui/payload-storefront-propagation.spec.ts must exist');
      const content = fs.readFileSync(propagationSpecPath, 'utf-8');

      assert.ok(content.includes('/products'), 'Must test /products route');
      assert.ok(content.includes('/api/revalidate'), 'Must test /api/revalidate endpoint');
      assert.ok(content.includes("Maker's Field Notes"), 'Must test maker notes rendering');
    });
  });

  describe('4. Component Test Hooks & Accessibility', () => {
    it('should verify DropCountdown component exports data-testid test hooks', () => {
      assert.ok(fs.existsSync(dropCountdownPath), 'DropCountdown.tsx must exist');
      const content = fs.readFileSync(dropCountdownPath, 'utf-8');

      assert.ok(content.includes('data-testid="drop-countdown-timer"'), 'Must expose drop-countdown-timer');
      assert.ok(content.includes('data-testid="countdown-hours"'), 'Must expose countdown-hours');
      assert.ok(content.includes('data-testid="countdown-minutes"'), 'Must expose countdown-minutes');
      assert.ok(content.includes('data-testid="countdown-seconds"'), 'Must expose countdown-seconds');
    });

    it('should verify CartDrawer component exports data-testid test hooks', () => {
      assert.ok(fs.existsSync(cartDrawerPath), 'CartDrawer.tsx must exist');
      const content = fs.readFileSync(cartDrawerPath, 'utf-8');

      assert.ok(content.includes('data-testid="cart-drawer"'), 'Must expose cart-drawer');
      assert.ok(content.includes('data-testid="cart-subtotal"'), 'Must expose cart-subtotal');
      assert.ok(content.includes('data-testid="checkout-button"'), 'Must expose checkout-button');
      assert.ok(content.includes('data-testid="close-cart-button"'), 'Must expose close-cart-button');
    });
  });

  describe('5. Developer Tooling & Documentation', () => {
    it('should verify package.json declares test:ui scripts and Playwright dependencies', () => {
      assert.ok(fs.existsSync(packageJsonPath), 'package.json must exist');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      assert.ok(pkg.scripts['test:ui'], 'Must declare test:ui script');
      assert.ok(pkg.scripts['test:ui:interactive'], 'Must declare test:ui:interactive script');
      assert.ok(pkg.scripts['test:ui:mobile'], 'Must declare test:ui:mobile script');
      assert.ok(pkg.devDependencies['@playwright/test'], 'Must include @playwright/test in devDependencies');
    });

    it('should verify LOCAL_DEVELOPMENT.md documents test:ui and worktree isolation', () => {
      assert.ok(fs.existsSync(localDevDocPath), 'LOCAL_DEVELOPMENT.md must exist');
      const content = fs.readFileSync(localDevDocPath, 'utf-8');

      assert.ok(content.includes('test:ui'), 'Must document test:ui');
      assert.ok(content.includes('PLAYWRIGHT_PORT'), 'Must document PLAYWRIGHT_PORT worktree isolation');
      assert.ok(content.includes('Intelligent Binary Caching'), 'Must document binary caching');
    });
  });
});
