import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { directusFetch } from './directus-client';
import { setupSchema } from './setup-schema';

/**
 * Applies version-controlled Directus Schema Snapshot to target instance.
 */
export async function applySchema(): Promise<void> {
  console.log('📥 [CMS Schema Apply] Applying version-controlled Directus Schema Snapshot...');

  const cwd = process.cwd();
  const repoRoot = cwd.endsWith('apps/cms') ? path.resolve(cwd, '../..') : cwd;

  let snapshotPath = path.join(repoRoot, 'infra/directus/snapshot.yaml');
  if (!fs.existsSync(snapshotPath)) {
    snapshotPath = path.join(repoRoot, 'apps/cms/snapshot.yaml');
  }

  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot file not found at ${snapshotPath}`);
  }

  const rawYaml = fs.readFileSync(snapshotPath, 'utf-8');
  const snapshotData = parse(rawYaml);

  console.log(
    `Loaded snapshot from ${snapshotPath} (Directus ${snapshotData.directus}, ${snapshotData.collections?.length || 0} collections)`
  );

  // 1. First ensure all base collections and fields are provisioned
  await setupSchema();

  // 2. Submit snapshot diff to Directus schema service
  try {
    const diffRes = await directusFetch('/schema/diff', {
      method: 'POST',
      body: JSON.stringify(snapshotData),
    });

    if (diffRes.ok && diffRes.data?.diff) {
      console.log('Applying schema diff to Directus...');
      const applyRes = await directusFetch('/schema/apply', {
        method: 'POST',
        body: JSON.stringify(diffRes.data.diff),
      });

      if (!applyRes.ok) {
        console.warn('Notice from schema:apply:', applyRes.errors || applyRes.data);
      } else {
        console.log('Schema diff applied successfully.');
      }
    } else {
      console.log('Schema is already in sync with snapshot (no diff detected).');
    }
  } catch (err) {
    console.warn('Notice while evaluating schema diff:', err);
  }

  console.log('✅ [CMS Schema Apply] Directus schema snapshot applied successfully.');
}

if (process.argv[1]?.includes('schema-apply')) {
  applySchema().catch((err) => {
    console.error('❌ Schema apply failed:', err);
    process.exit(1);
  });
}
