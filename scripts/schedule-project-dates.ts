#!/usr/bin/env tsx
/**
 * scripts/schedule-project-dates.ts
 *
 * Automatically computes and populates sensible 'Start date' and 'Target date'
 * custom fields on GitHub Project #4 (ChrisShop Delivery Roadmap), taking into
 * account historical velocity (~23 stories/day), milestone boundaries,
 * dependency chains, and realistic human/client review buffers.
 */

import { execSync } from 'node:child_process';

const PROJECT_ID = 'PVT_kwHOAxfaNM4BjBgZ';
const START_DATE_FIELD_ID = 'PVTF_lAHOAxfaNM4BjBgZzhiNTqM';
const TARGET_DATE_FIELD_ID = 'PVTF_lAHOAxfaNM4BjBgZzhiNTrI';

// Explicit schedule for open issues based on velocity, milestones, dependencies, and buffers
const SCHEDULE_MAP: Record<number, { start: string; target: string }> = {
  // Phase 1: Prototyping & Local Dev (Milestone Due: 2026-09-16)
  8:   { start: '2026-09-13', target: '2026-09-14' }, // Story 1.8: Creator Review (Local Demo Walkthrough) - ACTIVE TODAY
  203: { start: '2026-09-14', target: '2026-09-16' }, // Story 1.16: Storefront UX/UI Design Overhaul
  208: { start: '2026-09-14', target: '2026-09-15' }, // Story 1.18: POC Storefront Hero Banner & Dynamic Homepage Switch
  224: { start: '2026-09-15', target: '2026-09-16' }, // Story 1.24: Automated Storefront Responsiveness Guardrails
  250: { start: '2026-09-13', target: '2026-10-28' }, // Epic: Platform Destination State & Persona Capabilities Matrix

  // Phase 2: Infrastructure & Dependencies (Milestone Due: 2026-09-22)
  91:  { start: '2026-09-14', target: '2026-09-16' }, // Story 2.20: Shopify Store Setup & Headless Sales Channel Configuration
  233: { start: '2026-09-14', target: '2026-09-16' }, // Story 2.47: Decoupled Ephemeral PR Feature Flags
  237: { start: '2026-09-15', target: '2026-09-17' }, // Story 2.48: Spike — Cloudflare Edge Request Stream Consumption
  149: { start: '2026-09-15', target: '2026-09-17' }, // Story 2.33: Shopify Storefront Dual-Mode Client (WireMock Fallback)
  92:  { start: '2026-09-16', target: '2026-09-18' }, // Story 2.21: Shopify Storefront API Client
  93:  { start: '2026-09-17', target: '2026-09-19' }, // Story 2.22: Payload CMS afterChange Product Sync Hook
  143: { start: '2026-09-17', target: '2026-09-19' }, // Story 2.31: Composable Integration Matrix
  140: { start: '2026-09-18', target: '2026-09-20' }, // Story 2.29: Production Edge Secret Rotation Procedures
  144: { start: '2026-09-19', target: '2026-09-21' }, // Story 2.32: Staging & Preview Environment Parity Verification
  15:  { start: '2026-09-20', target: '2026-09-22' }, // Story 2.7: Phase 2 Creator Review - Staging Environment Demo

  // Phase 3: End-to-End Integration (Milestone Due: 2026-10-08)
  64:  { start: '2026-09-21', target: '2026-09-24' }, // Story 3.1g: Storefront Layout, Navigation & Responsive Design
  59:  { start: '2026-09-22', target: '2026-09-25' }, // Story 3.1b: Product Listing Page & Category Navigation
  60:  { start: '2026-09-23', target: '2026-09-26' }, // Story 3.1c: Product Detail Page & Variation Selector
  17:  { start: '2026-09-23', target: '2026-09-28' }, // Story 3.2: Shopify Storefront API Cart & Checkout Integration
  61:  { start: '2026-09-24', target: '2026-09-27' }, // Story 3.1d: Drop Countdown Timer & Scheduled Release UI
  63:  { start: '2026-09-25', target: '2026-09-28' }, // Story 3.1f: SEO, OpenGraph, JSON-LD & Metadata
  101: { start: '2026-09-26', target: '2026-09-29' }, // Story 3.9: Transactional Email Policy Disambiguation
  18:  { start: '2026-09-28', target: '2026-10-01' }, // Story 3.3: Shopify Order Webhook Ingestion & Raw HMAC
  100: { start: '2026-09-29', target: '2026-10-02' }, // Story 3.8: Async Shopify Webhook Pipeline with Queues
  102: { start: '2026-09-30', target: '2026-10-03' }, // Story 3.10: Drop Rush Defense — Cloudflare Turnstile on Checkout
  20:  { start: '2026-10-01', target: '2026-10-04' }, // Story 3.5: Order Fulfillment & Tracking Email Flow
  21:  { start: '2026-10-03', target: '2026-10-06' }, // Story 3.6: End-to-End Integration Test Suite
  22:  { start: '2026-10-06', target: '2026-10-08' }, // Story 3.7: Phase 3 Creator Review - Full Drop Dry Run & Sign-Off

  // Phase 4: DevOps & Failover Automation (Milestone Due: 2026-10-20)
  65:  { start: '2026-10-06', target: '2026-10-09' }, // Story 4.6: Sentry Error Tracking Integration
  23:  { start: '2026-10-07', target: '2026-10-10' }, // Story 4.1: Production CD Deployment Pipeline with Wrangler
  66:  { start: '2026-10-07', target: '2026-10-10' }, // Story 4.7: Better Stack Uptime Monitoring
  24:  { start: '2026-10-08', target: '2026-10-11' }, // Story 4.2: Workers Health Checks & Edge Monitoring
  166: { start: '2026-10-08', target: '2026-10-11' }, // Story 4.14: Telemetry & Observability Gap Audit
  67:  { start: '2026-10-09', target: '2026-10-12' }, // Story 4.8: Cloudflare DNS & Edge Caching Configuration
  167: { start: '2026-10-09', target: '2026-10-12' }, // Story 4.15: Metrics, Visualizations & Alerting Catalog
  164: { start: '2026-10-10', target: '2026-10-13' }, // Story 4.13: Spike — DNS Caching, TTL Policies & Edge Cache Purge
  168: { start: '2026-10-10', target: '2026-10-13' }, // Story 4.16: Dashboard Architecture Spike
  25:  { start: '2026-10-11', target: '2026-10-14' }, // Story 4.3: Cloudflare D1 Migration Automation & Rollback Strategy
  57:  { start: '2026-10-11', target: '2026-10-14' }, // Story 4.9: Domain Migration Runbook & DNS Cutover
  169: { start: '2026-10-11', target: '2026-10-14' }, // Story 4.17: Incident Response & On-Call Paging Spike
  26:  { start: '2026-10-12', target: '2026-10-15' }, // Story 4.4: Automated D1 Point-in-Time Recovery & R2 Snapshots
  209: { start: '2026-10-12', target: '2026-10-16' }, // Story 4.20: Playwright UI & Integration Test Suite Pipeline
  27:  { start: '2026-10-13', target: '2026-10-16' }, // Story 4.5: Workers Instant Rollback & Disaster Recovery Runbook
  153: { start: '2026-10-14', target: '2026-10-17' }, // Story 4.11: Cloudflare Browser Rendering Screen Tour
  173: { start: '2026-10-15', target: '2026-10-18' }, // Story 4.18: Rollback Integration Tests
  210: { start: '2026-10-15', target: '2026-10-18' }, // Story 4.21: Browser Rendering Ephemeral Preview Smoke Harness
  216: { start: '2026-10-15', target: '2026-10-18' }, // Story 4.22: Payload CMS Mutation & Storefront Test Harness
  148: { start: '2026-10-16', target: '2026-10-19' }, // Story 4.10: Drop Day High-Concurrency Load Testing
  226: { start: '2026-10-17', target: '2026-10-20' }, // Story 4.23: Production Promotion Deployment Integrity
  248: { start: '2026-10-18', target: '2026-10-20' }, // Story 4.24: Graceful Edge Timeout Interception & 504 Fallback

  // Phase 5: Security Hardening (Milestone Due: 2026-10-27)
  29:  { start: '2026-10-19', target: '2026-10-22' }, // Story 5.2: Payload CMS RBAC & Mandatory TOTP 2FA
  30:  { start: '2026-10-20', target: '2026-10-23' }, // Story 5.3: Secrets Management Audit & Wrangler Secrets Isolation
  56:  { start: '2026-10-21', target: '2026-10-24' }, // Story 5.5: Cloudflare Integration — WAF, CDN & DDoS Protection
  139: { start: '2026-10-22', target: '2026-10-25' }, // Story 5.6: Cloudflare Access (Zero Trust) Identity Gate
  165: { start: '2026-10-24', target: '2026-10-27' }, // Story 5.7: Cloudflare WAF Rulesets, Rate Limiting & False-Positive Mitigation

  // Phase 6+: Feature Enhancements (Milestone Due: 2026-11-15)
  32:  { start: '2026-10-29', target: '2026-11-05' }, // Story 6.1: Automated 1-Click Shipping Label Generation (Shippo)
  33:  { start: '2026-11-04', target: '2026-11-10' }, // Story 6.2: Drop Launch Waitlist & Alert System
  34:  { start: '2026-11-08', target: '2026-11-15' }, // Story 6.3: E-Commerce Analytics & Sales Reporting Dashboard
};

interface ProjectItem {
  id: string;
  content?: {
    number?: number;
    title?: string;
    state?: string;
    createdAt?: string;
    closedAt?: string;
  };
}

function runGhGql(query: string, variables: Record<string, any> = {}): any {
  const payload = JSON.stringify({ query, variables });
  const stdout = execSync(
    `gh api graphql --input -`,
    { input: payload, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  return JSON.parse(stdout);
}

function fetchAllProjectItems(): ProjectItem[] {
  const items: ProjectItem[] = [];
  let afterCursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const afterParam = afterCursor ? `, after: "${afterCursor}"` : '';
    const query = `
      query {
        user(login: "jacobmiller22") {
          projectV2(number: 4) {
            items(first: 100${afterParam}) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                content {
                  ... on Issue {
                    number
                    title
                    state
                    createdAt
                    closedAt
                  }
                  ... on PullRequest {
                    number
                    title
                    state
                    createdAt
                    closedAt
                  }
                }
              }
            }
          }
        }
      }
    `;

    const res = runGhGql(query);
    const connection = res.data.user.projectV2.items;
    items.push(...connection.nodes);
    hasNext = connection.pageInfo.hasNextPage;
    afterCursor = connection.pageInfo.endCursor;
  }

  return items;
}

function updateItemDate(itemId: string, fieldId: string, date: string) {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Date!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { date: $value }
        }
      ) {
        projectV2Item { id }
      }
    }
  `;

  runGhGql(mutation, {
    projectId: PROJECT_ID,
    itemId,
    fieldId,
    value: date,
  });
}

async function main() {
  console.log('📡 Fetching all items from GitHub Project #4...');
  const items = fetchAllProjectItems();
  console.log(`Found ${items.length} total project items.\n`);

  let openUpdated = 0;
  let closedUpdated = 0;

  for (const item of items) {
    if (!item.content || !item.content.number) continue;
    const num = item.content.number;
    const isClosed = item.content.state === 'CLOSED';

    if (SCHEDULE_MAP[num]) {
      // Open issue with explicitly planned schedule
      const { start, target } = SCHEDULE_MAP[num];
      process.stdout.write(`⏳ Setting Issue #${num} (${start} ➔ ${target})... `);
      try {
        updateItemDate(item.id, START_DATE_FIELD_ID, start);
        updateItemDate(item.id, TARGET_DATE_FIELD_ID, target);
        console.log('✅ Done');
        openUpdated++;
      } catch (err: any) {
        console.log(`❌ Error: ${err.message}`);
      }
    } else if (isClosed) {
      // Closed issue: set historical dates based on createdAt / closedAt
      const start = item.content.createdAt ? item.content.createdAt.slice(0, 10) : '2026-09-10';
      const target = item.content.closedAt ? item.content.closedAt.slice(0, 10) : '2026-09-13';
      try {
        updateItemDate(item.id, START_DATE_FIELD_ID, start);
        updateItemDate(item.id, TARGET_DATE_FIELD_ID, target);
        closedUpdated++;
      } catch {
        // Silently continue for closed items if already populated
      }
    }
  }

  console.log(`\n🎉 Schedule Population Complete!`);
  console.log(`- Open Issues Scheduled with Velocity & Buffers: ${openUpdated}`);
  console.log(`- Historical Completed Issues Backfilled: ${closedUpdated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
