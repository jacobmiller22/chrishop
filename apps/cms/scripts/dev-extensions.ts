import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

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

export function watchExtensions(): void {
  const extensionDirs = getExtensionDirs();

  if (extensionDirs.length === 0) {
    console.log('No extensions found in apps/cms/extensions.');
    return;
  }

  console.log(`Starting extension watch mode for ${extensionDirs.length} extension(s)...`);
  for (const extDir of extensionDirs) {
    const pkg = JSON.parse(readFileSync(join(extDir, 'package.json'), 'utf-8'));
    const name = pkg.name || extDir;
    console.log(`Watching extension: ${name}`);

    const child = spawn('pnpm', ['exec', 'directus-extension', 'build', '-w', '--no-minify'], {
      cwd: extDir,
      stdio: 'inherit',
      env: { ...process.env },
    });

    child.on('error', (err) => {
      console.error(`Error in extension watcher for ${name}:`, err);
    });
  }
}

if (process.argv[1] && process.argv[1].endsWith('dev-extensions.ts')) {
  watchExtensions();
}
