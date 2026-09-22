/**
 * Sentry Server-Side Initialization Configuration
 *
 * Captures backend Node.js and SSR exceptions in Next.js App Router per Story 4.6 (#65).
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN =
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

export const isSentryEnabled = Boolean(
  SENTRY_DSN && !SENTRY_DSN.includes('placeholder')
);

if (isSentryEnabled) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment:
      process.env.APP_ENV || process.env.NODE_ENV || 'development',
    release:
      process.env.COMMIT_SHA ||
      process.env.NEXT_PUBLIC_COMMIT_SHA ||
      'dev-local',
  });
}
