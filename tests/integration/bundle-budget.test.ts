import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  checkBundleBudget,
  profileWorkerBundle,
  formatMarkdownSummary,
  classifyWorkerRole,
  findWorkerFiles,
  BUNDLE_BUDGET_THRESHOLDS,
  formatBytes,
  runCli,
} from '../../scripts/check-bundle-budget.js';

describe('Cloudflare Worker Bundle Size Budgeting & PR Verification Gate', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const tempFixturesDir = path.join(rootDir, '.temp-bundle-test-fixtures');

  before(() => {
    if (fs.existsSync(tempFixturesDir)) {
      fs.rmSync(tempFixturesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempFixturesDir, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(tempFixturesDir)) {
      fs.rmSync(tempFixturesDir, { recursive: true, force: true });
    }
  });

  it('should verify defined threshold constants align with Story 2.41 specification', () => {
    // Storefront: Warning > 4MB uncompressed, Hard Fail > 8MB gzip, Hard Fail > 33MB uncompressed
    assert.equal(
      BUNDLE_BUDGET_THRESHOLDS.storefront.warnUncompressedBytes,
      4 * 1024 * 1024,
      'Storefront warning threshold must be 4 MB'
    );
    assert.equal(
      BUNDLE_BUDGET_THRESHOLDS.storefront.maxGzipBytes,
      8 * 1024 * 1024,
      'Storefront hard fail gzip threshold must be 8 MB'
    );
    assert.equal(
      BUNDLE_BUDGET_THRESHOLDS.storefront.maxUncompressedBytes,
      33 * 1024 * 1024,
      'Storefront uncompressed ceiling must be 33 MB'
    );

    // Admin: Warning > 20MB uncompressed, Hard Fail > 8.5MB gzip, Hard Fail > 33MB uncompressed
    assert.equal(
      BUNDLE_BUDGET_THRESHOLDS.admin.warnUncompressedBytes,
      20 * 1024 * 1024,
      'Admin warning threshold must be 20 MB'
    );
    assert.equal(
      BUNDLE_BUDGET_THRESHOLDS.admin.maxGzipBytes,
      8.5 * 1024 * 1024,
      'Admin hard fail gzip threshold must be 8.5 MB'
    );
    assert.equal(
      BUNDLE_BUDGET_THRESHOLDS.admin.maxUncompressedBytes,
      33 * 1024 * 1024,
      'Admin uncompressed ceiling must be 33 MB'
    );
  });

  it('should correctly classify worker bundle roles from file paths', () => {
    assert.equal(classifyWorkerRole('worker.js'), 'storefront');
    assert.equal(classifyWorkerRole('.open-next/worker.js'), 'storefront');
    assert.equal(classifyWorkerRole('server-functions/default/index.mjs'), 'storefront');
    assert.equal(classifyWorkerRole('server-functions/storefront.js'), 'storefront');
    assert.equal(classifyWorkerRole('admin-worker.js'), 'admin');
    assert.equal(classifyWorkerRole('server-functions/admin/index.mjs'), 'admin');
    assert.equal(classifyWorkerRole('.open-next/admin.js'), 'admin');
    assert.equal(classifyWorkerRole('custom-worker.js'), 'generic');
  });

  it('should format byte sizes accurately', () => {
    assert.equal(formatBytes(500), '500 B');
    assert.equal(formatBytes(1536), '1.50 KB');
    assert.equal(formatBytes(1048576), '1.00 MB');
    assert.equal(formatBytes(8.5 * 1024 * 1024), '8.50 MB');
  });

  it('should accurately discover worker files and ignore assets/cache', () => {
    const scanDir = path.join(tempFixturesDir, 'discovery-test');
    fs.mkdirSync(path.join(scanDir, 'assets/_next/static/css'), { recursive: true });
    fs.mkdirSync(path.join(scanDir, 'cache'), { recursive: true });
    fs.mkdirSync(path.join(scanDir, 'server-functions/admin'), { recursive: true });

    // Worker files
    fs.writeFileSync(path.join(scanDir, 'worker.js'), 'export default {};');
    fs.writeFileSync(path.join(scanDir, 'server-functions/admin/index.mjs'), 'export default {};');

    // Non-worker files
    fs.writeFileSync(path.join(scanDir, 'assets/style.css'), 'body { color: red; }');
    fs.writeFileSync(path.join(scanDir, 'cache/cache.json'), '{}');
    fs.writeFileSync(path.join(scanDir, 'worker.js.map'), '{}');

    const discovered = findWorkerFiles(scanDir, scanDir);
    assert.equal(discovered.length, 2, 'Should discover exactly 2 worker files');
    assert.ok(
      discovered.some((f) => f.endsWith('worker.js')),
      'Must discover worker.js'
    );
    assert.ok(
      discovered.some((f) => f.endsWith('index.mjs')),
      'Must discover server-functions/admin/index.mjs'
    );
  });

  it('should profile production .open-next/worker.js and pass within budget', () => {
    const result = checkBundleBudget({ cwd: rootDir });

    assert.equal(result.success, true, 'Production bundle check must succeed');
    assert.equal(result.exitCode, 0, 'Exit code must be 0');
    assert.ok(result.bundles.length > 0, 'At least one worker bundle must be detected');

    const storefrontWorker = result.bundles.find((b) => b.relativePath.includes('worker.js'));
    assert.ok(storefrontWorker, 'Storefront worker bundle must be detected');
    assert.equal(storefrontWorker.role, 'storefront');
    assert.equal(storefrontWorker.status, 'PASS');
    assert.equal(storefrontWorker.failures.length, 0);

    // Storefront bundle should be well under 4MB uncompressed / 8MB gzip
    assert.ok(storefrontWorker.uncompressedBytes < 4 * 1024 * 1024);
    assert.ok(storefrontWorker.gzipBytes < 8 * 1024 * 1024);

    // Summary markdown should include pass badge
    assert.ok(result.summaryMarkdown.includes('✅ PASS'));
    assert.ok(result.summaryMarkdown.includes('Cloudflare Worker Bundle Size Budget Report'));
  });

  it('should trigger warning status when storefront worker exceeds 4MB uncompressed but stays under gzip limit', () => {
    const warnDir = path.join(tempFixturesDir, 'warn-storefront');
    fs.mkdirSync(warnDir, { recursive: true });

    // 4.5 MB of repeating compressible text (compresses to ~20-50 KB)
    const filler = '/* ChrisShop Storefront Edge Cache Buffer */\n'.repeat(105000);
    const workerContent = `export default { async fetch() { return new Response("OK"); } };\n${filler}`;
    fs.writeFileSync(path.join(warnDir, 'worker.js'), workerContent);

    const result = checkBundleBudget({ openNextDir: warnDir });

    assert.equal(result.success, true, 'Should succeed (not hard fail) on warning');
    assert.equal(result.hasWarnings, true, 'Must flag warnings');
    assert.equal(result.exitCode, 0, 'Exit code must remain 0 on warning alone');

    const worker = result.bundles[0];
    assert.equal(worker.status, 'WARN');
    assert.equal(worker.failures.length, 0);
    assert.ok(worker.warnings.length > 0);
    assert.ok(worker.warnings[0].includes('warning threshold of 4.00 MB'));
    assert.ok(result.summaryMarkdown.includes('⚠️ WARN'));
    assert.ok(result.summaryMarkdown.includes('Bundle Budget Warning (Approaching Ceiling)'));
  });

  it('should trigger hard failure (exit code 1) when storefront worker breaches 8MB gzip limit', () => {
    const breachDir = path.join(tempFixturesDir, 'breach-storefront');
    fs.mkdirSync(breachDir, { recursive: true });

    // 8.2 MB of random bytes (uncompressible, so gzip > 8 MB)
    const randomPayload = crypto.randomBytes(8.2 * 1024 * 1024);
    const header = Buffer.from('export default { fetch() { return new Response("OK"); } };\nconst data = "');
    const footer = Buffer.from('";\n');
    const fullBundle = Buffer.concat([header, randomPayload, footer]);
    fs.writeFileSync(path.join(breachDir, 'worker.js'), fullBundle);

    const result = checkBundleBudget({ openNextDir: breachDir });

    assert.equal(result.success, false, 'Should fail when gzip limit is breached');
    assert.equal(result.exitCode, 1, 'Exit code must be 1 on breach');

    const worker = result.bundles[0];
    assert.equal(worker.status, 'FAIL');
    assert.ok(worker.failures.length > 0);
    assert.ok(
      worker.failures[0].includes('exceeds Storefront Edge Worker hard limit of 8.00 MB'),
      `Failure message must include limit details: ${worker.failures[0]}`
    );

    assert.ok(result.summaryMarkdown.includes('❌ FAIL'));
    assert.ok(result.summaryMarkdown.includes('Bundle Budget Breach Detected'));
    assert.ok(result.summaryMarkdown.includes('Actionable Remediation'));
  });

  it('should enforce Admin CMS Worker thresholds (20MB uncompressed warn / 8.5MB gzip hard fail)', () => {
    const adminDir = path.join(tempFixturesDir, 'admin-tests');
    fs.mkdirSync(adminDir, { recursive: true });

    // Test Admin Warning: 21 MB of repeating compressible code (compresses to ~100 KB)
    const repeatingCode = 'const PAYLOAD_ADMIN_SCHEMA = { table: "collections", fields: [] };\n'.repeat(320000);
    const adminJs = `export default { fetch() {} };\n${repeatingCode}`;
    fs.writeFileSync(path.join(adminDir, 'admin-worker.js'), adminJs);

    const warnResult = checkBundleBudget({ openNextDir: adminDir });
    assert.equal(warnResult.success, true);
    assert.equal(warnResult.hasWarnings, true);
    assert.equal(warnResult.exitCode, 0);

    const adminBundle = warnResult.bundles[0];
    assert.equal(adminBundle.role, 'admin');
    assert.equal(adminBundle.status, 'WARN');
    assert.ok(adminBundle.warnings[0].includes('Admin CMS Worker warning threshold of 20.00 MB'));

    // Test Admin Hard Fail: 8.7 MB of uncompressible random bytes
    const adminRandom = crypto.randomBytes(8.7 * 1024 * 1024);
    const adminFailBundle = Buffer.concat([
      Buffer.from('export default {}; const payloadAdmin = "'),
      adminRandom,
      Buffer.from('";'),
    ]);
    fs.writeFileSync(path.join(adminDir, 'admin-worker.js'), adminFailBundle);

    const failResult = checkBundleBudget({ openNextDir: adminDir });
    assert.equal(failResult.success, false);
    assert.equal(failResult.exitCode, 1);
    assert.equal(failResult.bundles[0].status, 'FAIL');
    assert.ok(failResult.bundles[0].failures[0].includes('Admin CMS Worker hard limit of 8.50 MB'));
  });

  it('should fail when a bundle breaches the Cloudflare Workers 33MB uncompressed ceiling', () => {
    const ceilingDir = path.join(tempFixturesDir, 'ceiling-test');
    fs.mkdirSync(ceilingDir, { recursive: true });

    // 34 MB of compressible text (gzip is tiny ~35KB, but uncompressed exceeds 33MB Cloudflare ceiling)
    const largeBundle = Buffer.concat([
      Buffer.from('export default {};\n'),
      Buffer.alloc(34 * 1024 * 1024, 'a'),
    ]);
    fs.writeFileSync(path.join(ceilingDir, 'worker.js'), largeBundle);

    const result = checkBundleBudget({ openNextDir: ceilingDir });
    assert.equal(result.success, false);
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.bundles[0].failures.some((f) => f.includes('Cloudflare Workers hard ceiling of 33.00 MB'))
    );
  });

  it('should return actionable diagnostics when build directory or bundles are missing', () => {
    // Missing directory
    const missingDir = path.join(tempFixturesDir, 'does-not-exist');
    const resultMissing = checkBundleBudget({ openNextDir: missingDir });
    assert.equal(resultMissing.success, false);
    assert.equal(resultMissing.exitCode, 1);
    assert.ok(resultMissing.summaryMarkdown.includes('was not found'));

    // Empty directory
    const emptyDir = path.join(tempFixturesDir, 'empty-dir');
    fs.mkdirSync(emptyDir, { recursive: true });
    const resultEmpty = checkBundleBudget({ openNextDir: emptyDir });
    assert.equal(resultEmpty.success, false);
    assert.equal(resultEmpty.exitCode, 1);
    assert.ok(resultEmpty.summaryMarkdown.includes('No worker bundles found'));
  });

  it('should append markdown report to GITHUB_STEP_SUMMARY when variable is set', () => {
    const summaryFile = path.join(tempFixturesDir, 'step-summary.md');
    process.env.GITHUB_STEP_SUMMARY = summaryFile;

    try {
      const exitCode = execSync(
        `pnpm exec tsx scripts/check-bundle-budget.ts`,
        { cwd: rootDir, env: { ...process.env, GITHUB_STEP_SUMMARY: summaryFile } }
      );
      assert.ok(fs.existsSync(summaryFile), 'GITHUB_STEP_SUMMARY file must be created');
      const summaryContent = fs.readFileSync(summaryFile, 'utf-8');
      assert.ok(summaryContent.includes('Cloudflare Worker Bundle Size Budget Report'));
      assert.ok(summaryContent.includes('worker.js'));
    } finally {
      delete process.env.GITHUB_STEP_SUMMARY;
    }
  });

  it('should execute CLI via npm script "pnpm run check:bundle" and exit with code 0', () => {
    const output = execSync('pnpm run check:bundle', {
      cwd: rootDir,
      encoding: 'utf-8',
    });

    assert.ok(output.includes('Cloudflare Worker Bundle Size Budget Verification Gate'));
    assert.ok(output.includes('Storefront Edge Worker'));
    assert.ok(output.includes('All worker bundles are within Cloudflare Workers size limits.'));
  });

  it('should execute CLI with simulated breach directory and exit with code 1 and diagnostics', () => {
    const breachDir = path.join(tempFixturesDir, 'cli-breach');
    fs.mkdirSync(breachDir, { recursive: true });
    const randomPayload = crypto.randomBytes(8.2 * 1024 * 1024);
    fs.writeFileSync(path.join(breachDir, 'worker.js'), randomPayload);

    let failed = false;
    let failureOutput = '';

    try {
      execSync(`pnpm exec tsx scripts/check-bundle-budget.ts --dir ${breachDir}`, {
        cwd: rootDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (err: any) {
      failed = true;
      failureOutput = (err.stdout || '') + (err.stderr || '');
      assert.equal(err.status, 1, 'Process must exit with status code 1');
    }

    assert.ok(failed, 'CLI must exit with non-zero status on budget breach');
    assert.ok(
      failureOutput.includes('BUDGET BREACHES (HARD FAILURES)'),
      'Output must contain failure header'
    );
    assert.ok(
      failureOutput.includes('exceeds Storefront Edge Worker hard limit'),
      'Output must contain specific threshold failure description'
    );
    assert.ok(
      failureOutput.includes('Actionable Remediation'),
      'Output must provide actionable remediation advice'
    );
  });
});
