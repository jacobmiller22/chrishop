# Dependency Specification: Discord Notification Engine (`DEP_DISCORD.md`)

This document specifies the integration, tooling, management scripts, and operational procedures for the **Discord Notification Engine**, providing real-time operational, inventory, drop launch, and order alerts.

---

## 1. Service Overview & Architecture

- **Platform**: Discord Webhook & Bot API
- **Module Path**: `packages/notifications`
- **Target Channels**:
  - `#store-orders`: New purchase notifications & low-stock alerts (`stock_quantity <= 3`).
  - `#dev-alerts`: Deployment events, uptime health check failures, and Sentry runtime errors.

---

## 2. Interface Contract (`packages/notifications`)

```typescript
export interface NotificationPayload {
  title: string;
  message: string;
  fields?: Record<string, string>;
  severity?: 'info' | 'success' | 'warning' | 'error';
}

export class DiscordNotificationProvider implements NotificationProvider {
  constructor(private webhookUrl: string) {}
  async send(payload: NotificationPayload): Promise<void> {
    // Formats rich Discord Embed with color-coded severity border
  }
}
```

---

## 3. Rich Embed Layout Specifications

- **Success / Order Color**: Green (`0x2ECC71`)
  - Title: `🛒 New Order #1042`
  - Fields: `Customer: Jane Doe`, `Items: Midnight Gold Edition (Qty: 1)`, `Total: $150.00`
- **Warning / Low Stock Color**: Yellow (`0xF1C40F`)
  - Title: `⚠️ Low Stock Warning`
  - Fields: `Variation: Midnight Gold Edition`, `Remaining Stock: 2`
- **Error / Deployment Color**: Red (`0xE74C3C`)
  - Title: `🚨 Health Check Failed`
  - Fields: `Service: Web App`, `Endpoint: /api/health`, `Status: 500`

---

## 4. Operational Commands & Integration Testing

- **Trigger Test Embed**: `pnpm --filter notifications test:discord`
- **Webhook Validation**: Send test POST payload and verify 204 response.
