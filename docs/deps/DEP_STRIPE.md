# Dependency Specification: Stripe Payments (`DEP_STRIPE.md`)

This document specifies the integration architecture, dynamic checkout specifications, raw webhook cryptographic verification, idempotency controls, and security procedures for **Stripe**, the payment SaaS provider for ChrisShop.

---

## 1. Service Overview & Architecture

- **Provider**: Stripe, Inc.
- **Integration Model**: **Stripe Hosted Checkout** with **Dynamic `price_data`** (zero database price synchronization needed).
- **PCI Compliance Level**: **SAQ-A** (100% hosted payment page; zero cardholder data touches ChrisShop servers).
- **Tax Automation**: Stripe Tax enabled (`automatic_tax: { enabled: true }`).
- **Webhook Target**: Next.js App Router API route `apps/web/src/app/api/webhooks/stripe/route.ts`.

---

## 2. Dynamic Checkout Creation API

Checkout sessions are created dynamically via `/api/checkout` from validated Directus database catalog items:

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

// Dynamic Checkout Session Creation
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [
    {
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(effectivePrice * 100), // in cents
        product_data: {
          name: `${product.title} - ${variation.variation_name}`,
          description: product.description?.slice(0, 500) || undefined,
          images: product.featured_image_url ? [product.featured_image_url] : [],
          metadata: {
            product_id: product.id,
            variation_id: variation.id,
            sku: variation.sku,
          },
        },
      },
      quantity: requestedQty,
    },
  ],
  automatic_tax: { enabled: true },
  shipping_address_collection: {
    allowed_countries: ['US', 'CA', 'GB', 'AU', 'EU'],
  },
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
  metadata: {
    reservation_id: sessionId,
    variation_id: variation.id,
  },
});
```

---

## 3. Webhook Signing & Cryptographic Verification

All inbound webhook events from Stripe MUST undergo raw-body cryptographic HMAC-SHA256 signature verification.

### 3.1 Raw Request Verification Workflow

Next.js App Router route handlers read the raw request text before parsing JSON:

```typescript
// apps/web/src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  // Enforce 300s Replay Window
  const eventAgeSeconds = Math.abs(Date.now() / 1000 - event.created);
  if (eventAgeSeconds > 300) {
    return NextResponse.json({ error: 'Webhook timestamp expired (>300s)' }, { status: 400 });
  }

  // Dispatch event processing with idempotency
  return handleStripeEvent(event);
}
```

---

## 4. Idempotency & Database Integrity

To prevent duplicate inventory decrements or double-order creation under network retries, every event is tracked in the `processed_stripe_events` table:

```sql
-- Schema of processed_stripe_events
CREATE TABLE processed_stripe_events (
  id VARCHAR(255) PRIMARY KEY, -- e.g. evt_1Oxyz...
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Deduplication Algorithm:

1. Query `processed_stripe_events WHERE id = :event_id`.
2. If row exists, immediately return HTTP 200 `{ received: true, duplicate: true }`.
3. If row does not exist, open an atomic PostgreSQL transaction (via Kysely):
   - Insert `event.id` into `processed_stripe_events`.
   - Insert order record into `orders`.
   - Insert line items into `order_items`.
   - Decrement `product_variations.stock_quantity`.
   - Commit transaction.

---

## 5. Handled Event Types & Operational Workflows

| Event Type                      | Business Action                                                                          | Downstream Integration                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `checkout.session.completed`    | Atomic inventory decrement, order creation in PostgreSQL, delete Redis reservation lock. | Discord alert to `#store-orders`; Resend customer receipt email. |
| `checkout.session.expired`      | Release stock reservation immediately (`DEL reservation:{variation_id}:{session_id}`).   | Returns reserved unit back to available pool.                    |
| `payment_intent.payment_failed` | Record payment error and reason.                                                         | Discord alert to `#dev-alerts`.                                  |
| `charge.refunded`               | Update `orders.order_status = 'refunded'`.                                               | Notify Chris via Directus dashboard.                             |

---

## 6. Reconciled Configuration Files & Monorepo Paths

| Path                                            | Status      | Scheduled Story | Description                                            |
| ----------------------------------------------- | ----------- | --------------- | ------------------------------------------------------ |
| `apps/web/src/app/api/webhooks/stripe/route.ts` | `[PLANNED]` | Story 3.2       | Stripe webhook ingestion endpoint                      |
| `apps/web/src/app/api/checkout/route.ts`        | `[PLANNED]` | Story 3.2       | Dynamic Stripe Checkout session generator              |
| `packages/types/src/index.ts`                   | `[EXISTS]`  | Phase 1         | Canonical TypeScript definitions for orders and events |
| `apps/web/tests/stripe.test.ts`                 | `[PLANNED]` | Story 3.2       | Unit and integration test suite for Stripe signatures  |

---

## 7. Operational Testing & CLI Commands

```bash
# Listen to Stripe webhooks locally and forward to Next.js API
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger simulated checkout.session.completed test event
stripe trigger checkout.session.completed

# Trigger simulated payment_intent.payment_failed test event
stripe trigger payment_intent.payment_failed

# Verify webhook endpoint security unit tests
pnpm --filter web test
```
