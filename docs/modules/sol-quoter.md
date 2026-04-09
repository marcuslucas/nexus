# Module: sol-quoter

**ID:** `sol-quoter`
**Status:** Planned (port from existing application)
**DB Env Key:** `SOL_QUOTER_DB_PATH`
**Route Prefix:** `/api/sol-quoter/`

---

## Purpose

Parses government solicitation PDFs and generates formatted .docx quote documents. What previously took 30–60 minutes of manual reading and formatting now takes under 5 minutes.

This module is a port of the standalone Sol-Quoter application. All business logic (extraction, parsing, .docx generation) is preserved exactly. Only the Flask routes, Electron shell, and data layer are restructured to fit the Nexus module contract.

**Porting rule:** Do not rewrite `extractor.py` or `docx_generator.py` during the port. Move them first, confirm zero regression against existing test fixtures, then improve.

---

## Workflow

```
1. User drops solicitation PDF onto upload zone
2. Flask reads PDF bytes (pdfplumber primary, pypdf fallback)
3. Format fingerprinting identifies solicitation type
4. Field extraction runs format-specific logic
5. Confidence scores calculated per field
6. ExtractReview screen shows results, flags low-confidence fields
7. User reviews, corrects flagged fields
8. User adds vendor info + line items
9. QuoteBuilder generates .docx via python-docx
10. File saved to configured output directory
```

---

## Supported Formats

| Format | Example ID | Detection | Status |
|---|---|---|---|
| SAM.gov structured export | W911S225U1431 | Presence of SAM.gov header text | Working (in original) |
| VA combined synopsis form | 36C24225Q0696 | VA agency identifiers | Working (in original) |
| Formal RFQ with lettered sections | 69056725Q000044 | Section A/B/C structure | Working (in original) |
| Unknown | any other PDF | None match → generic fallback | Partial extraction |

---

## Fields Extracted

| Field | Required | Notes |
|---|---|---|
| `solicitation_number` | Yes | Primary identifier |
| `title` | Yes | Project/contract title |
| `solicitation_type` | Yes | RFQ, Combined Synopsis, etc. |
| `issuing_agency` | Yes | |
| `response_due_date` | Yes | Parsed to ISO 8601 |
| `posting_date` | No | |
| `contact_name` | No | Extracted from prose — whitespace-sensitive (see Known Failure Modes) |
| `contact_email` | No | |
| `contact_phone` | No | |
| `naics_code` | No | |
| `psc_code` | No | |
| `set_aside` | No | |
| `place_of_performance` | No | |
| `period_of_performance` | No | |
| `estimated_value` | No | |
| `scope_of_work` | Yes | Full text, can be long |
| `line_items` | No | Product codes, quantities — fed to product-db enrichment |

Each field returns `{ value: string | null, confidence: 0.0–1.0 }`.
Fields with confidence below `CONFIDENCE_THRESHOLD` (default: 0.7) are flagged for review in the UI.

---

## Data Model

### solicitations table

```sql
CREATE TABLE IF NOT EXISTS solicitations (
  id                  TEXT PRIMARY KEY,     -- UUID
  solicitation_number TEXT NOT NULL,
  title               TEXT,
  solicitation_type   TEXT,
  issuing_agency      TEXT,
  response_due_date   TEXT,                 -- ISO 8601
  posting_date        TEXT,
  contact_name        TEXT,
  contact_email       TEXT,
  contact_phone       TEXT,
  naics_code          TEXT,
  psc_code            TEXT,
  set_aside           TEXT,
  place_of_performance TEXT,
  period_of_performance TEXT,
  estimated_value     TEXT,
  scope_of_work       TEXT,
  raw_pdf_path        TEXT,                 -- path to stored PDF, if retained
  source_format       TEXT,                 -- detected format name
  extraction_meta     TEXT,                 -- JSON: per-field confidence scores
  status              TEXT DEFAULT 'new',   -- new | reviewed | quoted | submitted | awarded | lost
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
```

### quotes table

```sql
CREATE TABLE IF NOT EXISTS quotes (
  id                  TEXT PRIMARY KEY,     -- UUID
  solicitation_id     TEXT NOT NULL,
  vendor_name         TEXT,
  vendor_address      TEXT,
  vendor_phone        TEXT,
  vendor_email        TEXT,
  vendor_cage_code    TEXT,
  vendor_uei          TEXT,
  line_items          TEXT NOT NULL,        -- JSON array of line items
  notes               TEXT,
  generated_at        TEXT,                 -- when .docx was generated
  output_path         TEXT,                 -- path to generated .docx
  status              TEXT DEFAULT 'draft', -- draft | final | submitted
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  FOREIGN KEY (solicitation_id) REFERENCES solicitations(id)
);
```

### Line items JSON structure (stored in `quotes.line_items`)

```json
[
  {
    "line_number": "0001",
    "description": "Dry Cleaning Services",
    "quantity": 1,
    "unit": "JB",
    "unit_price": null,
    "total_price": null,
    "product_code": "812332",
    "product_info": null
  }
]
```

`product_info` is populated at runtime by product-db enrichment. It is not stored — it's fetched fresh on each load.

---

## Route Reference

### Solicitations

```
GET    /api/sol-quoter/solicitations
  → All solicitations, ordered by created_at DESC
  → Query params: status=new|reviewed|quoted|submitted
  → Response: { data: [Solicitation], error, timestamp }

POST   /api/sol-quoter/solicitations/parse
  → Multipart form: field "pdf" = PDF file
  → Runs extraction pipeline, returns fields + confidence
  → Does NOT save to DB — user reviews first
  → Response: { data: { fields, confidence, format_detected }, error, timestamp }

POST   /api/sol-quoter/solicitations
  → Body: extracted + reviewed fields (user-confirmed data)
  → Saves to DB after user review
  → Response: { data: Solicitation, error, timestamp }

GET    /api/sol-quoter/solicitations/:id
  → Single solicitation with associated quotes
  → Response: { data: SolicitationWithQuotes, error, timestamp }

PUT    /api/sol-quoter/solicitations/:id
  → Update fields (e.g., manual corrections, status change)
  → Response: { data: Solicitation, error, timestamp }

DELETE /api/sol-quoter/solicitations/:id
  → Deletes solicitation and all associated quotes
  → Response: { data: { deleted: true }, error, timestamp }
```

### Quotes

```
GET    /api/sol-quoter/quotes
  → All quotes, optionally filtered by solicitation_id
  → Response: { data: [Quote], error, timestamp }

POST   /api/sol-quoter/quotes
  → Body: { solicitation_id, vendor_info, line_items }
  → Creates quote record
  → Response: { data: Quote, error, timestamp }

PUT    /api/sol-quoter/quotes/:id
  → Update quote fields / line items
  → Response: { data: Quote, error, timestamp }

POST   /api/sol-quoter/quotes/:id/generate
  → Calls docx_generator.py with quote data
  → Writes .docx to QUOTES_OUTPUT_PATH
  → Updates generated_at and output_path
  → Response: { data: { path, generated_at }, error, timestamp }
```

---

## Business Logic (lib/)

### extractor.py
The core extraction engine. Ported directly from original Sol-Quoter.

**Entry point:**
```python
def extract_fields(text: str, format_hint: str | None = None) -> dict[str, FieldResult]:
    """
    text: raw text output from pdfplumber
    format_hint: optional detected format name
    returns: dict of field_name → { value, confidence }
    """
```

**Format detection:**
```python
def detect_format(text: str) -> str:
    """
    Returns: "sam_gov" | "va_synopsis" | "formal_rfq" | "unknown"
    Detection is fingerprint-based: looks for format-specific header patterns
    """
```

### docx_generator.py
Generates formatted quote document from structured data.

```python
def generate_quote(quote_data: dict, output_path: str) -> str:
    """
    quote_data: dict with vendor_info, solicitation_fields, line_items
    output_path: directory to save .docx
    returns: full path to generated file
    """
```

---

## Known Failure Modes

These are documented failures from the original Sol-Quoter development. They are known issues, not hypothetical.

### 1. pdfplumber vs pypdf whitespace difference
**Symptom:** Extraction passes unit tests (run against pypdf output) but fails in the live app (uses pdfplumber).
**Root cause:** pdfplumber produces denser text with fewer blank lines between fields. Regex patterns that rely on blank-line boundaries fail against pdfplumber output.
**Mitigation:** All test fixtures must be pdfplumber output, not pypdf output. When writing new regex patterns, always validate against `repr()` output of actual pdfplumber text.
**Status:** Fixed in original. Must be preserved in port — do not change the regex patterns until after regression tests pass.

### 2. Contact name extraction — whitespace-sensitive
**Symptom:** Contact name field consistently fails or extracts garbage.
**Root cause:** The contact name appears in prose text without a consistent label structure. The regex requires specific whitespace context that varies by format.
**Mitigation:** Format-specific contact extraction patterns. Test against all three confirmed formats.
**Status:** Working in original. Do not change during port.

### 3. Zombie process holding port
**Symptom:** App launches, Flask fails to bind port, all API calls fail silently.
**Root cause:** Previous session's Flask process was not killed (Electron crash, forced quit).
**Mitigation:** Handled in Nexus core `main.js` — kill by PID on quit AND check port on startup. This is not a sol-quoter issue, it's a core issue, but documented here because it manifested first in Sol-Quoter development.

### 4. Unknown format → silent failure
**Symptom:** A new solicitation format produces an empty or near-empty extraction with all fields at low confidence.
**Root cause:** Format not recognized, falls back to generic extraction which doesn't know where to look.
**Mitigation:** Confidence scores and flagging system catches this. User sees every field flagged. The fix is to add a new format parser — document the new format in this file first.

### 5. SAM.gov API rate limiting
**Symptom:** Solicitation lookup by ID fails intermittently.
**Root cause:** SAM.gov API has rate limits. Not well-documented.
**Mitigation:** Cache lookups. Show clear error when rate limited — do not retry automatically.

---

## Adding a New Solicitation Format

1. Manually read 2–3 example PDFs of the new format
2. Document the format in the **Format Field Map** section below
3. Add detection fingerprint to `detect_format()`
4. Write format-specific extraction function `_extract_[format_name]_format()`
5. Add test fixture (real pdfplumber text output, not pypdf)
6. Write tests against fixture before implementation
7. Update this document with format status

---

## Format Field Map

### VA Combined Synopsis (va_synopsis)
Detection: Text contains "Department of Veterans Affairs" AND "COMBINED SYNOPSIS/SOLICITATION"

| Field | Location in document | Label text | Notes |
|---|---|---|---|
| solicitation_number | Header section | "Solicitation Number:" | |
| response_due_date | Header section | "Response Date:" or "Offers due" | Multiple label variations |
| contact_name | Point of contact section | Text after "Point of Contact" heading | Whitespace-sensitive |
| contact_email | Point of contact section | Email pattern | Regex: email pattern |
| naics_code | Classification section | "NAICS Code:" | |
| scope_of_work | Statement of Work section | Section labeled "STATEMENT OF WORK" | Full section text |

### Formal RFQ with Lettered Sections (formal_rfq)
Detection: Text contains "REQUEST FOR QUOTATION" AND section labels "SECTION A", "SECTION B"

| Field | Location in document | Label text | Notes |
|---|---|---|---|
| solicitation_number | Section A header | "Solicitation No." | |
| response_due_date | Section B | "Offers due by" | |
| contact_phone | Section A | Phone in prose text | Regex: phone pattern from prose |
| naics_code | Section B | "NAICS:" | |
| psc_code | Section B | "PSC:" | |
| scope_of_work | Section C | Full text of Section C | |

### SAM.gov Structured Export (sam_gov)
Detection: Structured text with consistent "Solicitation Number :" label formatting

| Field | Location | Label | Notes |
|---|---|---|---|
| solicitation_number | Top of document | "Solicitation Number :" | Note: space before colon |
| response_due_date | Header | "Response Date :" | |
| issuing_agency | Header | "Department/Ind.Agency :" | |
| naics_code | Classification | "NAICS Code :" | |
| scope_of_work | Description section | "Description :" | |

---

## Environment Variables

| Key | Required | Description |
|---|---|---|
| `SOL_QUOTER_DB_PATH` | Yes | Absolute path to sol-quoter.db |
| `QUOTES_OUTPUT_PATH` | Yes | Directory where generated .docx files are saved |
| `SAM_GOV_API_KEY` | No | Enables solicitation lookup by ID. Stored via safeStorage. |
| `ANTHROPIC_API_KEY` | No | Enables AI-assisted extraction fallback. Stored via safeStorage. |

---

## Development Notes

- **Port first, improve second.** Do not clean up or restructure `extractor.py` until all original test fixtures pass in the new module location.
- **Test fixtures live in `modules/sol-quoter/tests/fixtures/`.** Each fixture is a `.txt` file containing pdfplumber output (not raw PDF, not pypdf output).
- **The confidence threshold is `CONFIDENCE_THRESHOLD = 0.7` by default.** Fields below this are flagged yellow in the UI. This value should be configurable without code changes.
- **PDF files are not stored by default.** The parse route reads the PDF bytes in memory, extracts, and discards. Storing raw PDFs is opt-in (set `raw_pdf_path` if user wants to keep them).
