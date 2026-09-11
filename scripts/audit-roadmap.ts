#!/usr/bin/env tsx
/**
 * ChrisShop Adversarial Roadmap & Milestone Auditor CLI
 *
 * Inspects GitHub Milestones, Backlog Issues, and Local Architecture
 * to detect drift, orphaned stories, priority hygiene, and phase velocity.
 *
 * Usage:
 *   pnpm run audit:roadmap
 *   tsx scripts/audit-roadmap.ts
 *   tsx scripts/audit-roadmap.ts --markdown docs/ROADMAP_AUDIT_LATEST.md
 *   tsx scripts/audit-roadmap.ts --strict
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
  color: string;
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

function auditRoadmap() {
  const args = process.argv.slice(2);
  const strictMode = args.includes('--strict');
  const markdownIndex = args.indexOf('--markdown');
  const markdownOutput = markdownIndex !== -1 ? args[markdownIndex + 1] : null;

  console.log(
    `\n${colors.bold}${colors.cyan}================================================================${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}   🛡️  ChrisShop Adversarial Roadmap & Milestone Auditor        ${colors.reset}`
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

  // 4. Completed Left Open
  const completedLeftOpen = openIssues.filter((i) =>
    i.labels.some((l) => l.name === 'status:completed')
  );

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

  // Sort by number
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

  // Completed left open
  if (completedLeftOpen.length === 0) {
    console.log(
      `  ${colors.green}✅ Issue Lifecycle Sync:${colors.reset} No completed stories left open on GitHub.`
    );
  } else {
    console.log(
      `  ${colors.red}❌ Completed Stories Left Open on GitHub:${colors.reset}`
    );
    for (const c of completedLeftOpen) {
      console.log(`     - #${c.number}: "${c.title}"`);
    }
  }

  // Strategic Horizon Prioritization
  console.log(`\n${colors.bold}🎯 Strategic Execution Horizons (Current Recommendations):${colors.reset}`);

  const shovelReadyHigh = openIssues.filter((i) => {
    const labels = i.labels.map((l) => l.name);
    return (
      labels.includes('priority:high') &&
      !labels.includes('blocked') &&
      !labels.includes('creator-review') &&
      !labels.includes('status:in-progress')
    );
  });

  console.log(
    `  ${colors.cyan}🔥 Top Shovel-Ready High-Priority Candidates for Autonomous Agents:${colors.reset}`
  );
  if (shovelReadyHigh.length === 0) {
    console.log(`     (None currently unblocked)`);
  } else {
    for (const s of shovelReadyHigh.slice(0, 6)) {
      const msTitle = s.milestone ? s.milestone.title.split(':')[0] : 'NO MILESTONE';
      console.log(
        `     - ${colors.bold}#${s.number}${colors.reset} [${colors.magenta}${msTitle}${colors.reset}]: ${s.title}`
      );
    }
  }

  // Generate Markdown if requested
  if (markdownOutput) {
    const mdLines = [
      '# 🛡️ ChrisShop Adversarial Roadmap & Milestone Audit',
      `**Generated**: ${new Date().toISOString()}`,
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
    mdLines.push(`- **Completed Left Open**: ${completedLeftOpen.length}`);
    mdLines.push('');

    fs.writeFileSync(markdownOutput, mdLines.join('\n'), 'utf-8');
    console.log(`\n${colors.green}📄 Markdown report exported to:${colors.reset} ${markdownOutput}`);
  }

  console.log(
    `\n${colors.bold}${colors.cyan}================================================================${colors.reset}\n`
  );

  if (strictMode && (milestoneDrift.length > 0 || completedLeftOpen.length > 0)) {
    console.error(
      `${colors.red}❌ Strict mode failure: Roadmap integrity violations detected.${colors.reset}`
    );
    process.exit(1);
  }
}

auditRoadmap();
