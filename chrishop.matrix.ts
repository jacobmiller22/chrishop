import { type IntegrationMatrixConfig, resolveMatrixProfile } from '@chrishop/config';

/**
 * ChrisShop Integration Matrix Configuration
 *
 * Defines subsystem operating tiers across Storefront, D1 Database, KV Cache,
 * R2 Media Storage, Shopify Storefront/Admin, and Notifications.
 *
 * Run with a specific profile:
 *   pnpm dev --profile hybrid-staging
 *   MATRIX_PROFILE=prod-readonly-probe pnpm dev
 *
 * Documentation: docs/runbooks/INTEGRATION_MATRIX.md
 */
const matrixConfig: IntegrationMatrixConfig = resolveMatrixProfile();

export default matrixConfig;
