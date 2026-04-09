# Module: web-manager

**ID:** `web-manager`
**Status:** Planned
**DB Env Key:** `WEB_MANAGER_DB_PATH`
**Route Prefix:** `/api/web-manager/`

---

## Purpose

Manages content for a portfolio or business website. Provides full CRUD for projects, image management with ordering and role assignment, credits management, and a one-click export that writes a `projects.json` file the target website reads at build time.

In V1, the connection between Nexus and the website is a single JSON file — the site never has a runtime dependency on the Nexus server being online. Export is a deliberate human action.

---

## Data Model

### projects table

```sql
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,          -- slug, e.g. "residencia-norte"
  title         TEXT NOT NULL,
  date          TEXT,                       -- "2023"
  location      TEXT,
  type          TEXT NOT NULL,             -- Residence | Development | Condominium | Commercial
  status        TEXT NOT NULL,             -- Built | Under Construction | Design Development | Concept
  description   TEXT,                      -- markdown supported
  approach      TEXT,                      -- optional, markdown supported
  accent_color  TEXT,                      -- hex, e.g. "#C4A882"
  featured      INTEGER DEFAULT 0,         -- boolean: 0 | 1
  layout        TEXT DEFAULT 'full',       -- full | 75-left | 75-right | split
  sort_order    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

**Type enum values:** `Residence`, `Development`, `Condominium`, `Commercial`
**Status enum values:** `Built`, `Under Construction`, `Design Development`, `Concept`
**Layout enum values:** `full`, `75-left`, `75-right`, `split`

### images table

```sql
CREATE TABLE IF NOT EXISTS images (
  id            TEXT PRIMARY KEY,          -- UUID
  project_id    TEXT NOT NULL,
  filename      TEXT NOT NULL,
  filepath      TEXT NOT NULL,             -- relative path for site: "/images/projects/slug/filename.jpg"
  role          TEXT DEFAULT 'gallery',    -- hero | gallery
  sort_order    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

**Role enum values:** `hero`, `gallery`
**Constraint:** Only one image per project can have `role = 'hero'`. Enforced in application logic, not DB constraint.

### credits table

```sql
CREATE TABLE IF NOT EXISTS credits (
  id            TEXT PRIMARY KEY,          -- UUID
  project_id    TEXT NOT NULL,
  role          TEXT NOT NULL,             -- "Photography", "Structural Engineering"
  name          TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

---

## Route Reference

### Projects

```
GET    /api/web-manager/projects
  → All projects ordered by sort_order
  → Response: { data: [Project], error, timestamp }

POST   /api/web-manager/projects
  → Body: { title, type, status, ...optional fields }
  → Required: title, type, status
  → Response: { data: Project, error, timestamp }

GET    /api/web-manager/projects/:id
  → Single project with images array and credits array
  → Response: { data: ProjectWithRelations, error, timestamp }

PUT    /api/web-manager/projects/:id
  → Body: any subset of project fields
  → Updates updated_at automatically
  → Response: { data: Project, error, timestamp }

DELETE /api/web-manager/projects/:id
  → Cascades: deletes all images (files + records) and credits
  → Response: { data: { deleted: true }, error, timestamp }

PATCH  /api/web-manager/projects/reorder
  → Body: { order: ["slug-a", "slug-b", "slug-c"] }
  → Updates sort_order for all listed IDs
  → Response: { data: { updated: N }, error, timestamp }
```

### Images

```
POST   /api/web-manager/projects/:id/images
  → Multipart form data, field name: "images" (supports multiple)
  → Files saved to configured images directory
  → Response: { data: [Image], error, timestamp }

DELETE /api/web-manager/images/:id
  → Deletes file from disk AND record from DB
  → If deleted image was hero, no automatic promotion (UI handles this)
  → Response: { data: { deleted: true }, error, timestamp }

PATCH  /api/web-manager/images/reorder
  → Body: { order: ["uuid-a", "uuid-b"] }
  → All images must belong to the same project
  → Response: { data: { updated: N }, error, timestamp }

PATCH  /api/web-manager/images/:id/role
  → Body: { role: "hero" | "gallery" }
  → If setting hero: clears hero from any other image in same project
  → Response: { data: Image, error, timestamp }
```

### Export

```
POST   /api/web-manager/export
  → Reads all projects with images and credits from DB
  → Writes structured JSON to SITE_CONTENT_PATH env var
  → Updates last_export_at in a metadata record
  → Response: { data: { exported_at, project_count, path }, error, timestamp }
```

### Traffic

```
GET    /api/web-manager/traffic
  → Calls Vercel Analytics API (requires VERCEL_API_TOKEN env var)
  → Returns page views by route for last 30 days
  → Returns 503 if token not configured (not an error — feature is opt-in)
  → Response: { data: { pages: [{ route, views }], total_views, period }, error, timestamp }
```

---

## Export Contract

`POST /api/web-manager/export` produces this file at `$SITE_CONTENT_PATH/projects.json`:

```json
{
  "exported_at": "2024-01-15T14:30:00Z",
  "projects": [
    {
      "id": "residencia-norte",
      "title": "Residencia Norte",
      "date": "2023",
      "location": "São Paulo, Brazil",
      "type": "Residence",
      "status": "Built",
      "description": "Markdown content here...",
      "approach": "Optional markdown...",
      "accent_color": "#C4A882",
      "featured": true,
      "layout": "75-left",
      "sort_order": 1,
      "hero_image": {
        "filename": "hero.jpg",
        "filepath": "/images/projects/residencia-norte/hero.jpg"
      },
      "images": [
        {
          "id": "uuid",
          "filename": "gallery-1.jpg",
          "filepath": "/images/projects/residencia-norte/gallery-1.jpg",
          "role": "gallery",
          "sort_order": 0
        }
      ],
      "credits": [
        {
          "role": "Photography",
          "name": "Studio Nome",
          "sort_order": 0
        }
      ]
    }
  ]
}
```

The Next.js portfolio site imports this at build time. The TypeScript type on the site must match this structure. When this structure changes, update both the exporter and the site's TypeScript type.

---

## Environment Variables

| Key | Required | Description |
|---|---|---|
| `WEB_MANAGER_DB_PATH` | Yes | Absolute path to web-manager.db |
| `SITE_CONTENT_PATH` | Yes | Absolute path to site's /public/content/ directory |
| `IMAGES_STORAGE_PATH` | Yes | Absolute path to images directory |
| `VERCEL_API_TOKEN` | No | Enables traffic screen. Stored via safeStorage. |

---

## UI Screens

### Dashboard
- Project count
- Featured project count
- Last export timestamp + "Export to Site" button
- Traffic summary (if Vercel token configured): total views, top 3 pages this month

### ProjectList
- Sortable table: title, type, status, featured toggle, sort handle
- Drag-to-reorder rows (calls PATCH /reorder on drop)
- "New Project" button
- Click row → opens ProjectEditor

### ProjectEditor
- All fields from data model
- Image upload zone (drag-drop or file picker, multi-file)
- Image gallery with drag-to-reorder handles
- Hero image selection (radio/click on thumbnail)
- Credits management (add/remove/reorder rows)
- Save button → PUT
- Delete button → confirmation modal → DELETE

### Traffic
- Page view totals by route
- Bar chart, last 30 days
- "Vercel token not configured" state if token missing

---

## Known Failure Modes

1. **Export path not configured.** If `SITE_CONTENT_PATH` is wrong or the directory doesn't exist, export silently produces no file. Export route must validate path exists before writing.

2. **Image filepath mismatch.** The `filepath` stored in the DB must be the relative path the website uses. If image storage is reorganized, old filepaths in the DB become invalid. Document the filepath convention clearly.

3. **Hero image delete.** If the hero image is deleted, the project has no hero. The UI must show a clear warning state, not silently break.

4. **Cascade delete with files.** `ON DELETE CASCADE` handles DB records. File deletion from disk must be handled in application logic before the DB delete, or files will be orphaned.

---

## Development Notes

- The `id` field for projects is a human-readable slug, not a UUID. This is intentional — it's used in the website URL and the export filepath.
- Slug must be URL-safe: lowercase, hyphens only, no spaces or special characters.
- Slug is set on creation and should not change (it's the URL). If a rename is needed, it requires a migration.
- `sort_order` starts at 0 for the first project. When reordering, assign 0, 1, 2... sequentially.
