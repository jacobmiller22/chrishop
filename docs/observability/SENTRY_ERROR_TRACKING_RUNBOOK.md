# Sentry Error Tracking Operational Runbook (`docs/observability/SENTRY_ERROR_TRACKING_RUNBOOK.md`)

This operational runbook defines the architecture, initialization files, context tagging, Discord `#dev-alerts` escalation policies, and incident triage playbooks for **ChrisShop** JavaScript error tracking using **Sentry** (free tier compatible).

---

## 1. Architectural Overview & Objectives (Story 4.6)

ChrisShop utilizes **Sentry** across three runtime tiers of the Next.js and Cloudflare Workers application:
1. **Client Tier (`sentry.client.config.ts`)**: Browser hydration errors, client React exceptions, network request errors.
2. **Server Tier (`sentry.server.config.ts`)**: Server-Side Rendering (SSR) exceptions, Node.js tooling, and Payload CMS backend processing.
3. **Edge Tier (`sentry.edge.config.ts`)**: Cloudflare Workers edge runtime (`workerd`), API routes, and middleware exceptions.

```
+-----------------------------------------------------------------------------------+
|                        ChrisShop Full-Stack Runtime Topology                      |
+-----------------------------------------------------------------------------------+
       │ (Browser Exceptions)      │ (Edge API / SSR)          │ (Admin / Payload)
       ▼                           ▼                           ▼
[sentry.client.config.ts]   [sentry.edge.config.ts]     [sentry.server.config.ts]
       │                           │                           │
       └───────────────────────────┼───────────────────────────┘
                                   │
                                   ▼
                     [apps/web/src/lib/sentry.ts]
                     ├── Context Enrichment (runtime, sha, route)
                     ├── captureException / captureMessage
                     └── Sentry Ingest (https://*.ingest.sentry.io)
                                   │
                    Critical / Fatal Alert Detected
                                   │
                                   ▼
                [Discord #dev-alerts Escalation Engine]
                ├── Rich Crimson Embed (0xef4444 / 0x991b1b)
                ├── Event ID & Stack Trace Snippet
                └── Deep Link to Sentry Issue Dashboard
```

---

## 2. Configuration Files & Runtime Matrix

| Configuration File | Target Runtime | Sampling Rate | Primary Error Scope |
| :--- | :--- | :--- | :--- |
| `apps/web/sentry.client.config.ts` | Browser / React 19 Client | 10% Prod / 100% Dev | UI crashes, React hydration failures, client checkout errors |
| `apps/web/sentry.server.config.ts` | Node.js Server Environment | 10% Prod / 100% Dev | SSR compilation, database migrations, Payload CMS admin |
| `apps/web/sentry.edge.config.ts` | Cloudflare Workers (`workerd`) | 10% Prod / 100% Dev | Edge API routes, KV cache lookup failures, D1 query errors |

---

## 3. Environment Variables & Secrets Configuration

| Variable | Environment | Purpose | Example / Format |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SENTRY_DSN` | Client & Server | Public ingestion DSN | `https://<key>@o<org>.ingest.sentry.io/<proj>` |
| `SENTRY_DSN` | Server & Edge | Private backend ingestion DSN | `https://<key>@o<org>.ingest.sentry.io/<proj>` |
| `SENTRY_AUTH_TOKEN` | CI/CD Pipeline | Source map upload authentication | Sentry User / Org Auth Token |
| `SENTRY_ORG` | CI/CD Pipeline | Sentry organization identifier | `chrishop-gear` |
| `SENTRY_PROJECT` | CI/CD Pipeline | Sentry project identifier | `chrishop` |
| `DISCORD_WEBHOOK_DEV_ALERTS` | Edge Runtime | Webhook target for `#dev-alerts` | `https://discord.com/api/webhooks/...` |

---

## 4. Discord `#dev-alerts` Error Escalation Policy

When an unhandled exception or fatal system event is captured:
1. `captureException(err, { dispatchDiscordAlert: true })` or `{ level: 'fatal' }` formats a rich embed:
   - **Header**: `🚨 [Sentry Error Alert] <ErrorType>: <Message>`
   - **Color**: `0xef4444` (Error) or `0x991b1b` (Fatal)
   - **Fields**:
     - `Event ID`: Sentry UUID (e.g. `evt-8f4b1...`)
     - `Environment`: `production` / `staging`
     - `Runtime`: `cloudflare-workers` / `node`
     - `Request URL`: Path of the failing request
     - `Stack Trace`: Formatted 6-frame stack snippet in codeblock
2. Alert dispatches out-of-band to prevent adding latency to user requests.

---

## 5. Content-Security-Policy (CSP) Integration

To allow browser clients to communicate with Sentry without CSP violations, `apps/web/next.config.mjs` explicitly whitelists Sentry ingestion endpoints in `connect-src`:

```http
Content-Security-Policy: ... connect-src 'self' https: https://*.ingest.sentry.io https://*.ingest.us.sentry.io; ...
```

---

## 6. CLI Verification & Commands

```bash
# Verify Sentry configuration files, context enrichment, and Discord embed formatting
pnpm run sentry:verify
```

---

## 7. Incident Response & Triage Playbook

When an error notification fires in Discord `#dev-alerts`:

1. **Locate the Event**:
   - Copy the `Event ID` from the alert.
   - Search for the event in the Sentry dashboard: `https://sentry.io/organizations/chrishop-gear/issues/`.
2. **Inspect Context Tags**:
   - Check `runtime`: If `cloudflare-worker`, check Cloudflare Workers tail logs or metrics.
   - Check `release`: Verify if the error started immediately after a recent deployment.
3. **Execute Immediate Mitigation**:
   - If an error surge is causing widespread customer impact, execute instant worker rollback:
     ```bash
     pnpm run rollback
     ```
   - If error is isolated to a specific product or drop, toggle maintenance or preview flags.
