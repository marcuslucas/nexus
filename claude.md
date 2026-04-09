# NEXUS — Master Context File
> Claude Code reads this file at the start of every session, every time, without exception.
> If this file is stale, the session will produce code that contradicts prior decisions.
> Keep it current. It is the project's shared brain.

---

## What Nexus Is

Nexus is a **local-first, modular desktop platform** built on Electron + React + Flask + SQLite.

It is not a single application. It is a **product platform**. Each deployable product is:

```
Nexus Core (never changes)
  + one or more Modules (feature sets)
  = one Product (bundled, distributed application)
```

**Current products being built:**
| Product | Modules | Purpose |
|---|---|---|
| `architect-portfolio` | `web-manager` | Portfolio site content management for architecture client |
| `sol-business` | `sol-quoter`, `product-db` | Government solicitation parsing, quoting, product tracking |

The long-term vision is a business operating system — managing bids, products, inventory, client deliverables, and web presence from one platform, deployed as purpose-built products per business context.

---

## Repository Structure

```
nexus/
├── claude.md                        ← YOU ARE HERE. Read every session.
├── package.json                     ← Electron + React deps
├── requirements.txt                 ← Python platform-level deps
├── .env.example                     ← All required env vars documented
│
├── core/                            ← Platform shell. NEVER contains business logic.
│   ├── electron/
│   │   ├── main.js                  ← Entry: spawns Flask, creates BrowserWindow
│   │   ├── preload.js               ← Context bridge — IPC API exposed to renderer
│   │   └── ipc/
│   │       ├── server.js            ← Health check, server lifecycle IPC
│   │       └── shell.js             ← Open file, open external URL
│   ├── renderer/
│   │   ├── App.jsx                  ← Reads module registry, builds nav + routes
│   │   ├── layouts/
│   │   │   └── AppShell.jsx         ← Sidebar + topbar + content slot
│   │   ├── components/              ← Shared UI primitives only (Button, Modal, Table…)
│   │   ├── hooks/                   ← Shared hooks (useApi, useToast, useConfirm…)
│   │   └── styles/                  ← Design tokens, global CSS
│   └── server/
│       ├── app/
│       │   ├── __init__.py          ← App factory. Registers blueprints from active modules.
│       │   ├── config.py            ← Env-based config class
│       │   ├── db.py                ← Connection factory — path injected via env var
│       │   └── routes/
│       │       └── health.py        ← /api/health — platform level only
│       └── run.py                   ← Flask entry point
│
├── modules/                         ← Self-contained feature sets
│   ├── web-manager/                 ← Website content management
│   ├── sol-quoter/                  ← Solicitation parsing + quote generation
│   ├── product-db/                  ← Product/SKU database and lookup
│   └── [future-module]/
│
├── products/                        ← Product bundle definitions
│   ├── architect-portfolio/
│   │   ├── product.json             ← modules: ["web-manager"]
│   │   └── assets/
│   └── sol-business/
│       ├── product.json             ← modules: ["sol-quoter", "product-db"]
│       └── assets/
│
├── docs/                            ← Living documentation. Claude Code reads before acting.
│   ├── architecture.md              ← System design, data flow, boundaries
│   ├── module-contract.md           ← Spec for building any new module
│   ├── conventions.md               ← Naming, patterns, error handling rules
│   ├── decisions.md                 ← ADR log — every significant choice + why
│   ├── roadmap.md                   ← Phase plan, current status
│   └── modules/
│       ├── web-manager.md           ← Schema, routes, export contract
│       ├── sol-quoter.md            ← Field mapping, format specs, parser logic
│       ├── product-db.md            ← Schema, lookup API, integration points
│       └── [future-module].md
│
└── .planning/                       ← Session-level plans (ephemeral, not permanent docs)
    └── [phase-N-plan.md]            ← Written BEFORE each phase starts, checked off during
```

---

## Active Development State

**Current Phase:** `3 — web-manager Module`
**Active Product:** `architect-portfolio`
**Last Session:** 2026-04-09 — Phase 2 complete. product.json drives module loading end-to-end. Flask registers blueprints from manifest via importlib. React assembles nav + routes from active module list (passed through IPC config). web-manager stub scaffolded: manifest, ping route, Dashboard screen, renderer/index.js. HashRouter wired. moduleRegistry.js is the static import boundary. GET /api/web-manager/ping confirmed 200. NEXUS_PRODUCT=unknown and sol-business both boot cleanly with zero modules.
**Next Priority:** Phase 3 — web-manager module. Replace stub with real schema (projects, images, credits tables), full CRUD routes, and React screens (ProjectList, ProjectEditor, Dashboard).

---

## Module Registry

Modules currently in this repository:

| Module ID | Status | DB Env Key | Description |
|---|---|---|---|
| `web-manager` | `scaffolded` | `WEB_MANAGER_DB_PATH` | Website content CRUD + export |
| `sol-quoter` | `planned` | `SOL_QUOTER_DB_PATH` | Solicitation parsing + .docx quote generation |
| `product-db` | `planned` | `PRODUCT_DB_PATH` | Product/SKU master database |

**To add a new module:** See `docs/module-contract.md`. Add entry to this table when scaffolded.

---

## Immutable Rules
> These rules do not bend. If a task seems to require breaking them, stop and re-examine the approach.

1. **Business logic never lives in `core/`.** Core is infrastructure only. Features live in modules.
2. **Modules never import from other modules.** Cross-module data access goes through the Flask API only.
3. **All API responses use the standard envelope:** `{ data, error, timestamp }`. No exceptions.
4. **Database paths come from environment variables only.** Nothing is hardcoded.
5. **Renderer process never touches the database.** All data access goes through Flask API via HTTP.
6. **Every module is independently testable.** No module requires another module to run tests.
7. **No module is required for Core to boot.** Core starts clean with zero modules if needed.
8. **`claude.md`, `docs/decisions.md`, and relevant `docs/modules/*.md` are updated at the end of every session** that makes a structural or significant decision.

---

## Standard API Response Contract

Every Flask route in every module returns this shape. No exceptions.

```python
{
  "data": <payload or null>,
  "error": <string or null>,
  "timestamp": <ISO 8601 string>
}
```

HTTP status codes are used correctly: 200, 201, 400, 404, 422, 500. Never return 200 with an error in the body.

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Desktop shell | Electron | Manages window, spawns Flask as child process |
| UI framework | React | Loaded in Electron renderer process |
| IPC | Electron contextBridge + ipcRenderer | Renderer never has Node access directly |
| API server | Flask (Python) | Runs on localhost, port configured via env |
| Database | SQLite (per module) | Local file, path injected via env var |
| PDF parsing | pdfplumber (primary), pypdf (fallback) | Used in sol-quoter module |
| .docx generation | python-docx | Used in sol-quoter module |
| Packaging | electron-builder + PyInstaller | Per-product bundle |
| Testing | pytest (Python), Jest (JS) | Module-level unit tests |

---

## Key Decisions Log
> Append every significant decision here. Date it. Never delete entries.

| Date | Decision | Reason |
|---|---|---|
| [project start] | Per-module SQLite databases, not shared | Module isolation — no cross-module data coupling at DB layer |
| [project start] | Option B UI: core ships shell, modules register via manifest | Right complexity for current scale. Dynamic plugin loading is premature. |
| [project start] | Static module registry via product.json, not dynamic plugin loading | VS Code-style plugins are a 6-month architecture project. Registry is honest for V1. |
| [project start] | Sol-Quoter ported into nexus/modules/sol-quoter, original repo retired | One codebase. Prevents drift and duplication. |
| [project start] | Renderer communicates with Flask via HTTP only, never direct DB or IPC data calls | Flask API is the single data access layer. UI is independently swappable. |

---

## Before You Write Any Code This Session

1. Read this file fully.
2. Read `docs/conventions.md`.
3. Read `docs/architecture.md`.
4. If working on a specific module, read `docs/modules/[module-name].md`.
5. If a phase plan exists in `.planning/`, read it.
6. Check "Active Development State" above — know where we are before adding anything.
7. If something contradicts these docs, **stop and flag it** before proceeding.
