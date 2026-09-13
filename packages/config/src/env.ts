import { z } from 'zod';

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  // Shopify Headless Integration Credentials
  SHOPIFY_STORE_DOMAIN: z
    .string()
    .min(1, 'SHOPIFY_STORE_DOMAIN is required')
    .refine((val) => !val.startsWith('http://') && !val.startsWith('https://'), {
      message:
        'SHOPIFY_STORE_DOMAIN must be a hostname without protocol (e.g. your-store.myshopify.com)',
    })
    .default('chrishop-dev.myshopify.com'),
  SHOPIFY_STOREFRONT_TOKEN: z
    .string()
    .min(1, 'SHOPIFY_STOREFRONT_TOKEN is required')
    .default('shpat_dev_storefront_token_placeholder'),
  SHOPIFY_ADMIN_TOKEN: z
    .string()
    .min(1, 'SHOPIFY_ADMIN_TOKEN is required')
    .default('shpat_dev_admin_token_placeholder'),
  SHOPIFY_WEBHOOK_SECRET: z
    .string()
    .min(1, 'SHOPIFY_WEBHOOK_SECRET is required')
    .default('shpss_dev_webhook_secret_placeholder'),

  // Payload CMS v3 Configuration
  PAYLOAD_SECRET: z
    .string()
    .min(32, 'PAYLOAD_SECRET must be at least 32 characters long')
    .default('development-secret-key-min-32-chars'),
  PAYLOAD_PUBLIC_SERVER_URL: z
    .string()
    .url('PAYLOAD_PUBLIC_SERVER_URL must be a valid URL')
    .default('http://localhost:3000'),

  // Cloudflare R2 / Local S3 Storage Configuration
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required').default('chrishop-media'),
  R2_ENDPOINT: z.string().url('R2_ENDPOINT must be a valid URL').default('http://localhost:9000'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required').default('minioadmin'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required').default('minioadmin'),
  NEXT_PUBLIC_R2_PUBLIC_URL: z.string().optional(),

  // Cloudflare Platform Credentials (Optional in local dev, required in production edge)
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
  CLOUDFLARE_TURNSTILE_SITE_KEY: z.string().optional(),
  CLOUDFLARE_TURNSTILE_SECRET_KEY: z.string().optional(),

  // Channel-Agnostic Transactional Email & Operational Alert Credentials
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  MERCHANT_ALERT_EMAIL: z.string().email('MERCHANT_ALERT_EMAIL must be a valid email address').optional(),
  OPS_ALERT_WEBHOOK_URL: z.string().url('OPS_ALERT_WEBHOOK_URL must be a valid URL').optional(),

  // Legacy / Deprecated Notification Credentials (retained for backward compatibility)
  /** @deprecated Use RESEND_FROM_EMAIL instead */
  EMAIL_FROM: z.string().optional(),
  /** @deprecated Use OPS_ALERT_WEBHOOK_URL instead */
  DISCORD_WEBHOOK_URL: z.string().url('DISCORD_WEBHOOK_URL must be a valid URL').optional(),
  /** @deprecated Use OPS_ALERT_WEBHOOK_URL or MERCHANT_ALERT_EMAIL instead */
  DISCORD_WEBHOOK_ORDERS: z.string().url('DISCORD_WEBHOOK_ORDERS must be a valid URL').optional(),
  /** @deprecated Use OPS_ALERT_WEBHOOK_URL instead */
  DISCORD_WEBHOOK_ALERTS: z.string().url('DISCORD_WEBHOOK_ALERTS must be a valid URL').optional(),

  // Feature Flag Configurations (ADR-001)
  FLAG_IS_DROP_ACTIVE: z.coerce.boolean().optional(),
  FLAG_ENABLE_WIREMOCK: z.coerce.boolean().optional(),
  FLAG_MAINTENANCE_MODE: z.coerce.boolean().optional(),
  FLAG_EMERGENCY_KILL_SWITCH: z.coerce.boolean().optional(),
  FLAG_DISABLE_CHECKOUT: z.coerce.boolean().optional(),
  FLAG_VIP_EARLY_ACCESS: z.coerce.boolean().optional(),
  FLAG_VERBOSE_DEBUG_HEADERS: z.coerce.boolean().optional(),
  FLAG_PHASE_6_CANARY_PERCENT: z.coerce.number().min(0).max(100).optional(),
  FLAG_VIP_SECRET_TOKEN: z.string().optional(),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url('NEXT_PUBLIC_SITE_URL must be a valid URL')
    .default('http://localhost:3000'),
  PAYLOAD_PUBLIC_SERVER_URL: z
    .string()
    .url('PAYLOAD_PUBLIC_SERVER_URL must be a valid URL')
    .default('http://localhost:3000'),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: z.string().optional(),
  NEXT_PUBLIC_R2_PUBLIC_URL: z.string().optional(),
  NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_FLAG_IS_DROP_ACTIVE: z.coerce.boolean().optional(),
  NEXT_PUBLIC_FLAG_MAINTENANCE_MODE: z.coerce.boolean().optional(),
});

export const envSchema = serverEnvSchema.merge(clientEnvSchema);

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type Env = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}

export function validateServerEnv(
  env: Record<string, string | undefined> = process.env
): ServerEnv {
  const parsed = serverEnvSchema.safeParse(env);
  if (!parsed.success) {
    console.error('❌ Invalid server environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid server environment variables');
  }
  return parsed.data;
}

export function validateClientEnv(
  env: Record<string, string | undefined> = process.env
): ClientEnv {
  const parsed = clientEnvSchema.safeParse(env);
  if (!parsed.success) {
    console.error('❌ Invalid client environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid client environment variables');
  }
  return parsed.data;
}
