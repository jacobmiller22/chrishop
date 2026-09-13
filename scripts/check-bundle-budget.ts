#!/usr/bin/env tsx
/**
 * ChrisShop Cloudflare Worker Bundle Size Budgeting & Verification CLI
 *
 * Story 2.41: Cloudflare Worker Bundle Size Budgeting & PR CI Verification Gate
 *
 * Inspects .open-next/ compilation outputs post-build, measuring uncompressed,
 * gzip, and brotli sizes for all worker bundles.
 *
 * Thresholds:
 * - Storefront Edge Worker: Warning > 4 MB uncompressed, Hard Fail > 8 MB gzip
 * - Admin CMS Worker:       Warning > 20 MB uncompressed, Hard Fail > 8.5 MB gzip
 * - Cloudflare Hard Limit:  Hard Fail > 33 MB uncompressed
 *
 * Exit code 0 on pass / warn, exit code 1 with actionable diagnostics on failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export type WorkerRole = 'storefront' | 'admin' | 'generic';

export interface BudgetThreshold {
  warnUncompressedBytes: number;
  maxGzipBytes: number;
  maxUncompressedBytes: number;
}

export interface WorkerBundleProfile {
  name: string;
  relativePath: string;
  absolutePath: string;
  role: WorkerRole;
  roleLabel: string;
  uncompressedBytes: number;
  gzipBytes: number;
  brotliBytes: number;
  uncompressedMb: number;
  gzipMb: number;
  brotliMb: number;
  uncompressedFormatted: string;
  gzipFormatted: string;
  brotliFormatted: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  warnings: string[];
  failures: string[];
  thresholds: BudgetThreshold;
  percentGzipLimit: number;
  percentUncompressedLimit: number;
}

export interface BudgetCheckResult {
  success: boolean;
  hasWarnings: boolean;
  bundles: WorkerBundleProfile[];
  summaryMarkdown: string;
  timestamp: string;
  exitCode: number;
}

// Budget thresholds according to Story 2.41 specifications
export const BUNDLE_BUDGET_THRESHOLDS: Record<WorkerRole, BudgetThreshold> = {
  storefront: {
    warnUncompressedBytes: 4 * 1024 * 1024, // 4 MB
    maxGzipBytes: 8 * 1024 * 1024, // 8 MB
    maxUncompressedBytes: 33 * 1024 * 1024, // 33 MB Cloudflare ceiling
  },
  admin: {
    warnUncompressedBytes: 20 * 1024 * 1024, // 20 MB
    maxGzipBytes: 8.5 * 1024 * 1024, // 8.5 MB
    maxUncompressedBytes: 33 * 1024 * 1024, // 33 MB Cloudflare ceiling
  },
  generic: {
    warnUncompressedBytes: 4 * 1024 * 1024, // 4 MB
    maxGzipBytes: 8 * 1024 * 1024, // 8 MB
    maxUncompressedBytes: 33 * 1024 * 1024, // 33 MB Cloudflare ceiling
  },
};

export const ROLE_LABELS: Record<WorkerRole, string> = {
  storefront: 'Storefront Edge Worker',
  admin: 'Admin CMS Worker',
  generic: 'Edge Worker',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Recursively discovers worker bundle code files in .open-next, excluding assets.
 */
export function findWorkerFiles(dir: string, baseDir: string = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Exclude static assets and cache directories
      if (
        entry.name === 'assets' ||
        entry.name === 'cache' ||
        entry.name === 'node_modules' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }
      files.push(...findWorkerFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      // Worker code entrypoints & bundles
      if (
        (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs')) &&
        !entry.name.endsWith('.map')
      ) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Classify a bundle path into a role.
 */
export function classifyWorkerRole(relPath: string): WorkerRole {
  const lower = relPath.toLowerCase().replace(/\\/g, '/');
  const base = path.basename(lower);

  if (lower.includes('admin')) {
    return 'admin';
  }
  if (
    lower.includes('storefront') ||
    base === 'worker.js' ||
    base === 'worker.mjs' ||
    lower.endsWith('/worker.js') ||
    lower.endsWith('/worker.mjs') ||
    lower.includes('default') ||
    lower.includes('server-functions/default')
  ) {
    return 'storefront';
  }
  return 'generic';
}

/**
 * Profiles a single worker bundle file against its budget thresholds.
 */
export function profileWorkerBundle(
  filePath: string,
  baseDir: string,
  roleOverride?: WorkerRole
): WorkerBundleProfile {
  const content = fs.readFileSync(filePath);
  const uncompressedBytes = content.length;
  const gzipBytes = zlib.gzipSync(content, { level: 9 }).length;
  const brotliBytes = zlib.brotliCompressSync(content).length;

  const relPath = path.relative(baseDir, filePath);
  const role = roleOverride || classifyWorkerRole(relPath);
  const thresholds = BUNDLE_BUDGET_THRESHOLDS[role];

  const uncompressedMb = Number((uncompressedBytes / (1024 * 1024)).toFixed(3));
  const gzipMb = Number((gzipBytes / (1024 * 1024)).toFixed(3));
  const brotliMb = Number((brotliBytes / (1024 * 1024)).toFixed(3));

  const percentGzipLimit = Number(((gzipBytes / thresholds.maxGzipBytes) * 100).toFixed(1));
  const percentUncompressedLimit = Number(
    ((uncompressedBytes / thresholds.maxUncompressedBytes) * 100).toFixed(1)
  );

  const warnings: string[] = [];
  const failures: string[] = [];

  // Check hard failure for gzip size
  if (gzipBytes > thresholds.maxGzipBytes) {
    const overageBytes = gzipBytes - thresholds.maxGzipBytes;
    const overageMb = (overageBytes / (1024 * 1024)).toFixed(2);
    const pctOver = ((overageBytes / thresholds.maxGzipBytes) * 100).toFixed(1);
    failures.push(
      `Gzip size of ${formatBytes(gzipBytes)} (${gzipMb} MB) exceeds ${ROLE_LABELS[role]} hard limit of ${formatBytes(thresholds.maxGzipBytes)} (+${overageMb} MB / +${pctOver}% over budget).`
    );
  }

  // Check hard failure for uncompressed size (Cloudflare ceiling)
  if (uncompressedBytes > thresholds.maxUncompressedBytes) {
    const overageBytes = uncompressedBytes - thresholds.maxUncompressedBytes;
    const overageMb = (overageBytes / (1024 * 1024)).toFixed(2);
    failures.push(
      `Uncompressed size of ${formatBytes(uncompressedBytes)} (${uncompressedMb} MB) exceeds Cloudflare Workers hard ceiling of ${formatBytes(thresholds.maxUncompressedBytes)} (+${overageMb} MB over ceiling).`
    );
  }

  // Check warning threshold for uncompressed size
  if (uncompressedBytes > thresholds.warnUncompressedBytes) {
    const overageBytes = uncompressedBytes - thresholds.warnUncompressedBytes;
    const overageMb = (overageBytes / (1024 * 1024)).toFixed(2);
    warnings.push(
      `Uncompressed size of ${formatBytes(uncompressedBytes)} (${uncompressedMb} MB) exceeds ${ROLE_LABELS[role]} warning threshold of ${formatBytes(thresholds.warnUncompressedBytes)} (+${overageMb} MB).`
    );
  }

  const status: 'PASS' | 'WARN' | 'FAIL' =
    failures.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';

  return {
    name: path.basename(filePath),
    relativePath: relPath,
    absolutePath: filePath,
    role,
    roleLabel: ROLE_LABELS[role],
    uncompressedBytes,
    gzipBytes,
    brotliBytes,
    uncompressedMb,
    gzipMb,
    brotliMb,
    uncompressedFormatted: formatBytes(uncompressedBytes),
    gzipFormatted: formatBytes(gzipBytes),
    brotliFormatted: formatBytes(brotliBytes),
    status,
    warnings,
    failures,
    thresholds,
    percentGzipLimit,
    percentUncompressedLimit,
  };
}

/**
 * Formats a comprehensive Markdown summary report.
 */
export function formatMarkdownSummary(
  profiles: WorkerBundleProfile[],
  success: boolean,
  hasWarnings: boolean
): string {
  const lines: string[] = [];

  lines.push('### 📦 Cloudflare Worker Bundle Size Budget Report');
  lines.push('');

  if (profiles.length === 0) {
    lines.push('> [!WARNING]');
    lines.push('> No worker bundles detected in the specified directory.');
    return lines.join('\n');
  }

  lines.push('| Worker Bundle | Role | Uncompressed | Gzip | Brotli | Status | Gzip Limit % |');
  lines.push('|:---|:---|---:|---:|---:|:---:|---:|');

  for (const p of profiles) {
    const statusIcon = p.status === 'PASS' ? '✅ PASS' : p.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL';
    lines.push(
      `| \`${p.relativePath}\` | ${p.roleLabel} | ${p.uncompressedFormatted} | ${p.gzipFormatted} | ${p.brotliFormatted} | ${statusIcon} | ${p.percentGzipLimit}% |`
    );
  }

  lines.push('');

  // Failures section
  const allFailures = profiles.flatMap((p) => p.failures.map((f) => `\`${p.relativePath}\`: ${f}`));
  if (allFailures.length > 0) {
    lines.push('> [!CAUTION]');
    lines.push('> **Bundle Budget Breach Detected:**');
    for (const f of allFailures) {
      lines.push(`> - ${f}`);
    }
    lines.push('>');
    lines.push('> **Actionable Remediation:**');
    lines.push(
      '> 1. Inspect imported modules for heavy or accidental Node-only packages using `pnpm run benchmark`.'
    );
    lines.push(
      '> 2. Verify route splitting in `apps/web/open-next.config.ts` to isolate heavy admin dependencies.'
    );
    lines.push(
      '> 3. Use dynamic imports (`next/dynamic` or `await import(...)`) to defer non-critical code paths.'
    );
    lines.push(
      '> 4. Ensure non-edge dependencies (e.g. sharp, fs-heavy libraries) are not bundled into edge workers.'
    );
    lines.push('');
  }

  // Warnings section
  const allWarnings = profiles.flatMap((p) => p.warnings.map((w) => `\`${p.relativePath}\`: ${w}`));
  if (allWarnings.length > 0) {
    lines.push('> [!WARNING]');
    lines.push('> **Bundle Budget Warning (Approaching Ceiling):**');
    for (const w of allWarnings) {
      lines.push(`> - ${w}`);
    }
    lines.push('');
  }

  if (success && !hasWarnings) {
    lines.push('> [!NOTE]');
    lines.push(
      '> All Cloudflare Worker bundles strictly adhere to the size budget limits (< 10 MB compressed / < 33 MB uncompressed).'
    );
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Scan target directory and check bundle sizes.
 */
export function checkBundleBudget(options: {
  openNextDir?: string;
  cwd?: string;
}): BudgetCheckResult {
  const rootDir = options.cwd || process.cwd();
  const openNextDir = options.openNextDir
    ? path.resolve(rootDir, options.openNextDir)
    : path.resolve(rootDir, '.open-next');

  if (!fs.existsSync(openNextDir)) {
    const errorMarkdown = [
      '### 📦 Cloudflare Worker Bundle Size Budget Report',
      '',
      '> [!CAUTION]',
      `> **Error**: Build output directory \`${path.relative(rootDir, openNextDir) || '.open-next'}\` was not found.`,
      '> Run `pnpm run build` prior to verifying worker bundle budgets.',
    ].join('\n');

    return {
      success: false,
      hasWarnings: false,
      bundles: [],
      summaryMarkdown: errorMarkdown,
      timestamp: new Date().toISOString(),
      exitCode: 1,
    };
  }

  const workerFiles = findWorkerFiles(openNextDir, openNextDir);

  if (workerFiles.length === 0) {
    const errorMarkdown = [
      '### 📦 Cloudflare Worker Bundle Size Budget Report',
      '',
      '> [!CAUTION]',
      `> **Error**: No worker bundles found in \`${path.relative(rootDir, openNextDir) || '.open-next'}\`.`,
      '> Run `pnpm run build` to generate the Cloudflare Worker entrypoints.',
    ].join('\n');

    return {
      success: false,
      hasWarnings: false,
      bundles: [],
      summaryMarkdown: errorMarkdown,
      timestamp: new Date().toISOString(),
      exitCode: 1,
    };
  }

  const profiles: WorkerBundleProfile[] = workerFiles.map((file) =>
    profileWorkerBundle(file, openNextDir)
  );

  const hasFailures = profiles.some((p) => p.status === 'FAIL');
  const hasWarnings = profiles.some((p) => p.status === 'WARN');
  const success = !hasFailures;
  const exitCode = success ? 0 : 1;

  const summaryMarkdown = formatMarkdownSummary(profiles, success, hasWarnings);

  return {
    success,
    hasWarnings,
    bundles: profiles,
    summaryMarkdown,
    timestamp: new Date().toISOString(),
    exitCode,
  };
}

/**
 * CLI Runner
 */
export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  let openNextDir: string | undefined;
  let jsonOutput = false;
  let markdownOnly = false;
  let outputFile: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: tsx scripts/check-bundle-budget.ts [options]

Options:
  --dir <path>       Specify custom build output directory (default: .open-next)
  --json             Output results as JSON
  --markdown         Output only the Markdown summary
  --output <file>    Write report markdown/json to file
  -h, --help         Show help menu
      `);
      return 0;
    }
    if (arg === '--dir' && argv[i + 1]) {
      openNextDir = argv[++i];
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--markdown') {
      markdownOnly = true;
    } else if (arg === '--output' && argv[i + 1]) {
      outputFile = argv[++i];
    }
  }

  const result = checkBundleBudget({ openNextDir });

  if (outputFile) {
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), outputFile)), { recursive: true });
    fs.writeFileSync(
      outputFile,
      jsonOutput ? JSON.stringify(result, null, 2) : result.summaryMarkdown,
      'utf-8'
    );
  }

  // If in GitHub Actions, append to GITHUB_STEP_SUMMARY
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `\n${result.summaryMarkdown}\n`,
        'utf-8'
      );
    } catch (err: any) {
      console.warn('Could not write to GITHUB_STEP_SUMMARY:', err?.message || err);
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result.exitCode;
  }

  if (markdownOnly) {
    console.log(result.summaryMarkdown);
    return result.exitCode;
  }

  // Default Human-friendly terminal formatting
  console.log('\n================================================================');
  console.log('   📦 Cloudflare Worker Bundle Size Budget Verification Gate    ');
  console.log('================================================================\n');

  if (result.bundles.length === 0) {
    console.error('❌ No worker bundles found.');
    console.error('Run `pnpm run build` prior to running bundle budget checks.\n');
    return result.exitCode;
  }

  const tableData = result.bundles.map((b) => ({
    Bundle: b.relativePath,
    Role: b.roleLabel,
    Uncompressed: b.uncompressedFormatted,
    Gzip: b.gzipFormatted,
    Brotli: b.brotliFormatted,
    'Gzip %': `${b.percentGzipLimit}%`,
    Status: b.status,
  }));

  console.table(tableData);

  if (result.hasWarnings) {
    console.warn('\n⚠️  WARNINGS:');
    for (const b of result.bundles) {
      for (const w of b.warnings) {
        console.warn(`  - [${b.relativePath}] ${w}`);
      }
    }
  }

  if (!result.success) {
    console.error('\n❌ BUDGET BREACHES (HARD FAILURES):');
    for (const b of result.bundles) {
      for (const f of b.failures) {
        console.error(`  - [${b.relativePath}] ${f}`);
      }
    }
    console.error('\nActionable Remediation:');
    console.error('  1. Run `pnpm run benchmark` to identify bloated dependencies.');
    console.error('  2. Verify route splitting in `apps/web/open-next.config.ts`.');
    console.error('  3. Use dynamic imports for large modules.');
    console.error('  4. Ensure server-side heavy libraries are not bundled into edge isolates.\n');
  } else {
    console.log('\n✔ All worker bundles are within Cloudflare Workers size limits.\n');
  }

  return result.exitCode;
}

if (
  process.argv[1] === import.meta.filename ||
  process.argv[1]?.endsWith('check-bundle-budget.ts')
) {
  runCli().then((code) => {
    process.exit(code);
  });
}
