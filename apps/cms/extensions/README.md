# Directus Extension SDK & Build Pipeline

This directory contains custom Directus 11 extensions (hooks, endpoints, and bundles) for the ChrisShop platform.

Extensions are compiled from TypeScript using `@directus/extensions-sdk` and mounted into the Directus container for local development and runtime execution.

---

## Directory Architecture

Each extension is organized as an isolated package inside `apps/cms/extensions/<extension-name>`:

```text
apps/cms/extensions/
├── README.md                          # Extension development documentation (this file)
└── hello-world/                       # Sample hook extension
    ├── package.json                   # Extension manifest with directus:extension metadata
    ├── tsconfig.json                  # TypeScript compiler options
    ├── src/
    │   └── index.ts                   # TypeScript entrypoint
    └── dist/
        └── index.js                   # Compiled JavaScript bundle (loaded by Directus)
```

Directus discovers local extensions by scanning subdirectories inside `/directus/extensions`. Each subfolder must have a `package.json` with a valid `directus:extension` manifest object.

---

## Extension Manifest (`package.json`)

Extensions must define the `"directus:extension"` block:

```json
{
  "name": "directus-extension-hello-world",
  "description": "ChrisShop Hello World Hook Extension",
  "icon": "extension",
  "version": "1.0.0",
  "type": "module",
  "files": ["dist"],
  "directus:extension": {
    "type": "hook",
    "path": "dist/index.js",
    "source": "src/index.ts",
    "host": "^11.0.0"
  },
  "scripts": {
    "build": "directus-extension build",
    "dev": "directus-extension build -w --no-minify"
  }
}
```

---

## Available Scripts

All extension commands can be executed from the monorepo root or within `apps/cms`:

| Command                              | Working Directory | Description                                                           |
| :----------------------------------- | :---------------- | :-------------------------------------------------------------------- |
| `pnpm --filter cms build:extensions` | Monorepo root     | Compiles all extensions in `apps/cms/extensions/` to `dist/index.js`  |
| `pnpm --filter cms dev:extensions`   | Monorepo root     | Runs watch mode across all extensions with live recompilation         |
| `pnpm --filter cms dev`              | Monorepo root     | Alias for `dev:extensions` (local dev watcher)                        |
| `pnpm --filter cms test`             | Monorepo root     | Runs CMS test suite including extension manifest and build validation |
| `pnpm run build`                     | Monorepo root     | Monorepo production build (includes extension compilation)            |

---

## Scaffolding a New Extension

To create a new extension in `apps/cms/extensions/`:

1. Run the Directus Extension SDK CLI:

   ```bash
   pnpm --filter cms exec directus-extension create <type> <name>
   ```

   _Available types_: `hook`, `endpoint`, `bundle`, etc.

2. Move or create the extension folder inside `apps/cms/extensions/<name>/`.

3. Ensure dependencies resolve to `apps/cms` (which provides `@directus/extensions-sdk` and `typescript`).

4. Add your TypeScript implementation in `src/index.ts`.

5. Build the extension:
   ```bash
   pnpm --filter cms build:extensions
   ```

---

## Local Development & Hot-Reloading Workflow

1. **Start the Docker Stack**:

   ```bash
   docker compose -f infra/docker/docker-compose.dev.yml up -d
   ```

   The `cms` service automatically mounts `apps/cms/extensions` to `/directus/extensions`:

   ```yaml
   volumes:
     - ./../../apps/cms/extensions:/directus/extensions
   environment:
     EXTENSIONS_AUTO_RELOAD: 'true'
   ```

2. **Start the Extension Watcher**:

   ```bash
   pnpm --filter cms dev
   ```

   The watcher uses `directus-extension build -w --no-minify` to watch `src/` files and compile changes immediately to `dist/index.js`.

3. **Automatic Hot-Reload**:
   Because `EXTENSIONS_AUTO_RELOAD: 'true'` is configured in `docker-compose.dev.yml`, Directus watches `/directus/extensions` and reloads modified extensions automatically without restarting the container:
   ```text
   [HH:MM:SS] INFO: Extensions unloaded
   [HH:MM:SS] INFO: Extensions loaded
   [HH:MM:SS] INFO: Extensions reloaded
   ```

---

## Verifying Extensions

### 1. Directus Container Logs

Check startup and reload logs in the running container:

```bash
docker logs chrishop-cms | grep -E "Loaded extensions|Extensions reloaded"
```

Expected output:

```text
[17:23:02.026] INFO: Loaded extensions: directus-extension-hello-world
[17:23:16.601] INFO: Extensions reloaded
```

### 2. Automated Test Suite

Run the monorepo and CMS tests to verify extension manifests, compilation outputs, and compose configuration:

```bash
pnpm --filter cms test
```

---

## Phase 3 Extension Roadmap

The following custom extensions will be developed using this pipeline in Phase 3:

1. **Scheduled Drop Status Transitions** (`hook`):
   - Transitions product drops from `scheduled` to `active` to `ended` based on timestamps.
2. **Tracking URL Generation** (`endpoint` / `hook`):
   - Computes carrier tracking URLs and attaches them to order records.
3. **Resend Email Dispatch** (`hook`):
   - Triggers transactional order confirmation and shipping emails via Resend.
