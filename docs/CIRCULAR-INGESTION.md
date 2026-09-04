# Z83 — Circular ingestion (`services/circular-engine`)

Public Service Vacancy Circulars are published weekly as PDFs, listing
vacancies across national and provincial departments. This service turns
those PDFs into structured, verified vacancy data.

## Pipeline

```
circular (source document)
  → extracted vacancy (raw text block per post, page reference kept)
  → normalized vacancy (structured fields)
  → requirements (parsed into vacancy_requirements rows)
  → submission instructions (method, address/email, special instructions)
  → admin verification
  → publish
```

Every stage keeps provenance back to the source document and page number.
Nothing reaches an applicant without passing admin verification — the
extractor is a drafting tool, not a publisher.

### 1. Circular acquisition

Two paths, both landing in the same `circulars` table with
`ingestion_method` recording which one was used:

- **Manual upload (v1, implemented).** An admin uploads the circular PDF
  through `POST /admin/circulars/upload` with the circular number and
  publication date. This is the reliable path and the one this vertical
  slice depends on — it has no dependency on any external site staying
  reachable or unchanged.
- **Automatic collection (designed, not run against any live system yet).**
  DPSA does not publish a documented API for circulars, and the spec for
  this product is explicit: don't assume an undocumented API exists, and
  don't scrape a protected system blindly. So the automatic path is built
  as a pluggable `CircularSource` interface —

  ```ts
  interface CircularSource {
    listAvailableCirculars(): Promise<{ circularNumber: string; publicationDate: string; sourceUrl: string }[]>;
    fetchCircularPdf(sourceUrl: string): Promise<Buffer>;
  }
  ```

  — with a scheduled weekly job (`services/circular-engine/src/jobs/collect.ts`)
  that calls whatever `CircularSource` is configured, downloads new
  circulars it hasn't seen (by circular number), and feeds them into the
  same extraction pipeline as a manual upload. No adapter is wired up and
  enabled by default. Turning this on for a specific, permitted public
  index page is a deliberate configuration step for whoever operates this
  service, done against the *actual current terms and structure* of
  whatever page DPSA is publishing to at the time — not something to hardcode
  against a guess made in this codebase. Rate-limited, identifies itself
  with a real User-Agent and contact address, and respects `robots.txt`.

### 2. Extraction

`services/circular-engine/src/extract` takes the source PDF and:

1. Extracts raw text per page (`pdf-parse`).
2. Splits the document into per-vacancy text blocks. Circulars are laid out
   fairly consistently (department heading, then posts with reference
   numbers, salary, requirements, closing date), so this is a heuristic
   segmenter based on recurring markers (e.g. `POST :`, `REF NO :`,
   `SALARY :`, `CLOSING DATE :`) rather than a hardcoded per-department
   template — different departments format their sections slightly
   differently and the segmenter has to tolerate that.
3. Stores each raw block as an "extracted vacancy" — this is intentionally
   just text plus a page number at this stage, kept even if normalization
   below fails, so an admin can always fall back to reading the source.

### 3. Normalization

`services/circular-engine/src/normalize` turns each extracted block into a
draft `vacancies` row plus draft `vacancy_requirements` rows:

- Field extraction (job title, reference number, salary text, closing date,
  department, province) via labelled-line matching against the markers
  above, not free-form NLP guessing — if a field can't be confidently
  parsed, it's left null rather than filled with a bad guess.
- Requirement extraction looks for known patterns: qualification phrases
  ("National Diploma/Degree in ..."), experience phrases ("X years'
  experience"), driver's licence ("valid Code B driving licence"),
  professional registration ("registration with SAICA/ECSA/HPCSA/...").
  Anything it can't classify goes in as `requirement_type: 'other'` with
  the raw description, rather than being dropped.
- The vacancy's submission method/email/address/instructions are extracted
  the same way and stored on the vacancy row — this is what the
  application-generation step later uses to build the email or print
  package correctly.

Normalization never invents a requirement the source text doesn't support.
If the circular doesn't mention a driver's licence, no driver's licence
requirement is created — there is no default assumption layered on top of
what was published.

### 4. Admin verification

Every normalized vacancy lands in `pending_verification`. An admin, via
`GET /admin/vacancies/pending` and `PATCH /admin/vacancies/:id/verify`:

- reviews the extracted fields against the source page (the original PDF
  page is retrievable via the stored `source_document_key` and
  `page_number`),
- corrects anything the extractor got wrong or left null,
- approves (→ `published`, now visible to applicants and eligible for
  matching) or rejects (→ `rejected`, kept for record but never surfaced).

No vacancy skips this step, including ones ingested automatically.

### 5. Publish

`published` vacancies are what `GET /vacancies` and the matching engine see.
Closing an expired vacancy (`closing_at` passed) is a scheduled status flip
to `closed`, not a delete — applications already made against it keep their
snapshot regardless.

## What this service does not do

- It does not call any undocumented DPSA API.
- It does not scrape a system it isn't permitted to access.
- It does not publish a vacancy without a human admin looking at it first.
- It does not fabricate requirements beyond what the circular states.
