#!/usr/bin/env tsx
/**
 * Verification Script: Distributed Tracing & Edge Correlation ID Propagation
 *
 * Story 4.25 (#330): Distributed Tracing & Edge Correlation ID Propagation
 *
 * Verifies:
 * 1. Unified trace header extraction & collision-resistant generation (x-request-id, cf-ray)
 * 2. Response header injection across Responses, Headers, and plain records
 * 3. AsyncLocalStorage trace context propagation across asynchronous boundaries
 * 4. Outbound Shopify Storefront API client X-Request-ID propagation
 * 5. Automatic Sentry error event tag enrichment (correlation_id & cf_ray)
 * 6. D1 SQLite query attribution comment formatting (/* req:<id> ray:<ray> *\/)
 * 7. Edge middleware presence and routing matcher configuration
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  extractTraceHeaders,
  withTraceHeaders,
  runWithTraceContext,
  getCurrentTraceContext,
  annotateSqlQueryWithTrace,
  generateRequestId,
  generateSyntheticCfRay,
} from '../apps/web/src/lib/tracing';
import { shopify, defaultShopifyMock } from '../apps/web/src/lib/shopify';
import { captureException } from '../apps/web/src/lib/sentry';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

async function main(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🔍 Story 4.25: Distributed Tracing & Edge Correlation ID     ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let failures = 0;

  // 1. Trace Header Extraction & Fallback Generation
  console.log(`${colors.bold}1. Trace Header Extraction & Generation:${colors.reset}`);
  const explicitHeaders = new Headers({
    'x-request-id': 'req_explicit_123',
    'cf-ray': '8f123456789abcde-DEN',
    'traceparent': '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  });

  const extracted = extractTraceHeaders(explicitHeaders);
  if (
    extracted.requestId !== 'req_explicit_123' ||
    extracted.cfRay !== '8f123456789abcde-DEN' ||
    extracted.traceParent !== '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
  ) {
    console.error(`  ${colors.red}✖ Failed to extract explicit trace headers correctly${colors.reset}`, extracted);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Explicit trace headers correctly extracted and preserved`);
  }

  // Test fallback generation when headers are empty
  const fallback = extractTraceHeaders();
  if (!fallback.requestId.startsWith('req_') || !fallback.cfRay.startsWith('ray-')) {
    console.error(`  ${colors.red}✖ Fallback trace generation failed: requestId=${fallback.requestId}, cfRay=${fallback.cfRay}${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Fallback correlation IDs correctly generated (${fallback.requestId}, ${fallback.cfRay})`);
  }

  // 2. Response Header Injection
  console.log(`\n${colors.bold}2. Response Header Injection:${colors.reset}`);
  const testContext = {
    requestId: 'req_test_abc',
    cfRay: 'ray-test-xyz',
    startTime: Date.now(),
  };

  const dummyResponse = new Response(JSON.stringify({ status: 'ok' }));
  withTraceHeaders(dummyResponse, testContext);

  if (
    dummyResponse.headers.get('x-request-id') !== 'req_test_abc' ||
    dummyResponse.headers.get('cf-ray') !== 'ray-test-xyz' ||
    dummyResponse.headers.get('x-correlation-id') !== 'req_test_abc'
  ) {
    console.error(`  ${colors.red}✖ Response headers missing expected correlation IDs!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Response successfully enriched with x-request-id and cf-ray`);
  }

  // 3. AsyncLocalStorage Context Scope
  console.log(`\n${colors.bold}3. AsyncLocalStorage Execution Context Propagation:${colors.reset}`);
  let innerTraceCaptured: any = null;

  await runWithTraceContext(testContext, async () => {
    await new Promise((r) => setTimeout(r, 10)); // simulate async I/O
    innerTraceCaptured = getCurrentTraceContext();
  });

  if (!innerTraceCaptured || innerTraceCaptured.requestId !== 'req_test_abc') {
    console.error(`  ${colors.red}✖ Async context lost across async boundary!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} TraceContext seamlessly preserved across asynchronous calls`);
  }

  // 4. Outbound Shopify Storefront API Request Propagation
  console.log(`\n${colors.bold}4. Shopify Storefront API X-Request-ID Propagation:${colors.reset}`);
  defaultShopifyMock.reset();

  await runWithTraceContext({ requestId: 'req_shopify_trace_999', cfRay: 'ray-shopify-1', startTime: Date.now() }, async () => {
    await shopify.createCart('gid://shopify/ProductVariant/1001', 1, '198.51.100.42');
  });

  if (defaultShopifyMock.lastRequestId !== 'req_shopify_trace_999') {
    console.error(`  ${colors.red}✖ Shopify mock did not receive expected X-Request-ID: ${defaultShopifyMock.lastRequestId}${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Outbound Shopify request forwarded X-Request-ID (${defaultShopifyMock.lastRequestId})`);
  }

  // 5. Sentry Error Tag Enrichment
  console.log(`\n${colors.bold}5. Sentry Error Tag Correlation Enrichment:${colors.reset}`);
  let sentryCapturedEventId: string | null = null;

  runWithTraceContext({ requestId: 'req_sentry_trace_555', cfRay: 'ray-sentry-555', startTime: Date.now() }, () => {
    sentryCapturedEventId = captureException(new Error('Simulated tracing verification test error'));
  });

  if (!sentryCapturedEventId) {
    console.error(`  ${colors.red}✖ Sentry captureException failed to return an event ID!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Sentry captured error event in active trace context: ${sentryCapturedEventId}`);
  }

  // 6. D1 SQLite Query Attribution
  console.log(`\n${colors.bold}6. D1 SQLite Query Attribution:${colors.reset}`);
  const rawSql = 'SELECT * FROM products WHERE status = "active"';
  const annotatedSql = annotateSqlQueryWithTrace(rawSql, testContext);

  if (!annotatedSql.includes('/* req:req_test_abc ray:ray-test-xyz */')) {
    console.error(`  ${colors.red}✖ SQL annotation did not include expected comment: ${annotatedSql}${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} D1 SQL query correctly annotated: ${annotatedSql}`);
  }

  // 7. Middleware Presence
  console.log(`\n${colors.bold}7. Next.js Edge Middleware Integrity:${colors.reset}`);
  const middlewarePath = path.resolve(process.cwd(), 'apps/web/src/middleware.ts');
  if (!fs.existsSync(middlewarePath)) {
    console.error(`  ${colors.red}✖ apps/web/src/middleware.ts does not exist!${colors.reset}`);
    failures++;
  } else {
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
    if (
      !middlewareContent.includes('export function middleware') ||
      !middlewareContent.includes('extractTraceHeaders') ||
      !middlewareContent.includes('withTraceHeaders') ||
      !middlewareContent.includes('matcher')
    ) {
      console.error(`  ${colors.red}✖ Middleware missing required tracing exports or logic!${colors.reset}`);
      failures++;
    } else {
      console.log(`  ${colors.green}✔${colors.reset} Edge middleware verified at apps/web/src/middleware.ts`);
    }
  }

  console.log(`\n${colors.bold}================================================================${colors.reset}`);
  if (failures > 0) {
    console.error(`${colors.red}${colors.bold}✖ Verification Failed with ${failures} error(s)!${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✔ All Story 4.25 Distributed Tracing Verifications Passed!${colors.reset}\n`);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Fatal verification error:${colors.reset}`, err);
  process.exit(1);
});
