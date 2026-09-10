import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getExtensionDirs } from '../scripts/build-extensions';

describe('Directus Extension SDK & Build Pipeline', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const cmsRoot = path.resolve(__dirname, '..');
  const extensionsDir = path.join(cmsRoot, 'extensions');
  const helloWorldDir = path.join(extensionsDir, 'hello-world');
  const composePath = path.join(repoRoot, 'infra/docker/docker-compose.dev.yml');

  it('should discover extension directories containing package.json', () => {
    const dirs = getExtensionDirs();
    assert.ok(dirs.length >= 1, 'Should find at least 1 extension directory');
    assert.ok(
      dirs.some((d) => d.endsWith('hello-world')),
      'Should include hello-world extension'
    );
  });

  it('should have valid directus:extension manifest in hello-world package.json', () => {
    const pkgPath = path.join(helloWorldDir, 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'hello-world package.json must exist');

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    assert.equal(pkg.type, 'module');
    assert.ok(pkg['directus:extension'], 'Must define directus:extension object');
    assert.equal(pkg['directus:extension'].type, 'hook');
    assert.equal(pkg['directus:extension'].path, 'dist/index.js');
    assert.equal(pkg['directus:extension'].source, 'src/index.ts');
  });

  it('should have hello-world TypeScript source entrypoint', () => {
    const srcPath = path.join(helloWorldDir, 'src/index.ts');
    assert.ok(fs.existsSync(srcPath), 'hello-world src/index.ts must exist');
    const content = fs.readFileSync(srcPath, 'utf-8');
    assert.ok(content.includes('defineHook'), 'Must import or use defineHook');
  });

  it('should have compiled JavaScript bundle in dist/index.js', () => {
    const distPath = path.join(helloWorldDir, 'dist/index.js');
    assert.ok(fs.existsSync(distPath), 'hello-world dist/index.js must exist');
    const content = fs.readFileSync(distPath, 'utf-8');
    assert.ok(content.length > 0, 'Compiled bundle must not be empty');
    assert.ok(
      content.includes('export') || content.includes('default'),
      'Must contain export statement'
    );
  });

  it('should configure docker-compose.dev.yml with extensions mount and auto-reload', () => {
    assert.ok(fs.existsSync(composePath), 'docker-compose.dev.yml must exist');
    const composeContent = fs.readFileSync(composePath, 'utf-8');

    assert.ok(
      composeContent.includes('/apps/cms/extensions:/directus/extensions'),
      'Must mount cms extensions directory into /directus/extensions'
    );
    assert.ok(
      composeContent.includes("EXTENSIONS_AUTO_RELOAD: 'true'") ||
        composeContent.includes('EXTENSIONS_AUTO_RELOAD: "true"') ||
        composeContent.includes('EXTENSIONS_AUTO_RELOAD: true'),
      'Must enable EXTENSIONS_AUTO_RELOAD for hot-reloading'
    );
  });
});
