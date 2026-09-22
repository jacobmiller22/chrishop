import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateFlag,
  getFeatureFlag,
  ENVIRONMENT_FLAG_DEFAULTS,
  type EvaluationContext,
} from '../../packages/config/src/flags';
import {
  isHomepageHeroPocEnabled,
  extractEvaluationContext,
} from '../../apps/web/src/lib/flags';

describe('Story 1.18: POC Storefront Hero Banner & Dynamic Homepage Feature Switch', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.FLAG_HOMEPAGE_HERO_POC;
    delete (globalThis as any).FLAGS;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete (globalThis as any).FLAGS;
    process.env = { ...originalEnv };
  });

  it('AC1: FLAG_HOMEPAGE_HERO_POC defaults to true in preview/staging/dev, false in prod/test', () => {
    assert.equal(ENVIRONMENT_FLAG_DEFAULTS.preview.FLAG_HOMEPAGE_HERO_POC, true);
    assert.equal(ENVIRONMENT_FLAG_DEFAULTS.staging.FLAG_HOMEPAGE_HERO_POC, true);
    assert.equal(ENVIRONMENT_FLAG_DEFAULTS.development.FLAG_HOMEPAGE_HERO_POC, true);
    assert.equal(ENVIRONMENT_FLAG_DEFAULTS.production.FLAG_HOMEPAGE_HERO_POC, false);
    assert.equal(ENVIRONMENT_FLAG_DEFAULTS.test.FLAG_HOMEPAGE_HERO_POC, false);
  });

  it('AC2: isHomepageHeroPocEnabled resolves correctly per environment tier', async () => {
    // In preview tier, hero POC is enabled by default
    const previewVal = await isHomepageHeroPocEnabled({ environmentTier: 'preview' });
    assert.equal(previewVal, true);

    // In staging tier, hero POC is enabled by default
    const stagingVal = await isHomepageHeroPocEnabled({ environmentTier: 'staging' });
    assert.equal(stagingVal, true);

    // In production tier, hero POC is disabled by default (hardened)
    const prodVal = await isHomepageHeroPocEnabled({ environmentTier: 'production' });
    assert.equal(prodVal, false);
  });

  it('AC2: Local environment variable FLAG_HOMEPAGE_HERO_POC=true overrides tier defaults', async () => {
    process.env.FLAG_HOMEPAGE_HERO_POC = 'true';
    const active = await isHomepageHeroPocEnabled();
    assert.equal(active, true);

    process.env.FLAG_HOMEPAGE_HERO_POC = 'false';
    const inactive = await isHomepageHeroPocEnabled();
    assert.equal(inactive, false);
  });

  it('AC2: Reviewer session query parameter (?flag:hero=false) can flip hero POC in preview', async () => {
    const req = new Request('https://pr-208-chrishop.jacobmiller22.com/?flag:hero=false');
    process.env.NODE_ENV = 'preview';

    const context = extractEvaluationContext(req);
    assert.equal(context.environmentTier, 'preview');
    assert.ok(context.sessionFlags);
    assert.equal(context.sessionFlags.FLAG_HOMEPAGE_HERO_POC, false);

    const isEnabled = await isHomepageHeroPocEnabled(context);
    assert.equal(isEnabled, false, 'Reviewer override must disable hero in preview');
  });

  it('AC2: Reviewer session parameter is strictly ignored in production tier', async () => {
    const req = new Request('https://chrishop.jacobmiller22.com/?flag:hero=true');
    process.env.NODE_ENV = 'production';

    const context = extractEvaluationContext(req);
    assert.equal(context.environmentTier, 'production');
    assert.equal(context.sessionFlags, undefined, 'Must drop session flags in production');

    const isEnabled = await isHomepageHeroPocEnabled(context);
    assert.equal(isEnabled, false, 'Production must remain disabled despite query parameter');
  });

  it('AC3: Authentic brand hero photography and white logo exist on disk', () => {
    const heroDir = path.resolve(__dirname, '../../apps/web/public/media/hero');
    const bgPath = path.join(heroDir, 'bank-beaters-bg.jpg');
    const logoPath = path.join(heroDir, 'bank-beaters-logo-white.png');
    const heroPath = path.join(heroDir, 'bank-beaters-hero.jpg');

    assert.ok(fs.existsSync(bgPath), `Background asset must exist at ${bgPath}`);
    assert.ok(fs.existsSync(logoPath), `Logo asset must exist at ${logoPath}`);
    assert.ok(fs.existsSync(heroPath), `Hero asset must exist at ${heroPath}`);

    const bgStats = fs.statSync(bgPath);
    const logoStats = fs.statSync(logoPath);
    assert.ok(bgStats.size > 10000, 'Background image must be a valid non-empty photo');
    assert.ok(logoStats.size > 1000, 'Logo image must be a valid non-empty PNG');
  });
});
