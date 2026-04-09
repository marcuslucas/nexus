# Nexus — Development Roadmap

**Updated:** 2026-04-09
**Current Phase:** 2 — Module Registry
**Current Product Focus:** Platform foundation (no product-specific work yet)

---

## Phase Overview

```
Phase 0  — Repository bootstrap + documentation
Phase 1  — Core platform (Electron + Flask + health check, no modules)
Phase 2  — Module registry (product.json drives nav + blueprints)
Phase 3  — web-manager module (portfolio content CRUD + export)
Phase 4  — Sol-Quoter port (existing logic → module structure)
Phase 5  — product-db module (product/SKU catalog)
Phase 6  — Sol-Quoter × product-db integration (line item enrichment)
Phase 7  — First product builds (packaged installers)
Phase 8+  — Future modules (box-manifest, invoice, etc.)
```

---

## Phase 0 — Repository Bootstrap
**Status:** ✅ Complete
**Goal:** Everything needed to begin development exists and is correct before a line of code is written.

### Deliverables
- [x] `claude.md` — master context file
- [x] `docs/architecture.md`
- [x] `docs/module-contract.md`
- [x] `docs/conventions.md`
- [x] `docs/decisions.md`
- [x] `docs/roadmap.md`
- [x] `docs/modules/web-manager.md`
- [x] `docs/modules/sol-quoter.md`
- [x] `docs/modules/product-db.md`
- [x] `.env.example` with all required vars
- [x] `package.json` scaffolded (Electron + React deps)
- [x] `requirements.txt` scaffolded (Flask + Python deps)
- [x] Folder structure created

### Exit Criteria
A developer (or Claude Code) can read the docs and understand exactly what to build in Phase 1 without asking questions.

---

## Phase 1 — Core Platform
**Status:** ✅ Complete (2026-04-09)
**Goal:** A running Electron app that spawns Flask and displays a React UI. No modules. No features. Just the infrastructure working correctly.

### Deliverables
- [x] `core/electron/main.js` — BrowserWindow creation, Flask child process spawn, clean shutdown
- [x] `core/electron/preload.js` — context bridge with health check + shell utilities
- [x] `core/electron/ipc/server.js` — health check IPC handler
- [x] `core/electron/ipc/shell.js` — open file, open external, get app path
- [x] `core/server/app/__init__.py` — Flask app factory (no blueprints yet)
- [x] `core/server/app/config.py` — environment-based config
- [x] `core/server/app/db.py` — connection factory
- [x] `core/server/app/routes/health.py` — GET /api/health
- [x] `core/server/run.py` — Flask entry point
- [x] `core/renderer/App.jsx` — bare shell (empty nav, no routes yet)
- [x] `core/renderer/layouts/AppShell.jsx` — sidebar + content layout
- [x] `core/renderer/styles/tokens.css` — design tokens
- [x] `core/renderer/hooks/useApi.js` — data fetching hook
- [x] `core/renderer/hooks/apiClient.js` — mutation client

### Exit Criteria
- Electron launches, Flask starts as child process
- Browser window shows AppShell with empty nav
- GET /api/health returns `{ data: { status: "ok" }, error: null, timestamp }`
- Electron quit cleanly terminates Flask (no zombie process)
- Flask can be started independently for development: `python run.py`

### Known Risks
- Zombie process on crash — must be handled in main.js (see architecture.md)
- Port conflict — must be detected and reported clearly on startup

---

## Phase 2 — Module Registry
**Status:** ⬜ Not started
**Goal:** product.json drives what the app contains. Adding a module = editing one file.

### Deliverables
- [ ] `products/architect-portfolio/product.json`
- [ ] `products/sol-business/product.json`
- [ ] Core reads active product.json at startup
- [ ] Flask `__init__.py` registers blueprints from manifest
- [ ] React `App.jsx` builds nav + routes from manifests
- [ ] A placeholder module to prove the system works end-to-end

### Exit Criteria
- Two product configs exist
- Switching `NEXUS_PRODUCT` env var changes which modules are loaded
- Nav items appear from module manifest, not hardcoded in App.jsx
- A route from a placeholder module is reachable

---

## Phase 3 — web-manager Module
**Status:** ⬜ Not started
**Goal:** Full portfolio content management. This is the content system for the architect client's website.

### Deliverables
- [ ] `modules/web-manager/manifest.json`
- [ ] `modules/web-manager/db/schema.sql` — projects, images, credits tables
- [ ] Flask routes: projects CRUD, images upload/delete/reorder, export
- [ ] React screens: Dashboard, ProjectList, ProjectEditor, Traffic
- [ ] Image upload zone (drag-drop + file picker)
- [ ] Drag-to-reorder (projects list + image gallery)
- [ ] POST /api/web-manager/export → writes projects.json to site /public/content/
- [ ] Vercel Analytics integration (read-only, API key via safeStorage)

### Exit Criteria
- Full project CRUD works end-to-end
- Images upload, display, reorder, delete
- Export produces valid JSON that the Next.js site can consume
- Traffic screen shows page views from Vercel Analytics

### Reference
See `docs/modules/web-manager.md` for full field spec and route reference.

---

## Phase 4 — Sol-Quoter Port
**Status:** ⬜ Not started
**Goal:** Existing Sol-Quoter functionality, zero regression, running inside Nexus module structure.

### Approach
1. Copy `extractor.py` into `modules/sol-quoter/lib/` — no changes yet
2. Copy parser format files into `modules/sol-quoter/lib/parser/`
3. Copy `docx_generator.py` into `modules/sol-quoter/lib/`
4. Write thin Flask routes that call lib functions (replacing original Flask app)
5. Write React screens (replacing original Electron UI)
6. Run all existing test fixtures — confirm zero regression

### Deliverables
- [ ] `modules/sol-quoter/manifest.json`
- [ ] `modules/sol-quoter/lib/extractor.py` (ported)
- [ ] `modules/sol-quoter/lib/docx_generator.py` (ported)
- [ ] `modules/sol-quoter/lib/parser/` (all format parsers ported)
- [ ] Flask routes: parse, solicitations CRUD, quotes, export
- [ ] React screens: Dashboard, SolicitationList, ExtractReview, QuoteBuilder
- [ ] All original test fixtures pass

### Exit Criteria
- Drop in VA solicitation PDF → correct extraction, confidence scores
- Drop in FHWA RFQ PDF → correct extraction
- Drop in SAM.gov export → correct extraction
- Generate .docx quote → valid formatted document
- Zero regression against original Sol-Quoter behavior

### Reference
See `docs/modules/sol-quoter.md` for format specs, field mapping, and known failure modes.

---

## Phase 5 — product-db Module
**Status:** ⬜ Not started
**Goal:** Master product/SKU catalog. Shared data source for all modules that need product information.

### Deliverables
- [ ] `modules/product-db/manifest.json`
- [ ] `modules/product-db/db/schema.sql` — products, categories, product_codes tables
- [ ] Flask routes: products CRUD, lookup by code(s), search, import from CSV
- [ ] React screens: Dashboard, ProductList, ProductEditor, ImportTool
- [ ] CSV import for bulk product loading
- [ ] GET /api/product-db/products/lookup?codes=X,Y,Z — the cross-module integration endpoint

### Exit Criteria
- Products can be created, edited, deleted
- Bulk import via CSV works
- Lookup endpoint returns correct products for a list of codes
- Status field (in stock / out of stock / discontinued) is queryable

### Reference
See `docs/modules/product-db.md` for schema and lookup API spec.

---

## Phase 6 — Sol-Quoter × product-db Integration
**Status:** ⬜ Not started
**Goal:** When Sol-Quoter parses a solicitation containing product codes, it enriches the line items with data from product-db.

### Deliverables
- [ ] Sol-Quoter extraction identifies product codes in line items
- [ ] Sol-Quoter route calls product-db lookup endpoint
- [ ] ExtractReview screen shows product status alongside each line item
- [ ] Graceful degradation: if product-db module not active, line items show without enrichment

### Exit Criteria
- Parse solicitation with known product codes → line items show product name, status
- Parse solicitation with unknown codes → line items show codes, no enrichment (no error)
- product-db module disabled → sol-quoter works normally, no enrichment

---

## Phase 7 — First Product Builds
**Status:** ⬜ Not started
**Goal:** Two installable products, one per business context.

### Deliverables
- [ ] `architect-portfolio` product — electron-builder + PyInstaller packaging
- [ ] `sol-business` product — electron-builder + PyInstaller packaging
- [ ] Windows installer (.exe) for each
- [ ] macOS installer (.dmg) for each (if applicable)
- [ ] No Python required on target machine (bundled)

### Exit Criteria
- Install architect-portfolio on clean Windows machine → app launches, Flask starts, web-manager module works
- Install sol-business on clean Windows machine → app launches, sol-quoter + product-db work
- Neither product includes the other's module code or dependencies

---

## Future Modules (Backlog)

### box-manifest
Generate box content sheets for client shipments. A solicitation or manual entry produces a table of box numbers → product codes + quantities. Generates .docx or .xlsx manifest. Consumes product-db for product name resolution.

### invoice
Generate client invoices from quote data. References sol-quoter quotes. Produces formatted .docx or .pdf invoice.

### web-analytics
Enhanced traffic dashboard. Currently planned as part of web-manager but could be split if complexity warrants it.

### ai-assist (future)
Local AI via Ollama for extraction assistance, product matching, and document summarization. Opt-in. Privacy-preserving (local model, no external API). Not a V1 consideration.

---

## Dependency Map

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 (parallel with Phase 4)
                            → Phase 4
                                    → Phase 5
                                             → Phase 6
Phase 3 + Phase 4 + Phase 5 + Phase 6 → Phase 7
```

Phases 3 and 4 can be developed in parallel once Phase 2 is complete.
Phase 5 can start alongside Phase 4 (product-db doesn't depend on sol-quoter).
Phase 6 requires both Phase 4 and Phase 5 to be complete.
