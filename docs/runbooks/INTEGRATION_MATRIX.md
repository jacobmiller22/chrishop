# Operational Runbook: Composable Infrastructure & Dynamic Integration Matrix (`docs/runbooks/INTEGRATION_MATRIX.md`)

- **Owner**: Platform Engineering & Infrastructure Operations
- **Scope**: Multi-Cloud Subsystem Configuration, D1 Remote HTTP Proxy, and Developer Workflows
- **Related Stories**: Story 2.31 ([#143](https://github.com/jacobmiller22/chrishop/issues/143))
- **Configuration Schema**: `packages/config/src/matrix.ts` / `chrishop.matrix.ts`

---

## 1. Overview & Architecture

The **ChrisShop Integration Matrix** decouples developer environments from fixed infrastructure silos. It allows engineers to selectively mix and match local emulators and live remote Cloudflare/Shopify services across six primary subsystems:

1. **Storefront Presentation**: Local Next.js server, ephemeral PR preview worker, staging edge, or production edge.
2. **Cloudflare D1 Database**: Local SQLite file, Miniflare memory, staging remote D1, or production remote D1 (read-only protected).
3. **Workers KV Cache**: Local in-memory store, Miniflare disk persistence, staging KV namespace, or production KV namespace.
4. **Cloudflare R2 Media Storage**: Local filesystem mock, Miniflare S3 bucket, staging R2 bucket, or production R2 bucket.
5. **Shopify Integration**: In-memory WireMock engine, Shopify Partner Development Store, or Live Production Store.
6. **Notification Delivery**: In-memory test sink, Staging Discord/Slack webhook, or Production Resend/Discord channels.

---

## 2. Standard Integration Profiles

ChrisShop ships with three pre-configured, production-ready profiles:

| Profile Identifier | Storefront | Cloudflare D1 | KV Cache | R2 Media | Shopify Engine | Notifications | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`local-offline`** *(default)* | Local (3000) | Local SQLite | In-Memory | Mock Filesystem | In-Process WireMock | In-Memory Mock | Airplane mode, hermetic CI runs, unit tests |
| **`hybrid-staging`** | Local (3000) | Staging Remote D1 | Staging Remote KV | Staging Remote R2 | Shopify Dev Store | Staging Discord Webhook | Full integration testing against real staging data |
| **`prod-readonly-probe`** | Local (3000) | Production Remote D1 *(Read-Only)* | Production Remote KV | Production Remote R2 | Production Storefront | In-Memory Mock | Investigating production catalog issues safely |

---

## 3. Production Safety Guardrails & Write-Protection

> [!CAUTION]
> Direct local access to production databases carries catastrophic risk if uncontrolled. The Integration Matrix implements hard, un-bypassable runtime guardrails.

### Automatic Read-Only Lock
Whenever the `production-remote` D1 target is active, the database connection is initialized with `readOnly: true` by default.

### SQL Mutation Interception
All SQL queries executed through the remote D1 HTTP proxy are inspected by the `assertSafeSql` parser before transmission:
- **Forbidden Operations**: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `REPLACE`, `TRUNCATE`.
- If a mutating query is detected while `readOnly: true`, the driver instantly aborts and throws a `ProductionWriteForbiddenError`:
  ```text
  ProductionWriteForbiddenError: Mutating SQL operation (INSERT) is forbidden under read-only matrix profile.
  ```

### Emergency Override Protocol
In extreme disaster recovery scenarios where manual production mutations are required from an operator terminal:
1. Provide explicit environment flag `ALLOW_PROD_WRITES=true`.
2. Provide CLI flag `--allow-prod-writes`.
3. All write operations will be recorded in the audit log.

---

## 4. Developer CLI Usage

### Launching Local Dev with a Matrix Profile

Select any profile via the `--profile` flag:

```bash
# 1. Default local offline development (100% hermetic)
pnpm dev

# 2. Connect to remote staging Cloudflare services and Shopify dev store
pnpm dev --profile hybrid-staging

# 3. Read-only probe connected to production Cloudflare D1
pnpm dev --profile prod-readonly-probe
```

Alternatively, specify via the `MATRIX_PROFILE` environment variable:

```bash
MATRIX_PROFILE=hybrid-staging pnpm dev
```

---

## 5. Automated Test Harness Integration

Integration test suites can programmatically assert behavior across different profiles using the `withMatrixProfile` test helper:

```typescript
import { withMatrixProfile } from '@chrishop/config';
import { getProducts } from '../../apps/web/src/lib/catalog';

describe('Catalog Matrix Scenarios', () => {
  it('should fetch catalog under local-offline profile', async () => {
    await withMatrixProfile('local-offline', async (config) => {
      assert.equal(config.subsystems.shopify, 'mock');
      const products = await getProducts();
      assert.ok(products.length > 0);
    });
  });

  it('should enforce read-only safety under prod-readonly-probe', async () => {
    await withMatrixProfile('prod-readonly-probe', async (config) => {
      assert.equal(config.subsystems.databaseD1.readOnly, true);
    });
  });
});
```

---

## 6. Remote Cloudflare D1 HTTP REST Proxy

When connecting to remote D1 databases (`staging-remote` or `production-remote`) from a developer workstation outside the Cloudflare Workers isolate:

1. The runtime instantiates `createRemoteD1Client` from `@chrishop/config`.
2. Queries are dispatched securely over HTTPS to:
   ```http
   POST https://api.cloudflare.com/client/v4/accounts/:accountId/d1/database/:databaseId/query
   Authorization: Bearer :apiToken
   Content-Type: application/json
   ```
3. The response is translated transparently into the standard `D1DatabaseLike` interface (`prepare`, `bind`, `first`, `all`, `run`, `exec`, `batch`), providing identical syntax to native Cloudflare Workers edge bindings.
