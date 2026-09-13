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

// 1b. Patch Next.js setup-http-agent-env to guard against missing node:http in edge runtimes
try {
  const setupHttpAgentEnvPath = require.resolve('next/dist/server/setup-http-agent-env.js', { paths: candidatePaths });
  if (fs.existsSync(setupHttpAgentEnvPath)) {
    let content = fs.readFileSync(setupHttpAgentEnvPath, 'utf8');
    if (!content.includes('// [patched for cloudflare-workers]')) {
      content = `// [patched for cloudflare-workers]
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "setHttpClientAndAgentOptions", {
    enumerable: true,
    get: function() {
        return setHttpClientAndAgentOptions;
    }
});
function setHttpClientAndAgentOptions(config) {
    try {
        if (globalThis.__NEXT_HTTP_AGENT) return;
        if (!config || !config.httpAgentOptions) return;
        globalThis.__NEXT_HTTP_AGENT_OPTIONS = config.httpAgentOptions;
        const _http = require("http");
        const _https = require("https");
        if (_http && typeof _http.Agent === "function") {
            globalThis.__NEXT_HTTP_AGENT = new _http.Agent(config.httpAgentOptions);
        }
        if (_https && typeof _https.Agent === "function") {
            globalThis.__NEXT_HTTPS_AGENT = new _https.Agent(config.httpAgentOptions);
        }
    } catch {
        // Silently continue in edge workers where node:http may be stubbed or unavailable
    }
}
`;
      fs.writeFileSync(setupHttpAgentEnvPath, content, 'utf8');
      console.log('[patch-dependencies] Patched setup-http-agent-env.js at', setupHttpAgentEnvPath);
    } else {
      console.log('[patch-dependencies] setup-http-agent-env.js already patched at', setupHttpAgentEnvPath);
    }
  }
} catch (err) {
  console.warn('[patch-dependencies] Could not resolve setup-http-agent-env.js:', err.message);
}

// 1c. Patch Next.js next-server.js to expose debug error headers on 500 responses
try {
  const nextServerPath = require.resolve('next/dist/server/next-server.js', { paths: candidatePaths });
  if (fs.existsSync(nextServerPath)) {
    let content = fs.readFileSync(nextServerPath, 'utf8');
    if (!content.includes('x-debug-error')) {
      content = content.replace(
        'res.statusCode = 500;',
        `try {
          const errStr = (err && (err.stack || err.message || String(err))).replace(/\\r?\\n/g, ' -- ');
          res.setHeader('x-debug-error', errStr.slice(0, 1000));
        } catch {}
        res.statusCode = 500;`
      );
      content = content.replace(
        'res.statusCode = 500;\\n                    await this.renderError(error',
        `try {
          const errStr = (error && (error.stack || error.message || String(error))).replace(/\\r?\\n/g, ' -- ');
          res.setHeader('x-debug-error', errStr.slice(0, 1000));
        } catch {}
        res.statusCode = 500;
                    await this.renderError(error`
      );
      fs.writeFileSync(nextServerPath, content, 'utf8');
      console.log('[patch-dependencies] Patched next-server.js for x-debug-error at', nextServerPath);
    } else {
      console.log('[patch-dependencies] next-server.js already patched for x-debug-error at', nextServerPath);
    }
  }
} catch (err) {
  console.warn('[patch-dependencies] Could not resolve next-server.js:', err.message);
}

// 1d. Patch Next.js base-server.js to expose diagnostic error details on 500 responses
try {
  const baseServerPath = require.resolve('next/dist/server/base-server.js', { paths: candidatePaths });
  if (fs.existsSync(baseServerPath)) {
    let content = fs.readFileSync(baseServerPath, 'utf8');
    if (!content.includes('/* patched-base-server-error */')) {
      content = content.replace(
        "res.body('Internal Server Error').send();",
        `/* patched-base-server-error */
        try {
          const errDetails = String(err && (err.stack || err.message || err));
          res.setHeader('x-debug-error', errDetails.replace(/\\r?\\n/g, ' -- ').slice(0, 1000));
          res.body('Internal Server Error: ' + errDetails).send();
        } catch {
          res.body('Internal Server Error').send();
        }`
      );
      content = content.replace(
        "body: _renderresult.default.fromStatic('Internal Server Error', 'text/plain')",
        `/* patched-base-server-error */
        body: _renderresult.default.fromStatic('Internal Server Error: ' + String((typeof err !== 'undefined' && err && (err.stack || err.message || err)) || (typeof renderToHtmlError !== 'undefined' && renderToHtmlError && (renderToHtmlError.stack || renderToHtmlError.message || renderToHtmlError)) || 'Unknown Error'), 'text/plain')`
      );
      fs.writeFileSync(baseServerPath, content, 'utf8');
      console.log('[patch-dependencies] Patched base-server.js for diagnostic error details at', baseServerPath);
    } else {
      console.log('[patch-dependencies] base-server.js already patched for diagnostic error details at', baseServerPath);
    }
  }
} catch (err) {
  console.warn('[patch-dependencies] Could not resolve base-server.js:', err.message);
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

    // Ensure mkdirSync is imported from node:fs
    if (!content.includes('mkdirSync')) {
      content = content.replace(
        'import {',
        'import { mkdirSync,'
      );
      modified = true;
    }

    // Ensure outputDir exists before copyFileSync
    if (!content.includes('mkdirSync(outputDir, { recursive: true });')) {
      content = content.replace(
        'if (!existsSync(outputEdgePath)) {',
        'if (!existsSync(outputEdgePath)) {\n            mkdirSync(outputDir, { recursive: true });'
      );
      modified = true;
    }

    // Ensure fontSrc exists before renameSync
    if (content.includes('renameSync(path.join(outputDir, fontFileName)') && !content.includes('existsSync(fontSrc)')) {
      content = content.replace(
        'const fontFileName = matches[0].getMatch("PATH").text();\n                renameSync(path.join(outputDir, fontFileName), path.join(outputDir, `${fontFileName}.bin`));',
        `const fontFileName = matches[0].getMatch("PATH").text();
                const fontSrc = path.join(outputDir, fontFileName);
                if (existsSync(fontSrc)) {
                    renameSync(fontSrc, path.join(outputDir, \`\${fontFileName}.bin\`));
                }`
      );
      modified = true;
    } else if (content.includes('const destFontPath = path.join(outputDir, fontFileName);') && !content.includes('const sourceFontPath =')) {
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
      console.log('[patch-dependencies] @opennextjs/cloudflare patch-vercel-og-library.js already patched at', patchFilePath);
    }
  }

  // 3. Patch @opennextjs/cloudflare build plugins to support multi-worker function splitting
  const pluginsDir = path.join(pkgDir, 'dist/cli/build/patches/plugins');
  if (fs.existsSync(pluginsDir)) {
    const pluginFiles = [
      'open-next.js',
      'next-server.js',
      'route-module.js',
      'load-manifest.js',
      'find-dir.js',
      'dynamic-requires.js',
      'instrumentation.js',
    ];
    for (const file of pluginFiles) {
      const filePath = path.join(pluginsDir, file);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('path.join("server-functions", buildOpts.currentFnName ?? "default")')) {
          content = content.replace(
            /path\.join\("server-functions", buildOpts\.currentFnName \?\? "default"\)/g,
            '"server-functions", (buildOpts.currentFnName ?? "default")'
          );
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`[patch-dependencies] Fixed ${file} join syntax for multi-function splitting`);
        } else if (content.includes('"server-functions/default"')) {
          content = content.replace(
            /"server-functions\/default"/g,
            '"server-functions", (buildOpts.currentFnName ?? "default")'
          );
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`[patch-dependencies] Patched ${file} for multi-function splitting`);
        }
      }
    }
  }

  // 4. Patch @opennextjs/cloudflare bundle-server.js to bundle all server-functions (default + admin)
  const bundleServerPath = path.join(pkgDir, 'dist/cli/build/bundle-server.js');
  if (fs.existsSync(bundleServerPath)) {
    let content = fs.readFileSync(bundleServerPath, 'utf8');
    let modified = false;

    // Reset previous patch if needed to apply currentBuildOpts
    if (content.includes('const serverFunctionsBase =') && !content.includes('currentBuildOpts')) {
      // Re-read or adjust
      content = content.replace(
        'const updater = new ContentUpdater(buildOpts);',
        'const currentBuildOpts = { ...buildOpts, currentFnName: fnName };\n        const updater = new ContentUpdater(currentBuildOpts);'
      );
      content = content.replace(
        /shimRequireHook\(buildOpts\)/g,
        'shimRequireHook(currentBuildOpts)'
      );
      content = content.replace(
        /shimReact\(buildOpts\)/g,
        'shimReact(currentBuildOpts)'
      );
      content = content.replace(
        /inlineDynamicRequires\(updater, buildOpts\)/g,
        'inlineDynamicRequires(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchInstrumentation\(updater, buildOpts\)/g,
        'patchInstrumentation(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchPagesRouterContext\(buildOpts\)/g,
        'patchPagesRouterContext(currentBuildOpts)'
      );
      content = content.replace(
        /inlineFindDir\(updater, buildOpts\)/g,
        'inlineFindDir(updater, currentBuildOpts)'
      );
      content = content.replace(
        /inlineLoadManifest\(updater, buildOpts\)/g,
        'inlineLoadManifest(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchNextServer\(updater, buildOpts\)/g,
        'patchNextServer(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchRouteModules\(updater, buildOpts\)/g,
        'patchRouteModules(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchResolveCache\(updater, buildOpts\)/g,
        'patchResolveCache(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchSetWorkingDirectory\(updater, buildOpts\)/g,
        'patchSetWorkingDirectory(updater, currentBuildOpts)'
      );
      modified = true;
    } else if (!content.includes('const serverFunctionsBase =')) {
      content = content.replace(
        'const outputPath = path.join(outputDir, "server-functions", "default");\n    const packagePath = getPackagePath(buildOpts);\n    const openNextServer = path.join(outputPath, packagePath, `index.mjs`);\n    const openNextServerBundle = path.join(outputPath, packagePath, `handler.mjs`);\n    const updater = new ContentUpdater(buildOpts);',
        `const serverFunctionsBase = path.join(outputDir, "server-functions");
    const fnNames = fs.existsSync(serverFunctionsBase)
        ? fs.readdirSync(serverFunctionsBase).filter(f => fs.statSync(path.join(serverFunctionsBase, f)).isDirectory())
        : ["default"];
    for (const fnName of fnNames) {
        const currentBuildOpts = { ...buildOpts, currentFnName: fnName };
        const outputPath = path.join(outputDir, "server-functions", fnName);
        const packagePath = getPackagePath(currentBuildOpts);
        const openNextServer = path.join(outputPath, packagePath, \`index.mjs\`);
        if (!fs.existsSync(openNextServer)) continue;
        const openNextServerBundle = path.join(outputPath, packagePath, \`handler.mjs\`);
        const updater = new ContentUpdater(currentBuildOpts);`
      );

      content = content.replace(
        /shimRequireHook\(buildOpts\)/g,
        'shimRequireHook(currentBuildOpts)'
      );
      content = content.replace(
        /shimReact\(buildOpts\)/g,
        'shimReact(currentBuildOpts)'
      );
      content = content.replace(
        /inlineDynamicRequires\(updater, buildOpts\)/g,
        'inlineDynamicRequires(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchInstrumentation\(updater, buildOpts\)/g,
        'patchInstrumentation(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchPagesRouterContext\(buildOpts\)/g,
        'patchPagesRouterContext(currentBuildOpts)'
      );
      content = content.replace(
        /inlineFindDir\(updater, buildOpts\)/g,
        'inlineFindDir(updater, currentBuildOpts)'
      );
      content = content.replace(
        /inlineLoadManifest\(updater, buildOpts\)/g,
        'inlineLoadManifest(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchNextServer\(updater, buildOpts\)/g,
        'patchNextServer(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchRouteModules\(updater, buildOpts\)/g,
        'patchRouteModules(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchResolveCache\(updater, buildOpts\)/g,
        'patchResolveCache(updater, currentBuildOpts)'
      );
      content = content.replace(
        /patchSetWorkingDirectory\(updater, buildOpts\)/g,
        'patchSetWorkingDirectory(updater, currentBuildOpts)'
      );

      if (!content.includes('"node:child_process":')) {
        const shimList = `\n            "node:child_process": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "child_process": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:worker_threads": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "worker_threads": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:cluster": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "cluster": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:dgram": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "dgram": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:v8": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "v8": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:http2": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "http2": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:repl": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "repl": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:inspector": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "inspector": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:readline": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "readline": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:tty": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "tty": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:dns": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "dns": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "@aws-sdk/signature-v4-crt": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "@aws-sdk/signature-v4a": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),`;

        content = content.replace(
          '"@next/env": path.join(buildOpts.outputDir, "cloudflare-templates/shims/env.js"),',
          '"@next/env": path.join(buildOpts.outputDir, "cloudflare-templates/shims/env.js"),\n            "node:sqlite": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),\n            "node:vm": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),\n            "vm": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),' + shimList
        );
        modified = true;
      }

      content = content.replace(
        'const isMonorepo = monorepoRoot !== appPath;\n    if (isMonorepo) {\n        fs.writeFileSync(path.join(outputPath, "handler.mjs"), `export { handler } from "./${normalizePath(packagePath)}/handler.mjs";`);\n    }\n    console.log(`\\x1b[35mWorker saved in',
        `const isMonorepo = monorepoRoot !== appPath;
        if (isMonorepo) {
            fs.writeFileSync(path.join(outputPath, "handler.mjs"), \`export { handler } from "./\${normalizePath(packagePath)}/handler.mjs";\`);
        }
    }
    console.log(\`\\x1b[35mWorker saved in`
      );
      modified = true;
    }

    if (!content.includes('"node:child_process":')) {
      const shimList = `\n            "node:child_process": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "child_process": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:worker_threads": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "worker_threads": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:cluster": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "cluster": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:dgram": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "dgram": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:v8": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "v8": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:http2": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "http2": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:repl": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "repl": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:inspector": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "inspector": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:readline": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "readline": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:tty": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "tty": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "node:dns": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "dns": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "@aws-sdk/signature-v4-crt": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
            "@aws-sdk/signature-v4a": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),`;

      content = content.replace(
        '"vm": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),',
        '"vm": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),' + shimList
      );
      modified = true;
    }

    const safeRequireBanner = `js: \`import {setInterval, clearInterval, setTimeout, clearTimeout} from "node:timers";
import { createRequire as __topLevelCreateRequire } from "node:module";
try { if (typeof globalThis.process === "undefined") { globalThis.process = { env: {}, versions: { node: "22.0.0" }, version: "v22.0.0", platform: "linux", arch: "x64" }; } else { if (!process.versions) { try { process.versions = { node: "22.0.0" }; } catch {} } if (!process.version) { try { process.version = "v22.0.0"; } catch {} } } } catch {}
if (typeof globalThis.MessagePort === "undefined") globalThis.MessagePort = class MessagePort {};
if (typeof globalThis.MessageChannel === "undefined") globalThis.MessageChannel = class MessageChannel { constructor() { this.port1 = new globalThis.MessagePort(); this.port2 = new globalThis.MessagePort(); } };
if (typeof globalThis.FinalizationRegistry === "undefined") globalThis.FinalizationRegistry = class FinalizationRegistry { constructor() {} register() {} unregister() { return false; } };
if (typeof globalThis.WeakRef === "undefined") globalThis.WeakRef = class WeakRef { #t; constructor(t) { this.#t = t; } deref() { return this.#t; } };
const __rawRequire = __topLevelCreateRequire(import.meta.url);
const __unsupportedBuiltins = {
  "child_process": { exec: () => {}, execSync: () => {}, spawn: () => {}, spawnSync: () => {}, fork: () => {}, ChildProcess: class {} },
  "node:child_process": { exec: () => {}, execSync: () => {}, spawn: () => {}, spawnSync: () => {}, fork: () => {}, ChildProcess: class {} },
  "worker_threads": { isMainThread: true, Worker: class {}, parentPort: null, workerData: null, threadId: 0, markAsUncloneable: (o) => o, markAsUntransferable: (o) => o, isMarkedAsUntransferable: () => false, MessageChannel: globalThis.MessageChannel || class {}, MessagePort: globalThis.MessagePort || class {}, BroadcastChannel: globalThis.BroadcastChannel || class {} },
  "node:worker_threads": { isMainThread: true, Worker: class {}, parentPort: null, workerData: null, threadId: 0, markAsUncloneable: (o) => o, markAsUntransferable: (o) => o, isMarkedAsUntransferable: () => false, MessageChannel: globalThis.MessageChannel || class {}, MessagePort: globalThis.MessagePort || class {}, BroadcastChannel: globalThis.BroadcastChannel || class {} },
  "http2": { constants: { HTTP2_HEADER_AUTHORITY: ":authority", HTTP2_HEADER_METHOD: ":method", HTTP2_HEADER_PATH: ":path", HTTP2_HEADER_SCHEME: ":scheme", HTTP2_HEADER_STATUS: ":status" } },
  "node:http2": { constants: { HTTP2_HEADER_AUTHORITY: ":authority", HTTP2_HEADER_METHOD: ":method", HTTP2_HEADER_PATH: ":path", HTTP2_HEADER_SCHEME: ":scheme", HTTP2_HEADER_STATUS: ":status" } },
  "readline": { createInterface: () => ({ on: () => {}, close: () => {} }) },
  "tty": { isatty: () => false },
  "dns": { lookup: (_h, cb) => cb && cb(null, "127.0.0.1", 4), resolve: () => {}, promises: {} },
  "node:dns": { lookup: (_h, cb) => cb && cb(null, "127.0.0.1", 4), resolve: () => {}, promises: {} },
  "cluster": {},
  "node:cluster": {},
  "dgram": {},
  "node:dgram": {},
  "v8": {},
  "node:v8": {},
  "repl": {},
  "node:repl": {},
  "inspector": {},
  "node:inspector": {},
  "perf_hooks": globalThis.performance || {},
  "node:perf_hooks": globalThis.performance || {},
  "@aws-sdk/signature-v4-crt": {},
  "@aws-sdk/signature-v4a": {},
};
const require = (mod) => {
  if (__unsupportedBuiltins[mod]) return __unsupportedBuiltins[mod];
  try {
    const res = __rawRequire(mod);
    if ((mod === "events" || mod === "node:events") && typeof res === "object" && res && (res.EventEmitter || res.default)) {
      const b = res.EventEmitter || res.default;
      if (typeof b === "function") {
        for (const k in res) {
          if (!(k in b)) {
            try { b[k] = res[k]; } catch {}
          }
        }
        return b;
      }
    }
    if ((mod === "assert" || mod === "node:assert") && typeof res === "object" && res && (res.default || res.assert)) {
      const b = res.default || res.assert;
      if (typeof b === "function") {
        for (const k in res) {
          if (!(k in b)) {
            try { b[k] = res[k]; } catch {}
          }
        }
        return b;
      }
    }
    return res;
  } catch (e) {
    const stripped = String(mod || "").replace(/^node:/, "");
    if (__unsupportedBuiltins[stripped]) return __unsupportedBuiltins[stripped];
    return {};
  }
};
Object.assign(require, __rawRequire);\`,`;

    if (content.includes('__unsupportedBuiltins')) {
      content = content.replace(
        /js: `import {setInterval, clearInterval, setTimeout, clearTimeout} from "node:timers";[\s\S]*?Object\.assign\(require, __rawRequire\);`,/,
        safeRequireBanner
      );
      modified = true;
    } else if (content.includes('__topLevelCreateRequire')) {
      content = content.replace(
        /js: `import {setInterval, clearInterval, setTimeout, clearTimeout} from "node:timers";\s*import { createRequire as __topLevelCreateRequire } from "node:module";\s*const require = __topLevelCreateRequire\(import\.meta\.url\);`,/,
        safeRequireBanner
      );
      modified = true;
    } else {
      content = content.replace(
        'js: `import {setInterval, clearInterval, setTimeout, clearTimeout} from "node:timers"`,',
        safeRequireBanner
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(bundleServerPath, content, 'utf8');
      console.log('[patch-dependencies] Patched @opennextjs/cloudflare bundle-server.js at', bundleServerPath);
    } else {
      console.log('[patch-dependencies] @opennextjs/cloudflare bundle-server.js already patched at', bundleServerPath);
    }
  }

  // 4b. Patch @opennextjs/cloudflare empty.js template shim to provide safe stubs
  const emptyShimPath = path.join(pkgDir, 'dist/cli/templates/shims/empty.js');
  if (fs.existsSync(emptyShimPath)) {
    const emptyShimContent = `export const ChildProcess = class {};
export const _forkChild = () => {};
export const exec = () => {};
export const execFile = () => {};
export const execFileSync = () => {};
export const execSync = () => {};
export const fork = () => {};
export const spawn = () => {};
export const spawnSync = () => {};
export const isMainThread = true;
export const Worker = class {};
export const parentPort = null;
export const workerData = null;
export const threadId = 0;
export const markAsUncloneable = (o) => o;
export const markAsUntransferable = (o) => o;
export const isMarkedAsUntransferable = () => false;
export const MessageChannel = globalThis.MessageChannel || class {};
export const MessagePort = globalThis.MessagePort || class {};
export const BroadcastChannel = globalThis.BroadcastChannel || class {};
export const createInterface = () => ({ on: () => {}, close: () => {} });
export const isatty = () => false;
export const lookup = (_h, cb) => cb && cb(null, "127.0.0.1", 4);
export const resolve = () => {};
export const promises = {};
export const constants = {
  HTTP2_HEADER_AUTHORITY: ":authority",
  HTTP2_HEADER_METHOD: ":method",
  HTTP2_HEADER_PATH: ":path",
  HTTP2_HEADER_SCHEME: ":scheme",
  HTTP2_HEADER_STATUS: ":status"
};
const emptyObj = {
  ChildProcess, _forkChild, exec, execFile, execFileSync, execSync, fork, spawn, spawnSync,
  isMainThread, Worker, parentPort, workerData, threadId, markAsUncloneable, markAsUntransferable, isMarkedAsUntransferable,
  MessageChannel, MessagePort, BroadcastChannel,
  createInterface, isatty, lookup, resolve, promises, constants
};
export default new Proxy(emptyObj, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return () => {};
  },
});
`;
    fs.writeFileSync(emptyShimPath, emptyShimContent, 'utf8');
    console.log('[patch-dependencies] Patched empty.js shim for comprehensive node built-in stubs');
  }

  // 4. Patch @opennextjs/cloudflare templates/worker.js to dispatch between admin and default functions
  const workerTemplatePath = path.join(pkgDir, 'dist/cli/templates/worker.js');
  if (fs.existsSync(workerTemplatePath)) {
    let content = fs.readFileSync(workerTemplatePath, 'utf8');
    let modified = false;

    if (!content.includes('const isAdminRoute =')) {
      content = content.replace(
        'const { handler } = await import("./server-functions/default/handler.mjs");\n            return handler(reqOrResp, env, ctx, request.signal);',
        `const pathname = url.pathname;
            const isAdminRoute =
                pathname === "/admin" ||
                pathname.startsWith("/admin/") ||
                pathname.startsWith("/api/payload/") ||
                pathname === "/api/graphql" ||
                pathname.startsWith("/api/graphql/");

            if (isAdminRoute) {
                // @ts-expect-error: resolved by wrangler build
                const { handler } = await import("./server-functions/admin/handler.mjs");
                return handler(reqOrResp, env, ctx, request.signal);
            }

            // @ts-expect-error: resolved by wrangler build
            const { handler } = await import("./server-functions/default/handler.mjs");
            return handler(reqOrResp, env, ctx, request.signal);`
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(workerTemplatePath, content, 'utf8');
      console.log('[patch-dependencies] Patched @opennextjs/cloudflare templates/worker.js at', workerTemplatePath);
    } else {
      console.log('[patch-dependencies] @opennextjs/cloudflare templates/worker.js already patched at', workerTemplatePath);
    }
  }

  // Patch compile-env-files.js to avoid duplicate exports on multiple compilations
  const compileEnvFilesPath = path.join(pkgDir, 'dist/cli/build/open-next/compile-env-files.js');
  if (fs.existsSync(compileEnvFilesPath)) {
    let content = fs.readFileSync(compileEnvFilesPath, 'utf8');
    if (!content.includes('next-env.mjs`), ""')) {
      content = content.replace(
        'fs.mkdirSync(envDir, { recursive: true });',
        'fs.mkdirSync(envDir, { recursive: true });\n    fs.writeFileSync(path.join(envDir, `next-env.mjs`), "");'
      );
      fs.writeFileSync(compileEnvFilesPath, content, 'utf8');
      console.log('[patch-dependencies] Patched @opennextjs/cloudflare compile-env-files.js at', compileEnvFilesPath);
    } else {
      console.log('[patch-dependencies] @opennextjs/cloudflare compile-env-files.js already patched at', compileEnvFilesPath);
    }
  }
} catch (err) {
  console.warn('[patch-dependencies] Could not resolve @opennextjs/cloudflare:', err.message);
}
