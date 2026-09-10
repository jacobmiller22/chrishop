# Dependency Specification: Stripe Payments (`DEP_STRIPE.md`)

This document specifies the integration, tooling, management scripts, and security procedures for **Stripe**, handling dynamic checkout sessions, SAQ-A PCI compliance, tax automation, and webhook event processing.

---

## 1. Service Overview & Architecture

- **Integration Pattern**: Stripe Checkout Hosted Sessions with dynamic `price_data` (zero database price synchronization needed).
- **PCI Compliance Level**: **SAQ-A** (100% hosted payment page).
- **Tax Automation**: Stripe Tax enabled (`automatic_tax: { enabled: true }`).
- **Webhook Target**: Storefront API route `/api/webhooks/stripe`.

---

## 2. Interaction Tools & Interfaces

- **SDK**: `stripe` Node.js SDK (`pnpm add stripe`)
- **CLI Tool**: Stripe CLI (`stripe listen`, `stripe trigger checkout.session.completed`)
- **Dashboard**: Stripe Dashboard UI (`https://dashboard.stripe.com`)

---

## 3. Webhook Security & Idempotency Rules

1. **Raw Body Signature Verification**: Next.js API route reads raw request buffer using `req.text()` and verifies signature via `stripe.webhooks.constructEvent(body, sig, secret)`.
2. **Replay Protection**: Rejects events with timestamps older than 300 seconds (5 minutes).
3. **Idempotency Table**: Direct SQL check against `processed_stripe_events` table using `evt.id` as primary key. Duplicate deliveries return HTTP 200 immediately without executing business logic.

---

## 4. Operational Commands & Integration Testing

- **Listen to Local Webhooks**: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- **Trigger Test Event**: `stripe trigger checkout.session.completed`
- **Integration Test Suite**: `pnpm --filter web test:stripe`
