# Module Contract — How to Build a Nexus Module

Every module follows this contract. No exceptions. This document is the specification
Claude Code reads before scaffolding any new module.

---

## What a Module Must Provide

| Artifact | Required | Purpose |
|---|---|---|
| `manifest.json` | Yes | Declares module to Core |
| `server/routes/*.py` | Yes | Flask blueprints |
| `db/schema.sql` | Yes | SQLite schema — module owns its tables |
| `renderer/index.js` | Yes | Exports nav items and React route definitions |
| `renderer/screens/` | Yes | At minimum one screen |
| `docs/modules/[id].md` | Yes | Living documentation for this module |
| `tests/` | Yes | At minimum one test file per route module |

---

## Directory Structure (required layout)

```
modules/[module-id]/
├── manifest.json
├── server/
│   ├── routes/
│   │   └── [feature].py          ← One file per route group
│   └── models/
│       └── [model].py            ← SQLAlchemy-style model OR plain dataclass
├── lib/                          ← Pure Python business logic (no Flask imports)
│   └── [logic].py
├── db/
│   └── schema.sql                ← CREATE TABLE IF NOT EXISTS only
├── renderer/
│   ├── index.js                  ← Exports: { navItems, routes }
│   ├── screens/
│   │   └── [Screen].jsx
│   └── components/               ← Module-specific UI components
│       └── [Component].jsx
└── tests/
    ├── test_[feature].py
    └── fixtures/
        └── [fixture].json
```

Module ID naming: lowercase, hyphenated. Examples: `sol-quoter`, `web-manager`, `product-db`.
Python module path uses underscores: `modules.sol_quoter.server.routes.solicitations`.

---

## manifest.json — Full Specification

```json
{
  "id": "module-id",
  "name": "Human Readable Name",
  "version": "1.0.0",
  "description": "One sentence. What this module does.",
  "server": {
    "blueprints": [
      "modules.module_id.server.routes.feature_one",
      "modules.module_id.server.routes.feature_two"
    ],
    "db_schema": "modules/module-id/db/schema.sql",
    "db_env_key": "MODULE_ID_DB_PATH"
  },
  "renderer": {
    "entry": "modules/module-id/renderer/index.js"
  },
  "nav": [
    {
      "id": "unique-nav-id",
      "label": "Display Label",
      "icon": "icon-name",
      "path": "/module-id/screen"
    }
  ]
}
```

**Rules:**
- `id` must be unique across all modules in the registry
- `db_env_key` must be documented in `.env.example`
- All nav `id` values must be globally unique (prefix with module id to ensure this)
- Blueprint paths use Python dot notation with underscores

---

## Flask Blueprint Rules

### File template

```python
# modules/[module_id]/server/routes/[feature].py

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from ..models.[model] import [Model]
from core.server.app.db import get_db  # injected connection factory

bp = Blueprint('[module_id]_[feature]', __name__)

def _response(data=None, error=None, status=200):
    """Standard response envelope. Use this for every return."""
    return jsonify({
        "data": data,
        "error": error,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }), status


@bp.route('/api/[module-id]/[resource]', methods=['GET'])
def get_resources():
    try:
        db = get_db(current_app.config['MODULE_ID_DB_PATH'])
        # ... query logic
        return _response(data=results)
    except Exception as e:
        return _response(error=str(e), status=500)
```

### Route naming convention
All module routes are prefixed with `/api/[module-id]/`.
- `web-manager` → `/api/web-manager/projects`
- `sol-quoter` → `/api/sol-quoter/solicitations`
- `product-db` → `/api/product-db/products`

This prevents route collisions between modules.

### Required routes per resource
Every resource should implement the full set unless explicitly justified:

```
GET    /api/[module]/[resource]        list (paginated if > 100 records expected)
POST   /api/[module]/[resource]        create
GET    /api/[module]/[resource]/:id    single record
PUT    /api/[module]/[resource]/:id    full update
DELETE /api/[module]/[resource]/:id    delete
PATCH  /api/[module]/[resource]/reorder  sort order (if applicable)
```

### Response envelope — mandatory
**Every route returns this shape. No raw objects. No exceptions.**

```python
{
  "data": <payload | list | null>,
  "error": <string | null>,
  "timestamp": "<ISO 8601>"
}
```

HTTP status codes are used semantically:
- `200` — success
- `201` — resource created
- `400` — bad request (client error, invalid input)
- `404` — resource not found
- `422` — unprocessable entity (valid JSON, failed validation)
- `500` — server error

---

## Database Rules

### Schema file
The module owns `db/schema.sql`. It uses `CREATE TABLE IF NOT EXISTS` exclusively.
Core applies this schema when initializing the module's database.

### Naming conventions
- Table names: `snake_case`, plural. `projects`, `solicitations`, `product_codes`
- Primary keys: `id TEXT PRIMARY KEY` using UUID or slug depending on resource
- Foreign keys: `[table_singular]_id` — e.g., `project_id`, `solicitation_id`
- Timestamps: `created_at TEXT` and `updated_at TEXT` in ISO 8601 format
- Booleans: `INTEGER` (0/1) — SQLite has no native boolean
- Soft delete: use `deleted_at TEXT DEFAULT NULL` if records should be recoverable

### Database path
Never hardcode a database path. Always read from the env key declared in `manifest.json`.

```python
# WRONG
db = sqlite3.connect('/path/to/module.db')

# RIGHT
db = get_db(current_app.config['MODULE_ID_DB_PATH'])
```

---

## Renderer (React) Rules

### index.js — required exports

```javascript
// modules/[module-id]/renderer/index.js

import Dashboard from './screens/Dashboard';
import ResourceList from './screens/ResourceList';

export const navItems = [
  { id: 'mod-dashboard', label: 'Dashboard', icon: 'grid', path: '/module-id' },
  { id: 'mod-resources', label: 'Resources', icon: 'list', path: '/module-id/resources' },
];

export const routes = [
  { path: '/module-id',           component: Dashboard },
  { path: '/module-id/resources', component: ResourceList },
];
```

Core's `App.jsx` imports these and assembles the application nav and router. Nothing else from a module is imported by Core.

### Data fetching
All data fetching uses the shared `useApi` hook from `core/renderer/hooks/`.

```javascript
// RIGHT
import { useApi } from '../../../core/renderer/hooks/useApi';
const { data, loading, error } = useApi('/api/sol-quoter/solicitations');

// WRONG — never construct raw fetch inside a screen component
fetch('http://localhost:5199/api/solicitations')
```

### Component scope
- Module screens can use `core/renderer/components/` primitives freely
- Module-specific UI that won't be reused goes in `modules/[id]/renderer/components/`
- Never move a module component to core unless two or more modules use it

---

## Business Logic Rules

### lib/ directory
Pure business logic (PDF parsing, .docx generation, data transformation) lives in `modules/[id]/lib/`.
These files must have **zero Flask imports**. They are pure Python functions.
This is what makes them independently testable.

```python
# modules/sol_quoter/lib/extractor.py
# No Flask. No database. Pure functions.

def extract_fields(text: str, format_hint: str = None) -> dict:
    """
    Extract solicitation fields from raw PDF text.
    Returns dict of field_name → { value, confidence }
    """
    ...
```

Routes call lib functions. Lib functions know nothing about HTTP.

---

## Testing Rules

Every module ships with tests. Minimum bar:
- One test file per route module
- At minimum: happy path, missing required field, resource not found
- Business logic in `lib/` is tested independently of Flask

```python
# modules/sol_quoter/tests/test_extractor.py
# Tests lib/ logic directly — no Flask test client needed

from modules.sol_quoter.lib.extractor import extract_fields

def test_extracts_solicitation_number_from_va_format():
    with open('tests/fixtures/va_solicitation.txt') as f:
        text = f.read()
    result = extract_fields(text)
    assert result['solicitation_number']['value'] == '36C24225Q0696'
    assert result['solicitation_number']['confidence'] >= 0.9
```

---

## Documentation Rules

Every module requires `docs/modules/[module-id].md` containing:

1. **Purpose** — one paragraph, what this module does and why it exists
2. **Data model** — every table, every field, types, constraints
3. **Route reference** — every endpoint, inputs, outputs, error cases
4. **Business logic** — non-obvious logic explained (parsing strategies, confidence scoring, etc.)
5. **External integrations** — any API calls out, what data is sent
6. **Known failure modes** — documented bugs, edge cases, parser limitations
7. **Development notes** — gotchas, setup steps, test fixture info

This file is read by Claude Code before touching any file in this module.

---

## Cross-Module Communication

Modules are isolated. They do not import each other.

The only approved pattern for cross-module data access:

```python
# modules/sol_quoter/server/routes/quotes.py
# Calling product-db module to enrich line items

import requests

def enrich_line_items_with_products(line_items):
    codes = [item['product_code'] for item in line_items if item.get('product_code')]
    if not codes:
        return line_items

    response = requests.get(
        f"http://localhost:{current_app.config['FLASK_PORT']}/api/product-db/products/lookup",
        params={'codes': ','.join(codes)},
        timeout=5
    )
    if response.status_code != 200:
        return line_items  # graceful degradation — never hard fail on enrichment

    products_by_code = {p['code']: p for p in response.json()['data']}
    for item in line_items:
        item['product_info'] = products_by_code.get(item.get('product_code'))
    return line_items
```

This pattern:
- Keeps modules isolated at the code level
- Goes through the API contract, not internal imports
- Degrades gracefully if the other module is unavailable
- Is auditable (you can see exactly what data crosses module boundaries)

---

## Checklist — Before Declaring a Module Complete

- [ ] `manifest.json` present and valid
- [ ] All declared blueprints exist and are importable
- [ ] `db/schema.sql` uses `CREATE TABLE IF NOT EXISTS` only
- [ ] DB path read from env var — never hardcoded
- [ ] All routes return `{ data, error, timestamp }` envelope
- [ ] HTTP status codes used semantically
- [ ] `renderer/index.js` exports `navItems` and `routes`
- [ ] All screens use `useApi` hook for data fetching
- [ ] Business logic isolated in `lib/` with no Flask imports
- [ ] At least one test per route file
- [ ] `docs/modules/[id].md` written and current
- [ ] `.env.example` updated with module's env key
- [ ] Module entry added to `claude.md` module registry table
