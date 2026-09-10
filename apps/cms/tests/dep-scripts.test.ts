import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Dependency Control Automation Scripts (Story 2.2)', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const scriptsDir = path.join(repoRoot, 'infra/scripts/deps');
  const hetznerScript = path.join(repoRoot, 'infra/archive/scripts/hetzner_provision.sh');
  const directusScript = path.join(scriptsDir, 'directus_sync.sh');
  const r2Script = path.join(scriptsDir, 'r2_create_buckets.sh');
  const corsConfigFile = path.join(repoRoot, 'infra/r2/cors-media.json');

  it('should verify all required scripts exist and are executable', () => {
    const scripts = [hetznerScript, directusScript, r2Script];
    for (const script of scripts) {
      assert.ok(fs.existsSync(script), `Script must exist: ${script}`);
      const stats = fs.statSync(script);
      // Check executable bit for user (0o100)
      assert.ok((stats.mode & 0o111) !== 0, `Script must be executable: ${script}`);
    }
  });

  it('should pass bash -n syntax checks for all scripts', () => {
    const scripts = [hetznerScript, directusScript, r2Script];
    for (const script of scripts) {
      assert.doesNotThrow(() => {
        execSync(`bash -n "${script}"`, { stdio: 'pipe' });
      }, `bash -n failed on ${script}`);
    }
  });

  it('should output help and exit 0 for --help on all scripts', () => {
    const scripts = [hetznerScript, directusScript, r2Script];
    for (const script of scripts) {
      const output = execSync(`"${script}" --help`, { encoding: 'utf-8' });
      assert.match(output, /Usage:/i);
    }
  });

  it('should fail with exit code 1 when required env vars are missing', () => {
    // hetzner_provision.sh without HCLOUD_TOKEN
    assert.throws(() => {
      execSync(`HCLOUD_TOKEN="" "${hetznerScript}"`, { stdio: 'pipe' });
    }, /Command failed/);

    // r2_create_buckets.sh without endpoint/credentials
    assert.throws(() => {
      execSync(`ENDPOINT_URL="" CLOUDFLARE_ACCOUNT_ID="" "${r2Script}"`, { stdio: 'pipe' });
    }, /Command failed/);

    // directus_sync.sh with nonexistent snapshot
    assert.throws(() => {
      execSync(`"${directusScript}" /nonexistent-path.yaml`, { stdio: 'pipe' });
    }, /Command failed/);
  });

  it('should support dry-run execution on hetzner_provision.sh and r2_create_buckets.sh', () => {
    const hetznerDryRun = execSync(`HCLOUD_TOKEN="mock_token" "${hetznerScript}" --dry-run`, {
      encoding: 'utf-8',
    });
    assert.match(hetznerDryRun, /\[DRY-RUN\]/);

    const r2DryRun = execSync(
      `ENDPOINT_URL="http://localhost:9000" AWS_ACCESS_KEY_ID="test" AWS_SECRET_ACCESS_KEY="test" "${r2Script}" --dry-run`,
      { encoding: 'utf-8' }
    );
    assert.match(r2DryRun, /\[DRY-RUN\]/);
  });

  it('should verify infra/r2/cors-media.json exists and has valid CORS rules', () => {
    assert.ok(fs.existsSync(corsConfigFile), 'infra/r2/cors-media.json must exist');
    const content = JSON.parse(fs.readFileSync(corsConfigFile, 'utf-8'));
    assert.ok(content.CORSRules && Array.isArray(content.CORSRules), 'Must define CORSRules array');
    const rule = content.CORSRules[0];
    assert.ok(rule.AllowedOrigins.includes('https://chrishop.com'));
    assert.ok(rule.AllowedMethods.includes('GET'));
    assert.ok(rule.AllowedMethods.includes('PUT'));
  });
});
