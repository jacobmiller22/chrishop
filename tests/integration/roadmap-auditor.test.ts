import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { auditDeliverables } from '../../scripts/audit-roadmap';

describe('Roadmap & Deliverables Auditor Integration', () => {
  const repoRoot = path.resolve(__dirname, '../..');

  it('should execute audit-roadmap CLI in skip-disk-check mode without errors', () => {
    const output = execSync('tsx scripts/audit-roadmap.ts --skip-disk-check', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    assert.ok(output.includes('ChrisShop Adversarial Roadmap & Backlog Auditor'));
    assert.ok(output.includes('Delivery Phase & Milestone Health'));
    assert.ok(output.includes('Milestone Architecture Cleanliness'));
  });

  it('should accurately categorize active, PR, historical, and superseded deliverables without false positives', () => {
    const mockIssues: any[] = [
      {
        number: 9991,
        title: 'Story 99.1: Active deliverable test',
        state: 'CLOSED',
        milestone: { number: 1, title: 'Phase 1' },
        labels: [{ name: 'priority:high' }],
        body: 'Implemented `docs/HIGH_LEVEL_DESIGN.md` and `scripts/audit-roadmap.ts` for auditor testing.',
      },
      {
        number: 9992,
        title: 'Story 99.2: Historical migration test',
        state: 'CLOSED',
        milestone: { number: 1, title: 'Phase 1' },
        labels: [{ name: 'priority:high' }],
        body: 'Archived legacy `docs/deps/DEP_STRIPE.md` during Cloudflare migration.',
      },
      {
        number: 9993,
        title: 'Story 99.3: Superseded architecture test',
        state: 'CLOSED',
        milestone: { number: 1, title: 'Phase 1' },
        labels: [{ name: 'priority:high' }],
        body: 'Superseded by Story 0.2 — eliminated `apps/web/src/app/api/checkout/route.ts` in favor of Shopify.',
      },
    ];

    const mockPrs: any[] = [
      {
        number: 213,
        state: 'OPEN',
        mergedAt: null,
        title: 'feat(design): Story 1.17 Senior Design Direction (#207)',
        headRefName: 'feature/story-1-17-design-direction',
      },
    ];

    const summary = auditDeliverables(mockIssues, mockPrs, repoRoot);

    assert.ok(summary.verifiedActive >= 2, 'Should verify active files (package.json, audit-roadmap.ts)');
    assert.ok(summary.verifiedHistorical >= 1, 'Should verify historically committed files');
    assert.ok(summary.verifiedSuperseded >= 1, 'Should verify superseded/eliminated routes');
    assert.equal(summary.missing.length, 0, 'Mock issues should have zero unresolved missing deliverables');
  });
});
