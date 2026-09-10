import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const extensionsDir = resolve(__dirname, '../extensions');

export function getExtensionDirs(): string[] {
  if (!existsSync(extensionsDir)) {
    return [];
  }

  return readdirSync(extensionsDir)
    .filter((entry) => {
      const fullPath = join(extensionsDir, entry);
      return (
        statSync(fullPath).isDirectory() &&
        !entry.startsWith('.') &&
        existsSync(join(fullPath, 'package.json'))
      );
    })
    .map((entry) => join(extensionsDir, entry));
}

export function buildExtensions(): void {
  const extensionDirs = getExtensionDirs();

  if (extensionDirs.length === 0) {
    console.log('No extensions found in apps/cms/extensions.');
    return;
  }

  console.log(`Found ${extensionDirs.length} extension(s) in apps/cms/extensions:`);
  for (const extDir of extensionDirs) {
    const pkg = JSON.parse(readFileSync(join(extDir, 'package.json'), 'utf-8'));
    const name = pkg.name || extDir;
    console.log(`\nBuilding extension: ${name}...`);

    execSync('pnpm exec directus-extension build', {
      cwd: extDir,
      stdio: 'inherit',
      env: { ...process.env },
    });

    console.log(`✓ Built ${name} successfully.`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('build-extensions.ts')) {
  buildExtensions();
}
