# Nexus — Conventions

Claude Code reads this file before writing any code.
These conventions apply to every file in every module and in core.
Consistency is not optional — it is what makes a codebase maintainable.

---

## Naming Conventions

### Files and directories
| Context | Convention | Example |
|---|---|---|
| Python files | `snake_case` | `extractor.py`, `docx_generator.py` |
| React components | `PascalCase` | `ProjectEditor.jsx`, `AppShell.jsx` |
| React hooks | `camelCase`, prefix `use` | `useApi.js`, `useToast.js` |
| JS utility files | `camelCase` | `formatDate.js`, `apiClient.js` |
| Directories | `kebab-case` | `sol-quoter/`, `web-manager/` |
| Python module paths | `snake_case` | `modules.sol_quoter.server.routes` |

### Python
| Item | Convention | Example |
|---|---|---|
| Classes | `PascalCase` | `SolicitationExtractor` |
| Functions | `snake_case` | `extract_fields()` |
| Constants | `UPPER_SNAKE` | `CONFIDENCE_THRESHOLD = 0.7` |
| Private helpers | `_snake_case` | `_parse_va_format()` |
| Blueprint names | `[module_id]_[feature]` | `sol_quoter_solicitations` |

### React / JavaScript
| Item | Convention | Example |
|---|---|---|
| Components | `PascalCase` | `SolicitationList` |
| Hooks | `useCamelCase` | `useSolicitations` |
| Event handlers | `handleNoun` or `handleVerbNoun` | `handleSubmit`, `handleDeleteProject` |
| Boolean props/state | `isNoun` or `hasNoun` | `isLoading`, `hasError`, `isOpen` |
| Constants | `UPPER_SNAKE` | `MAX_FILE_SIZE_MB` |

### Database
| Item | Convention | Example |
|---|---|---|
| Table names | `snake_case`, plural | `solicitations`, `product_codes` |
| Column names | `snake_case` | `created_at`, `project_id` |
| Primary keys | `id TEXT PRIMARY KEY` | Always UUID or slug |
| Foreign keys | `[table_singular]_id` | `solicitation_id`, `project_id` |
| Timestamp columns | `TEXT`, ISO 8601 | `"2024-01-15T14:30:00Z"` |
| Boolean columns | `INTEGER` (0/1) | `featured INTEGER DEFAULT 0` |

### API Routes
Pattern: `/api/[module-id]/[resource]/[action-if-non-crud]`

```
/api/web-manager/projects
/api/web-manager/projects/:id
/api/web-manager/images/reorder
/api/sol-quoter/solicitations
/api/sol-quoter/solicitations/parse
/api/product-db/products
/api/product-db/products/lookup
```

---

## Python Code Standards

### Imports — order and grouping
```python
# 1. Standard library
import os
import json
from datetime import datetime, timezone
from pathlib import Path

# 2. Third-party
from flask import Blueprint, request, jsonify, current_app
import pdfplumber

# 3. Internal (absolute from project root)
from core.server.app.db import get_db
from modules.sol_quoter.lib.extractor import extract_fields
```

### Function signatures
- Use type hints on all public functions in `lib/`
- Flask route handlers don't require type hints (return type is always Response)

```python
# lib/ functions — type hints required
def extract_fields(text: str, format_hint: str | None = None) -> dict[str, dict]:
    ...

# Route handlers — no type hints needed
@bp.route('/api/sol-quoter/solicitations', methods=['GET'])
def get_solicitations():
    ...
```

### Error handling pattern
```python
@bp.route('/api/module/resource/:id', methods=['GET'])
def get_resource(id):
    try:
        db = get_db(current_app.config['MODULE_DB_PATH'])
        resource = db.execute('SELECT * FROM resources WHERE id = ?', [id]).fetchone()

        if not resource:
            return _response(error=f'Resource {id} not found', status=404)

        return _response(data=dict(resource))

    except ValueError as e:
        return _response(error=str(e), status=400)
    except Exception as e:
        current_app.logger.error(f'get_resource({id}): {e}')
        return _response(error='Internal server error', status=500)
```

Never swallow exceptions silently. Always log server errors.

### The `_response` helper
Every route module defines and uses this. It is not in core — it is defined locally in each route file.

```python
def _response(data=None, error=None, status=200):
    return jsonify({
        "data": data,
        "error": error,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }), status
```

### Input validation
Validate before touching the database. Return 400 or 422 early.

```python
@bp.route('/api/web-manager/projects', methods=['POST'])
def create_project():
    body = request.get_json(silent=True)
    if not body:
        return _response(error='Request body required', status=400)

    required = ['title', 'type', 'status']
    missing = [f for f in required if not body.get(f)]
    if missing:
        return _response(error=f'Missing required fields: {", ".join(missing)}', status=422)

    # proceed with validated input
```

---

## React / JavaScript Code Standards

### Component structure
```jsx
// 1. Imports
import { useState, useEffect } from 'react';
import { useApi } from '../../../core/renderer/hooks/useApi';
import Button from '../../../core/renderer/components/Button';
import styles from './ProjectList.module.css';

// 2. Component (named export, no default unless required by router)
export function ProjectList() {
  // 2a. Hooks at top
  const { data: projects, loading, error } = useApi('/api/web-manager/projects');
  const [selected, setSelected] = useState(null);

  // 2b. Derived state / memos
  const featuredProjects = projects?.filter(p => p.featured) ?? [];

  // 2c. Handlers
  function handleSelectProject(id) {
    setSelected(id);
  }

  // 2d. Early returns (loading, error states)
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  // 2e. Render
  return (
    <div className={styles.container}>
      ...
    </div>
  );
}
```

### useApi hook contract
```javascript
// Always handle all three states
const { data, loading, error, refetch } = useApi('/api/module/resource');

// data  — null until loaded, then the value of response.data
// loading — true during fetch
// error — null if ok, string if failed
// refetch — call to re-run the fetch
```

### Mutation pattern (POST/PUT/DELETE)
```javascript
// Not useApi — use direct apiClient for mutations
import { apiClient } from '../../../core/renderer/hooks/apiClient';

async function handleSave() {
  setIsSaving(true);
  const { data, error } = await apiClient.put(`/api/web-manager/projects/${id}`, formData);
  if (error) {
    showToast({ type: 'error', message: error });
  } else {
    showToast({ type: 'success', message: 'Project saved' });
    onSaved(data);
  }
  setIsSaving(false);
}
```

### Never do these in React
- Direct `fetch()` calls with hardcoded localhost URLs
- Business logic inside render functions
- `useEffect` for data fetching (use `useApi` hook instead)
- Inline styles (use CSS modules or design tokens)

---

## API Client (Renderer → Flask)

The base URL is read from config, never hardcoded.

```javascript
// core/renderer/hooks/apiClient.js
const BASE_URL = `http://localhost:${window.nexus.config.FLASK_PORT}`;

export const apiClient = {
  get: (path) => fetch(`${BASE_URL}${path}`).then(r => r.json()),
  post: (path, body) => fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()),
  put: (path, body) => /* same pattern */,
  delete: (path) => /* same pattern */,
  patch: (path, body) => /* same pattern */,
};
```

File uploads use `multipart/form-data` — do not set `Content-Type` manually, let the browser set the boundary.

---

## CSS / Styling Conventions

### Design tokens (defined in `core/renderer/styles/tokens.css`)
```css
:root {
  /* Spacing — 4px base unit */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Typography */
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;

  /* Colors — defined in product theme, not here */
  --color-bg-primary: ...;
  --color-bg-secondary: ...;
  --color-text-primary: ...;
  --color-text-secondary: ...;
  --color-border: ...;
  --color-accent: ...;
  --color-danger: ...;
  --color-success: ...;
}
```

### Rules
- Never use magic numbers for spacing — use tokens
- Never use inline styles
- CSS modules per component (`.module.css`)
- Mobile/responsive is out of scope for V1 (desktop app, fixed window)

---

## Git Conventions

### Branch naming
```
feature/[module-id]-[description]    feature/sol-quoter-confidence-scoring
fix/[module-id]-[description]        fix/web-manager-image-delete
chore/[description]                  chore/update-dependencies
phase/[N]-[description]              phase/1-core-scaffold
```

### Commit messages
```
[module] action: description

web-manager: add image reorder endpoint
sol-quoter: fix whitespace handling in pdfplumber output
core: prevent zombie Flask process on window close
product-db: add product lookup route
```

### When to commit
- After each route is implemented and tested
- After each screen is functional
- Never commit broken code to main
- Phase completion = one summarizing commit + tag

---

## Documentation Update Rules

After any session that changes architecture, adds a module, or makes a significant decision:

1. Update `claude.md` — Active Development State section
2. Append to `docs/decisions.md` — what was decided and why
3. Update the relevant `docs/modules/[id].md` — if the module changed
4. Update `docs/roadmap.md` — mark phases complete, update next steps

If these docs drift from reality, the next Claude Code session will produce code that contradicts prior work.
