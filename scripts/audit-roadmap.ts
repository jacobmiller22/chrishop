#!/usr/bin/env tsx
/**
 * ChrisShop Adversarial Roadmap & Backlog Auditor CLI (On-Demand)
 *
 * Inspects GitHub Milestones, Backlog Issues, and Local Architecture
 * to detect drift, orphaned stories, priority hygiene, missing deliverables
 * on disk, dependency blockers, and shovel-readiness.
 *
 * Usage:
 *   pnpm run audit:roadmap
 *   pnpm run audit:backlog
 *   tsx scripts/audit-roadmap.ts
 *   tsx scripts/audit-roadmap.ts --markdown docs/ROADMAP_AUDIT_LATEST.md
 *   tsx scripts/audit-roadmap.ts --strict
 *   tsx scripts/audit-roadmap.ts --skip-disk-check
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ANSI styling
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

interface Milestone {
  number: number;
  title: string;
  description: string;
  open_issues: number;
  closed_issues: number;
  state: string;
  due_on: string | null;
}

interface IssueLabel {
  name: string;
  color?: string;
}

interface Issue {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  milestone: { number: number; title: string } | null;
  labels: IssueLabel[];
  body: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

const LEGACY_KEYWORDS = [
  'docker',
  'postgres',
  'postgresql',
  'redis',
  'stripe',
  'hetzner',
  'directus',
  'caddy',
  'ansible',
  'minio',
];

const VALID_PRIORITIES = ['priority:critical', 'priority:high', 'priority:medium', 'priority:low'];

function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

function runGh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err: any) {
    const msg = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`GitHub CLI command failed: ${cmd}\n${msg}`);
  }
}

function fetchMilestones(): Milestone[] {
  const raw = runGh('gh api repos/:owner/:repo/milestones --paginate');
  return JSON.parse(raw);
}

function fetchIssues(): Issue[] {
  const raw = runGh(
    'gh issue list --state all --limit 200 --json number,title,milestone,state,labels,body,createdAt,updatedAt,closedAt'
  );
  return JSON.parse(raw);
}

interface PullRequest {
  number: number;
  state: string;
  mergedAt: string | null;
  title: string;
}

function fetchPullRequests(): PullRequest[] {
  try {
    const raw = runGh(
      'gh pr list --state all --limit 200 --json number,state,mergedAt,title'
    );
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function findAssociatedPr(issue: Issue, prs: PullRequest[]): PullRequest | undefined {
  const exactIssueMatch = prs.find(
    (pr) => pr.title.includes(`(#${issue.number})`) || pr.title.includes(`#${issue.number}`)
  );
  if (exactIssueMatch) return exactIssueMatch;

  const storyMatch = issue.title.match(/Story\s+([\d.]+)/i);
  if (storyMatch) {
    const storyId = storyMatch[1];
    const prWithStory = prs.find((pr) =>
      new RegExp(`Story\\s+${storyId}\\b`, 'i').test(pr.title)
    );
    if (prWithStory) return prWithStory;
  }
  return undefined;
}

interface MissingDeliverableItem {
  issueNumber: number;
  title: string;
  missingFiles: string[];
}

function auditDeliverablesOnDisk(issues: Issue[], repoRoot: string): MissingDeliverableItem[] {
  const findings: MissingDeliverableItem[] = [];
  const closedIssues = issues.filter((i) => i.state === 'CLOSED');
  const pathPattern = /[`'"]([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)[`'"]/g;

  for (const issue of closedIssues) {
    const body = issue.body || '';
    const matches = Array.from(body.matchAll(pathPattern), (m) => m[1]);
    const candidatePaths = new Set(
      matches.filter(
        (f) =>
          (f.startsWith('apps/') ||
            f.startsWith('packages/') ||
            f.startsWith('infra/') ||
            f.startsWith('docs/') ||
            f.startsWith('.github/') ||
            f.startsWith('.agents/')) &&
          !f.endsWith('.png') &&
          !f.endsWith('.jpg') &&
          !f.endsWith('.svg') &&
          !f.endsWith('.ico')
      )
    );

    const missingFiles: string[] = [];
    for (const relPath of candidatePaths) {
      const fullPath = path.join(repoRoot, relPath);
      if (!fs.existsSync(fullPath)) {
        missingFiles.push(relPath);
      }
    }

    if (missingFiles.length > 0) {
      findings.push({
        issueNumber: issue.number,
        title: issue.title,
        missingFiles,
      });
    }
  }

  return findings;
}

interface DependencyAnalysis {
  shovelReady: Array<{ number: number; title: string; labels: string[]; priority: string; phase: string }>;
  blocked: Array<{ number: number; title: string; reason: string }>;
  needsRefinement: Array<{ number: number; title: string; reason: string }>;
}

function analyzeDependenciesAndReadiness(issues: Issue[]): DependencyAnalysis {
  const closedNumbers = new Set(issues.filter((i) => i.state === 'CLOSED').map((i) => i.number));
  const openIssues = issues.filter((i) => i.state === 'OPEN');

  const shovelReady: DependencyAnalysis['shovelReady'] = [];
  const blocked: DependencyAnalysis['blocked'] = [];
  const needsRefinement: DependencyAnalysis['needsRefinement'] = [];

  const depPattern = /(?:Prerequisites|Depends on|prerequisite):\s*([#\d\s,]+)/i;

  for (const issue of openIssues) {
    const num = issue.number;
    const title = issue.title;
    const body = issue.body || '';
    const labelNames = issue.labels.map((l) => l.name);
    if (labelNames.includes('status:completed') || labelNames.includes('status:in-progress')) {
      // Story is actively in progress or completed and awaiting PR merge
      continue;
    }

    if (labelNames.includes('needs-refinement') || body.trim().length < 80) {
      needsRefinement.push({
        number: num,
        title,
        reason: 'Explicit needs-refinement label or incomplete description (<80 chars)',
      });
      continue;
    }

    if (labelNames.includes('creator-review')) {
      blocked.push({
        number: num,
        title,
        reason: 'Requires Creator (Chris) vision sign-off touchpoint',
      });
      continue;
    }

    const depMatch = depPattern.exec(body);
    const unmetDeps: number[] = [];
    if (depMatch) {
      const numMatches = depMatch[1].match(/\d+/g) || [];
      for (const d of numMatches.map(Number)) {
        if (!closedNumbers.has(d)) {
          unmetDeps.push(d);
        }
      }
    }

    if (unmetDeps.length > 0) {
      blocked.push({
        number: num,
        title,
        reason: `Prerequisites open: ${unmetDeps.map((d) => `#${d}`).join(', ')}`,
      });
    } else {
      const priorityLabel = labelNames.find((l) => l.startsWith('priority:')) || 'priority:none';
      const phaseLabel = issue.milestone?.title.split(':')[0] || 'Unassigned';
      shovelReady.push({
        number: num,
        title,
        labels: labelNames,
        priority: priorityLabel,
        phase: phaseLabel,
      });
    }
  }

  // Sort shovel ready by priority tier
  const priorityWeight: Record<string, number> = {
    'priority:critical': 4,
    'priority:high': 3,
    'priority:medium': 2,
    'priority:low': 1,
    'priority:none': 0,
  };

  shovelReady.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

  return { shovelReady, blocked, needsRefinement };
}

function auditRoadmap() {
  const args = process.argv.slice(2);
  const strictMode = args.includes('--strict');
  const skipDiskCheck = args.includes('--skip-disk-check');
  const markdownIndex = args.indexOf('--markdown');
  const markdownOutput = markdownIndex !== -1 ? args[markdownIndex + 1] : null;

  const repoRoot = getRepoRoot();

  console.log(
    `\n${colors.bold}${colors.cyan}================================================================${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}   🛡️  ChrisShop Adversarial Roadmap & Backlog Auditor (On-Demand)${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}================================================================${colors.reset}\n`
  );

  let milestones: Milestone[] = [];
  let issues: Issue[] = [];

  try {
    process.stdout.write('📡 Fetching GitHub milestones and backlog data... ');
    milestones = fetchMilestones();
    issues = fetchIssues();
    console.log(`${colors.green}Done.${colors.reset}\n`);
  } catch (err: any) {
    console.error(`\n${colors.red}❌ Failed to fetch data from GitHub:${colors.reset} ${err.message}`);
    process.exit(1);
  }

  const openIssues = issues.filter((i) => i.state === 'OPEN');
  const closedIssues = issues.filter((i) => i.state === 'CLOSED');

  // 1. Milestone Drift Audit
  const milestoneDrift: Array<{ milestone: Milestone; detected: string[] }> = [];
  for (const m of milestones) {
    const text = `${m.title} ${m.description || ''}`.toLowerCase();
    const found = LEGACY_KEYWORDS.filter((k) => text.includes(k));
    if (found.length > 0) {
      milestoneDrift.push({ milestone: m, detected: found });
    }
  }

  // 2. Orphaned Issues
  const orphanedIssues = openIssues.filter((i) => !i.milestone);

  // 3. Priority Missing
  const missingPriority = openIssues.filter(
    (i) => !i.labels.some((l) => VALID_PRIORITIES.includes(l.name))
  );

  const prs = fetchPullRequests();

  // 4. Completed Issues Lifecycle Sync
  // Stories marked status:completed remain open while PR is open/pending review.
  // An issue is only considered improperly left open if its PR has already been merged (or no open PR).
  const completedIssues = openIssues.filter((i) =>
    i.labels.some((l) => l.name === 'status:completed')
  );

  const awaitingPrMerge: Array<{ issue: Issue; pr?: PullRequest }> = [];
  const completedLeftOpen: Array<{ issue: Issue; pr?: PullRequest }> = [];

  for (const issue of completedIssues) {
    const pr = findAssociatedPr(issue, prs);
    if (pr && pr.state === 'OPEN') {
      awaitingPrMerge.push({ issue, pr });
    } else {
      completedLeftOpen.push({ issue, pr });
    }
  }

  // 5. Deliverables on disk
  const missingDeliverables = skipDiskCheck ? [] : auditDeliverablesOnDisk(issues, repoRoot);

  // 6. Dependencies & Shovel-Readiness
  const { shovelReady, blocked, needsRefinement } = analyzeDependenciesAndReadiness(issues);

  // Milestone Progress Table
  console.log(`${colors.bold}📊 Delivery Phase & Milestone Health:${colors.reset}`);
  console.log(
    `┌─────┬──────────────────────────────────────────┬───────┬────────┬──────────┬─────────────┐`
  );
  console.log(
    `│ Num │ Milestone Title                          │ Open  │ Closed │ Progress │ Due Date    │`
  );
  console.log(
    `├─────┼──────────────────────────────────────────┼───────┼────────┼──────────┼─────────────┤`
  );

  milestones.sort((a, b) => a.number - b.number);

  for (const m of milestones) {
    const total = m.open_issues + m.closed_issues;
    const pct = total > 0 ? Math.round((m.closed_issues / total) * 100) : 0;
    const numStr = m.number.toString().padEnd(3);
    const titleStr = m.title.padEnd(40).slice(0, 40);
    const openStr = m.open_issues.toString().padEnd(5);
    const closedStr = m.closed_issues.toString().padEnd(6);
    const pctStr = `${pct}%`.padEnd(8);
    const dueStr = m.due_on ? m.due_on.slice(0, 10).padEnd(11) : 'No due date';

    const color = pct >= 80 ? colors.green : pct >= 40 ? colors.yellow : colors.white;
    console.log(
      `│ ${numStr} │ ${titleStr} │ ${openStr} │ ${closedStr} │ ${color}${pctStr}${colors.reset} │ ${dueStr} │`
    );
  }
  console.log(
    `└─────┴──────────────────────────────────────────┴───────┴────────┴──────────┴─────────────┘\n`
  );

  // Findings & Violations
  console.log(`${colors.bold}🔍 Adversarial Audit Findings:${colors.reset}`);

  // Drift
  if (milestoneDrift.length === 0) {
    console.log(
      `  ${colors.green}✅ Milestone Architecture Cleanliness:${colors.reset} Zero legacy stack keywords detected in milestone descriptions.`
    );
  } else {
    console.log(
      `  ${colors.red}❌ Architectural Drift Detected in Milestones:${colors.reset}`
    );
    for (const d of milestoneDrift) {
      console.log(
        `     - Milestone ${d.milestone.number} ("${d.milestone.title}"): Contains [${d.detected.join(', ')}]`
      );
    }
  }

  // Orphans
  if (orphanedIssues.length === 0) {
    console.log(
      `  ${colors.green}✅ Milestone Assignment Integrity:${colors.reset} All ${openIssues.length} open issues belong to a milestone.`
    );
  } else {
    console.log(
      `  ${colors.yellow}⚠️  Orphaned Issues Detected (No Milestone Assigned):${colors.reset}`
    );
    for (const o of orphanedIssues) {
      console.log(`     - #${o.number}: "${o.title}"`);
    }
  }

  // Priority
  if (missingPriority.length === 0) {
    console.log(
      `  ${colors.green}✅ Priority Governance:${colors.reset} 100% of open issues have an explicit priority label.`
    );
  } else {
    console.log(
      `  ${colors.yellow}⚠️  Issues Missing Priority Label (${missingPriority.length}):${colors.reset}`
    );
    for (const p of missingPriority.slice(0, 8)) {
      console.log(`     - #${p.number}: "${p.title}"`);
    }
    if (missingPriority.length > 8) {
      console.log(`     ... and ${missingPriority.length - 8} more.`);
    }
  }

  // Completed left open / awaiting PR merge
  if (completedLeftOpen.length === 0) {
    console.log(
      `  ${colors.green}✅ Issue Lifecycle Sync:${colors.reset} No completed stories with merged PRs left open on GitHub.`
    );
  } else {
    console.log(
      `  ${colors.red}❌ Completed Stories Left Open on GitHub (PR Merged / Unclosed):${colors.reset}`
    );
    for (const c of completedLeftOpen) {
      const prInfo = c.pr ? `(PR #${c.pr.number} is ${c.pr.state})` : '(No active PR)';
      console.log(`     - #${c.issue.number}: "${c.issue.title}" ${prInfo}`);
    }
  }

  if (awaitingPrMerge.length > 0) {
    console.log(
      `  ${colors.cyan}⏳ Stories Completed & Awaiting PR Merge (${awaitingPrMerge.length}):${colors.reset}`
    );
    for (const item of awaitingPrMerge) {
      const prInfo = item.pr ? `(PR #${item.pr.number}: ${item.pr.title})` : '';
      console.log(`     - #${item.issue.number}: "${item.issue.title}" ${prInfo}`);
    }
  }

  // Deliverables on disk
  if (!skipDiskCheck) {
    if (missingDeliverables.length === 0) {
      console.log(
        `  ${colors.green}✅ Deliverables Verification:${colors.reset} All referenced files in closed issues exist on disk.`
      );
    } else {
      console.log(
        `  ${colors.yellow}⚠️  Deliverables on Disk Verification:${colors.reset} Found ${missingDeliverables.length} closed issues mentioning missing/archived files (e.g. decommissioned legacy files).`
      );
    }
  }

  // Strategic Execution Horizons & Shovel-Ready Stories
  console.log(`\n${colors.bold}🎯 Strategic Execution Horizons (Top Shovel-Ready Candidates):${colors.reset}`);
  if (shovelReady.length === 0) {
    console.log(`  ${colors.yellow}⚠️  No unblocked shovel-ready candidates currently found.${colors.reset}`);
  } else {
    for (const s of shovelReady.slice(0, 6)) {
      const pColor =
        s.priority === 'priority:critical'
          ? colors.red
          : s.priority === 'priority:high'
          ? colors.cyan
          : colors.yellow;
      console.log(
        `  - ${colors.bold}#${s.number}${colors.reset} [${colors.magenta}${s.phase}${colors.reset}] [${pColor}${s.priority}${colors.reset}]: ${s.title}`
      );
    }
  }

  // Blocked & Needing Refinement
  if (blocked.length > 0 || needsRefinement.length > 0) {
    console.log(`\n${colors.bold}🚧 Blocked Stories & Pending Review (${blocked.length + needsRefinement.length}):${colors.reset}`);
    for (const b of blocked.slice(0, 5)) {
      console.log(`  - ${colors.yellow}#${b.number}${colors.reset}: ${b.title} — ${colors.dim}${b.reason}${colors.reset}`);
    }
    for (const n of needsRefinement.slice(0, 3)) {
      console.log(`  - ${colors.magenta}#${n.number}${colors.reset} (Needs Refinement): ${n.title}`);
    }
  }

  // Generate Markdown if requested
  if (markdownOutput) {
    const mdLines = [
      '# 🛡️ ChrisShop Adversarial Roadmap & Backlog Audit',
      `**Generated**: ${new Date().toISOString()}`,
      `**Monorepo Root**: \`${repoRoot}\``,
      '',
      '## 1. Milestone Status Table',
      '| # | Milestone | Open | Closed | Progress | Due Date |',
      '| :--- | :--- | :---: | :---: | :---: | :--- |',
    ];

    for (const m of milestones) {
      const total = m.open_issues + m.closed_issues;
      const pct = total > 0 ? Math.round((m.closed_issues / total) * 100) : 0;
      mdLines.push(
        `| ${m.number} | ${m.title} | ${m.open_issues} | ${m.closed_issues} | ${pct}% | ${m.due_on ? m.due_on.slice(0, 10) : 'N/A'} |`
      );
    }

    mdLines.push('');
    mdLines.push('## 2. Findings Summary');
    mdLines.push(`- **Milestones with Legacy Drift**: ${milestoneDrift.length}`);
    mdLines.push(`- **Orphaned Issues**: ${orphanedIssues.length}`);
    mdLines.push(`- **Issues Missing Priority**: ${missingPriority.length}`);
    mdLines.push(`- **Completed Left Open (PR Merged)**: ${completedLeftOpen.length}`);
    mdLines.push(`- **Stories Awaiting PR Merge**: ${awaitingPrMerge.length}`);
    mdLines.push(`- **Shovel-Ready Candidates**: ${shovelReady.length}`);
    mdLines.push(`- **Blocked Stories**: ${blocked.length}`);
    mdLines.push('');

    mdLines.push('## 3. Top Shovel-Ready Candidates');
    for (const s of shovelReady.slice(0, 10)) {
      mdLines.push(`- **#${s.number}** [${s.phase}] (${s.priority}): ${s.title}`);
    }
    mdLines.push('');

    if (blocked.length > 0) {
      mdLines.push('## 4. Blocked Stories');
      for (const b of blocked) {
        mdLines.push(`- **#${b.number}**: ${b.title} (${b.reason})`);
      }
      mdLines.push('');
    }

    fs.writeFileSync(markdownOutput, mdLines.join('\n'), 'utf-8');
    console.log(`\n${colors.green}📄 Markdown report exported to:${colors.reset} ${markdownOutput}`);
  }

  console.log(
    `\n${colors.bold}${colors.cyan}================================================================${colors.reset}\n`
  );

  if (strictMode && (milestoneDrift.length > 0 || completedLeftOpen.length > 0 || orphanedIssues.length > 0)) {
    console.error(
      `${colors.red}❌ Strict mode failure: Roadmap integrity violations detected.${colors.reset}`
    );
    process.exit(1);
  }
}

auditRoadmap();
