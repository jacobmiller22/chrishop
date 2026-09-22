import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveMatrixProfile,
  STANDARD_PROFILES,
  assertSafeSql,
  isMutatingSql,
  ProductionWriteForbiddenError,
  createRemoteD1Client,
  withMatrixProfile,
  type IntegrationMatrixConfig,
} from '@chrishop/config';
import { getDatabase, setDatabase, resetDatabase } from '../../apps/web/src/lib/catalog';

describe('Story 2.31: Composable Infrastructure & Integration Matrix (Issue #143)', () => {
  beforeEach(() => {
    resetDatabase();
    delete process.env.MATRIX_PROFILE;
    delete process.env.ALLOW_PROD_WRITES;
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.MATRIX_PROFILE;
    delete process.env.ALLOW_PROD_WRITES;
  });

  describe('1. Profile Resolution & Configuration Schema', () => {
    it('should resolve default local-offline profile when no environment profile is set', () => {
      const config = resolveMatrixProfile();
      assert.equal(config.profile, 'local-offline');
      assert.equal(config.subsystems.storefront, 'local');
      assert.equal(config.subsystems.databaseD1.target, 'local-sqlite');
      assert.equal(config.subsystems.databaseD1.readOnly, false);
      assert.equal(config.subsystems.kvCache, 'in-memory');
      assert.equal(config.subsystems.r2Storage, 'mock-filesystem');
      assert.equal(config.subsystems.shopify, 'mock');
      assert.equal(config.subsystems.notifications, 'mock-in-memory');
    });

    it('should resolve hybrid-staging profile with remote Cloudflare staging services', () => {
      const config = resolveMatrixProfile('hybrid-staging');
      assert.equal(config.profile, 'hybrid-staging');
      assert.equal(config.subsystems.databaseD1.target, 'staging-remote');
      assert.equal(config.subsystems.databaseD1.databaseId, 'chrishop-staging-db');
      assert.equal(config.subsystems.kvCache, 'staging-remote');
      assert.equal(config.subsystems.r2Storage, 'staging-remote');
      assert.equal(config.subsystems.shopify, 'dev-store');
      assert.equal(config.subsystems.notifications, 'staging-webhook');
    });

    it('should resolve prod-readonly-probe profile and strictly lock database to readOnly: true', () => {
      const config = resolveMatrixProfile('prod-readonly-probe');
      assert.equal(config.profile, 'prod-readonly-probe');
      assert.equal(config.subsystems.databaseD1.target, 'production-remote');
      assert.equal(config.subsystems.databaseD1.readOnly, true);
      assert.equal(config.subsystems.shopify, 'production-store');
    });

    it('should allow overriding prod write protection ONLY when allowProdWrites is explicitly true', () => {
      // Without flag: locked
      const locked = resolveMatrixProfile('prod-readonly-probe', { allowProdWrites: false });
      assert.equal(locked.subsystems.databaseD1.readOnly, true);

      // With flag: unlocked
      const unlocked = resolveMatrixProfile('prod-readonly-probe', { allowProdWrites: true });
      assert.equal(unlocked.allowProdWrites, true);
    });
  });

  describe('2. SQL Mutation Interception & Write Protection Guardrails', () => {
    it('should identify read-only queries as non-mutating', () => {
      assert.equal(isMutatingSql('SELECT * FROM products'), false);
      assert.equal(isMutatingSql('SELECT id, title FROM products WHERE status = ?'), false);
      assert.equal(isMutatingSql('  -- Fetch all products\nSELECT * FROM categories'), false);
      assert.equal(isMutatingSql('/* Multi-line comment */ SELECT count(*) FROM media'), false);
      assert.equal(isMutatingSql('PRAGMA table_info(products)'), false);
    });

    it('should identify mutating queries accurately', () => {
      assert.equal(isMutatingSql('INSERT INTO products (title) VALUES (?)'), true);
      assert.equal(isMutatingSql('UPDATE products SET title = ? WHERE id = ?'), true);
      assert.equal(isMutatingSql('DELETE FROM products WHERE id = ?'), true);
      assert.equal(isMutatingSql('DROP TABLE products'), true);
      assert.equal(isMutatingSql('ALTER TABLE products ADD COLUMN sku TEXT'), true);
      assert.equal(isMutatingSql('CREATE TABLE temp_table (id TEXT)'), true);
      assert.equal(isMutatingSql('REPLACE INTO products (id) VALUES (?)'), true);
      assert.equal(isMutatingSql('TRUNCATE TABLE products'), true);
    });

    it('should throw ProductionWriteForbiddenError on mutating SQL under readOnly: true', () => {
      assert.throws(
        () => {
          assertSafeSql('INSERT INTO products (title) VALUES ("Hacker Pack")', true);
        },
        (err: any) => {
          assert.ok(err instanceof ProductionWriteForbiddenError);
          assert.ok(err.message.includes('forbidden under read-only matrix profile'));
          return true;
        }
      );

      assert.throws(
        () => {
          assertSafeSql('DELETE FROM categories WHERE id = "1"', true);
        },
        ProductionWriteForbiddenError
      );
    });

    it('should allow mutating SQL when readOnly: false', () => {
      assert.doesNotThrow(() => {
        assertSafeSql('INSERT INTO products (title) VALUES ("Allowed")', false);
      });
    });
  });

  describe('3. Cloudflare D1 Remote HTTP Client', () => {
    it('should execute queries through mock fetch and map results correctly', async () => {
      const dispatchedRequests: any[] = [];
      const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        dispatchedRequests.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                results: [{ id: 'prod-101', title: 'Alpine Anorak' }],
                meta: { changes: 0, duration: 12 },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const d1 = createRemoteD1Client({
        accountId: 'acc_test_123',
        databaseId: 'db_test_456',
        apiToken: 'cf_token_789',
        readOnly: true,
        fetchFn: mockFetch as any,
      });

      const stmt = d1.prepare('SELECT * FROM products WHERE id = ?').bind('prod-101');
      const row = await stmt.get();
      assert.deepEqual(row, { id: 'prod-101', title: 'Alpine Anorak' });

      assert.equal(dispatchedRequests.length, 1);
      assert.ok(dispatchedRequests[0].url.includes('acc_test_123/d1/database/db_test_456/query'));
      assert.equal(dispatchedRequests[0].init.headers['Authorization'], 'Bearer cf_token_789');

      const body = JSON.parse(dispatchedRequests[0].init.body);
      assert.equal(body.sql, 'SELECT * FROM products WHERE id = ?');
      assert.deepEqual(body.params, ['prod-101']);
    });

    it('should reject mutating queries in remote D1 client when readOnly is enabled', async () => {
      const d1 = createRemoteD1Client({
        accountId: 'acc_test_123',
        databaseId: 'db_test_456',
        apiToken: 'cf_token_789',
        readOnly: true,
      });

      await assert.rejects(
        async () => {
          await d1.prepare('DELETE FROM products').run();
        },
        ProductionWriteForbiddenError
      );
    });
  });

  describe('4. withMatrixProfile Test Runner Utility', () => {
    it('should temporarily switch profile and restore original environment afterwards', async () => {
      process.env.MATRIX_PROFILE = 'local-offline';

      const executedConfig = await withMatrixProfile('hybrid-staging', (config) => {
        assert.equal(process.env.MATRIX_PROFILE, 'hybrid-staging');
        assert.equal(config.profile, 'hybrid-staging');
        return config;
      });

      assert.equal(executedConfig.profile, 'hybrid-staging');
      assert.equal(process.env.MATRIX_PROFILE, 'local-offline');
    });
  });

  describe('5. Catalog Integration with Matrix Profile Resolver', () => {
    it('should initialize remote D1 database when MATRIX_PROFILE is prod-readonly-probe', () => {
      process.env.MATRIX_PROFILE = 'prod-readonly-probe';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'acc_prod_test';
      process.env.CLOUDFLARE_API_TOKEN = 'token_prod_test';
      process.env.CLOUDFLARE_PROD_D1_DATABASE_ID = 'db_prod_test';

      const db = getDatabase();
      assert.ok(db, 'Catalog getDatabase() must return database client');
      assert.ok(typeof db.prepare === 'function');

      // Attempt mutating query against returned db
      assert.rejects(
        async () => {
          await db.prepare('DROP TABLE products').run();
        },
        ProductionWriteForbiddenError
      );

      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_API_TOKEN;
      delete process.env.CLOUDFLARE_PROD_D1_DATABASE_ID;
    });
  });
});
