import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';
import { directusFetch } from './directus-client';

/**
 * Exports version-controlled Directus Schema Snapshot to yaml files.
 * Target locations:
 * - infra/directus/snapshot.yaml
 * - apps/cms/snapshot.yaml
 */
export async function exportSchema(): Promise<void> {
  console.log('📤 [CMS Schema Export] Fetching snapshot from Directus instance...');

  const res = await directusFetch('/schema/snapshot');
  if (!res.ok) {
    throw new Error(`Failed to fetch schema snapshot: ${JSON.stringify(res.errors || res.data)}`);
  }

  const snapshot = res.data;
  const yamlContent = stringify(snapshot, {
    indent: 2,
    lineWidth: 0,
  });

  const cwd = process.cwd();
  // Support running from repo root or apps/cms
  const repoRoot = cwd.endsWith('apps/cms') ? path.resolve(cwd, '../..') : cwd;

  const infraDirectusDir = path.join(repoRoot, 'infra/directus');
  if (!fs.existsSync(infraDirectusDir)) {
    fs.mkdirSync(infraDirectusDir, { recursive: true });
  }

  const infraSnapshotPath = path.join(infraDirectusDir, 'snapshot.yaml');
  const cmsSnapshotPath = path.join(repoRoot, 'apps/cms/snapshot.yaml');

  fs.writeFileSync(infraSnapshotPath, yamlContent, 'utf-8');
  console.log(`✅ Snapshot exported to ${infraSnapshotPath}`);

  fs.writeFileSync(cmsSnapshotPath, yamlContent, 'utf-8');
  console.log(`✅ Snapshot exported to ${cmsSnapshotPath}`);

  const collectionsCount = Array.isArray(snapshot?.collections) ? snapshot.collections.length : 0;
  const fieldsCount = Array.isArray(snapshot?.fields) ? snapshot.fields.length : 0;
  const relationsCount = Array.isArray(snapshot?.relations) ? snapshot.relations.length : 0;

  console.log(
    `🎉 Export successful: ${collectionsCount} collections, ${fieldsCount} fields, ${relationsCount} relations captured.`
  );
}

if (process.argv[1]?.includes('schema-export')) {
  exportSchema().catch((err) => {
    console.error('❌ Schema export failed:', err);
    process.exit(1);
  });
}
