import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('CI Security & Dependency Vulnerability Audit (Story 5.4)', () => {
  const rootDir = process.cwd();

  it('should pass pnpm audit with zero high and zero critical vulnerabilities', () => {
    let auditData: any;
    try {
      const stdout = execSync('pnpm audit --json', { encoding: 'utf-8', cwd: rootDir });
      auditData = JSON.parse(stdout);
    } catch (err: any) {
      // pnpm audit --json exits non-zero if vulnerabilities exist, but still outputs valid JSON to stdout
      const rawOutput = err.stdout?.toString() || '';
      assert.ok(rawOutput.length > 0, 'pnpm audit must produce output');
      auditData = JSON.parse(rawOutput);
    }

    assert.ok(auditData?.metadata?.vulnerabilities, 'Audit JSON must contain vulnerability metadata');
    const { high, critical } = auditData.metadata.vulnerabilities;

    assert.equal(
      high,
      0,
      `Expected 0 high-severity vulnerabilities, but found ${high}. Remediation via pnpm overrides required.`
    );
    assert.equal(
      critical,
      0,
      `Expected 0 critical-severity vulnerabilities, but found ${critical}. Remediation required.`
    );

    // Also assert that executing pnpm audit --audit-level=high exits successfully with code 0
    let auditExitCode = 0;
    try {
      execSync('pnpm audit --audit-level=high', { stdio: 'pipe', cwd: rootDir });
    } catch (err: any) {
      auditExitCode = err.status ?? 1;
    }

    assert.equal(
      auditExitCode,
      0,
      'pnpm audit --audit-level=high must exit with code 0, confirming no high or critical vulnerabilities'
    );
  });

  it('should define audit:security script and security overrides in package.json', () => {
    const pkgJsonPath = path.join(rootDir, 'package.json');
    assert.ok(fs.existsSync(pkgJsonPath), 'package.json must exist at root');

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    assert.ok(pkgJson.scripts, 'package.json must contain scripts');
    assert.equal(
      pkgJson.scripts['audit:security'],
      'pnpm audit --audit-level=high',
      'package.json must define "audit:security": "pnpm audit --audit-level=high"'
    );

    assert.ok(pkgJson.pnpm?.overrides, 'package.json must specify pnpm.overrides for transitive security patches');
    const overrides = pkgJson.pnpm.overrides;
    assert.ok(overrides['sharp'], 'pnpm overrides must patch sharp');
    assert.ok(overrides['postcss'], 'pnpm overrides must patch postcss');
    assert.ok(overrides['undici'], 'pnpm overrides must patch undici');
    assert.ok(overrides['ws'], 'pnpm overrides must patch ws');
    assert.ok(overrides['js-yaml'], 'pnpm overrides must patch js-yaml');
  });

  it('should configure Dependabot with full monorepo package coverage and github-actions', () => {
    const dependabotPath = path.join(rootDir, '.github/dependabot.yml');
    assert.ok(fs.existsSync(dependabotPath), '.github/dependabot.yml must exist');

    const content = fs.readFileSync(dependabotPath, 'utf-8');
    assert.ok(content.includes('version: 2'), 'Dependabot config must specify version: 2');
    assert.ok(content.includes('package-ecosystem: "github-actions"'), 'Dependabot must scan github-actions');

    const requiredNpmWorkspaces = [
      '/',
      '/apps/web',
      '/packages/config',
      '/packages/notifications',
      '/packages/types',
      '/packages/ui',
    ];

    for (const workspaceDir of requiredNpmWorkspaces) {
      const match = new RegExp(
        `package-ecosystem:\\s*["']npm["'][\\s\\S]*?directory:\\s*["']${workspaceDir.replace('/', '\\/')}["']`
      );
      assert.ok(
        match.test(content),
        `Dependabot must configure npm scanning for workspace directory "${workspaceDir}"`
      );
    }
  });

  it('should enforce security audit in GitHub Actions CI and deployment workflows', () => {
    const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');
    assert.ok(fs.existsSync(deployWorkflowPath), '.github/workflows/deploy.yml must exist');
    const deployContent = fs.readFileSync(deployWorkflowPath, 'utf-8');
    assert.ok(
      deployContent.includes('pnpm audit --audit-level=high'),
      '.github/workflows/deploy.yml must enforce pnpm audit --audit-level=high'
    );

    const ciWorkflowPath = path.join(rootDir, '.github/workflows/ci.yml');
    assert.ok(fs.existsSync(ciWorkflowPath), '.github/workflows/ci.yml must exist');
    const ciContent = fs.readFileSync(ciWorkflowPath, 'utf-8');
    assert.ok(
      ciContent.includes('pnpm audit --audit-level=high'),
      '.github/workflows/ci.yml must enforce pnpm audit --audit-level=high'
    );
    assert.ok(
      ciContent.includes('actions/dependency-review-action'),
      '.github/workflows/ci.yml must include actions/dependency-review-action'
    );
  });

  it('should have comprehensive security audit report in docs/security/DEPENDENCY_AUDIT.md', () => {
    const auditDocPath = path.join(rootDir, 'docs/security/DEPENDENCY_AUDIT.md');
    assert.ok(fs.existsSync(auditDocPath), 'docs/security/DEPENDENCY_AUDIT.md must exist');

    const docContent = fs.readFileSync(auditDocPath, 'utf-8');
    assert.ok(docContent.includes('Executive Summary'), 'Audit report must have Executive Summary');
    assert.ok(docContent.includes('Package Inventory'), 'Audit report must list package inventory');
    assert.ok(docContent.includes('Remediation Matrix'), 'Audit report must document remediation matrix');
    assert.ok(docContent.includes('Incident Response Runbook'), 'Audit report must provide incident response runbook');
  });
});
