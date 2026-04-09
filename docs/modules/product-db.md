# Module: product-db

**ID:** `product-db`
**Status:** Planned
**DB Env Key:** `PRODUCT_DB_PATH`
**Route Prefix:** `/api/product-db/`

---

## Purpose

The master product catalog for the business. Stores product codes, descriptions, categories, pricing, and stock status. It is a shared data source — other modules query it to enrich their own data rather than maintaining their own product information.

**Current consumers:**
- `sol-quoter` — enriches parsed line items with product names and stock status
- `box-manifest` (future) — resolves product codes to names when generating box content sheets

This module is the single source of truth for product data. It does not duplicate information from other modules.

---

## Data Model

### products table

```sql
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,       -- UUID
  code              TEXT NOT NULL UNIQUE,   -- internal product code / SKU
  name              TEXT NOT NULL,
  description       TEXT,
  category_id       TEXT,
  manufacturer      TEXT,
  manufacturer_code TEXT,                   -- manufacturer's part number
  unit              TEXT,                   -- EA | BX | CS | LB | etc.
  unit_price        REAL,                   -- base price, nullable
  status            TEXT DEFAULT 'active',  -- active | inactive | discontinued
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

**Status enum values:** `active`, `inactive`, `discontinued`

### categories table

```sql
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,             -- UUID
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER DEFAULT 0
);
```

### product_aliases table
Products can be referenced by multiple codes (internal code, NAICS code, manufacturer code, customer-specific code). This table handles that.

```sql
CREATE TABLE IF NOT EXISTS product_aliases (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL,
  alias_type  TEXT NOT NULL,               -- "naics" | "manufacturer" | "customer" | "legacy"
  alias_code  TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

---

## Route Reference

### Products

```
GET    /api/product-db/products
  → All products, ordered by name
  → Query params: category_id=X, status=active|inactive|discontinued, q=search_term
  → Response: { data: [Product], error, timestamp }

POST   /api/product-db/products
  → Body: { code, name, ...optional fields }
  → Required: code, name
  → Response: { data: Product, error, timestamp }

GET    /api/product-db/products/:id
  → Single product with aliases
  → Response: { data: ProductWithAliases, error, timestamp }

PUT    /api/product-db/products/:id
  → Body: any subset of product fields
  → Response: { data: Product, error, timestamp }

DELETE /api/product-db/products/:id
  → Soft delete: sets status = 'inactive', sets deleted_at
  → Hard delete not available via API — must be done directly in DB
  → Response: { data: { deactivated: true }, error, timestamp }
```

### Lookup (cross-module integration endpoint)

```
GET    /api/product-db/products/lookup
  → Query params: codes=CODE1,CODE2,CODE3
  → Searches: products.code, product_aliases.alias_code
  → Returns matched products only (no error for unmatched codes)
  → Response: { data: [Product], error, timestamp }
```

This is the primary endpoint other modules call. It accepts multiple codes in one request and returns whatever matches. Codes with no match are silently omitted — the caller handles "not found" gracefully.

**Example:**
```
GET /api/product-db/products/lookup?codes=812332,S209,UNKNOWN-CODE

Response:
{
  "data": [
    { "code": "812332", "name": "Dry Cleaning Services", "status": "active", ... },
    { "code": "S209", "name": "Housekeeping Services", "status": "active", ... }
  ],
  "error": null,
  "timestamp": "..."
}
```
`UNKNOWN-CODE` has no match — it is omitted, not an error.

### Import

```
POST   /api/product-db/products/import
  → Multipart form: field "file" = CSV file
  → CSV format: see Import Format below
  → Upserts by product code (insert new, update existing)
  → Response: { data: { inserted: N, updated: N, errors: [...] }, error, timestamp }
```

### Categories

```
GET    /api/product-db/categories
  → All categories ordered by sort_order
  → Response: { data: [Category], error, timestamp }

POST   /api/product-db/categories
PUT    /api/product-db/categories/:id
DELETE /api/product-db/categories/:id
```

---

## CSV Import Format

```csv
code,name,description,category,manufacturer,manufacturer_code,unit,unit_price,status
812332,Dry Cleaning Services,Professional garment cleaning,,,,EA,,active
S209,Housekeeping Services,Building janitorial services,,,,JB,,active
```

**Rules:**
- `code` is required and is the upsert key
- `name` is required
- `category` is matched by name, created if not exists
- `unit_price` is optional, leave blank if not applicable
- `status` defaults to `active` if blank
- First row must be the header row exactly as shown

**Error handling:**
- Rows with missing required fields are skipped and reported in `errors`
- Import does not fail entirely on row errors — it processes all rows and reports
- Duplicate `code` within the same CSV: last row wins

---

## UI Screens

### Dashboard
- Total product count
- Count by status (active / inactive / discontinued)
- Recent additions (last 10)
- Category breakdown

### ProductList
- Searchable, filterable table: code, name, category, status, unit_price
- Filter by category, status
- Quick inline status toggle
- "New Product" button
- "Import CSV" button → opens ImportTool
- Click row → opens ProductEditor

### ProductEditor
- All product fields
- Aliases section (add/remove codes that map to this product)
- Category picker (or create new inline)
- Save / Deactivate buttons

### ImportTool
- File picker for CSV
- Preview: show first 5 rows before committing
- Import results: X inserted, Y updated, Z errors
- Download error report if errors exist

---

## Cross-Module Integration Notes

### How sol-quoter uses product-db

When Sol-Quoter parses a solicitation, it may identify product codes in line items (NAICS codes, PSC codes, or description-embedded codes). It calls the lookup endpoint to enrich those line items:

```python
# modules/sol_quoter/server/routes/solicitations.py

def enrich_line_items(line_items: list, flask_port: int) -> list:
    """
    Calls product-db lookup. Returns line_items with product_info populated.
    Degrades gracefully: if product-db unavailable or code not found, product_info = None.
    Never raises — enrichment is additive, not required.
    """
```

The enriched data shows in ExtractReview:
- Line item has a known product code → shows product name + status badge
- Line item has an unknown code → shows code only, no enrichment
- product-db module not active → enrichment silently skipped

### How box-manifest will use product-db (future)

The box-manifest module generates packing lists where each line is `[box_number, product_code, quantity, description]`. It resolves product codes to names via the same lookup endpoint. The generated .docx shows product names rather than requiring the user to know what each code means.

---

## Environment Variables

| Key | Required | Description |
|---|---|---|
| `PRODUCT_DB_PATH` | Yes | Absolute path to product-db.db |

---

## Development Notes

- **`code` is the business key**, not `id`. When displaying products, always show the code prominently. It's what users will search by and what other systems reference.
- **Lookup endpoint performance matters.** Sol-Quoter may pass 50–100 codes at once from a large solicitation. The lookup query must use an `IN` clause, not individual queries per code.
- **Aliases exist because government solicitations use NAICS/PSC codes**, not internal product codes. A product may be referenced by its NAICS code in one solicitation and its internal SKU in another. The alias table handles this mapping.
- **Soft delete only.** Products that have been quoted should never be hard-deleted — historical quotes reference them. Deactivating preserves the record while hiding it from active searches.
- **The import tool is how the database gets populated initially.** Expect the first real use to be a bulk CSV import of an existing product list. Test this path thoroughly.
