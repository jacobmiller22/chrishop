#!/usr/bin/env tsx
/**
 * ChrisShop Rolling Release Notes & Manifest Composer
 *
 * Analyzes the delta between production and staging (or arbitrary base/head refs),
 * extracting merged PRs, commit titles, resolved issue references, affected monorepo
 * areas, and pending D1 migrations. Outputs a release checklist and markdown manifest
 * for the automated staging-to-production release PR.
 *
 * Usage:
 *   pnpm run release:notes
 *   pnpm run release:notes --base origin/production --head origin/staging --output release.md
 *   pnpm run release:notes --json
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface CommitEntry {
  hash: string;
  shortHash: string;
  author: string;
  subject: string;
  body: string;
  prNumber?: number;
  issueNumbers: number[];
  storyReference?: string;
}

export interface ImpactedAreaSummary {
  area: string;
  fileCount: number;
  description: string;
}

export interface ReleaseDelta {
  baseRef: string;
  baseHash: string;
  headRef: string;
  headHash: string;
  commitCount: number;
  commits: CommitEntry[];
  changedFiles: string[];
  impactedAreas: ImpactedAreaSummary[];
  migrations: string[];
  resolvedIssues: number[];
  mergedPrs: number[];
  compareUrl?: string;
}

export interface ComposeOptions {
  base?: string;
  head?: string;
  repo?: string;
  output?: string;
  json?: boolean;
  cwd?: string;
}

const MONOREPO_AREAS: { prefix: string; area: string; description: string }[] = [
  { prefix: 'apps/web', area: 'apps/web', description: 'Storefront application & Payload CMS v3' },
  { prefix: 'apps/cms', area: 'apps/cms', description: 'Standalone CMS package / admin layer' },
  { prefix: 'packages/config', area: 'packages/config', description: 'Shared configs, TypeScript & environment schemas' },
  { prefix: 'packages/ui', area: 'packages/ui', description: 'Shared UI design system & components' },
  { prefix: 'packages/notifications', area: 'packages/notifications', description: 'Resend email & Discord notification engines' },
  { prefix: 'packages/types', area: 'packages/types', description: 'Monorepo domain contracts & TypeScript types' },
  { prefix: 'infra', area: 'infra', description: 'Wrangler config, R2 policies, launchd daemons & infra scripts' },
  { prefix: '.github', area: '.github', description: 'GitHub Actions workflows, CI/CD automation & governance' },
  { prefix: 'migrations', area: 'migrations', description: 'Cloudflare D1 SQLite database migrations' },
  { prefix: 'docs', area: 'docs', description: 'Architecture specifications, ADRs, runbooks & documentation' },
  { prefix: 'scripts', area: 'scripts', description: 'Build scripts, local verification pipeline & dev tooling' },
  { prefix: 'tests', area: 'tests', description: 'Integration tests, spike benchmarks & ephemeral probes' },
  { prefix: '.agents', area: '.agents', description: 'Autonomous agent skills, prompts & workflows' },
];

/**
 * Execute a git command and return stripped stdout
 */
export function runGit(cmd: string, cwd: string = process.cwd()): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    throw new Error(`Git command failed: "git ${cmd}"\n${stderr || err.message}`);
  }
}

/**
 * Detect GitHub repository slug (e.g. "jacobmiller22/chrishop")
 */
export function detectRepoSlug(cwd: string = process.cwd()): string {
  try {
    const remoteUrl = runGit('remote get-url origin', cwd);
    // Handles git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // fallback
  }
  return 'jacobmiller22/chrishop';
}

/**
 * Resolve an appropriate git reference or commit hash
 */
export function resolveRef(candidateRef: string, fallbackRefs: string[], cwd: string = process.cwd()): { ref: string; hash: string } {
  const candidates = [candidateRef, ...fallbackRefs].filter(Boolean);
  for (const ref of candidates) {
    try {
      const hash = runGit(`rev-parse --verify ${ref}`, cwd);
      return { ref, hash };
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Could not resolve any git ref from candidates: ${candidates.join(', ')}`);
}

/**
 * Parse commit log stream into structured CommitEntry objects
 */
export function parseCommitLog(logOutput: string): CommitEntry[] {
  if (!logOutput.trim()) {
    return [];
  }

  // Format used: %H%x1f%an%x1f%s%x1f%b%x1e
  const records = logOutput.split('\x1e').map((r) => r.trim()).filter(Boolean);
  const commits: CommitEntry[] = [];

  for (const record of records) {
    const parts = record.split('\x1f');
    if (parts.length < 3) continue;

    const hash = parts[0].trim();
    const author = parts[1].trim();
    const subject = parts[2].trim();
    const body = parts[3] ? parts[3].trim() : '';

    const combinedText = `${subject}\n${body}`;

    // 1. Extract PR number if present (GitHub usually places (#123) at the end of commit subject)
    let prNumber: number | undefined;
    const prMatch = subject.match(/\(#(\d+)\)\s*$/);
    if (prMatch) {
      prNumber = parseInt(prMatch[1], 10);
    }

    // 2. Extract issue references: Fixes #X, Closes #X, Resolves #X
    const issueNumbersSet = new Set<number>();
    const issueRegex = /(?:fixes|closes|resolves|fixed|closed|resolved|ref)[:\s]+#(\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = issueRegex.exec(combinedText)) !== null) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        issueNumbersSet.add(num);
      }
    }

    // 3. Extract parenthesized issue references (#160) before the PR (#174) in titles
    const allParensMatches = [...subject.matchAll(/\(#(\d+)\)/g)];
    if (allParensMatches.length > 1) {
      // The preceding ones are likely story/issue numbers
      for (let i = 0; i < allParensMatches.length - 1; i++) {
        const num = parseInt(allParensMatches[i][1], 10);
        if (!isNaN(num)) {
          issueNumbersSet.add(num);
        }
      }
    }

    // 4. Extract Story reference (e.g. "Story 2.37")
    let storyReference: string | undefined;
    const storyMatch = subject.match(/Story\s+(\d+\.\d+[a-z]?)/i);
    if (storyMatch) {
      storyReference = `Story ${storyMatch[1]}`;
    }

    commits.push({
      hash,
      shortHash: hash.substring(0, 7),
      author,
      subject,
      body,
      prNumber,
      issueNumbers: Array.from(issueNumbersSet).sort((a, b) => a - b),
      storyReference,
    });
  }

  return commits;
}

/**
 * Detect impacted monorepo areas from a list of changed filepaths
 */
export function detectImpactedAreas(changedFiles: string[]): ImpactedAreaSummary[] {
  const counts = new Map<string, number>();

  for (const file of changedFiles) {
    let matched = false;
    for (const area of MONOREPO_AREAS) {
      if (file.startsWith(area.prefix + '/') || file === area.prefix) {
        counts.set(area.area, (counts.get(area.area) || 0) + 1);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Root or miscellaneous
      counts.set('root', (counts.get('root') || 0) + 1);
    }
  }

  const summaries: ImpactedAreaSummary[] = [];
  for (const area of MONOREPO_AREAS) {
    const fileCount = counts.get(area.area);
    if (fileCount && fileCount > 0) {
      summaries.push({
        area: area.area,
        fileCount,
        description: area.description,
      });
    }
  }

  const rootCount = counts.get('root');
  if (rootCount && rootCount > 0) {
    summaries.push({
      area: 'root',
      fileCount: rootCount,
      description: 'Root configuration files & workspace manifests',
    });
  }

  return summaries;
}

/**
 * Detect D1 migration SQL scripts from changed files
 */
export function detectMigrations(changedFiles: string[]): string[] {
  return changedFiles
    .filter((file) => /^migrations\/.*\.sql$/i.test(file) || /\/migrations\/.*\.sql$/i.test(file))
    .sort();
}

/**
 * Compute the full release delta between base and head
 */
export function computeReleaseDelta(options: ComposeOptions = {}): ReleaseDelta {
  const cwd = options.cwd || process.cwd();
  const repoSlug = options.repo || detectRepoSlug(cwd);

  // 1. Resolve Base Ref
  const explicitBase = options.base;
  const baseResolution = resolveRef(explicitBase || 'origin/production', ['production', 'main'], cwd);

  // 2. Resolve Head Ref
  const explicitHead = options.head;
  const headResolution = resolveRef(explicitHead || 'origin/staging', ['staging', 'HEAD'], cwd);

  // 3. Git log delta
  const logRaw = runGit(`log --format="%H%x1f%an%x1f%s%x1f%b%x1e" ${baseResolution.hash}..${headResolution.hash}`, cwd);
  const commits = parseCommitLog(logRaw);

  // 4. Changed files delta
  const diffRaw = runGit(`diff --name-only ${baseResolution.hash}..${headResolution.hash}`, cwd);
  const changedFiles = diffRaw.split('\n').map((f) => f.trim()).filter(Boolean);

  // 5. Impacted areas & migrations
  const impactedAreas = detectImpactedAreas(changedFiles);
  const migrations = detectMigrations(changedFiles);

  // 6. Aggregated issues & PRs
  const issueSet = new Set<number>();
  const prSet = new Set<number>();

  for (const commit of commits) {
    if (commit.prNumber) {
      prSet.add(commit.prNumber);
    }
    for (const issue of commit.issueNumbers) {
      issueSet.add(issue);
    }
  }

  const resolvedIssues = Array.from(issueSet).sort((a, b) => a - b);
  const mergedPrs = Array.from(prSet).sort((a, b) => a - b);

  const compareUrl = repoSlug
    ? `https://github.com/${repoSlug}/compare/${baseResolution.ref}...${headResolution.ref}`
    : undefined;

  return {
    baseRef: baseResolution.ref,
    baseHash: baseResolution.hash,
    headRef: headResolution.ref,
    headHash: headResolution.hash,
    commitCount: commits.length,
    commits,
    changedFiles,
    impactedAreas,
    migrations,
    resolvedIssues,
    mergedPrs,
    compareUrl,
  };
}

/**
 * Generate formatted Markdown manifest for Release Pull Request
 */
export function generateReleaseMarkdown(delta: ReleaseDelta, options: ComposeOptions = {}): string {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const repoSlug = options.repo || 'jacobmiller22/chrishop';

  const lines: string[] = [];

  lines.push('## 🚀 Production Release Candidate Manifest');
  lines.push('');
  lines.push('> [!NOTE]');
  lines.push('> This automated Release PR is continuously managed by `.github/workflows/staging-release-pr.yml`.');
  lines.push('> It tracks the rolling delta between `staging` and `production`, compiling merged PRs, resolved issues,');
  lines.push('> affected monorepo components, and pending database migrations.');
  lines.push('');
  lines.push('### 📊 Release Overview');
  lines.push(`- **Target Environment**: Production Edge (\`https://chrishop.jacobmiller22.com\`)`);
  lines.push(`- **Promotion Route**: \`${delta.headRef}\` ➔ \`${delta.baseRef}\``);
  lines.push(`- **Base Commit**: \`${delta.baseHash.substring(0, 7)}\` (\`${delta.baseRef}\`)`);
  lines.push(`- **Head Commit**: \`${delta.headHash.substring(0, 7)}\` (\`${delta.headRef}\`)`);
  lines.push(`- **Total Commits**: \`${delta.commitCount}\` commits`);
  lines.push(`- **Merged PRs**: \`${delta.mergedPrs.length}\` pull requests`);
  lines.push(`- **Resolved Issues**: \`${delta.resolvedIssues.length}\` tracked issues`);
  lines.push(`- **Generated At**: \`${timestamp}\``);
  if (delta.compareUrl) {
    lines.push(`- **Git Diff**: [View Full Comparison](${delta.compareUrl})`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Preflight checklist
  lines.push('### 📋 Preflight Promotion Checklist');
  lines.push('- [ ] Staging edge health verified at `https://staging-chrishop.jacobmiller22.com/api/health`.');
  lines.push('- [ ] Staging integration test suite passed (`pnpm run test:all` & `pnpm run check`).');
  lines.push('- [ ] Ephemeral preview workers verified for merged feature PRs.');
  if (delta.migrations.length > 0) {
    lines.push('- [ ] **D1 Database Migrations** reviewed and dry-run verified for production.');
  } else {
    lines.push('- [ ] D1 database schema parity confirmed (no pending migrations).');
  }
  lines.push('- [ ] Cloudflare Workers secrets and environment variables validated.');
  lines.push('- [ ] **Mandatory Human Review Gate**: Approved by designated maintainer (`jacobmiller22`).');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Migrations Alert
  lines.push('### 🗄️ Database Migrations');
  if (delta.migrations.length > 0) {
    lines.push('> [!WARNING]');
    lines.push('> **Pending D1 SQLite Migrations Detected in this Release!**');
    lines.push('> Ensure migrations are applied to production D1 database (`chrishop-prod-db`) upon promotion:');
    lines.push('> ```bash');
    lines.push('> pnpm exec wrangler d1 migrations apply chrishop-prod-db --remote');
    lines.push('> ```');
    lines.push('');
    lines.push('**Migration Files:**');
    for (const m of delta.migrations) {
      lines.push(`- \`${m}\``);
    }
  } else {
    lines.push('✅ **No D1 Database Migrations**: No schema modification scripts detected in this delta.');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Impacted Monorepo Areas
  lines.push('### 📦 Impacted Monorepo Areas');
  if (delta.impactedAreas.length === 0) {
    lines.push('No workspace file changes detected.');
  } else {
    lines.push('| Area / Package | Changed Files | Description |');
    lines.push('| :--- | :---: | :--- |');
    for (const area of delta.impactedAreas) {
      lines.push(`| \`${area.area}\` | \`${area.fileCount}\` | ${area.description} |`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Resolved Issues & Stories
  lines.push('### 🎯 Resolved Issues & Stories');
  if (delta.resolvedIssues.length === 0) {
    lines.push('No explicit issue closing references detected in commit messages.');
  } else {
    lines.push('Merging this Release PR will formally document the live production delivery of:');
    for (const issueNum of delta.resolvedIssues) {
      // Find associated story reference if any
      const matchingCommit = delta.commits.find((c) => c.issueNumbers.includes(issueNum) && c.storyReference);
      const storyLabel = matchingCommit?.storyReference ? ` (${matchingCommit.storyReference})` : '';
      lines.push(`- Resolves https://github.com/${repoSlug}/issues/${issueNum}${storyLabel}`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Merged Pull Requests & Commits
  lines.push('### 📝 Included Pull Requests & Commits');
  if (delta.commits.length === 0) {
    lines.push('Branch is currently synchronized with base. No pending commits.');
  } else {
    for (const commit of delta.commits) {
      const prLink = commit.prNumber
        ? ` ([#${commit.prNumber}](https://github.com/${repoSlug}/pull/${commit.prNumber}))`
        : '';
      const commitLink = `[\`${commit.shortHash}\`](https://github.com/${repoSlug}/commit/${commit.hash})`;
      lines.push(`- ${commitLink} ${commit.subject}${prLink} — _@${commit.author}_`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### 🔒 Deployment Gate Notice');
  lines.push('Upon merging into `production`, the multi-stage deployment pipeline in `.github/workflows/deploy.yml` will:');
  lines.push('1. Run full typechecks, lints, security audits, and production builds.');
  lines.push('2. Deploy to staging edge (`staging-chrishop.jacobmiller22.com`) and execute live health probes.');
  lines.push('3. Pause at the **`production` GitHub Actions Environment Gate** requiring explicit approval from `jacobmiller22`.');
  lines.push('4. Deploy to live Cloudflare Workers production edge (`chrishop.jacobmiller22.com`).');

  return lines.join('\n');
}

/**
 * Main execution function
 */
export async function composeReleaseNotes(options: ComposeOptions = {}): Promise<string> {
  const delta = computeReleaseDelta(options);

  const writeOutput = (content: string) => {
    if (options.output) {
      const outputDir = path.dirname(path.resolve(options.output));
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(options.output, content, 'utf-8');
    }
  };

  if (options.json) {
    const jsonStr = JSON.stringify(delta, null, 2);
    writeOutput(jsonStr);
    return jsonStr;
  }

  const markdown = generateReleaseMarkdown(delta, options);
  writeOutput(markdown);

  return markdown;
}

// CLI entrypoint if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options: ComposeOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') continue;
    if (arg === '--base' && args[i + 1]) {
      options.base = args[++i];
    } else if (arg === '--head' && args[i + 1]) {
      options.head = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--repo' && args[i + 1]) {
      options.repo = args[++i];
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
ChrisShop Release Notes Composer

Usage:
  tsx scripts/compose-release-notes.ts [options]

Options:
  --base <ref>     Base git reference (default: origin/production or production)
  --head <ref>     Head git reference (default: origin/staging or staging or HEAD)
  --output <file>  Write output to file path
  --repo <slug>    GitHub repository slug (default: auto-detected or jacobmiller22/chrishop)
  --json           Output raw JSON manifest instead of Markdown
  -h, --help       Show this help message
`);
      process.exit(0);
    }
  }

  composeReleaseNotes(options)
    .then((result) => {
      if (!options.output) {
        console.log(result);
      } else {
        console.log(`✔ Release notes successfully written to ${options.output}`);
      }
    })
    .catch((err) => {
      console.error('✖ Error composing release notes:', err.message);
      process.exit(1);
    });
}
