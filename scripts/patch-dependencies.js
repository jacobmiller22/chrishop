const fs = require('fs');
const path = require('path');

const candidatePaths = [
  process.cwd(),
  path.join(process.cwd(), 'apps/web'),
  path.join(__dirname, '../apps/web'),
  __dirname
];

// 1. Patch @next/env CJS/ESM interop
try {
  const envPath = require.resolve('@next/env', { paths: candidatePaths });
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (!content.includes('n.default=n;')) {
      fs.writeFileSync(envPath, content.replace('module.exports=n', 'n.default=n;module.exports=n'));
      console.log('[patch-dependencies] Patched @next/env at', envPath);
    } else {
      console.log('[patch-dependencies] @next/env already patched at', envPath);
    }
  }
} catch (err) {
  console.warn('[patch-dependencies] Could not resolve @next/env:', err.message);
}

// 2. Patch @opennextjs/cloudflare AST vercel-og patcher for multi-worker route splitting
try {
  const openNextEntry = require.resolve('@opennextjs/cloudflare', { paths: candidatePaths });
  const pkgDir = path.resolve(path.dirname(openNextEntry), '../..');
  const patchFilePath = path.join(
    pkgDir,
    'dist/cli/build/patches/ast/patch-vercel-og-library.js'
  );
  if (fs.existsSync(patchFilePath)) {
    let content = fs.readFileSync(patchFilePath, 'utf8');
    let modified = false;

    // Ensure outputDir exists before copyFileSync
    if (!content.includes('mkdirSync(outputDir, { recursive: true });')) {
      content = content.replace(
        'if (!existsSync(outputEdgePath)) {',
        'if (!existsSync(outputEdgePath)) {\n            mkdirSync(outputDir, { recursive: true });'
      );
      modified = true;
    }

    // Ensure sourceFontPath is copied before renameSync
    if (!content.includes('const sourceFontPath =')) {
      content = content.replace(
        'const destFontPath = path.join(outputDir, fontFileName);',
        `const sourceFontPath = path.join(path.dirname(traceInfoPath), tracedNodePath.replace("index.node.js", fontFileName));
                const destFontPath = path.join(outputDir, fontFileName);
                if (!existsSync(destFontPath) && existsSync(sourceFontPath)) {
                    copyFileSync(sourceFontPath, destFontPath);
                }`
      );
      modified = true;
    }

    // Ensure routeFilePath exists before parseFile (handles multi-worker route function splitting)
    if (!content.includes('if (!existsSync(routeFilePath)) {')) {
      content = content.replace(
        'const routeFilePath = traceInfoPath.replace(appBuildOutputPath, packagePath).replace(".nft.json", "");',
        `const routeFilePath = traceInfoPath.replace(appBuildOutputPath, packagePath).replace(".nft.json", "");
            if (!existsSync(routeFilePath)) {
                continue;
            }`
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(patchFilePath, content, 'utf8');
      console.log('[patch-dependencies] Patched @opennextjs/cloudflare patch-vercel-og-library.js at', patchFilePath);
    } else {
      console.log('[patch-dependencies] @opennextjs/cloudflare already patched at', patchFilePath);
    }
  }
} catch (err) {
  console.warn('[patch-dependencies] Could not resolve @opennextjs/cloudflare:', err.message);
}
