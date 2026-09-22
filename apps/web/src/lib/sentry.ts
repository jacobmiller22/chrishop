/**
 * ChrisShop Sentry Error Tracking & Edge Alerting Engine
 *
 * Story 4.6 (#65): Sentry Error Tracking Integration
 *
 * Provides unified error capture, edge-to-Discord escalation, and Sentry webhook parsing
 * across Next.js App Router and Cloudflare Workers runtimes per docs/HIGH_LEVEL_DESIGN.md Section 9.
 */

import * as Sentry from '@sentry/nextjs';
import { getCurrentTraceContext } from './tracing';

export interface SentryErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  level?: 'fatal' | 'error' | 'warning' | 'info';
  user?: { id?: string; email?: string; ip_address?: string };
  fingerprint?: string[];
  dispatchDiscordAlert?: boolean;
}

export interface SentryIncidentPayload {
  eventId: string;
  message: string;
  errorType?: string;
  stack?: string;
  url?: string;
  environment?: string;
  runtime?: string;
  timestamp?: string;
  level?: string;
  tags?: Record<string, string>;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordWebhookPayload {
  content: string;
  embeds: Array<{
    title: string;
    color: number;
    description: string;
    fields?: DiscordEmbedField[];
    timestamp: string;
    footer?: { text: string };
  }>;
}

/**
 * Checks if Sentry is actively enabled via non-placeholder DSN.
 */
export function isSentryConfigured(): boolean {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  return Boolean(dsn && !dsn.includes('placeholder'));
}

/**
 * Captures an exception, records tags/context, and optionally dispatches an immediate alert.
 */
export function captureException(
  error: unknown,
  context?: SentryErrorContext
): string {
  const currentTrace = getCurrentTraceContext();
  const correlationId =
    context?.tags?.correlation_id ||
    context?.tags?.['x-request-id'] ||
    currentTrace?.requestId;
  const cfRay =
    context?.tags?.cf_ray ||
    context?.tags?.['cf-ray'] ||
    currentTrace?.cfRay;

  const enrichedTags: Record<string, string> = {
    runtime: typeof (globalThis as any).WebSocketPair !== 'undefined' ? 'cloudflare-worker' : 'node',
    service: 'chrishop-storefront',
    ...(correlationId ? { correlation_id: correlationId } : {}),
    ...(cfRay ? { cf_ray: cfRay } : {}),
    ...context?.tags,
  };

  const eventId = isSentryConfigured()
    ? Sentry.captureException(error, {
        tags: enrichedTags,
        extra: context?.extra,
        level: context?.level || 'error',
        user: context?.user,
        fingerprint: context?.fingerprint,
      })
    : `mock-sentry-evt-${Date.now().toString(36)}`;

  // Automatically trigger Discord alert on fatal or critical errors if requested
  if (context?.dispatchDiscordAlert || context?.level === 'fatal') {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const incident: SentryIncidentPayload = {
      eventId,
      message: errObj.message,
      errorType: errObj.name,
      stack: errObj.stack,
      level: context?.level || 'error',
      environment: process.env.APP_ENV || process.env.NODE_ENV || 'production',
      runtime: typeof (globalThis as any).WebSocketPair !== 'undefined' ? 'cloudflare-worker' : 'node',
      timestamp: new Date().toISOString(),
      tags: enrichedTags,
    };

    // Asynchronously dispatch to avoid blocking the request path
    dispatchSentryAlertToDiscord(incident).catch((dispatchErr) => {
      console.warn('[Sentry:DiscordAlertFailed]', dispatchErr);
    });
  }

  return eventId;
}

/**
 * Captures a structured log message in Sentry.
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' = 'info',
  context?: SentryErrorContext
): string {
  if (isSentryConfigured()) {
    return Sentry.captureMessage(message, {
      level,
      tags: context?.tags,
      extra: context?.extra,
    });
  }
  return `mock-sentry-msg-${Date.now().toString(36)}`;
}

/**
 * Formats a Sentry error incident into a high-visibility Discord embed for #dev-alerts.
 */
export function formatSentryDiscordAlert(
  incident: SentryIncidentPayload
): DiscordWebhookPayload {
  const isFatal = incident.level === 'fatal';
  const color = isFatal ? 0x991b1b : 0xef4444; // Dark Red for fatal, Crimson for error
  const title = `🚨 [Sentry Error Alert] ${incident.errorType || 'Application Error'}: ${incident.message}`;

  const fields: DiscordEmbedField[] = [
    { name: 'Event ID', value: `\`${incident.eventId}\``, inline: true },
    { name: 'Environment', value: `\`${incident.environment || 'production'}\``, inline: true },
    { name: 'Runtime', value: `\`${incident.runtime || 'cloudflare-workers'}\``, inline: true },
  ];

  if (incident.url) {
    fields.push({ name: 'Request URL', value: `\`${incident.url}\``, inline: false });
  }

  if (incident.tags && Object.keys(incident.tags).length > 0) {
    const formattedTags = Object.entries(incident.tags)
      .map(([k, v]) => `• **${k}**: \`${v}\``)
      .join('\n');
    fields.push({ name: 'Tags', value: formattedTags, inline: false });
  }

  if (incident.stack) {
    // Truncate stack trace to fit cleanly in Discord embed (max 800 characters)
    const truncatedStack =
      incident.stack.length > 800
        ? incident.stack.slice(0, 800) + '\n... [truncated]'
        : incident.stack;
    fields.push({
      name: 'Stack Trace',
      value: `\`\`\`javascript\n${truncatedStack}\n\`\`\``,
      inline: false,
    });
  }

  return {
    content: `🚨 **[Sentry Exception] Unhandled Error Detected in Production** (\`${incident.eventId}\`)`,
    embeds: [
      {
        title,
        color,
        description: `An unhandled exception was captured and forwarded to the Sentry dashboard for investigation.`,
        fields,
        timestamp: incident.timestamp || new Date().toISOString(),
        footer: { text: 'ChrisShop Sentry Error Tracking • #dev-alerts' },
      },
    ],
  };
}

/**
 * Dispatches a formatted Sentry incident alert to Discord #dev-alerts.
 */
export async function dispatchSentryAlertToDiscord(
  incident: SentryIncidentPayload,
  webhookUrl?: string
): Promise<boolean> {
  const targetUrl =
    webhookUrl ||
    process.env.DISCORD_WEBHOOK_DEV_ALERTS ||
    process.env.DISCORD_WEBHOOK_ALERTS ||
    process.env.OPS_ALERT_WEBHOOK_URL;

  if (!targetUrl) {
    return false;
  }

  const payload = formatSentryDiscordAlert(incident);

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('[Sentry:DiscordDispatchError]', err);
    return false;
  }
}

/**
 * Parses an incoming Sentry Alert Webhook payload (dispatched by Sentry alert rules).
 */
export function parseSentryWebhookPayload(body: any): SentryIncidentPayload {
  const event = body.event || body.data?.event || body;
  const issue = body.data?.issue || {};

  return {
    eventId: event.event_id || event.id || `sentry-${Date.now()}`,
    message: event.title || event.message || issue.title || 'Unknown Sentry Exception',
    errorType: event.type || event.metadata?.type || issue.type || 'Error',
    stack: event.entries?.find((e: any) => e.type === 'exception')?.data?.values?.[0]?.stacktrace?.frames
      ? formatFramesToStack(event.entries.find((e: any) => e.type === 'exception').data.values[0].stacktrace.frames)
      : undefined,
    url: event.web_url || issue.web_url || event.request?.url,
    environment: event.environment || 'production',
    runtime: event.tags?.find((t: any) => t[0] === 'runtime')?.[1] || 'cloudflare-workers',
    timestamp: event.received ? new Date(event.received * 1000).toISOString() : new Date().toISOString(),
    level: event.level || 'error',
    tags: Array.isArray(event.tags)
      ? Object.fromEntries(event.tags)
      : (event.tags || {}),
  };
}

function formatFramesToStack(frames: any[]): string {
  return frames
    .slice(-6)
    .map((f: any) => `  at ${f.function || 'anonymous'} (${f.filename || 'unknown'}:${f.lineno || 0}:${f.colno || 0})`)
    .join('\n');
}
