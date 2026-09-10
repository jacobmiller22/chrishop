import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  serverEnvSchema,
  clientEnvSchema,
  envSchema,
  validateEnv,
  validateServerEnv,
  validateClientEnv,
} from '../src/index';
import * as configModule from '../src/index';

describe('Shared Config Environment Schema (@chrishop/config/env)', () => {
  describe('Eradication of Obsolete Legacy Environment Variables', () => {
    const obsoleteVariables = [
      'POSTGRES_DB',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'DATABASE_URL',
      'KEY',
      'SECRET',
      'ADMIN_EMAIL',
      'ADMIN_PASSWORD',
      'STORAGE_LOCATIONS',
      'STORAGE_S3_DRIVER',
      'STORAGE_S3_KEY',
      'STORAGE_S3_SECRET',
      'STORAGE_S3_BUCKET',
      'STORAGE_S3_ENDPOINT',
      'STORAGE_S3_S3_FORCE_PATH_STYLE',
      'REDIS_HOST',
      'REDIS_PORT',
      'REDIS_URL',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_CMS_URL',
      'DIRECTUS_URL',
    ];

    it('should not contain any obsolete legacy variables in serverEnvSchema shape', () => {
      const serverKeys = Object.keys(serverEnvSchema.shape);
      for (const legacyVar of obsoleteVariables) {
        assert.equal(
          serverKeys.includes(legacyVar),
          false,
          `serverEnvSchema must not contain obsolete variable: ${legacyVar}`
        );
      }
    });

    it('should not contain any obsolete legacy variables in clientEnvSchema shape', () => {
      const clientKeys = Object.keys(clientEnvSchema.shape);
      for (const legacyVar of obsoleteVariables) {
        assert.equal(
          clientKeys.includes(legacyVar),
          false,
          `clientEnvSchema must not contain obsolete variable: ${legacyVar}`
        );
      }
    });

    it('should not contain any obsolete legacy variables in merged envSchema shape', () => {
      const envKeys = Object.keys(envSchema.shape);
      for (const legacyVar of obsoleteVariables) {
        assert.equal(
          envKeys.includes(legacyVar),
          false,
          `envSchema must not contain obsolete variable: ${legacyVar}`
        );
      }
    });

    it('should strip obsolete legacy variables from parsed output', () => {
      const rawEnv: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_12345',
        STRIPE_WEBHOOK_SECRET: 'whsec_12345',
        POSTGRES_PASSWORD: 'secretpassword',
        DATABASE_URL: 'postgres://localhost/db',
        REDIS_HOST: 'localhost',
        KEY: 'legacy-key',
        SECRET: 'legacy-secret',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_12345',
      };

      const parsed = validateEnv(rawEnv);
      for (const legacyVar of obsoleteVariables) {
        assert.equal(
          (parsed as Record<string, unknown>)[legacyVar],
          undefined,
          `Parsed output must not contain legacy key: ${legacyVar}`
        );
      }
    });
  });

  describe('Default Fallbacks for Development & Test Environments', () => {
    it('should provide valid defaults when called with an empty object', () => {
      const env = validateEnv({});

      // Core server defaults
      assert.equal(env.NODE_ENV, 'development');
      assert.equal(env.PORT, 3000);

      // Shopify defaults
      assert.equal(env.SHOPIFY_STORE_DOMAIN, 'chrishop-dev.myshopify.com');
      assert.equal(env.SHOPIFY_STOREFRONT_TOKEN, 'shpat_dev_storefront_token_placeholder');
      assert.equal(env.SHOPIFY_ADMIN_TOKEN, 'shpat_dev_admin_token_placeholder');
      assert.equal(env.SHOPIFY_WEBHOOK_SECRET, 'shpss_dev_webhook_secret_placeholder');

      // Payload CMS defaults
      assert.equal(env.PAYLOAD_SECRET, 'development-secret-key-min-32-chars');
      assert.equal(env.PAYLOAD_PUBLIC_SERVER_URL, 'http://localhost:3000');

      // Cloudflare R2 defaults
      assert.equal(env.R2_BUCKET_NAME, 'chrishop-media');
      assert.equal(env.R2_ENDPOINT, 'http://localhost:9000');
      assert.equal(env.R2_ACCESS_KEY_ID, 'minioadmin');
      assert.equal(env.R2_SECRET_ACCESS_KEY, 'minioadmin');

      // Client defaults
      assert.equal(env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000');

      // Optional credentials should be undefined by default
      assert.equal(env.DISCORD_WEBHOOK_URL, undefined);
      assert.equal(env.RESEND_API_KEY, undefined);
      assert.equal(env.CLOUDFLARE_ACCOUNT_ID, undefined);
      assert.equal(env.CLOUDFLARE_API_TOKEN, undefined);
    });

    it('should parse custom valid values correctly', () => {
      const customEnv = {
        NODE_ENV: 'production',
        PORT: '8080',
        SHOPIFY_STORE_DOMAIN: 'chrishop-prod.myshopify.com',
        SHOPIFY_STOREFRONT_TOKEN: 'shpat_live_storefront_token_123',
        SHOPIFY_ADMIN_TOKEN: 'shpat_live_admin_token_123',
        SHOPIFY_WEBHOOK_SECRET: 'shpss_live_webhook_secret_123',
        PAYLOAD_SECRET: 'super-long-secure-production-payload-secret-key-64-bytes',
        PAYLOAD_PUBLIC_SERVER_URL: 'https://admin.chrishop.com',
        R2_BUCKET_NAME: 'chrishop-prod-media',
        R2_ENDPOINT: 'https://0123456789abcdef.r2.cloudflarestorage.com',
        R2_ACCESS_KEY_ID: 'cf_r2_access_key_123',
        R2_SECRET_ACCESS_KEY: 'cf_r2_secret_key_123',
        CLOUDFLARE_ACCOUNT_ID: '0123456789abcdef',
        CLOUDFLARE_API_TOKEN: 'cf_api_token_123',
        DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
        RESEND_API_KEY: 're_123456789',
        NEXT_PUBLIC_SITE_URL: 'https://chrishop.com',
      };

      const parsed = validateEnv(customEnv);

      assert.equal(parsed.NODE_ENV, 'production');
      assert.equal(parsed.PORT, 8080);
      assert.equal(parsed.SHOPIFY_STORE_DOMAIN, 'chrishop-prod.myshopify.com');
      assert.equal(parsed.SHOPIFY_STOREFRONT_TOKEN, 'shpat_live_storefront_token_123');
      assert.equal(parsed.SHOPIFY_ADMIN_TOKEN, 'shpat_live_admin_token_123');
      assert.equal(parsed.SHOPIFY_WEBHOOK_SECRET, 'shpss_live_webhook_secret_123');
      assert.equal(
        parsed.PAYLOAD_SECRET,
        'super-long-secure-production-payload-secret-key-64-bytes'
      );
      assert.equal(parsed.PAYLOAD_PUBLIC_SERVER_URL, 'https://admin.chrishop.com');
      assert.equal(parsed.R2_BUCKET_NAME, 'chrishop-prod-media');
      assert.equal(parsed.R2_ENDPOINT, 'https://0123456789abcdef.r2.cloudflarestorage.com');
      assert.equal(parsed.R2_ACCESS_KEY_ID, 'cf_r2_access_key_123');
      assert.equal(parsed.R2_SECRET_ACCESS_KEY, 'cf_r2_secret_key_123');
      assert.equal(parsed.CLOUDFLARE_ACCOUNT_ID, '0123456789abcdef');
      assert.equal(parsed.CLOUDFLARE_API_TOKEN, 'cf_api_token_123');
      assert.equal(parsed.DISCORD_WEBHOOK_URL, 'https://discord.com/api/webhooks/123/abc');
      assert.equal(parsed.RESEND_API_KEY, 're_123456789');
      assert.equal(parsed.NEXT_PUBLIC_SITE_URL, 'https://chrishop.com');
    });
  });

  describe('Strict Zod Validation Rules', () => {
    it('should reject SHOPIFY_STORE_DOMAIN if empty', () => {
      const result = serverEnvSchema.safeParse({ SHOPIFY_STORE_DOMAIN: '' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.SHOPIFY_STORE_DOMAIN);
      }
    });

    it('should reject SHOPIFY_STORE_DOMAIN containing https:// or http:// protocol', () => {
      const resultHttps = serverEnvSchema.safeParse({
        SHOPIFY_STORE_DOMAIN: 'https://store.myshopify.com',
      });
      assert.equal(resultHttps.success, false);
      if (!resultHttps.success) {
        assert.ok(
          resultHttps.error
            .flatten()
            .fieldErrors.SHOPIFY_STORE_DOMAIN?.some((msg) => msg.includes('without protocol'))
        );
      }

      const resultHttp = serverEnvSchema.safeParse({
        SHOPIFY_STORE_DOMAIN: 'http://store.myshopify.com',
      });
      assert.equal(resultHttp.success, false);
      if (!resultHttp.success) {
        assert.ok(
          resultHttp.error
            .flatten()
            .fieldErrors.SHOPIFY_STORE_DOMAIN?.some((msg) => msg.includes('without protocol'))
        );
      }
    });

    it('should reject empty SHOPIFY_STOREFRONT_TOKEN', () => {
      const result = serverEnvSchema.safeParse({ SHOPIFY_STOREFRONT_TOKEN: '' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.SHOPIFY_STOREFRONT_TOKEN);
      }
    });

    it('should reject empty SHOPIFY_ADMIN_TOKEN', () => {
      const result = serverEnvSchema.safeParse({ SHOPIFY_ADMIN_TOKEN: '' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.SHOPIFY_ADMIN_TOKEN);
      }
    });

    it('should reject empty SHOPIFY_WEBHOOK_SECRET', () => {
      const result = serverEnvSchema.safeParse({ SHOPIFY_WEBHOOK_SECRET: '' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.SHOPIFY_WEBHOOK_SECRET);
      }
    });

    it('should reject PAYLOAD_SECRET with fewer than 32 characters', () => {
      const result = serverEnvSchema.safeParse({
        PAYLOAD_SECRET: 'too-short-secret-key-1234',
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error
            .flatten()
            .fieldErrors.PAYLOAD_SECRET?.some((msg) => msg.includes('at least 32 characters'))
        );
      }
    });

    it('should reject invalid URL for PAYLOAD_PUBLIC_SERVER_URL', () => {
      const result = serverEnvSchema.safeParse({
        PAYLOAD_PUBLIC_SERVER_URL: 'invalid-url-string',
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error
            .flatten()
            .fieldErrors.PAYLOAD_PUBLIC_SERVER_URL?.some((msg) => msg.includes('valid URL'))
        );
      }
    });

    it('should reject invalid URL for NEXT_PUBLIC_SITE_URL', () => {
      const result = clientEnvSchema.safeParse({
        NEXT_PUBLIC_SITE_URL: 'not-a-valid-url',
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error
            .flatten()
            .fieldErrors.NEXT_PUBLIC_SITE_URL?.some((msg) => msg.includes('valid URL'))
        );
      }
    });

    it('should reject empty R2_BUCKET_NAME', () => {
      const result = serverEnvSchema.safeParse({ R2_BUCKET_NAME: '' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.R2_BUCKET_NAME);
      }
    });

    it('should reject invalid URL for R2_ENDPOINT', () => {
      const result = serverEnvSchema.safeParse({ R2_ENDPOINT: 'bad-endpoint' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.flatten().fieldErrors.R2_ENDPOINT?.some((msg) => msg.includes('valid URL'))
        );
      }
    });

    it('should reject empty R2_ACCESS_KEY_ID', () => {
      const result = serverEnvSchema.safeParse({ R2_ACCESS_KEY_ID: '' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.R2_ACCESS_KEY_ID);
      }
    });

    it('should reject empty R2_SECRET_ACCESS_KEY', () => {
      const result = serverEnvSchema.safeParse({ R2_SECRET_ACCESS_KEY: '' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.R2_SECRET_ACCESS_KEY);
      }
    });

    it('should reject invalid NODE_ENV', () => {
      const result = serverEnvSchema.safeParse({ NODE_ENV: 'invalid-environment' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.NODE_ENV);
      }
    });

    it('should reject non-coercible PORT', () => {
      const result = serverEnvSchema.safeParse({ PORT: 'not-a-number' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.PORT);
      }
    });

    it('should reject invalid URL for DISCORD_WEBHOOK_URL when provided', () => {
      const result = serverEnvSchema.safeParse({ DISCORD_WEBHOOK_URL: 'invalid-discord-url' });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error
            .flatten()
            .fieldErrors.DISCORD_WEBHOOK_URL?.some((msg) => msg.includes('valid URL'))
        );
      }
    });
  });

  describe('Validation Helpers & Error Handling', () => {
    it('validateEnv should throw when validation fails and log error', () => {
      let consoleErrorCalled = false;
      const originalConsoleError = console.error;
      console.error = () => {
        consoleErrorCalled = true;
      };

      try {
        assert.throws(
          () => {
            validateEnv({
              PAYLOAD_SECRET: 'too-short',
            });
          },
          {
            name: 'Error',
            message: 'Invalid environment variables',
          }
        );
        assert.equal(consoleErrorCalled, true);
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('validateServerEnv should successfully parse server env', () => {
      const serverEnv = validateServerEnv({});
      assert.equal(serverEnv.NODE_ENV, 'development');
      assert.equal(serverEnv.SHOPIFY_STORE_DOMAIN, 'chrishop-dev.myshopify.com');
      assert.equal(serverEnv.PAYLOAD_SECRET, 'development-secret-key-min-32-chars');
    });

    it('validateServerEnv should throw when server validation fails', () => {
      let consoleErrorCalled = false;
      const originalConsoleError = console.error;
      console.error = () => {
        consoleErrorCalled = true;
      };

      try {
        assert.throws(
          () => {
            validateServerEnv({
              R2_ENDPOINT: 'bad-url',
            });
          },
          {
            name: 'Error',
            message: 'Invalid server environment variables',
          }
        );
        assert.equal(consoleErrorCalled, true);
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('validateClientEnv should successfully parse client env', () => {
      const clientEnv = validateClientEnv({});
      assert.equal(clientEnv.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000');
      assert.equal(clientEnv.PAYLOAD_PUBLIC_SERVER_URL, 'http://localhost:3000');
    });

    it('validateClientEnv should throw when client validation fails', () => {
      let consoleErrorCalled = false;
      const originalConsoleError = console.error;
      console.error = () => {
        consoleErrorCalled = true;
      };

      try {
        assert.throws(
          () => {
            validateClientEnv({
              NEXT_PUBLIC_SITE_URL: 'invalid-url',
            });
          },
          {
            name: 'Error',
            message: 'Invalid client environment variables',
          }
        );
        assert.equal(consoleErrorCalled, true);
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('should use process.env as default argument when none provided', () => {
      // In the current test process, NODE_ENV is typically 'test' or undefined
      // validateServerEnv() / validateClientEnv() / validateEnv() should not throw
      assert.doesNotThrow(() => {
        validateServerEnv();
      });
      assert.doesNotThrow(() => {
        validateClientEnv();
      });
      assert.doesNotThrow(() => {
        validateEnv();
      });
    });

    it('should export all public schemas and helpers from package entrypoint', () => {
      assert.ok(configModule.serverEnvSchema);
      assert.ok(configModule.clientEnvSchema);
      assert.ok(configModule.envSchema);
      assert.equal(typeof configModule.validateEnv, 'function');
      assert.equal(typeof configModule.validateServerEnv, 'function');
      assert.equal(typeof configModule.validateClientEnv, 'function');
    });
  });
});
