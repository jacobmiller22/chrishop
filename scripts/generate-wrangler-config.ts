#!/usr/bin/env tsx
/**
 * ChrisShop Terraform-to-Wrangler Bridge Script
 *
 * Connects Terraform IaC outputs (D1 UUIDs, KV IDs, R2 Buckets)
 * to Wrangler configuration for application and asset deployment.
 */

import fs from 'node:fs';
import path from 'node:path';

interface TerraformOutputs {
  d1_database_id?: { value: string };
  d1_database_name?: { value: string };
  kv_namespace_id?: { value: string };
  r2_bucket_name?: { value: string };
  storefront_url?: { value: string };
  turnstile_site_key?: { value: string };
}

interface BridgeOptions {
  env: 'production' | 'staging' | 'preview';
  tfOutputFile?: string;
  dryRun?: boolean;
  verify?: boolean;
}

function parseArgs(): BridgeOptions {
  const args = process.argv.slice(2);
  let env: 'production' | 'staging' | 'preview' = 'staging';
  let tfOutputFile: string | undefined;
  let dryRun = false;
  let verify = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env' && args[i + 1]) {
      env = args[++i] as any;
    } else if (args[i] === '--from-tf-output' && args[i + 1]) {
      tfOutputFile = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--verify') {
      verify = true;
    }
  }

  return { env, tfOutputFile, dryRun, verify };
}

export function syncTerraformToWrangler(options: BridgeOptions): void {
  const rootDir = process.cwd();
  const wranglerPath = path.join(rootDir, 'wrangler.toml');

  if (!fs.existsSync(wranglerPath)) {
    throw new Error(`wrangler.toml not found at ${wranglerPath}`);
  }

  let d1Id = process.env[`TF_OUT_D1_ID`] || process.env[`D1_DATABASE_ID`];
  let kvId = process.env[`TF_OUT_KV_ID`] || process.env[`KV_NAMESPACE_ID`];
  let r2Bucket = process.env[`TF_OUT_R2_BUCKET`] || process.env[`R2_BUCKET_NAME`];

  if (options.tfOutputFile && fs.existsSync(options.tfOutputFile)) {
    const raw = fs.readFileSync(options.tfOutputFile, 'utf-8');
    const parsed: TerraformOutputs = JSON.parse(raw);
    if (parsed.d1_database_id?.value) d1Id = parsed.d1_database_id.value;
    if (parsed.kv_namespace_id?.value) kvId = parsed.kv_namespace_id.value;
    if (parsed.r2_bucket_name?.value) r2Bucket = parsed.r2_bucket_name.value;
  }

  console.log(`\n🔗 [Terraform-Wrangler Bridge] Target Environment: ${options.env}`);
  console.log(`  - D1 Database ID:   ${d1Id || '(retaining current)'}`);
  console.log(`  - KV Namespace ID:  ${kvId || '(retaining current)'}`);
  console.log(`  - R2 Bucket:        ${r2Bucket || '(retaining current)'}`);

  if (options.verify) {
    const content = fs.readFileSync(wranglerPath, 'utf-8');
    const hasD1 = content.includes('d1_databases');
    const hasKv = content.includes('kv_namespaces');
    const hasR2 = content.includes('r2_buckets');
    if (!hasD1 || !hasKv || !hasR2) {
      throw new Error(`Verification failed: wrangler.toml missing required bindings for ${options.env}`);
    }
    console.log(`✅ [Terraform-Wrangler Bridge] Configuration verified cleanly.\n`);
    return;
  }

  let content = fs.readFileSync(wranglerPath, 'utf-8');

  if (options.env === 'staging') {
    if (d1Id) {
      content = content.replace(
        /\[\[env\.staging\.d1_databases\]\][\s\S]*?database_id\s*=\s*"[^"]+"/,
        (match) => match.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${d1Id}"`)
      );
    }
    if (kvId) {
      content = content.replace(
        /\[\[env\.staging\.kv_namespaces\]\][\s\S]*?id\s*=\s*"[^"]+"/,
        (match) => match.replace(/id\s*=\s*"[^"]+"/, `id = "${kvId}"`)
      );
    }
    if (r2Bucket) {
      content = content.replace(
        /\[\[env\.staging\.r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"[^"]+"/,
        (match) => match.replace(/bucket_name\s*=\s*"[^"]+"/, `bucket_name = "${r2Bucket}"`)
      );
    }
  } else if (options.env === 'production') {
    if (d1Id) {
      content = content.replace(
        /\[\[env\.production\.d1_databases\]\][\s\S]*?database_id\s*=\s*"[^"]+"/,
        (match) => match.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${d1Id}"`)
      );
    }
    if (kvId) {
      content = content.replace(
        /\[\[env\.production\.kv_namespaces\]\][\s\S]*?id\s*=\s*"[^"]+"/,
        (match) => match.replace(/id\s*=\s*"[^"]+"/, `id = "${kvId}"`)
      );
    }
    if (r2Bucket) {
      content = content.replace(
        /\[\[env\.production\.r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"[^"]+"/,
        (match) => match.replace(/bucket_name\s*=\s*"[^"]+"/, `bucket_name = "${r2Bucket}"`)
      );
    }
  } else if (options.env === 'preview') {
    if (d1Id) {
      content = content.replace(
        /\[\[env\.preview\.d1_databases\]\][\s\S]*?database_id\s*=\s*"[^"]+"/,
        (match) => match.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${d1Id}"`)
      );
    }
    if (kvId) {
      content = content.replace(
        /\[\[env\.preview\.kv_namespaces\]\][\s\S]*?id\s*=\s*"[^"]+"/,
        (match) => match.replace(/id\s*=\s*"[^"]+"/, `id = "${kvId}"`)
      );
    }
  }

  if (options.dryRun) {
    console.log(`[dry-run] Changes would be written to ${wranglerPath}`);
  } else {
    fs.writeFileSync(wranglerPath, content, 'utf-8');
    console.log(`✅ [Terraform-Wrangler Bridge] wrangler.toml successfully updated for ${options.env}.\n`);
  }
}

if (require.main === module) {
  const options = parseArgs();
  syncTerraformToWrangler(options);
}
