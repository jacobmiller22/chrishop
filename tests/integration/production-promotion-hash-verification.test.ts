import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  probeHealth,
  verifyStagingEdgeSha,
  STAGING_HEALTH_URL,
  PROD_HEALTH_URL,
} from '../../scripts/promote-production';
import { performHealthCheck } from '../../apps/web/src/lib/health-monitoring';
import { GET } from '../../apps/web/src/app/api/health/route';

describe('Story 4.23: Production Promotion Deployment Integrity & Commit Hash Verification', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');
  const promotionScriptPath = path.join(rootDir, 'scripts/promote-production.ts');
  const buildWorkerScriptPath = path.join(rootDir, 'scripts/build-worker.ts');
  const promotionRunbookPath = path.join(rootDir, 'docs/runbooks/PRODUCTION_PROMOTION.md');
  const devopsSkillPath = path.join(rootDir, '.agents/skills/devops/SKILL.md');

  describe('Runtime Commit Exposure (/api/health)', () => {
    it('should expose commitSha, shortSha, buildTimestamp, and environment in health payload', async () => {
      const { payload, httpStatus } = await performHealthCheck();
      assert.strictEqual(httpStatus, 200, 'performHealthCheck must return HTTP 200');

      assert.ok(payload.commitSha, 'commitSha must be defined');
      assert.ok(payload.commitSha.length >= 7, 'commitSha must be a valid git SHA');
      assert.ok(payload.shortSha, 'shortSha must be defined');
      assert.strictEqual(payload.shortSha, payload.commitSha.slice(0, 7), 'shortSha must match slice of commitSha');
      assert.ok(payload.buildTimestamp, 'buildTimestamp must be defined');
      assert.ok(!isNaN(Date.parse(payload.buildTimestamp)), 'buildTimestamp must be valid ISO date string');
      assert.ok(payload.environment, 'environment must be defined');
    });

    it('should return x-chrishop-commit-sha header with cache-control no-store from Next.js route handler', async () => {
      const response = await GET();
      assert.strictEqual(response.status, 200, 'Health endpoint must return HTTP 200');

      const commitShaHeader = response.headers.get('x-chrishop-commit-sha');
      assert.ok(commitShaHeader, 'x-chrishop-commit-sha header must be present');
      assert.ok(commitShaHeader.length >= 7, 'x-chrishop-commit-sha header must be valid SHA');

      const cacheControl = response.headers.get('cache-control');
      assert.ok(cacheControl?.includes('no-store'), 'cache-control must contain no-store');

      const json = await response.json();
      assert.strictEqual(json.commitSha, commitShaHeader, 'JSON commitSha must match header value');
      assert.strictEqual(json.shortSha, commitShaHeader.slice(0, 7), 'JSON shortSha must match header prefix');
    });

    it('should verify scripts/build-worker.ts injects buildCommitSha and response headers into worker bundle', () => {
      assert.ok(fs.existsSync(buildWorkerScriptPath), 'scripts/build-worker.ts must exist');
      const content = fs.readFileSync(buildWorkerScriptPath, 'utf-8');

      assert.ok(content.includes('buildCommitSha'), 'Must bake buildCommitSha at build time');
      assert.ok(content.includes('buildShortSha'), 'Must bake buildShortSha at build time');
      assert.ok(content.includes('buildIsoTimestamp'), 'Must bake buildIsoTimestamp at build time');
      assert.ok(content.includes('x-chrishop-commit-sha'), 'Must inject x-chrishop-commit-sha into worker headers');
    });
  });

  describe('CLI Promotion Tooling (scripts/promote-production.ts)', () => {
    it('should export correct production and staging health probe URLs', () => {
      assert.strictEqual(
        STAGING_HEALTH_URL,
        'https://staging-chrishop.jacobmiller22.com/api/health',
        'Staging health URL must point to staging-chrishop'
      );
      assert.strictEqual(
        PROD_HEALTH_URL,
        'https://chrishop.jacobmiller22.com/api/health',
        'Production health URL must point to chrishop production'
      );
    });

    it('should probe health and extract commit SHA from mock responses', async () => {
      const originalFetch = globalThis.fetch;
      try {
        const mockSha = 'abcdef1234567890abcdef1234567890abcdef12';
        (globalThis as any).fetch = async () => {
          return new Response(
            JSON.stringify({
              status: 'healthy',
              environment: 'staging',
              commitSha: mockSha,
              shortSha: mockSha.slice(0, 7),
              buildTimestamp: '2026-09-22T08:00:00.000Z',
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
                'x-chrishop-commit-sha': mockSha,
              },
            }
          );
        };

        const result = await probeHealth('https://mock-edge/api/health');
        assert.strictEqual(result.ok, true, 'Result ok must be true');
        assert.strictEqual(result.status, 200, 'Status must be 200');
        assert.strictEqual(result.commitSha, mockSha, 'commitSha must match mock');
        assert.strictEqual(result.shortSha, mockSha.slice(0, 7), 'shortSha must match slice');
        assert.strictEqual(result.headers['x-chrishop-commit-sha'], mockSha, 'Header must match mock');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should verify verifyStagingEdgeSha matches exact and prefix commit hashes', async () => {
      const originalFetch = globalThis.fetch;
      try {
        const targetSha = '31b26f59bf0a2c9183dc2ad9ecf91a5db9f95018';
        (globalThis as any).fetch = async () => {
          return new Response(
            JSON.stringify({
              status: 'healthy',
              commitSha: targetSha,
              shortSha: targetSha.slice(0, 7),
            }),
            {
              status: 200,
              headers: { 'x-chrishop-commit-sha': targetSha },
            }
          );
        };

        const verification = await verifyStagingEdgeSha(targetSha, {
          targetUrl: 'https://mock-edge/api/health',
          maxRetries: 2,
          retryIntervalMs: 10,
        });

        assert.strictEqual(verification.verified, true, 'Verification must succeed');
        assert.strictEqual(verification.edgeSha, targetSha, 'Edge SHA must match target');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should detect SHA mismatch and report diagnostic error in verifyStagingEdgeSha', async () => {
      const originalFetch = globalThis.fetch;
      try {
        const edgeSha = '1111111111111111111111111111111111111111';
        const targetSha = '2222222222222222222222222222222222222222';
        (globalThis as any).fetch = async () => {
          return new Response(
            JSON.stringify({
              status: 'healthy',
              commitSha: edgeSha,
            }),
            {
              status: 200,
              headers: { 'x-chrishop-commit-sha': edgeSha },
            }
          );
        };

        const verification = await verifyStagingEdgeSha(targetSha, {
          targetUrl: 'https://mock-edge/api/health',
          maxRetries: 2,
          retryIntervalMs: 10,
          logger: () => {},
        });

        assert.strictEqual(verification.verified, false, 'Verification must fail on mismatch');
        assert.strictEqual(verification.edgeSha, edgeSha, 'Reported edge SHA must match probe');
        assert.ok(verification.error?.includes('does not match'), 'Error message must describe mismatch');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should verify CLI script supports --verify-sha, --no-verify-sha, and --wait-for-staging flags', () => {
      const content = fs.readFileSync(promotionScriptPath, 'utf-8');
      assert.ok(content.includes('--verify-sha'), 'CLI must support --verify-sha');
      assert.ok(content.includes('--no-verify-sha'), 'CLI must support --no-verify-sha');
      assert.ok(content.includes('--wait-for-staging'), 'CLI must support --wait-for-staging');
      assert.ok(content.includes('verifyStagingEdgeSha'), 'CLI must call verifyStagingEdgeSha');
    });
  });

  describe('GitHub Actions CI/CD Hash Verification Workflow (.github/workflows/deploy.yml)', () => {
    it('should enforce Pre-Test Staging Edge Commit Hash Assertion in test-staging job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');
      const testStagingIdx = content.indexOf('test-staging:');
      assert.ok(testStagingIdx !== -1, 'test-staging job must exist');
      const testStagingSection = content.slice(testStagingIdx, content.indexOf('deploy-production:'));

      assert.ok(
        testStagingSection.includes('Pre-Test Staging Edge Commit Hash Assertion'),
        'Must include Pre-Test Staging Edge Commit Hash Assertion step'
      );
      assert.ok(
        testStagingSection.includes('EXPECTED_SHA="${{ github.sha }}"'),
        'Must set EXPECTED_SHA to github.sha'
      );
      assert.ok(
        testStagingSection.includes('x-chrishop-commit-sha') || testStagingSection.includes('.commitSha'),
        'Must extract commit SHA from staging health endpoint'
      );
      assert.ok(
        testStagingSection.includes('Pre-test staging commit hash assertion passed'),
        'Must log success message when SHA matches'
      );
    });

    it('should enforce Post-Test Staging SHA Integrity Check in test-staging job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');
      const testStagingIdx = content.indexOf('test-staging:');
      const testStagingSection = content.slice(testStagingIdx, content.indexOf('deploy-production:'));

      assert.ok(
        testStagingSection.includes('Post-Test Staging SHA Integrity Check'),
        'Must include Post-Test Staging SHA Integrity Check step'
      );
      assert.ok(
        testStagingSection.includes('Mid-test staging mutation detected'),
        'Must detect and fail on mid-test edge mutations'
      );
      assert.ok(
        testStagingSection.includes('Staging SHA integrity confirmed post-test'),
        'Must log confirmation when no mid-test mutation occurred'
      );
    });

    it('should enforce Pre-Approval Production Target Commit Validation in deploy-production job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');
      const deployProdIdx = content.indexOf('deploy-production:');
      const deployProdSection = content.slice(deployProdIdx, content.indexOf('verify-production:'));

      assert.ok(
        deployProdSection.includes('Pre-Approval Production Target Commit Validation'),
        'Must include Pre-Approval Production Target Commit Validation step'
      );
      assert.ok(
        deployProdSection.includes('CURRENT_HEAD=$(git rev-parse HEAD)'),
        'Must verify checkout HEAD against EXPECTED_SHA'
      );
      assert.ok(
        deployProdSection.includes('Release candidate SHA ${{ github.sha }} validated') ||
          deployProdSection.includes('Release candidate SHA ${EXPECTED_SHA} validated'),
        'Must validate candidate SHA prior to building and deploying'
      );
    });
  });

  describe('Documentation & Runbook Specifications', () => {
    it('should verify docs/runbooks/PRODUCTION_PROMOTION.md documents SHA verification and Pattern B immutable promotion', () => {
      assert.ok(fs.existsSync(promotionRunbookPath), 'docs/runbooks/PRODUCTION_PROMOTION.md must exist');
      const content = fs.readFileSync(promotionRunbookPath, 'utf-8');

      assert.ok(content.includes('Promotion Integrity & Commit Hash Verification Protocol'), 'Must document Section 3');
      assert.ok(content.includes('Pattern A: Runtime Commit Hash Verification'), 'Must document Pattern A');
      assert.ok(content.includes('Pre-Test Assertion'), 'Must document Pre-Test Assertion');
      assert.ok(content.includes('Post-Test Mutation Check'), 'Must document Post-Test Mutation Check');
      assert.ok(content.includes('Pre-Approval Target Validation'), 'Must document Pre-Approval Target Validation');
      assert.ok(content.includes('Pattern B: Cloudflare Workers Immutable Version Promotion'), 'Must document Pattern B');
      assert.ok(content.includes('wrangler versions promote'), 'Must document wrangler versions promote');
    });

    it('should verify .agents/skills/devops/SKILL.md documents hash verification checkpoints and Pattern B', () => {
      assert.ok(fs.existsSync(devopsSkillPath), '.agents/skills/devops/SKILL.md must exist');
      const content = fs.readFileSync(devopsSkillPath, 'utf-8');

      assert.ok(content.includes('Commit Hash Verification (Story 4.23)'), 'Must include Story 4.23 security guarantee');
      assert.ok(content.includes('--verify-sha'), 'Must document --verify-sha CLI flag');
      assert.ok(content.includes('--wait-for-staging'), 'Must document --wait-for-staging CLI flag');
      assert.ok(content.includes('Promotion Integrity & Immutable Version Promotion Protocol'), 'Must document Section 4');
      assert.ok(content.includes('wrangler versions promote'), 'Must document wrangler versions promote');
    });
  });
});
