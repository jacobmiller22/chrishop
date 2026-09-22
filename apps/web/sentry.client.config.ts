/**
 * Sentry Client-Side Initialization Configuration
 *
 * Captures uncaught frontend JavaScript exceptions, hydration errors,
 * and user-facing UI failures per Story 4.6 (#65).
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

export const isSentryEnabled = Boolean(
  SENTRY_DSN && !SENTRY_DSN.includes('placeholder')
);

if (isSentryEnabled) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development',
    release:
      process.env.NEXT_PUBLIC_COMMIT_SHA ||
      process.env.COMMIT_SHA ||
      'dev-local',
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.05,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  });
}
