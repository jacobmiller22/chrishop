#!/usr/bin/env tsx
/**
 * ChrisShop Backlog Prioritization & Audit CLI Tool
 *
 * Audits open backlog issues for priority label coverage (priority:critical,
 * priority:high, priority:medium, priority:low) and provides batch-labeling
 * and governance check capabilities.
 *
 * Usage:
 *   pnpm run pm:prioritize
 *   tsx scripts/prioritize-backlog.ts
 *   tsx scripts/prioritize-backlog.ts --check
 *   tsx scripts/prioritize-backlog.ts --set <issue-number> <critical|high|medium|low>
 *   tsx scripts/prioritize-backlog.ts --batch-default <critical|high|medium|low>
 */

import { execSync } from 'node:child_process';

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

const VALID_PRIORITIES = [
  'priority:critical',
  'priority:high',
  'priority:medium',
  'priority:low',
] as const;

type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

interface Issue {
  number: number;
  title: string;
  milestone: { number: number; title: string } | null;
  labels: Array<{ name: string; color: string }>;
  body: string;
}

function runGh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err: any) {
    const msg = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`GitHub CLI failed: ${cmd}\n${msg}`);
  }
}

function fetchOpenIssues(): Issue[] {
  const raw = runGh(
    'gh issue list --state open --limit 200 --json number,title,milestone,labels,body'
  );
  return JSON.parse(raw);
}

function setIssuePriority(issueNumber: number, priority: PriorityLevel) {
  const targetLabel = `priority:${priority}`;
  console.log(`Setting #${issueNumber} to ${targetLabel}...`);

  // Remove other priority labels if present
  for (const p of ['critical', 'high', 'medium', 'low']) {
    if (p !== priority) {
      try {
        runGh(`gh issue edit ${issueNumber} --remove-label "priority:${p}"`);
      } catch {
        // Ignore if label wasn't on the issue
      }
    }
  }

  runGh(`gh issue edit ${issueNumber} --add-label "${targetLabel}"`);
  console.log(`${colors.green}✔ Updated #${issueNumber} -> ${targetLabel}${colors.reset}`);
}

function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');
  const setIndex = args.indexOf('--set');
  const batchDefaultIndex = args.indexOf('--batch-default');

  console.log(
    `\n${colors.bold}${colors.cyan}================================================================${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}   🎯 ChrisShop Backlog Prioritization & Governance Tool         ${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}================================================================${colors.reset}\n`
  );

  // Direct --set command
  if (setIndex !== -1 && args[setIndex + 1] && args[setIndex + 2]) {
    const issueNum = parseInt(args[setIndex + 1], 10);
    const prio = args[setIndex + 2].toLowerCase() as PriorityLevel;
    if (!['critical', 'high', 'medium', 'low'].includes(prio)) {
      console.error(
        `${colors.red}❌ Invalid priority "${prio}". Valid options: critical, high, medium, low.${colors.reset}`
      );
      process.exit(1);
    }
    setIssuePriority(issueNum, prio);
    return;
  }

  let issues: Issue[] = [];
  try {
    process.stdout.write('📡 Fetching open backlog issues from GitHub... ');
    issues = fetchOpenIssues();
    console.log(`${colors.green}Done (${issues.length} open issues).${colors.reset}\n`);
  } catch (err: any) {
    console.error(`\n${colors.red}❌ Failed to fetch issues:${colors.reset} ${err.message}`);
    process.exit(1);
  }

  const priorityDistribution: Record<string, number> = {
    'priority:critical': 0,
    'priority:high': 0,
    'priority:medium': 0,
    'priority:low': 0,
    unassigned: 0,
  };

  const unassignedIssues: Issue[] = [];

  for (const issue of issues) {
    const assigned = issue.labels.find((l) =>
      VALID_PRIORITIES.includes(l.name as (typeof VALID_PRIORITIES)[number])
    );
    if (assigned) {
      priorityDistribution[assigned.name] = (priorityDistribution[assigned.name] || 0) + 1;
    } else {
      priorityDistribution.unassigned += 1;
      unassignedIssues.push(issue);
    }
  }

  console.log(`${colors.bold}📊 Backlog Priority Breakdown:${colors.reset}`);
  console.log(`  ${colors.red}● priority:critical${colors.reset} : ${priorityDistribution['priority:critical']}`);
  console.log(`  ${colors.yellow}● priority:high    ${colors.reset} : ${priorityDistribution['priority:high']}`);
  console.log(`  ${colors.blue}● priority:medium  ${colors.reset} : ${priorityDistribution['priority:medium']}`);
  console.log(`  ${colors.green}● priority:low     ${colors.reset} : ${priorityDistribution['priority:low']}`);
  console.log(`  ${colors.dim}○ Unassigned       ${colors.reset} : ${priorityDistribution.unassigned}\n`);

  if (unassignedIssues.length === 0) {
    console.log(
      `${colors.green}✅ All ${issues.length} open backlog issues have an explicit priority tier!${colors.reset}\n`
    );
  } else {
    console.log(
      `${colors.yellow}⚠️  ${unassignedIssues.length} issues are missing a priority label:${colors.reset}`
    );
    for (const issue of unassignedIssues) {
      const ms = issue.milestone ? `[${issue.milestone.title.split(':')[0]}]` : '[NO MILESTONE]';
      console.log(`   - #${issue.number} ${colors.dim}${ms}${colors.reset} ${issue.title}`);
    }
    console.log('');

    // Handle batch default labeling if requested
    if (batchDefaultIndex !== -1 && args[batchDefaultIndex + 1]) {
      const defaultPrio = args[batchDefaultIndex + 1].toLowerCase() as PriorityLevel;
      if (!['critical', 'high', 'medium', 'low'].includes(defaultPrio)) {
        console.error(`${colors.red}❌ Invalid batch priority level.${colors.reset}`);
        process.exit(1);
      }

      console.log(
        `⚡ Applying batch priority "${defaultPrio}" to ${unassignedIssues.length} unassigned issues...`
      );
      for (const issue of unassignedIssues) {
        setIssuePriority(issue.number, defaultPrio);
      }
      console.log(`${colors.green}✔ Batch labeling complete.${colors.reset}\n`);
    } else {
      console.log(
        `${colors.dim}Tip: Run "pnpm run pm:prioritize --batch-default medium" to label all unassigned issues.${colors.reset}\n`
      );
    }
  }

  if (checkMode && unassignedIssues.length > 0) {
    console.error(
      `${colors.red}❌ Priority Check Failed: ${unassignedIssues.length} issues lack priority labels.${colors.reset}`
    );
    process.exit(1);
  }
}

main();
