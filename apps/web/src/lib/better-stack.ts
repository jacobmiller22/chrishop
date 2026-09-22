/**
 * Better Stack Uptime Monitoring & Heartbeat Probing Engine
 *
 * Implements external synthetic probe specifications, incident webhook parsing,
 * Discord #dev-alerts alert formatting, and public status page configuration.
 *
 * Conforms to docs/HIGH_LEVEL_DESIGN.md Section 9 and Story 4.7.
 */

export const BETTER_STACK_API_BASE = 'https://uptime.betterstack.com/api/v2';
export const DEFAULT_CHECK_FREQUENCY_SECONDS = 60; // Standard 60-second polling cadence
export const DEFAULT_TIMEOUT_SECONDS = 5;
export const EXPECTED_KEYWORD = '"status":"healthy"';

export interface BetterStackMonitorConfig {
  id?: string;
  name: string;
  url: string;
  monitorType: 'status' | 'expected_status_code' | 'keyword';
  checkFrequencySeconds: number;
  requestTimeoutSeconds: number;
  httpMethod: 'GET';
  expectedStatusCode: number;
  keywordToFind?: string;
  pronounceableName?: string;
  regions?: string[];
  alertChannels?: string[];
}

export interface BetterStackIncidentWebhook {
  event: 'incident.started' | 'incident.resolved' | 'incident.acknowledged';
  incident: {
    id: string;
    name: string;
    url: string;
    cause?: string;
    started_at: string;
    resolved_at?: string;
    response_datetime?: string;
    http_status_code?: number;
    region?: string;
    origin?: string;
  };
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
 * Returns standard production Better Stack monitor configuration.
 */
export function getProductionMonitorConfig(
  domain = 'chrishop.jacobmiller22.com'
): BetterStackMonitorConfig {
  return {
    name: 'ChrisShop Production Edge Health (/api/health)',
    url: `https://${domain}/api/health`,
    monitorType: 'status',
    checkFrequencySeconds: DEFAULT_CHECK_FREQUENCY_SECONDS,
    requestTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    httpMethod: 'GET',
    expectedStatusCode: 200,
    keywordToFind: EXPECTED_KEYWORD,
    pronounceableName: 'ChrisShop Production Storefront',
    regions: ['us', 'eu', 'as'],
  };
}

/**
 * Returns standard staging Better Stack monitor configuration.
 */
export function getStagingMonitorConfig(
  domain = 'staging-chrishop.jacobmiller22.com'
): BetterStackMonitorConfig {
  return {
    name: 'ChrisShop Staging Edge Health (/api/health)',
    url: `https://${domain}/api/health`,
    monitorType: 'status',
    checkFrequencySeconds: DEFAULT_CHECK_FREQUENCY_SECONDS,
    requestTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    httpMethod: 'GET',
    expectedStatusCode: 200,
    keywordToFind: EXPECTED_KEYWORD,
    pronounceableName: 'ChrisShop Staging Storefront',
    regions: ['us'],
  };
}

/**
 * Compiles monitor creation payload for the Better Stack REST API.
 */
export function generateBetterStackMonitorPayload(config: BetterStackMonitorConfig) {
  return {
    url: config.url,
    monitor_type: 'status',
    check_frequency: config.checkFrequencySeconds,
    request_timeout: config.requestTimeoutSeconds,
    http_method: config.httpMethod,
    expected_status_codes: [config.expectedStatusCode],
    required_keyword: config.keywordToFind,
    pronounceable_name: config.pronounceableName || config.name,
    regions: config.regions || ['us', 'eu'],
    paused: false,
    follow_redirects: true,
  };
}

/**
 * Compiles public status page specification for platform transparency.
 */
export function generateBetterStackStatusPagePayload(domain = 'status.chrishop.com') {
  return {
    company_name: 'ChrisShop (BankBeaters Adventure Gear)',
    subdomain: 'chrishop',
    custom_domain: domain,
    timezone: 'America/New_York',
    sections: [
      {
        name: 'Storefront & Customer Services',
        resources: [
          { name: 'Edge Storefront (Next.js 16 App Router)', status: 'operational' },
          { name: 'Checkout & Cart API', status: 'operational' },
          { name: 'R2 Static Media Assets', status: 'operational' },
        ],
      },
      {
        name: 'Core Infrastructure & Dependencies',
        resources: [
          { name: 'Edge Worker Runtime (Cloudflare Workers)', status: 'operational' },
          { name: 'Edge Database (Cloudflare D1 SQLite)', status: 'operational' },
          { name: 'Global KV Cache (Workers KV)', status: 'operational' },
          { name: 'Shopify Storefront API Integration', status: 'operational' },
        ],
      },
      {
        name: 'Administrative & Security Systems',
        resources: [
          { name: 'Payload CMS Admin Dashboard (/admin)', status: 'operational' },
          { name: 'Cloudflare Zero Trust Access Gate', status: 'operational' },
        ],
      },
    ],
  };
}

/**
 * Formats a Better Stack incident webhook into a rich Discord alert payload.
 */
export function formatBetterStackDiscordAlert(
  payload: BetterStackIncidentWebhook
): DiscordWebhookPayload {
  const isDown = payload.event === 'incident.started';
  const isResolved = payload.event === 'incident.resolved';

  const color = isDown ? 0xef4444 : isResolved ? 0x10b981 : 0xf59e0b;
  const statusEmoji = isDown ? '🚨' : isResolved ? '✅' : '⚠️';
  const statusLabel = isDown ? 'DOWN' : isResolved ? 'RESOLVED' : 'ACKNOWLEDGED';

  const fields: DiscordEmbedField[] = [
    { name: 'Monitor', value: `\`${payload.incident.name}\``, inline: true },
    { name: 'Target URL', value: `[${payload.incident.url}](${payload.incident.url})`, inline: true },
    { name: 'Status', value: `\`${statusLabel}\``, inline: true },
  ];

  if (payload.incident.http_status_code) {
    fields.push({
      name: 'HTTP Status',
      value: `\`${payload.incident.http_status_code}\``,
      inline: true,
    });
  }

  if (payload.incident.region) {
    fields.push({
      name: 'Probe Region',
      value: `\`${payload.incident.region.toUpperCase()}\``,
      inline: true,
    });
  }

  if (payload.incident.cause) {
    fields.push({
      name: 'Incident Cause',
      value: `\`${payload.incident.cause}\``,
      inline: false,
    });
  }

  if (isResolved && payload.incident.started_at && payload.incident.resolved_at) {
    const start = new Date(payload.incident.started_at).getTime();
    const end = new Date(payload.incident.resolved_at).getTime();
    const durationMin = ((end - start) / 60000).toFixed(1);
    fields.push({
      name: 'Downtime Duration',
      value: `\`${durationMin} minutes\``,
      inline: true,
    });
  }

  return {
    content: `${statusEmoji} **[Better Stack Uptime Alert] ${payload.incident.name}: ${statusLabel}**`,
    embeds: [
      {
        title: `${statusEmoji} Monitor ${statusLabel}: ${payload.incident.name}`,
        color,
        description: isDown
          ? `External heartbeat monitor detected outage on \`${payload.incident.url}\` within 60 seconds.`
          : `Edge health check probe restored to operational state on \`${payload.incident.url}\`.`,
        fields,
        timestamp: payload.incident.resolved_at || payload.incident.started_at || new Date().toISOString(),
        footer: { text: 'ChrisShop Better Stack Uptime Monitoring • #dev-alerts' },
      },
    ],
  };
}

/**
 * Dispatches a formatted Better Stack incident alert to Discord #dev-alerts.
 */
export async function dispatchBetterStackAlertToDiscord(
  payload: BetterStackIncidentWebhook,
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

  const discordPayload = formatBetterStackDiscordAlert(payload);

  try {
    const fetchImpl = globalThis.fetch;
    const res = await fetchImpl(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload),
    });
    return res.ok;
  } catch (err) {
    console.error('[BetterStack:DiscordAlertError]', err);
    return false;
  }
}
