# Nexus — System Architecture

**Version:** 1.0
**Status:** Canonical. Update this document when architecture changes. Log the change in `decisions.md`.

---

## System Overview

Nexus is a local-first desktop platform. It runs entirely on the user's machine. There is no cloud dependency for core functionality. External connections (Vercel Analytics, SAM.gov, Anthropic API) are opt-in, scoped to specific modules, and never touch the user's documents.

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Shell                        │
│                                                          │
│   ┌──────────────────────────────────────────────────┐  │
│   │              React Renderer (UI)                  │  │
│   │                                                   │  │
│   │   AppShell (core layout)                          │  │
│   │     └── Nav built from module manifests           │  │
│   │     └── Routes built from module manifests        │  │
│   │           └── Module screens render here          │  │
│   │                                                   │  │
│   │   All data access → HTTP fetch to localhost:PORT  │  │
│   └────────────────────┬──────────────────────────────┘  │
│                        │ HTTP (localhost only)            │
│   ┌────────────────────▼──────────────────────────────┐  │
│   │              Flask API Server                      │  │
│   │              (child process)                       │  │
│   │                                                   │  │
│   │   Core routes:   /api/health                      │  │
│   │   web-manager:   /api/projects, /api/images…      │  │
│   │   sol-quoter:    /api/solicitations, /api/quotes… │  │
│   │   product-db:    /api/products…                   │  │
│   │                                                   │  │
│   │   Each module blueprint mounted at startup        │  │
│   └────────────────────┬──────────────────────────────┘  │
│                        │                                  │
│   ┌────────────────────▼──────────────────────────────┐  │
│   │              SQLite Databases                      │  │
│   │              (one file per module)                 │  │
│   │                                                   │  │
│   │   core.db          → [reserved, currently empty]  │  │
│   │   web-manager.db   → projects, images, credits    │  │
│   │   sol-quoter.db    → solicitations, quotes        │  │
│   │   product-db.db    → products, categories, stock  │  │
│   └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Process Architecture

### Electron main process (`core/electron/main.js`)
- Creates the BrowserWindow
- Spawns Flask as a child process on startup
- Monitors Flask health before showing the window (prevents blank screen on slow start)
- Kills Flask cleanly on app quit — **zombie process prevention is a known failure mode**
- Manages the port — reads from env, falls back to default, passes to Flask via env var

### Electron renderer process (`core/renderer/`)
- Pure React application
- Has zero Node.js access — everything goes through the contextBridge
- Communicates with Flask via standard HTTP fetch calls
- Communicates with main process via the exposed IPC API only (open file, get app path, etc.)

### Flask server (`core/server/`)
- Started by Electron main, but independently runnable for development and testing
- Registers module blueprints based on active product configuration
- Each module blueprint is isolated — failure in one module does not crash others
- Port is always configured via environment variable `FLASK_PORT`

### Context Bridge (IPC contract)
The preload script exposes a minimal, explicit API to the renderer. Nothing else is accessible.

```javascript
// core/electron/preload.js — the only IPC surface
window.nexus = {
  // Server
  checkHealth: () => ipcRenderer.invoke('server:health'),

  // Shell utilities
  openFile: (path) => ipcRenderer.invoke('shell:openFile', path),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getAppPath: () => ipcRenderer.invoke('shell:getAppPath'),

  // Env / config (read-only, non-sensitive values only)
  getConfig: () => ipcRenderer.invoke('shell:getConfig'),
}
```

If a new IPC capability is needed, it is added here explicitly. The renderer never gets `ipcRenderer` directly.

---

## Module Architecture

### What a module is
A module is a self-contained feature set. It owns:
- Its Flask routes (registered as a Blueprint)
- Its SQLite schema (applied on first run)
- Its React screens and components
- Its navigation items
- Its own documentation in `docs/modules/`

A module does **not** own:
- Core UI primitives (use `core/renderer/components/`)
- Platform IPC (use the bridge defined in preload)
- Another module's database

### How modules are loaded

**At build time:** `products/[product-name]/product.json` lists which modules are active.

**At runtime (Flask):** `core/server/app/__init__.py` reads the active product config and calls `register_blueprint()` for each module's declared blueprints.

**At runtime (React):** `core/renderer/App.jsx` reads the same product config, imports each module's `renderer/index.js`, and assembles the nav and route tree.

### Module manifest (`manifest.json`)
Every module declares itself. Core reads this. Core never reads module internals directly.

```json
{
  "id": "sol-quoter",
  "name": "Solicitation Quoter",
  "version": "1.0.0",
  "description": "Government solicitation PDF parsing and quote generation",
  "server": {
    "blueprints": [
      "modules.sol_quoter.server.routes.solicitations",
      "modules.sol_quoter.server.routes.quotes",
      "modules.sol_quoter.server.routes.export"
    ],
    "db_schema": "modules/sol-quoter/db/schema.sql",
    "db_env_key": "SOL_QUOTER_DB_PATH"
  },
  "renderer": {
    "entry": "modules/sol-quoter/renderer/index.js"
  },
  "nav": [
    { "id": "sq-dashboard",     "label": "Dashboard",      "icon": "grid",      "path": "/sol-quoter" },
    { "id": "sq-solicitations", "label": "Solicitations",  "icon": "file-text", "path": "/sol-quoter/solicitations" },
    { "id": "sq-quotes",        "label": "Quotes",         "icon": "send",      "path": "/sol-quoter/quotes" }
  ]
}
```

---

## Data Flow Examples

### Creating a project (web-manager module)
```
User fills form in ProjectEditor.jsx
  → calls POST /api/projects with JSON body
  → Flask web-manager blueprint handles route
  → validates input, writes to web-manager.db
  → returns { data: { id, ...project }, error: null, timestamp }
  → React updates local state, shows success toast
```

### Parsing a solicitation (sol-quoter module)
```
User drops PDF onto upload zone
  → file sent via multipart/form-data to POST /api/solicitations/parse
  → Flask reads PDF bytes (never written to disk unencrypted)
  → pdfplumber extracts text → format fingerprinting → field extraction
  → confidence scores calculated per field
  → returns { data: { fields, confidence, raw_text_preview }, error: null, timestamp }
  → React renders ExtractReview screen with flagged low-confidence fields
```

### Product lookup during solicitation parse (cross-module via API)
```
sol-quoter extractor identifies line items from solicitation
  → Flask sol-quoter route calls GET /api/products/lookup?codes=1234,5678
  → product-db blueprint responds with matched products + status
  → sol-quoter route merges product data into response
  → React shows line items annotated with product DB status
```
Note: This is the ONLY approved pattern for cross-module data access.
Module A's Flask route calls Module B's Flask route internally.
Module A never imports Module B's models or queries Module B's database directly.

---

## Security Model

- **No data leaves the machine** unless the user explicitly connects an external service (Vercel Analytics API key, SAM.gov, Anthropic API key)
- **API keys** are stored using Electron `safeStorage` (OS-level encryption — Keychain on macOS, DPAPI on Windows)
- **Flask is localhost-only.** It binds to `127.0.0.1`, never `0.0.0.0`
- **No authentication between Electron and Flask** — the local network boundary is the security boundary. This is appropriate for a single-user desktop app. If this ever becomes multi-user or network-accessible, this must be revisited.
- **PDF files** are read into memory for parsing. They are not re-uploaded anywhere.

---

## External Integrations (opt-in, per module)

| Integration | Module | Purpose | What it receives |
|---|---|---|---|
| Vercel Analytics API | `web-manager` | Traffic stats | Read-only API call, no user data |
| SAM.gov API | `sol-quoter` | Solicitation lookup by ID | Solicitation ID only |
| Anthropic Claude API | `sol-quoter` | AI-assisted extraction fallback | Extracted text only, never raw PDF |

All external integrations:
- Require a user-provided API key
- Are disabled by default
- Have their keys stored via `safeStorage`, never in plaintext
- Have a clearly documented data boundary in their module's `docs/modules/*.md` file

---

## Known Failure Modes (learned from Sol-Quoter development)

These are real failures that occurred during Sol-Quoter's original development. They are documented here so they are designed around from the start.

1. **Zombie Flask process holding the port.** If Electron crashes without killing Flask, the next launch fails silently because the old process owns the port. Mitigation: `main.js` must kill by PID on quit AND on startup if a process is already bound to the configured port.

2. **pdfplumber vs pypdf text differences.** These two libraries produce different whitespace output from the same PDF. Regex patterns that pass unit tests against pypdf output can silently fail at runtime with pdfplumber. Always test extraction against pdfplumber output specifically.

3. **Stale packaged binary.** PyInstaller bundles the Python at build time. If you test the installed package after changing source code, the changes are not present. Always test against source in dev mode until you're ready for a packaging pass.

4. **IPC bridge surface creep.** Every time something is convenient to do in main process, there's pressure to add another IPC handler. Resist this. Every addition to the bridge is a security surface. Add only what's explicitly needed.

---

## Packaging

Each product is packaged independently using `electron-builder` + `PyInstaller`.

```
products/architect-portfolio/product.json
  → defines which modules are bundled
  → electron-builder config references this
  → PyInstaller bundles only the Python files needed by active modules
  → Output: platform-specific installer (.exe / .dmg)
```

This means `sol-quoter`'s PDF parsing dependencies are NOT bundled in the `architect-portfolio` product. Bundle size stays minimal per product.
