import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  parseCommitLog,
  detectImpactedAreas,
  detectMigrations,
  generateReleaseMarkdown,
  computeReleaseDelta,
  composeReleaseNotes,
  type ReleaseDelta,
} from '../../scripts/compose-release-notes.ts';

describe('Story 2.40: Release Notes Composer & Manifest Generator', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const workflowPath = path.join(rootDir, '.github/workflows/staging-release-pr.yml');

  describe('1. Commit Log Parsing (parseCommitLog)', () => {
    it('should parse single commit with PR and story issue numbers', () => {
      const sample = [
        '225d080c199b91fb3478d6e420797e145e8ff37f',
        'Jacob Miller',
        'feat(infra): Story 2.37 Staged Git Promotion Pipeline (staging ➔ production) (#160) (#174)',
        'Fixes #160\n- Added git promotion rules',
      ].join('\x1f') + '\x1e';

      const commits = parseCommitLog(sample);
      assert.equal(commits.length, 1);
      assert.equal(commits[0].hash, '225d080c199b91fb3478d6e420797e145e8ff37f');
      assert.equal(commits[0].shortHash, '225d080');
      assert.equal(commits[0].author, 'Jacob Miller');
      assert.equal(commits[0].prNumber, 174, 'Should detect PR #174 at end of subject');
      assert.deepEqual(commits[0].issueNumbers, [160], 'Should extract issue #160 from title and body');
      assert.equal(commits[0].storyReference, 'Story 2.37');
    });

    it('should extract multiple issues closed via keywords (Fixes, Closes, Resolves)', () => {
      const sample = [
        'abc1234567890abcdef1234567890abcdef12345',
        'Alice Engineer',
        'feat(storefront): Multi-filter support (#42)',
        'Resolves #101\nCloses #202\nfixes #303',
      ].join('\x1f') + '\x1e';

      const commits = parseCommitLog(sample);
      assert.equal(commits.length, 1);
      assert.equal(commits[0].prNumber, 42);
      assert.deepEqual(commits[0].issueNumbers, [101, 202, 303]);
    });

    it('should handle empty or whitespace-only log output gracefully', () => {
      assert.deepEqual(parseCommitLog(''), []);
      assert.deepEqual(parseCommitLog('   \n\t  '), []);
    });
  });

  describe('2. Impacted Area Detection (detectImpactedAreas)', () => {
    it('should categorize monorepo workspaces and paths accurately', () => {
      const files = [
        'apps/web/src/app/page.tsx',
        'apps/web/package.json',
        'packages/config/src/index.ts',
        'infra/r2/cors-media.json',
        'infra/scripts/setup-branch-protection.sh',
        '.github/workflows/deploy.yml',
        'migrations/0001_initial.sql',
        'docs/HIGH_LEVEL_DESIGN.md',
        'package.json',
      ];

      const areas = detectImpactedAreas(files);
      const areaMap = new Map(areas.map((a) => [a.area, a.fileCount]));

      assert.equal(areaMap.get('apps/web'), 2);
      assert.equal(areaMap.get('packages/config'), 1);
      assert.equal(areaMap.get('infra'), 2);
      assert.equal(areaMap.get('.github'), 1);
      assert.equal(areaMap.get('migrations'), 1);
      assert.equal(areaMap.get('docs'), 1);
      assert.equal(areaMap.get('root'), 1);
    });
  });

  describe('3. Database Migrations Detection (detectMigrations)', () => {
    it('should filter only D1 SQL migration scripts', () => {
      const files = [
        'migrations/0001_initial.sql',
        'migrations/0002_add_orders.sql',
        'scripts/seed-db.ts',
        'docs/migrations.md',
        'apps/web/src/migrations/readme.txt',
      ];

      const migrations = detectMigrations(files);
      assert.deepEqual(migrations, [
        'migrations/0001_initial.sql',
        'migrations/0002_add_orders.sql',
      ]);
    });

    it('should return empty list when no migrations are present', () => {
      assert.deepEqual(detectMigrations(['apps/web/src/app/page.tsx', 'package.json']), []);
    });
  });

  describe('4. Release Markdown Manifest Generation (generateReleaseMarkdown)', () => {
    it('should format full markdown manifest with preflight checklist and migration warning', () => {
      const mockDelta: ReleaseDelta = {
        baseRef: 'production',
        baseHash: '1111111222222233333334444444555555566666',
        headRef: 'staging',
        headHash: 'aaaaaaabbbbbbbccccccdddddddeeeeeeeffffff',
        commitCount: 2,
        commits: [
          {
            hash: 'aaaaaaabbbbbbbccccccdddddddeeeeeeeffffff',
            shortHash: 'aaaaaaa',
            author: 'Jacob Miller',
            subject: 'feat(infra): Story 2.40 Release PR Automation (#172) (#185)',
            body: 'Fixes #172',
            prNumber: 185,
            issueNumbers: [172],
            storyReference: 'Story 2.40',
          },
        ],
        changedFiles: ['migrations/0002_new_table.sql', 'apps/web/src/page.tsx'],
        impactedAreas: [
          { area: 'apps/web', fileCount: 1, description: 'Storefront & Payload CMS' },
          { area: 'migrations', fileCount: 1, description: 'D1 migrations' },
        ],
        migrations: ['migrations/0002_new_table.sql'],
        resolvedIssues: [172],
        mergedPrs: [185],
        compareUrl: 'https://github.com/jacobmiller22/chrishop/compare/production...staging',
      };

      const markdown = generateReleaseMarkdown(mockDelta, { repo: 'jacobmiller22/chrishop' });

      // Check header and overview
      assert.ok(markdown.includes('## 🚀 Production Release Candidate Manifest'));
      assert.ok(markdown.includes('`staging` ➔ `production`'));
      assert.ok(markdown.includes('`aaaaaaa`'));
      assert.ok(markdown.includes('`1111111`'));

      // Check checklist
      assert.ok(markdown.includes('### 📋 Preflight Promotion Checklist'));
      assert.ok(markdown.includes('Mandatory Human Review Gate'));
      assert.ok(markdown.includes('jacobmiller22'));

      // Check migration warning
      assert.ok(markdown.includes('Pending D1 SQLite Migrations Detected in this Release!'));
      assert.ok(markdown.includes('migrations/0002_new_table.sql'));
      assert.ok(markdown.includes('wrangler d1 migrations apply chrishop-prod-db --remote'));

      // Check resolved issues
      assert.ok(markdown.includes('https://github.com/jacobmiller22/chrishop/issues/172 (Story 2.40)'));

      // Check merged PR & commit
      assert.ok(markdown.includes('[#185](https://github.com/jacobmiller22/chrishop/pull/185)'));
      assert.ok(markdown.includes('Story 2.40 Release PR Automation'));

      // Check deployment gate notice
      assert.ok(markdown.includes('### 🔒 Deployment Gate Notice'));
      assert.ok(markdown.includes('.github/workflows/deploy.yml'));
    });

    it('should format clean no-migration notice when migrations list is empty', () => {
      const mockDelta: ReleaseDelta = {
        baseRef: 'production',
        baseHash: '1111111222222233333334444444555555566666',
        headRef: 'staging',
        headHash: 'aaaaaaabbbbbbbccccccdddddddeeeeeeeffffff',
        commitCount: 1,
        commits: [],
        changedFiles: ['apps/web/src/page.tsx'],
        impactedAreas: [{ area: 'apps/web', fileCount: 1, description: 'Storefront' }],
        migrations: [],
        resolvedIssues: [],
        mergedPrs: [],
      };

      const markdown = generateReleaseMarkdown(mockDelta);
      assert.ok(markdown.includes('No D1 Database Migrations'));
      assert.ok(!markdown.includes('Pending D1 SQLite Migrations Detected'));
    });
  });

  describe('5. Real Git Delta Computation (composeReleaseNotes)', () => {
    it('should successfully compute delta between origin/production and origin/staging', async () => {
      const delta = computeReleaseDelta({
        base: 'origin/production',
        head: 'origin/staging',
        cwd: rootDir,
      });

      assert.ok(delta.commitCount >= 10, 'Expected at least 10 commits between origin/production and origin/staging');
      assert.ok(delta.resolvedIssues.length > 0, 'Expected resolved issue references');
      assert.ok(delta.mergedPrs.length > 0, 'Expected merged PR references');
      assert.ok(delta.impactedAreas.some((a) => a.area === 'apps/web'), 'Should detect apps/web impact');
      assert.ok(delta.impactedAreas.some((a) => a.area === 'infra'), 'Should detect infra impact');
      assert.ok(delta.impactedAreas.some((a) => a.area === '.github'), 'Should detect .github impact');
    });

    it('should generate valid JSON delta and write to file with --json and --output', async () => {
      const tempJsonPath = path.join(rootDir, 'node_modules/.cache/test-release-delta.json');
      await composeReleaseNotes({
        base: 'origin/production',
        head: 'origin/staging',
        json: true,
        output: tempJsonPath,
        cwd: rootDir,
      });

      assert.ok(fs.existsSync(tempJsonPath), 'Temporary JSON output file must exist');
      const content = JSON.parse(fs.readFileSync(tempJsonPath, 'utf-8'));
      assert.equal(typeof content.commitCount, 'number');
      assert.ok(Array.isArray(content.commits));
      assert.ok(Array.isArray(content.impactedAreas));
    });
  });

  describe('6. Automated Release PR Workflow Definition (.github/workflows/staging-release-pr.yml)', () => {
    it('should verify workflow file existence and permissions', () => {
      assert.ok(fs.existsSync(workflowPath), 'staging-release-pr.yml must exist');
      const content = fs.readFileSync(workflowPath, 'utf-8');

      assert.match(content, /name:\s*Automated Staging Release PR & Changelog/);
      assert.match(content, /branches:\s*\n\s*-\s*staging/, 'Must trigger on push to staging branch');
      assert.match(content, /workflow_dispatch:/, 'Must support workflow_dispatch trigger');
      assert.match(content, /pull-requests:\s*write/, 'Must grant pull-requests: write permission');
      assert.match(content, /issues:\s*write/, 'Must grant issues: write permission');
      assert.match(content, /fetch-depth:\s*0/, 'Must fetch full git history (fetch-depth: 0)');
      assert.match(content, /pnpm run release:notes/, 'Must run release:notes composer');
      assert.match(content, /gh pr list/, 'Must query GitHub API for open release PR');
      assert.match(content, /gh pr edit/, 'Must update existing release PR');
      assert.match(content, /gh pr create/, 'Must create new release PR if none exists');
      assert.match(content, /chore\(release\):\s*Promote staging to production \[Pending Review\]/, 'Title must match convention');
      assert.match(content, /type:release/, 'Must attach type:release label');
      assert.match(content, /status:needs-review/, 'Must attach status:needs-review label');
      assert.match(content, /jacobmiller22/, 'Must assign reviewer jacobmiller22');
    });
  });
});
