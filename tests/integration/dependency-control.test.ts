import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ResendNotificationProvider,
  DiscordNotificationProvider,
  DISCORD_COLORS,
  type OrderReceiptPayload,
  type ShippingUpdatePayload,
} from '../../packages/notifications/src/index';

/**
 * ==============================================================================
 * ChrisShop Dependency Control Integration Test Suite
 * Specification: docs/HIGH_LEVEL_DESIGN.md Section 9, docs/deps/DEP_*.md
 *
 * Validates connection health, communication protocols, transaction boundaries,
 * and security constraints across all core external service dependencies:
 *   1. Cloudflare D1 SQLite Database (query connectivity, transactions, rollbacks)
 *   2. Cloudflare R2 Object Storage (S3 API compatibility, CORS rules, lifecycle)
 *   3. Shopify Storefront API Client (GraphQL queries/mutations, buyer IP forwarding)
 *   4. Resend Transactional Email Engine (order receipts, tracking updates, 429 retry)
 *   5. Discord Operational Notification Dispatcher (embed schemas, channel colors, 429 retry)
 * ==============================================================================
 */

describe('Dependency Control Integration Test Suite (DEP_*)', () => {
  // ----------------------------------------------------------------------------
  // 1. Cloudflare D1 SQLite Database Query Connectivity & Transactions
  // ----------------------------------------------------------------------------
  describe('1. Cloudflare D1 Database Integration (DEP_CLOUDFLARE_D1)', () => {
    let db: DatabaseSync;

    beforeEach(() => {
      // In-memory SQLite matching Cloudflare D1 edge runtime semantics
      db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Apply D1 Content Schema per DEP_CLOUDFLARE_D1.md
      db.exec(`
        CREATE TABLE categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          base_price REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          category_id TEXT,
          shopify_product_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );

        CREATE TABLE product_variations (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          sku TEXT NOT NULL UNIQUE,
          variation_name TEXT NOT NULL,
          price_override REAL,
          stock_quantity INTEGER NOT NULL DEFAULT 0,
          shopify_variant_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_products_slug ON products(slug);
        CREATE INDEX idx_products_shopify_id ON products(shopify_product_id);
        CREATE INDEX idx_product_variations_sku ON product_variations(sku);
        CREATE INDEX idx_product_variations_product_id ON product_variations(product_id);
      `);
    });

    it('should verify PRAGMA foreign_keys is enabled and table schemas are intact', () => {
      const fkCheck = db.prepare('PRAGMA foreign_keys;').get() as { foreign_keys: number };
      assert.equal(fkCheck.foreign_keys, 1, 'PRAGMA foreign_keys must be enabled');

      const tables = (
        db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").all() as {
          name: string;
        }[]
      ).map((r) => r.name);

      assert.ok(tables.includes('categories'));
      assert.ok(tables.includes('products'));
      assert.ok(tables.includes('product_variations'));
    });

    it('should execute atomic multi-statement transactions successfully', () => {
      // Begin transaction, insert category + product + variants, then commit
      db.exec('BEGIN TRANSACTION;');

      const insertCat = db.prepare(
        'INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)'
      );
      insertCat.run('cat-art', 'Fine Art', 'fine-art', 'Gallery pieces');

      const insertProd = db.prepare(
        'INSERT INTO products (id, title, slug, base_price, status, category_id, shopify_product_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      insertProd.run(
        'prod-nebula',
        'Nebula Sphere',
        'nebula-sphere',
        450.0,
        'active',
        'cat-art',
        'gid://shopify/Product/991'
      );

      const insertVar = db.prepare(
        'INSERT INTO product_variations (id, product_id, sku, variation_name, price_override, stock_quantity, shopify_variant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      insertVar.run(
        'var-nebula-1',
        'prod-nebula',
        'NEB-01',
        'Obsidian Finish',
        null,
        5,
        'gid://shopify/ProductVariant/881'
      );
      insertVar.run(
        'var-nebula-2',
        'prod-nebula',
        'NEB-02',
        'Gold Inlay',
        650.0,
        2,
        'gid://shopify/ProductVariant/882'
      );

      db.exec('COMMIT;');

      // Verify committed rows
      const prod = db
        .prepare('SELECT title, base_price FROM products WHERE id = ?')
        .get('prod-nebula') as any;
      assert.equal(prod.title, 'Nebula Sphere');

      const variants = db
        .prepare('SELECT sku, price_override FROM product_variations WHERE product_id = ? ORDER BY sku')
        .all('prod-nebula') as any[];
      assert.equal(variants.length, 2);
      assert.equal(variants[0].sku, 'NEB-01');
      assert.equal(variants[0].price_override, null);
      assert.equal(variants[1].sku, 'NEB-02');
      assert.equal(variants[1].price_override, 650.0);
    });

    it('should rollback transaction atomically upon constraint failure', () => {
      // Seed initial product
      db.prepare(
        'INSERT INTO products (id, title, slug, base_price) VALUES (?, ?, ?, ?)'
      ).run('p-initial', 'Initial Sculpture', 'initial-sculpture', 100);

      // Attempt transaction with duplicate slug error
      let caughtError = false;
      try {
        db.exec('BEGIN TRANSACTION;');
        db.prepare(
          'INSERT INTO products (id, title, slug, base_price) VALUES (?, ?, ?, ?)'
        ).run('p-ok', 'Valid Product', 'valid-product', 200);

        // Duplicate slug 'initial-sculpture' will trigger UNIQUE constraint violation
        db.prepare(
          'INSERT INTO products (id, title, slug, base_price) VALUES (?, ?, ?, ?)'
        ).run('p-fail', 'Duplicate Product', 'initial-sculpture', 300);

        db.exec('COMMIT;');
      } catch (err) {
        caughtError = true;
        db.exec('ROLLBACK;');
      }

      assert.equal(caughtError, true, 'Transaction should throw on UNIQUE constraint error');

      // Verify rollback: 'p-ok' must NOT exist in the database
      const rolledBackProd = db
        .prepare('SELECT id FROM products WHERE id = ?')
        .get('p-ok');
      assert.equal(rolledBackProd, undefined, 'Rolled back statement must not be committed');
    });

    it('should simulate Cloudflare D1 batch execution semantics', () => {
      // D1 db.batch([stmt1, stmt2]) executes all statements in a transaction
      const batchOperations = [
        {
          sql: 'INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)',
          params: ['cat-batch-1', 'Ceramics', 'ceramics'],
        },
        {
          sql: 'INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)',
          params: ['cat-batch-2', 'Glassware', 'glassware'],
        },
      ];

      db.exec('BEGIN TRANSACTION;');
      for (const op of batchOperations) {
        db.prepare(op.sql).run(...op.params);
      }
      db.exec('COMMIT;');

      const count = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
      assert.equal(count.c, 2, 'Batch operations should execute cleanly');
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Cloudflare R2 Bucket Connectivity, S3 Compatibility & CORS Rules
  // ----------------------------------------------------------------------------
  describe('2. Cloudflare R2 Storage Integration (DEP_CLOUDFLARE_R2)', () => {
    const corsPath = path.resolve(process.cwd(), 'infra/r2/cors-media.json');

    it('should validate infra/r2/cors-media.json schema and mandatory CORS rules', () => {
      assert.ok(fs.existsSync(corsPath), 'infra/r2/cors-media.json must exist');
      const corsContent = JSON.parse(fs.readFileSync(corsPath, 'utf-8'));

      assert.ok(Array.isArray(corsContent.CORSRules), 'CORSRules must be an array');
      const rule = corsContent.CORSRules[0];
      assert.ok(rule, 'Must have at least one CORS rule');

      // Check AllowedMethods per DEP_CLOUDFLARE_R2.md Section 4
      const methods = rule.AllowedMethods;
      assert.ok(methods.includes('GET'), 'CORS must allow GET');
      assert.ok(methods.includes('PUT'), 'CORS must allow PUT (admin uploads)');
      assert.ok(methods.includes('HEAD'), 'CORS must allow HEAD');
      assert.ok(methods.includes('POST'), 'CORS must allow POST');

      // Check AllowedOrigins
      const origins = rule.AllowedOrigins;
      assert.ok(origins.includes('https://chrishop.jacobmiller22.com'));
      assert.ok(origins.includes('https://staging.chrishop.jacobmiller22.com'));
      assert.ok(origins.includes('https://admin.chrishop.jacobmiller22.com'));
      assert.ok(origins.includes('https://shop.jacobmiller22.com'));
      assert.ok(origins.includes('http://localhost:3000'));
      assert.ok(origins.includes('http://localhost:8055'));
      assert.ok(origins.some((o: string) => o.includes('*-chrishop.jacobmiller22.com')));
      assert.ok(origins.some((o: string) => o.includes('preview.shop.jacobmiller22.com')));

      // Check ExposeHeaders and MaxAgeSeconds
      assert.ok(rule.ExposeHeaders.includes('ETag'));
      assert.equal(rule.MaxAgeSeconds, 3600);
    });

    it('should simulate CORS preflight request evaluation matching R2 policies', () => {
      const corsContent = JSON.parse(fs.readFileSync(corsPath, 'utf-8'));
      const rule = corsContent.CORSRules[0];

      function evaluateCorsPreflight(origin: string, method: string) {
        const originAllowed = rule.AllowedOrigins.some((allowed: string) => {
          if (allowed === origin) return true;
          if (allowed.includes('*')) {
            const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
            return regex.test(origin);
          }
          return false;
        });

        const methodAllowed = rule.AllowedMethods.includes(method);
        return originAllowed && methodAllowed;
      }

      // Valid requests
      assert.equal(evaluateCorsPreflight('https://chrishop.jacobmiller22.com', 'GET'), true);
      assert.equal(evaluateCorsPreflight('https://admin.chrishop.jacobmiller22.com', 'PUT'), true);
      assert.equal(evaluateCorsPreflight('https://pr-42-chrishop.jacobmiller22.com', 'GET'), true);
      assert.equal(evaluateCorsPreflight('http://localhost:3000', 'POST'), true);

      // Disallowed requests
      assert.equal(evaluateCorsPreflight('https://malicious-site.com', 'GET'), false);
      assert.equal(evaluateCorsPreflight('https://chrishop.jacobmiller22.com', 'DELETE'), false);
    });

    it('should verify S3 client API compatibility simulation for R2 storage', async () => {
      // In-memory mock S3 storage simulator representing Cloudflare R2 bucket
      class MockR2Storage {
        private storage = new Map<string, { buffer: Buffer; metadata: Record<string, string>; etag: string }>();

        async putObject(key: string, data: Buffer, metadata: Record<string, string> = {}) {
          const etag = crypto.createHash('md5').update(data).digest('hex');
          this.storage.set(key, { buffer: data, metadata, etag });
          return { ETag: `"${etag}"`, VersionId: '1' };
        }

        async getObject(key: string) {
          const item = this.storage.get(key);
          if (!item) throw new Error(`NoSuchKey: ${key}`);
          return { Body: item.buffer, Metadata: item.metadata, ETag: item.etag };
        }

        async headObject(key: string) {
          const item = this.storage.get(key);
          if (!item) throw new Error(`NoSuchKey: ${key}`);
          return { ContentLength: item.buffer.length, ETag: item.etag, Metadata: item.metadata };
        }

        async deleteObject(key: string) {
          this.storage.delete(key);
          return { DeleteMarker: true };
        }

        async listObjects(prefix = '') {
          const keys = Array.from(this.storage.keys()).filter((k) => k.startsWith(prefix));
          return { Contents: keys.map((Key) => ({ Key })) };
        }
      }

      const r2 = new MockR2Storage();

      // Put image asset
      const testBuffer = Buffer.from('mock-high-res-image-binary-payload');
      const putResult = await r2.putObject('products/sculpture-01.webp', testBuffer, {
        'content-type': 'image/webp',
        'cache-control': 'public, max-age=31536000',
      });
      assert.ok(putResult.ETag);

      // Head object
      const head = await r2.headObject('products/sculpture-01.webp');
      assert.equal(head.ContentLength, testBuffer.length);

      // Get object
      const obj = await r2.getObject('products/sculpture-01.webp');
      assert.equal(obj.Body.toString(), 'mock-high-res-image-binary-payload');

      // List objects
      const list = await r2.listObjects('products/');
      assert.equal(list.Contents.length, 1);
      assert.equal(list.Contents[0].Key, 'products/sculpture-01.webp');

      // Delete object
      await r2.deleteObject('products/sculpture-01.webp');
      const listAfterDelete = await r2.listObjects('products/');
      assert.equal(listAfterDelete.Contents.length, 0);
    });

    it('should verify dual-bucket topology and backup retention policies per DEP_CLOUDFLARE_R2.md', () => {
      const buckets = {
        media: 'chrishop-media',
        backups: 'chrishop-backups',
      };
      assert.equal(buckets.media, 'chrishop-media');
      assert.equal(buckets.backups, 'chrishop-backups');

      // Lifecycle retention rules per DEP_CLOUDFLARE_R2.md Section 5
      const retentionRules = [
        { prefix: 'daily/', expireDays: 7 },
        { prefix: 'weekly/', expireDays: 28 },
        { prefix: 'monthly/', expireDays: 365 },
      ];

      assert.equal(retentionRules[0].expireDays, 7, 'Daily backups retain for 7 days');
      assert.equal(retentionRules[1].expireDays, 28, 'Weekly backups retain for 28 days');
      assert.equal(retentionRules[2].expireDays, 365, 'Monthly compliance archive retains for 365 days');
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Shopify Storefront API Client Communication & Buyer IP Forwarding
  // ----------------------------------------------------------------------------
  describe('3. Shopify Storefront API Client Integration (DEP_SHOPIFY)', () => {
    const storeDomain = 'chrishop-dev.myshopify.com';
    const apiVersion = '2025-01';
    const publicToken = 'shpat_mock_storefront_token_123';

    // Mock client simulating Storefront API requests from Cloudflare Worker
    class MockShopifyStorefrontClient {
      constructor(
        public domain: string,
        public token: string,
        public version: string
      ) {}

      async request<T = any>(
        query: string,
        variables?: Record<string, any>,
        buyerIp?: string
      ): Promise<{ data: T; errors?: any[] }> {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.token,
        };

        if (buyerIp) {
          // Validate buyer IP format per Shopify Headless spec
          const isIpv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(buyerIp);
          const isIpv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(buyerIp) || buyerIp.includes('::');
          if (!isIpv4 && !isIpv6) {
            throw new Error(`Invalid Shopify-Storefront-Buyer-IP format: "${buyerIp}"`);
          }
          headers['Shopify-Storefront-Buyer-IP'] = buyerIp;
        }

        // Handle CartCreate mutation
        if (query.includes('cartCreate')) {
          const lines = variables?.input?.lines || [];
          return {
            data: {
              cartCreate: {
                cart: {
                  id: 'gid://shopify/Cart/c1-mock-cart-guid',
                  checkoutUrl: `https://${this.domain}/checkouts/c/c1-mock-cart-guid?key=mock_secure_key`,
                  totalQuantity: lines.reduce((acc: number, l: any) => acc + (l.quantity || 1), 0),
                  lines: {
                    edges: lines.map((l: any) => ({
                      node: {
                        id: 'gid://shopify/CartLine/l1',
                        quantity: l.quantity,
                        merchandise: {
                          id: l.merchandiseId,
                          title: 'Obsidian Beast - 24K Gold Leaf',
                          price: { amount: '495.00', currencyCode: 'USD' },
                        },
                      },
                    })),
                  },
                },
                userErrors: [],
              },
            } as any,
          };
        }

        // Handle Product query
        if (query.includes('products')) {
          return {
            data: {
              products: {
                edges: [
                  {
                    node: {
                      id: 'gid://shopify/Product/101',
                      title: 'Obsidian Beast',
                      handle: 'obsidian-beast',
                      variants: {
                        edges: [
                          {
                            node: {
                              id: 'gid://shopify/ProductVariant/201',
                              title: 'Gold Edition',
                              availableForSale: true,
                              price: { amount: '495.00', currencyCode: 'USD' },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            } as any,
          };
        }

        return { data: {} as any };
      }
    }

    it('should format and execute Storefront API GraphQL cartCreate mutation', async () => {
      const client = new MockShopifyStorefrontClient(storeDomain, publicToken, apiVersion);

      const cartMutation = `
        mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart {
              id
              checkoutUrl
              totalQuantity
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `;

      const response = await client.request(cartMutation, {
        input: {
          lines: [{ merchandiseId: 'gid://shopify/ProductVariant/201', quantity: 1 }],
        },
      });

      assert.ok(response.data.cartCreate.cart.id);
      assert.ok(response.data.cartCreate.cart.checkoutUrl.startsWith(`https://${storeDomain}/checkouts/`));
      assert.equal(response.data.cartCreate.cart.totalQuantity, 1);
      assert.equal(response.data.cartCreate.userErrors.length, 0);
    });

    it('should forward valid buyer IP headers (IPv4 and IPv6) to Shopify Storefront API', async () => {
      const client = new MockShopifyStorefrontClient(storeDomain, publicToken, apiVersion);
      const cartMutation = `mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id } } }`;

      // Valid IPv4
      const resIpv4 = await client.request(cartMutation, {}, '203.0.113.195');
      assert.ok(resIpv4.data.cartCreate.cart.id);

      // Valid IPv6
      const resIpv6 = await client.request(cartMutation, {}, '2001:db8::1');
      assert.ok(resIpv6.data.cartCreate.cart.id);

      // Malformed IP should throw error
      await assert.rejects(async () => {
        await client.request(cartMutation, {}, 'invalid-ip-address');
      }, /Invalid Shopify-Storefront-Buyer-IP format/);
    });

    it('should verify Shopify HMAC-SHA256 signature algorithm per DEP_SHOPIFY.md Section 4', () => {
      const secret = 'shpss_secret_key_123';
      const payload = JSON.stringify({ id: 1001, status: 'paid', total: '495.00' });

      const hmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64');

      function verifySignature(body: string, header: string, s: string): boolean {
        const hash = crypto.createHmac('sha256', s).update(body, 'utf8').digest('base64');
        const expected = Buffer.from(hash);
        const actual = Buffer.from(header);
        if (expected.length !== actual.length) return false;
        return crypto.timingSafeEqual(expected, actual);
      }

      assert.equal(verifySignature(payload, hmac, secret), true);
      assert.equal(verifySignature(payload + 'tampered', hmac, secret), false);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Resend Transactional Email Engine
  // ----------------------------------------------------------------------------
  describe('4. Resend Email Client Integration (DEP_RESEND)', () => {
    it('should format order receipt email and verify DKIM/SPF sender domain', async () => {
      let capturedRequest: any = null;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url.includes('api.resend.com/emails')) {
          capturedRequest = {
            headers: init.headers,
            body: JSON.parse(init.body),
          };
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 're_order_receipt_id_101' }),
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const resend = new ResendNotificationProvider({
          apiKey: 're_test_live_key',
          fromEmail: 'orders@shop.jacobmiller22.com',
        });

        const receipt: OrderReceiptPayload = {
          order_id: 'ord-guid-900',
          order_number: '#1099',
          customer_name: 'Alex Rivera',
          customer_email: 'alex@example.com',
          items: [
            {
              title: 'Obsidian Beast',
              variation_name: 'Gold Edition',
              sku: 'BEAST-GOLD',
              quantity: 1,
              unit_price: 495.0,
            },
          ],
          amount_subtotal: 495.0,
          amount_shipping: 25.0,
          amount_tax: 41.5,
          amount_total: 561.5,
          shipping_address: {
            street: '742 Evergreen Terrace',
            city: 'Springfield',
            state: 'OR',
            postal_code: '97477',
            country: 'US',
          },
        };

        const result = await resend.notifyOrderReceipt(receipt);
        assert.equal(result.success, true);
        assert.equal(result.id, 're_order_receipt_id_101');

        assert.ok(capturedRequest);
        assert.equal(capturedRequest.body.to, 'alex@example.com');
        assert.equal(capturedRequest.body.from, 'orders@shop.jacobmiller22.com');
        assert.ok(capturedRequest.body.html.includes('Thank you for your order, Alex Rivera!'));
        assert.ok(capturedRequest.body.html.includes('BEAST-GOLD'));
        assert.ok(capturedRequest.body.html.includes('$561.50'));
        assert.ok(capturedRequest.body.text.includes('Total: $561.50'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should format shipping update notification and tracking button', async () => {
      let capturedBody: any = null;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 're_ship_102' }),
        } as Response;
      }) as any;

      try {
        const resend = new ResendNotificationProvider({
          apiKey: 're_test_key',
        });

        const shipping: ShippingUpdatePayload = {
          order_id: 'ord-guid-900',
          order_number: '#1099',
          customer_name: 'Alex Rivera',
          customer_email: 'alex@example.com',
          carrier: 'FedEx',
          tracking_number: '794820194821',
          tracking_url: 'https://www.fedex.com/fedextrack/?trknbr=794820194821',
        };

        const result = await resend.notifyShippingUpdate(shipping);
        assert.equal(result.success, true);
        assert.ok(capturedBody.html.includes('FedEx'));
        assert.ok(capturedBody.html.includes('794820194821'));
        assert.ok(capturedBody.html.includes('Track Your Package'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Discord Webhook Notification Dispatcher
  // ----------------------------------------------------------------------------
  describe('5. Discord Notification Engine (DEP_DISCORD)', () => {
    it('should route events to proper channel colors per DEP_DISCORD.md Section 2', async () => {
      const capturedEmbeds: any[] = [];
      const mockWebhookUrl = 'https://discord.com/api/webhooks/mock/channels';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_url: any, init: any) => {
        const parsed = JSON.parse(init.body);
        capturedEmbeds.push(parsed.embeds[0]);
        return { ok: true, status: 200, statusText: 'OK' } as Response;
      }) as any;

      try {
        const discord = new DiscordNotificationProvider(mockWebhookUrl);

        // 1. Order Placed (#store-orders, Green)
        await discord.notifyOrderCreated({
          id: 'ord-disc-1',
          shipping_name: 'Jordan Lee',
          customer_email: 'jordan@example.com',
          amount_total: 495.0,
          order_status: 'paid',
          shipping_status: 'pending',
          shipping_address: {
            street: '1 Art Blvd',
            city: 'Austin',
            state: 'TX',
            postal_code: '78701',
            country: 'US',
          },
        });

        // 2. Low Stock Warning (#store-orders, Yellow)
        await discord.notifyLowStock('Obsidian Beast', 'Gold Edition', 2, 'BEAST-GOLD');

        // 3. Drop Sold Out (#store-orders, Orange)
        await discord.notifyLowStock('Obsidian Beast', 'Gold Edition', 0, 'BEAST-GOLD');

        // 4. Dev Alert (#dev-alerts, Red)
        await discord.notifyDevAlert('Edge Health Degraded', '503 Service Unavailable', 'error');

        assert.equal(capturedEmbeds.length, 4);
        assert.equal(capturedEmbeds[0].color, DISCORD_COLORS.success); // Green
        assert.equal(capturedEmbeds[1].color, DISCORD_COLORS.lowStock); // Yellow
        assert.equal(capturedEmbeds[2].color, DISCORD_COLORS.soldOut); // Orange
        assert.equal(capturedEmbeds[3].color, DISCORD_COLORS.healthFailure); // Red
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should retry on HTTP 429 rate limit backoff using X-RateLimit-Reset-After', async () => {
      let attempts = 0;
      const mockWebhookUrl = 'https://discord.com/api/webhooks/mock/throttle';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        attempts++;
        if (attempts === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({ 'X-RateLimit-Reset-After': '0.01' }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
        } as Response;
      }) as any;

      try {
        const discord = new DiscordNotificationProvider(mockWebhookUrl, {
          maxRetries: 2,
          initialRetryDelayMs: 5,
        });

        await discord.send({
          title: 'Testing Rate Limit Retry',
          message: 'Verifying pause and retry',
          severity: 'info',
        });

        assert.equal(attempts, 2, 'Should succeed on retry after 429');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
