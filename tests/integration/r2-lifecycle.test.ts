import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Cloudflare R2 Bucket Lifecycle Policies & Storage Class Transitions (Story 2.36)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const infraR2Dir = path.join(rootDir, 'infra/r2');
  const prodLifecyclePath = path.join(infraR2Dir, 'lifecycle-prod.json');
  const stagingLifecyclePath = path.join(infraR2Dir, 'lifecycle-staging.json');
  const previewLifecyclePath = path.join(infraR2Dir, 'lifecycle-preview.json');
  const corsPath = path.join(infraR2Dir, 'cors-media.json');
  const applyLifecycleScript = path.join(rootDir, 'infra/scripts/deps/r2_apply_lifecycle.sh');

  it('should verify all lifecycle JSON configuration files exist and parse as valid JSON', () => {
    assert.ok(fs.existsSync(prodLifecyclePath), 'lifecycle-prod.json must exist');
    assert.ok(fs.existsSync(stagingLifecyclePath), 'lifecycle-staging.json must exist');
    assert.ok(fs.existsSync(previewLifecyclePath), 'lifecycle-preview.json must exist');

    const prod = JSON.parse(fs.readFileSync(prodLifecyclePath, 'utf-8'));
    const staging = JSON.parse(fs.readFileSync(stagingLifecyclePath, 'utf-8'));
    const preview = JSON.parse(fs.readFileSync(previewLifecyclePath, 'utf-8'));

    assert.ok(Array.isArray(prod.rules), 'lifecycle-prod.json must contain rules array');
    assert.ok(Array.isArray(staging.rules), 'lifecycle-staging.json must contain rules array');
    assert.ok(Array.isArray(preview.rules), 'lifecycle-preview.json must contain rules array');
  });

  it('should validate Production lifecycle policy (chrishop-media-prod): cold transition without active expiration', () => {
    const prod = JSON.parse(fs.readFileSync(prodLifecyclePath, 'utf-8'));

    // Verify rules structure and enabled status
    for (const rule of prod.rules) {
      assert.ok(typeof rule.id === 'string' && rule.id.length > 0, 'Every rule must have an id');
      assert.equal(rule.enabled, true, 'Every rule must be enabled');
      assert.ok(typeof rule.conditions === 'object', 'Conditions must be an object');
    }

    // No blanket deleteObjectsTransition across the bucket (preserves active catalog drops permanently)
    const blanketExpireRule = prod.rules.find(
      (r: any) => (!r.conditions.prefix || r.conditions.prefix === '') && r.deleteObjectsTransition
    );
    assert.equal(blanketExpireRule, undefined, 'Production bucket must NEVER expire active root catalog media');

    // Archive prefix transitions to Infrequent Access
    const archiveRule = prod.rules.find((r: any) => r.conditions.prefix === 'archive/');
    assert.ok(archiveRule, 'Production must have a lifecycle rule for archive/ prefix');
    assert.ok(Array.isArray(archiveRule.storageClassTransitions), 'Must define storageClassTransitions');
    assert.equal(archiveRule.storageClassTransitions[0]?.storageClass, 'InfrequentAccess');
    assert.equal(archiveRule.storageClassTransitions[0]?.condition?.type, 'Age');
    assert.equal(archiveRule.storageClassTransitions[0]?.condition?.maxAge, 7776000, 'archive/ transition must be 90 days (7776000s)');

    // Past drops prefix transitions to Infrequent Access
    const pastDropsRule = prod.rules.find((r: any) => r.conditions.prefix === 'drops/past/');
    assert.ok(pastDropsRule, 'Production must have a lifecycle rule for drops/past/ prefix');
    assert.equal(pastDropsRule.storageClassTransitions[0]?.storageClass, 'InfrequentAccess');
    assert.equal(pastDropsRule.storageClassTransitions[0]?.condition?.type, 'Age');
    assert.equal(pastDropsRule.storageClassTransitions[0]?.condition?.maxAge, 15552000, 'drops/past/ transition must be 180 days (15552000s)');

    // Multipart upload cleanup
    const multipartRule = prod.rules.find((r: any) => r.abortMultipartUploadsTransition);
    assert.ok(multipartRule, 'Production must define abortMultipartUploadsTransition');
    assert.equal(multipartRule.abortMultipartUploadsTransition.condition.maxAge, 604800, 'Multipart abort must be 7 days (604800s)');
  });

  it('should validate Staging lifecycle policy (chrishop-media-staging): IA @ 30d, expiration @ 90d, abort @ 3d', () => {
    const staging = JSON.parse(fs.readFileSync(stagingLifecyclePath, 'utf-8'));

    // Staging transition to Infrequent Access after 30 days
    const iaRule = staging.rules.find((r: any) => r.storageClassTransitions?.length > 0);
    assert.ok(iaRule, 'Staging must define storageClassTransitions');
    assert.equal(iaRule.storageClassTransitions[0]?.storageClass, 'InfrequentAccess');
    assert.equal(iaRule.storageClassTransitions[0]?.condition?.type, 'Age');
    assert.equal(iaRule.storageClassTransitions[0]?.condition?.maxAge, 2592000, 'Staging IA transition must be 30 days (2592000s)');

    // Staging automated expiration after 90 days
    const expireRule = staging.rules.find((r: any) => r.deleteObjectsTransition);
    assert.ok(expireRule, 'Staging must define deleteObjectsTransition');
    assert.equal(expireRule.deleteObjectsTransition.condition.type, 'Age');
    assert.equal(expireRule.deleteObjectsTransition.condition.maxAge, 7776000, 'Staging expiration must be 90 days (7776000s)');

    // Multipart upload cleanup after 3 days
    const multipartRule = staging.rules.find((r: any) => r.abortMultipartUploadsTransition);
    assert.ok(multipartRule, 'Staging must define abortMultipartUploadsTransition');
    assert.equal(multipartRule.abortMultipartUploadsTransition.condition.maxAge, 259200, 'Multipart abort must be 3 days (259200s)');
  });

  it('should validate Preview lifecycle policy (chrishop-media-preview): aggressive expiration @ 7d, abort @ 1d', () => {
    const preview = JSON.parse(fs.readFileSync(previewLifecyclePath, 'utf-8'));

    // Ephemeral preview expiration after 7 days
    const expireRule = preview.rules.find((r: any) => r.deleteObjectsTransition);
    assert.ok(expireRule, 'Preview must define deleteObjectsTransition');
    assert.equal(expireRule.deleteObjectsTransition.condition.type, 'Age');
    assert.equal(expireRule.deleteObjectsTransition.condition.maxAge, 604800, 'Preview expiration must be 7 days (604800s)');

    // Multipart upload cleanup after 1 day (24h)
    const multipartRule = preview.rules.find((r: any) => r.abortMultipartUploadsTransition);
    assert.ok(multipartRule, 'Preview must define abortMultipartUploadsTransition');
    assert.equal(multipartRule.abortMultipartUploadsTransition.condition.maxAge, 86400, 'Multipart abort must be 1 day (86400s)');
  });

  it('should validate CORS configuration formatting adhering to both Cloudflare R2 API and S3 schemas', () => {
    assert.ok(fs.existsSync(corsPath), 'infra/r2/cors-media.json must exist');
    const cors = JSON.parse(fs.readFileSync(corsPath, 'utf-8'));

    // 1. Cloudflare REST / Wrangler R2 API format
    assert.ok(Array.isArray(cors.rules), 'cors-media.json must include rules array for Cloudflare R2 API');
    const cfRule = cors.rules[0];
    assert.ok(cfRule.allowed, 'Cloudflare rule must have allowed object');
    assert.ok(Array.isArray(cfRule.allowed.origins), 'origins must be an array');
    assert.ok(cfRule.allowed.origins.includes('https://chrishop.jacobmiller22.com'));
    assert.ok(cfRule.allowed.origins.includes('https://staging-chrishop.jacobmiller22.com'));
    assert.ok(cfRule.allowed.origins.includes('http://localhost:3000'));
    assert.ok(cfRule.allowed.origins.some((o: string) => o.includes('*-chrishop.jacobmiller22.com')));
    assert.ok(Array.isArray(cfRule.allowed.methods), 'methods must be an array');
    assert.ok(cfRule.allowed.methods.includes('GET'));
    assert.ok(cfRule.allowed.methods.includes('PUT'));
    assert.ok(Array.isArray(cfRule.allowed.headers), 'headers must be an array');
    assert.ok(Array.isArray(cfRule.exposeHeaders), 'exposeHeaders must be an array');
    assert.equal(cfRule.maxAgeSeconds, 3600);

    // 2. S3 AWS CLI compatibility format
    assert.ok(Array.isArray(cors.CORSRules), 'cors-media.json must include CORSRules array for AWS S3 CLI compatibility');
  });

  it('should test dry-run execution of r2_apply_lifecycle.sh for all environments', () => {
    assert.ok(fs.existsSync(applyLifecycleScript), 'infra/scripts/deps/r2_apply_lifecycle.sh must exist');

    // Test execution in dry-run mode
    const output = execSync(`bash "${applyLifecycleScript}" --dry-run`, {
      encoding: 'utf-8',
      cwd: rootDir,
    });

    assert.ok(output.includes('ChrisShop Cloudflare R2 Bucket Lifecycle Provisioner'), 'Script banner must display');
    assert.ok(output.includes('chrishop-media-prod'), 'Must evaluate chrishop-media-prod');
    assert.ok(output.includes('chrishop-media-staging'), 'Must evaluate chrishop-media-staging');
    assert.ok(output.includes('chrishop-media-preview'), 'Must evaluate chrishop-media-preview');
    assert.ok(output.includes('[SUCCESS] All target lifecycle policies processed successfully.'), 'Must succeed cleanly');
  });

  it('should test dry-run execution of r2_apply_lifecycle.sh with environment filter and overrides', () => {
    // Environment filter: staging
    const stagingOutput = execSync(`bash "${applyLifecycleScript}" --env staging --dry-run`, {
      encoding: 'utf-8',
      cwd: rootDir,
    });
    assert.ok(stagingOutput.includes('chrishop-media-staging'));
    assert.ok(!stagingOutput.includes('chrishop-media-prod'));

    // Custom bucket and file override
    const overrideOutput = execSync(
      `bash "${applyLifecycleScript}" --bucket custom-test-bucket --file infra/r2/lifecycle-preview.json --dry-run`,
      {
        encoding: 'utf-8',
        cwd: rootDir,
      }
    );
    assert.ok(overrideOutput.includes('custom-test-bucket'));
    assert.ok(overrideOutput.includes('expire-preview-ephemeral-objects'));
  });
});
