#!/usr/bin/env tsx
/**
 * ChrisShop Unified Local Development Orchestrator
 *
 * Concurrently manages:
 * 1. Cloudflare Workers environment pre-flight (wrangler types, local D1 state)
 * 2. Next.js App Router Storefront & Payload CMS Admin on http://localhost:3000
 * 3. Cloudflare Wrangler & Miniflare Edge Worker emulation on http://localhost:8787
 * 4. Graceful shutdown and signal propagation across both process trees
 */

import { spawn, execSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildWorker } from './build-worker';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const rootDir = process.cwd();
const children: ChildProcess[] = [];
let isShuttingDown = false;

function log(prefix: string, message: string, color = colors.cyan) {
  const lines = message.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.log(`${color}${prefix}${colors.reset} ${line}`);
    }
  }
}

function runPreflight(): void {
  console.log(
    `\n${colors.bold}${colors.blue}▶ [PREFLIGHT] Initializing Cloudflare & Local Emulation Environment...${colors.reset}`
  );

  // 1. Ensure worker entrypoint exists
  buildWorker();

  // 2. Generate Cloudflare Workers types for bindings
  try {
    log('[cf:types]', 'Generating Cloudflare Worker environment types (wrangler types)...', colors.yellow);
    execSync('pnpm exec wrangler types', { cwd: rootDir, stdio: 'pipe' });
    log('[cf:types]', 'Worker configuration types generated successfully.', colors.green);
  } catch (err: any) {
    log('[cf:types]', `Warning: types generation failed: ${err.message}`, colors.yellow);
  }

  // 3. Ensure local D1 directory exists
  const d1Dir = path.resolve(rootDir, '.wrangler/state/v3/d1');
  if (!fs.existsSync(d1Dir)) {
    fs.mkdirSync(d1Dir, { recursive: true });
  }

  console.log(
    `${colors.bold}${colors.green}✔ [PREFLIGHT] Environment ready! Launching dev servers...${colors.reset}\n`
  );
}

function startProcess(
  name: string,
  command: string,
  args: string[],
  prefixColor: string
): ChildProcess {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (data) => {
    log(`[${name}]`, data.toString('utf-8'), prefixColor);
  });

  child.stderr?.on('data', (data) => {
    log(`[${name}]`, data.toString('utf-8'), prefixColor);
  });

  child.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      log(
        `[${name}]`,
        `Process exited unexpectedly with code ${code ?? signal}`,
        colors.yellow
      );
      cleanup();
      process.exit(code ?? 1);
    }
  });

  children.push(child);
  return child;
}

function cleanup(): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${colors.bold}${colors.yellow}Shutting down local dev processes...${colors.reset}`);

  for (const child of children) {
    if (child && !child.killed) {
      try {
        child.kill('SIGINT');
      } catch {
        // Process might already be terminating
      }
    }
  }

  // Give processes 1.5s to cleanly flush and terminate before force killing
  setTimeout(() => {
    for (const child of children) {
      if (child && !child.killed) {
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore
        }
      }
    }
    process.exit(0);
  }, 1500).unref();
}

function main(): void {
  runPreflight();

  console.log(`${colors.bold}Services Starting:${colors.reset}`);
  console.log(`- ${colors.cyan}Next.js Storefront & Payload CMS${colors.reset}: http://localhost:3000`);
  console.log(`- ${colors.magenta}Cloudflare Miniflare Edge Worker${colors.reset}: http://localhost:8787\n`);

  // Start Next.js App
  startProcess('web', 'pnpm', ['--filter', '@chrishop/web', 'dev'], colors.cyan);

  // Start Cloudflare Wrangler dev with Miniflare emulation on port 8787
  startProcess('wrangler', 'pnpm', ['exec', 'wrangler', 'dev', '--port', '8787'], colors.magenta);

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main();
