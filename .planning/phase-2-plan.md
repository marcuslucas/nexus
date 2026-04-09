# Phase 2 Plan — Module Registry

**Phase:** 2
**Goal:** `product.json` drives what the app contains. A placeholder `web-manager` stub proves Flask blueprint registration and React nav assembly work end-to-end before any real module code is written.
**Depends on:** Phase 1 (core platform) ✅
**Status:** Ready to begin

---

## Success Criteria (Definition of Done)

Every item below must be true before Phase 2 is considered complete.

- [ ] `products/architect-portfolio/product.json` and `products/sol-business/product.json` exist with correct module lists
- [ ] Flask `__init__.py` reads the active product's `product.json`, loads each module's `manifest.json`, and registers declared blueprints — without crashing if a module's DB env key is not set
- [ ] `GET /api/web-manager/ping` returns the standard `{ data, error, timestamp }` envelope — proving blueprint registration works
- [ ] React `App.jsx` reads active module list from IPC config, looks each up in `moduleRegistry.js`, and assembles nav items and routes
- [ ] AppShell sidebar renders the nav item declared in `web-manager`'s manifest
- [ ] Navigating to `/web-manager` renders the stub Dashboard screen — no blank page, no console errors
- [ ] Setting `NEXUS_PRODUCT=sol-business` (where web-manager is not listed) causes the nav item to disappear — module list is data-driven, not hardcoded
- [ ] Core boots cleanly with `NEXUS_PRODUCT=unknown` (zero modules) — no crash, empty nav

---

## Naming Convention Note — Python vs Filesystem

Module IDs use hyphens: `web-manager`, `sol-quoter`, `product-db`.
Python cannot import from a hyphenated directory name.

**Rule (applies to all phases):**
- Physical Python package directory: `modules/web_manager/` (underscore)
- Module ID in `manifest.json`: `"id": "web-manager"` (hyphen — used in routes, nav paths, product.json)
- Flask blueprint paths in manifest use underscores: `modules.web_manager.server.routes.ping`
- Filesystem paths in manifest (schema, renderer entry) use hyphens matching the directory... 

Wait — the directory IS underscored. So filesystem paths also use underscores:
- `"db_schema": "modules/web_manager/db/schema.sql"`
- `"renderer.entry": "modules/web_manager/renderer/index.js"`

The hyphen appears only in: `manifest.id`, API route prefixes (`/api/web-manager/`), nav paths (`/web-manager`), and `product.json` module lists.

Core maps `module_id.replace('-', '_')` when constructing filesystem/import paths from the manifest ID.

---

## File Build Order

Build in this order. Each step should work before moving to the next.

---

### Step 1 — Product config files

These are pure data. No code depends on them yet. Create them first so all subsequent steps can reference them.

```
products/architect-portfolio/product.json
products/sol-business/product.json
```

| File | What it does |
|---|---|
| `products/architect-portfolio/product.json` | Declares `modules: ["web-manager"]` — the active module list for this product |
| `products/sol-business/product.json` | Declares `modules: ["sol-quoter", "product-db"]` — for future use; these modules don't exist yet |

**Test:** Files are valid JSON. `NEXUS_PRODUCT` env var matches a directory name.

---

### Step 2 — Python package init files

Python requires `__init__.py` in every directory that is part of an importable package. These are empty files that unlock `importlib.import_module('modules.web_manager.server.routes.ping')`.

```
modules/__init__.py
modules/web_manager/__init__.py
modules/web_manager/server/__init__.py
modules/web_manager/server/routes/__init__.py
```

| File | What it does |
|---|---|
| `modules/__init__.py` | Makes `modules/` an importable Python package |
| `modules/web_manager/__init__.py` | Makes the web-manager module a Python package |
| `modules/web_manager/server/__init__.py` | Makes the server subdirectory importable |
| `modules/web_manager/server/routes/__init__.py` | Makes the routes subdirectory importable |

---

### Step 3 — web-manager stub: manifest + schema

```
modules/web_manager/manifest.json
modules/web_manager/db/schema.sql
```

| File | What it does |
|---|---|
| `modules/web_manager/manifest.json` | Full module declaration: id, name, blueprints list, db_env_key, db_schema path, renderer entry, nav items |
| `modules/web_manager/db/schema.sql` | Stub schema with a single placeholder comment and no tables — Phase 3 adds real tables |

**manifest.json must declare:**
- `"id": "web-manager"`
- `"server.blueprints": ["modules.web_manager.server.routes.ping"]`
- `"server.db_env_key": "WEB_MANAGER_DB_PATH"`
- `"server.db_schema": "modules/web_manager/db/schema.sql"`
- `"renderer.entry": "modules/web_manager/renderer/index.js"`
- `"nav"`: one item — label "Web Manager", path `/web-manager`

---

### Step 4 — web-manager stub: Flask route

```
modules/web_manager/server/routes/ping.py
```

| File | What it does |
|---|---|
| `modules/web_manager/server/routes/ping.py` | Defines Blueprint `web_manager_ping` with a single `GET /api/web-manager/ping` route returning `{ data: { module: "web-manager", status: "ok" }, error: null, timestamp }` — proves blueprint registration works without requiring a database |

This is a stub route only. It is replaced by real routes in Phase 3 (the blueprint list in manifest.json will grow; `ping.py` is removed).

---

### Step 5 — web-manager stub: React renderer

```
modules/web_manager/renderer/screens/Dashboard.jsx
modules/web_manager/renderer/index.js
```

| File | What it does |
|---|---|
| `modules/web_manager/renderer/screens/Dashboard.jsx` | Stub screen rendering a placeholder — "Web Manager" heading and "Coming in Phase 3" note — no data fetching |
| `modules/web_manager/renderer/index.js` | Exports `navItems` (one entry matching the manifest nav) and `routes` (one entry: path `/web-manager` → Dashboard component) |

**`index.js` export shape** (required by module contract):
```javascript
export const navItems = [ { id, label, icon, path } ];
export const routes   = [ { path, component } ];
```

---

### Step 6 — Core Flask: blueprint registration from product.json

```
core/server/app/__init__.py   (modify)
```

| Change | What it does |
|---|---|
| Add `_load_modules(app)` function | Reads `products/{NEXUS_PRODUCT}/product.json`, iterates module IDs, loads each `manifest.json`, registers blueprints via `importlib.import_module`, applies db schema if env key is set and db path is configured |

**Critical requirements:**
- If `NEXUS_PRODUCT` is `unknown` or the product.json doesn't exist: log a warning, continue with zero modules — do not crash
- If a blueprint fails to import: log the error, skip that blueprint, continue — one bad module must not kill Flask
- If `db_env_key` is set but the env var is not defined: skip schema application silently — dev without all DBs configured must still work
- Schema application: read the `.sql` file and `executescript()` on a fresh connection — idempotent because schema uses `CREATE TABLE IF NOT EXISTS`
- Module directory name derived from ID: `module_id.replace('-', '_')`

---

### Step 7 — Electron: pass module list through IPC

```
core/electron/main.js         (modify)
core/electron/ipc/shell.js    (modify)
```

| File | Change |
|---|---|
| `core/electron/main.js` | At startup, read `products/{NEXUS_PRODUCT}/product.json`; store the `modules` array; pass it to `registerShellIpc` alongside existing config |
| `core/electron/ipc/shell.js` | Add `modules` array to the `shell:getConfig` IPC response so the renderer knows which modules are active |

**Why:** React's module registry is static (webpack resolves imports at build time). The renderer needs to know which subset of registered modules is active for the current product. This comes from the IPC config.

**Edge case:** If `product.json` doesn't exist (e.g., `NEXUS_PRODUCT=unknown`), pass `modules: []` — renderer shows empty nav, no crash.

---

### Step 8 — Core React: module registry + router

```
package.json                          (modify — add react-router-dom)
core/renderer/moduleRegistry.js       (create)
core/renderer/App.jsx                 (modify)
```

| File | Change |
|---|---|
| `package.json` | Add `react-router-dom` to dependencies |
| `core/renderer/moduleRegistry.js` | Static map of all known module IDs to their renderer exports — the single file that changes when a new module is added to the platform. Phase 2: contains only `'web-manager'` entry. |
| `core/renderer/App.jsx` | Read `modules` list from IPC config; look each up in `MODULE_REGISTRY`; collect `navItems` and `routes`; render `HashRouter` wrapping `AppShell` (with assembled navItems) and `Routes` built from collected route definitions |

**`moduleRegistry.js` pattern:**
```javascript
import * as webManager from '../../modules/web_manager/renderer/index.js';

export const MODULE_REGISTRY = {
  'web-manager': webManager,
  // Phase 3+: add 'sol-quoter', 'product-db' here
};
```

**Routing:** Use `HashRouter` from `react-router-dom`. Hash routing avoids Electron's `file://` protocol issues with browser-history routing. A default redirect from `/` to the first active module's first route prevents blank content area.

---

## What NOT to Build in Phase 2

- No real web-manager CRUD routes (Phase 3)
- No database tables in the stub schema (Phase 3)
- No React screens beyond the Dashboard stub (Phase 3)
- No sol-quoter or product-db module code (Phase 4 and 5)
- No theme switcher UI (deferred — system is already wired)
- No module hot-reload or dynamic plugin loading (not in scope for V1)

---

## Risks

1. **`importlib.import_module` path resolution.** If `sys.path` doesn't include the project root, the dotted path `modules.web_manager...` won't resolve. The project root is already on `sys.path` via `run.py`'s path setup — verify this holds when Flask is spawned by Electron (env var `PYTHONPATH` is set in `main.js`).

2. **Webpack can't resolve module renderer imports.** `moduleRegistry.js` imports from `modules/web_manager/renderer/index.js`. Webpack resolves from the project root — confirm the relative path from `core/renderer/moduleRegistry.js` is correct (`../../../modules/web_manager/renderer/index.js`).

3. **HashRouter vs file:// protocol.** Electron loads the renderer via `win.loadFile()`, which uses the `file://` protocol. BrowserRouter relies on the HTML5 History API which doesn't work under `file://`. HashRouter is the correct choice here and avoids this entirely.

4. **Empty module list.** When `NEXUS_PRODUCT=sol-business`, `web-manager` is not in the module list. The renderer must handle an empty `MODULE_REGISTRY` lookup gracefully — no crash, just empty nav and a "no modules loaded" state in the content area.

---

## Phase 2 Complete → Go to Phase 3

When all success criteria are checked, update:
- `claude.md` → Active Development State: "Phase 2 complete. Starting Phase 3."
- `docs/roadmap.md` → Mark Phase 2 tasks complete
- `docs/decisions.md` → Append decisions made during Phase 2 (notably: `HashRouter` for Electron, `moduleRegistry.js` as the static import boundary, underscore directory names for Python packages)
- `claude.md` → Module Registry table: update `web-manager` status from `planned` to `scaffolded`
