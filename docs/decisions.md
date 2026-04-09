# Nexus — Architectural Decision Record

This file is append-only. Decisions are never deleted or edited after the fact.
If a decision is reversed, a new entry is added explaining what changed and why.
This prevents re-litigating decisions that were already made with full context.

---

## Format

```
## [DATE] — [Decision title]
**Status:** Accepted | Superseded by [DATE entry]
**Context:** Why this decision needed to be made.
**Decision:** What was decided.
**Consequences:** What this enables, what it forecloses, what tradeoffs it carries.
```

---

## [Project Start] — Platform architecture: modular hub, not standalone app

**Status:** Accepted

**Context:**
Initial scope was a portfolio content management tool. The requirement expanded: the same shell needed to work for a solicitation business tool, and potentially many future business contexts. Building a single-purpose app would require rebuilding the shell each time.

**Decision:**
Build Nexus as a product platform. Core = infrastructure only. Features live in modules. Products = Core + a set of modules, bundled per business context.

**Consequences:**
- Higher upfront complexity than a single-purpose app
- Future features are additive, not architectural rewrites
- Each new business context requires only a new module + product.json
- The shell investment pays off starting at the second product

---

## [Project Start] — Per-module SQLite databases (not shared)

**Status:** Accepted

**Context:**
Modules could share one SQLite file with tables namespaced by module, or each module could own its own database file.

**Decision:**
Each module owns its own SQLite file. Path injected via environment variable. Core has its own (currently empty) core.db.

**Consequences:**
- Modules cannot accidentally corrupt each other's data
- A module can be removed cleanly without touching other modules' data
- Cross-module queries require an API call, not a JOIN — this is the correct tradeoff
- Slightly more complex initialization (multiple DB connections) — acceptable

---

## [Project Start] — Static module registry via product.json (not dynamic plugins)

**Status:** Accepted

**Context:**
Two approaches to loading modules: (A) a plugin system where modules are discovered and loaded at runtime dynamically, like VS Code extensions; (B) a static registry where product.json explicitly lists which modules are bundled.

**Decision:**
Option B — static registry. product.json lists modules. Core reads this at startup and loads declared modules.

**Consequences:**
- Adding a module requires editing product.json and rebuilding — this is acceptable
- Dynamic loading (add module without rebuild) is not possible — out of scope for current scale
- Significantly simpler implementation — no module discovery, no version conflict resolution
- Can be upgraded to dynamic loading later without restructuring existing modules

---

## [Project Start] — Option B UI: core ships shell, modules register nav + routes via manifest

**Status:** Accepted

**Context:**
Two approaches to module UI: (A) modules ship their own React components as true plugins, loaded at runtime; (B) modules declare nav items and routes in their manifest, core assembles the nav and router, modules export screen components that are statically imported.

**Decision:**
Option B — static imports. Core's App.jsx imports from each active module's renderer/index.js at build time. Modules register nav and routes, core assembles them.

**Consequences:**
- Modules cannot be added without a rebuild (same as registry decision above)
- Dramatically simpler than a true plugin system
- Screen components are type-safe and tree-shakable
- Consistent: adding a module always follows the same pattern

---

## [Project Start] — Sol-Quoter ported into nexus/modules/sol-quoter (original repo retired)

**Status:** Accepted

**Context:**
Sol-Quoter exists as a standalone working application. Options: (A) maintain it as a separate repo and have Nexus reference it; (B) port its logic into Nexus as a module and retire the original repo.

**Decision:**
Option A (port + retire). The existing Python logic (extractor.py, docx_generator.py, parser formats) moves to modules/sol-quoter/lib/. The Flask routes move to modules/sol-quoter/server/routes/. The Electron shell is replaced by Nexus core.

**Consequences:**
- One codebase — no drift, no duplication
- Sol-Quoter's business logic is preserved exactly — no rewrite of the extraction patterns
- The original repo becomes a reference archive, not an active codebase
- First real test of the module architecture: Sol-Quoter must fit the module contract cleanly

---

## [Project Start] — Renderer communicates with Flask via HTTP only

**Status:** Accepted

**Context:**
The Electron renderer could access the database directly via ipcMain handlers, bypassing Flask entirely. This would be simpler for some read operations.

**Decision:**
The Flask API is the only data access layer. Renderer → HTTP → Flask → SQLite. No exceptions.

**Consequences:**
- Flask API is independently testable without Electron
- Renderer could be replaced with a web UI without changing any backend code
- Slightly more latency on local calls — immaterial for a desktop app at this scale
- IPC surface stays minimal and explicit

---

## [Project Start] — Modules never import from other modules (API-only cross-module communication)

**Status:** Accepted

**Context:**
When sol-quoter needs product data from product-db, it could: (A) import product-db's models directly; (B) call product-db's Flask routes via HTTP.

**Decision:**
Option B always. Module A calls Module B's API routes. No direct imports.

**Consequences:**
- Cross-module data access is explicit and auditable
- Modules remain independently deployable and testable
- Graceful degradation is natural: if product-db is unavailable, sol-quoter handles it
- Tiny overhead of a localhost HTTP call — immaterial

---

## [Project Start] — Business logic in lib/, not in Flask routes

**Status:** Accepted

**Context:**
PDF parsing, .docx generation, and confidence scoring could live directly in Flask route handlers, or in separate pure-Python files.

**Decision:**
All business logic lives in modules/[id]/lib/. Flask routes are thin: validate input, call lib function, return response. Lib functions have zero Flask imports.

**Consequences:**
- Lib functions are testable without a Flask test client
- Business logic is readable without understanding HTTP mechanics
- Extraction patterns (the hardest part of sol-quoter) can be unit tested in isolation
- Explicit boundary makes the codebase easier to reason about

---

## [2026-04-09] — Windows zombie process kill uses taskkill, not process.kill()

**Status:** Accepted

**Context:**
On Windows, `process.kill()` in Node.js does not reliably terminate child processes or their subprocesses. A crashed Electron session can leave Flask holding the port, causing silent startup failure on the next launch.

**Decision:**
`main.js` uses `taskkill /PID <pid> /T /F` (via `execSync`) for both on-quit cleanup and startup zombie detection. `netstat -ano | findstr :<port>` identifies zombie PIDs before spawning a new Flask process.

**Consequences:**
- Clean shutdown on Windows matches Unix behavior
- Zombie processes from prior crashes are killed on next startup, not silently ignored
- `taskkill` is a Windows-only syscall — packaging for macOS would require `kill -9` instead

---

## [2026-04-09] — Webpack bundles renderer; Electron loads HTML file directly

**Status:** Accepted

**Context:**
Needed a build pipeline for the React renderer that works with Electron's `loadFile()` pattern (not a dev server).

**Decision:**
Webpack bundles `core/renderer/index.js` → `core/renderer/dist/bundle.js`. `core/renderer/index.html` loads `dist/bundle.js` via a `<script>` tag. Electron's `main.js` calls `win.loadFile('core/renderer/index.html')`.

**Consequences:**
- Works without a dev server — `npm run build` is the only prerequisite before `npm start`
- `npm run build:watch` + `electron .` in parallel for development
- Renderer bundle must be rebuilt after any source change (no HMR in Phase 1)

---

## [Project Start] — Product database as a standalone module (product-db)

**Status:** Accepted

**Context:**
Product/SKU data is needed by sol-quoter (matching parsed line items against known products) and by a future box-manifest module (generating box content sheets). This data could live inside sol-quoter, or as its own module.

**Decision:**
product-db is its own module. It owns the product catalog data. Other modules access it via the cross-module API pattern.

**Consequences:**
- Product data is not duplicated across modules
- Sol-quoter and box-manifest both query the same product truth source
- product-db can evolve independently (add fields, import formats, etc.) without touching consumer modules
- Follows the principle: data that is shared between modules belongs to no single module
