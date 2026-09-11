import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Monorepo Scripts & GitHub Actions Coverage', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const workflowsDir = path.join(rootDir, '.github/workflows');

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const scripts = pkg.scripts || {};

  it('should verify all critical dev and build scripts are declared in package.json', () => {
    const requiredScripts = [
      'dev',
      'dev:web',
      'dev:wrangler',
      'dev:types',
      'dev:db',
      'build',
      'build:apps',
      'build:worker',
      'build:prod',
      'check',
      'test',
      'test:unit',
      'test:integration',
      'test:all',
      'verify:local',
      'audit:security',
    ];

    for (const scriptName of requiredScripts) {
      assert.ok(
        scripts[scriptName],
        `Script "${scriptName}" must be defined in root package.json`
      );
    }
  });

  it('should verify 100% coverage of all pnpm run commands invoked by GitHub Actions workflows', () => {
    const workflowFiles = fs
      .readdirSync(workflowsDir)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

    assert.ok(workflowFiles.length > 0, 'Must find GitHub Actions workflow files');

    const referencedScripts = new Set<string>();

    for (const file of workflowFiles) {
      const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');
      // Match "pnpm run <script-name>" or "pnpm <script-name>" where script-name is an identifier
      const pnpmRunMatches = content.matchAll(/pnpm\s+run\s+([a-zA-Z0-9_:-]+)/g);
      for (const match of pnpmRunMatches) {
        referencedScripts.add(match[1]);
      }
    }

    assert.ok(
      referencedScripts.size > 0,
      'Should identify pnpm run scripts in GitHub Actions workflows'
    );

    for (const scriptName of referencedScripts) {
      assert.ok(
        scripts[scriptName],
        `GitHub Actions workflow calls "pnpm run ${scriptName}", which MUST be covered in package.json`
      );
    }
  });

  it('should execute build:worker and verify .open-next/worker.js generation', () => {
    execSync('pnpm run build:worker', { cwd: rootDir, stdio: 'pipe' });

    const workerPath = path.join(rootDir, '.open-next/worker.js');
    assert.ok(fs.existsSync(workerPath), '.open-next/worker.js must exist after build:worker');

    const content = fs.readFileSync(workerPath, 'utf-8');
    assert.ok(content.includes('export default'), 'Worker must export default handler');
    assert.ok(content.includes('/api/health'), 'Worker must handle health check');
  });

  it('should verify wrangler dry-run validation with generated worker bundle', () => {
    const output = execSync('pnpm exec wrangler deploy --dry-run --env preview', {
      cwd: rootDir,
      encoding: 'utf-8',
    });

    assert.ok(
      output.includes('--dry-run: exiting now') || output.includes('Total Upload'),
      'Wrangler deploy dry-run must validate successfully'
    );
  });
});
