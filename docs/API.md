# Z83 — API (`services/api`)

Fastify + TypeScript REST API over JSON. Base path in dev:
`http://localhost:4000`. Auth is a signed httpOnly session cookie
(`z83_session`), set by `/auth/login` and `/auth/register`.

Status column: **v1** = implemented and tested in this vertical slice.
**designed** = schema and route exist in this doc for later work, not wired
up yet. Nothing in this document describes behaviour that isn't true of the
code — if a route is `designed`, it is not callable yet.

All error responses share a shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

## Auth — v1

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, fullName }` | role always `applicant`; creates `users` + empty `profiles` row |
| POST | `/auth/login` | `{ email, password }` | sets session cookie |
| POST | `/auth/logout` | — | clears cookie |
| GET | `/auth/me` | — | current user + role |

## Profile — v1

All routes act on the authenticated user's own profile.

| Method | Path | Notes |
|---|---|---|
| GET | `/profile` | full profile + qualifications + work experience + languages + references |
| PUT | `/profile` | updates core fields (personal particulars, address, driver's licence codes); writes a `profile_versions` row |
| POST | `/profile/qualifications` | add one |
| PUT | `/profile/qualifications/:id` | edit |
| DELETE | `/profile/qualifications/:id` | remove |
| POST | `/profile/work-experience` | add one |
| PUT/DELETE | `/profile/work-experience/:id` | edit/remove |
| POST | `/profile/languages` | add one |
| PUT/DELETE | `/profile/languages/:id` | edit/remove |
| POST | `/profile/references` | add one |
| PUT/DELETE | `/profile/references/:id` | edit/remove |
| GET | `/profile/completeness` | runs `packages/validation` profile checks, returns pass/fail per rule |

`GET /profile/completeness` response:

```json
{
  "complete": false,
  "checks": [
    { "rule": "has_id_number", "passed": true },
    { "rule": "minimum_three_references", "passed": false, "message": "Add at least 3 references." }
  ]
}
```

## Documents — v1

| Method | Path | Notes |
|---|---|---|
| POST | `/documents` | multipart: `file`, `documentTypeCode`. Stores via `StorageProvider`, returns the `documents` row (never a raw storage path) |
| GET | `/documents` | current user's documents, excludes soft-deleted |
| GET | `/documents/:id/url` | short-lived signed URL, checked against ownership |
| DELETE | `/documents/:id` | soft delete (`deleted_at`), audit-logged |

## Vacancies — v1

| Method | Path | Notes |
|---|---|---|
| GET | `/vacancies` | published only; query `province`, `departmentId`; if authenticated, each item includes `matchPercentage` |
| GET | `/vacancies/:id` | full vacancy + requirements + full match breakdown if authenticated |

`GET /vacancies/:id` match block:

```json
"match": {
  "percentage": 85,
  "matched": [
    { "requirementId": "...", "description": "National Diploma in Public Administration (NQF 6)" },
    { "requirementId": "...", "description": "Minimum 3 years relevant experience" }
  ],
  "missing": [
    { "requirementId": "...", "description": "Valid Code B driver's licence" }
  ],
  "unknown": [
    { "requirementId": "...", "description": "Registration with SAICA", "reason": "Not captured on profile" }
  ],
  "disclaimer": "Your profile appears to match this vacancy. This is not a decision on eligibility — only the department can confirm that."
}
```

The API never returns wording implying an eligibility decision. This is
enforced by `packages/validation`'s matching module owning all
user-facing strings for match results — routes cannot construct their own.

## Applications — v1

| Method | Path | Notes |
|---|---|---|
| POST | `/applications` | `{ vacancyId }`. Blocked if an open (non-`closed`) application already exists for that vacancy (one Z83 per position). Creates `applications` (draft) + `application_snapshots` from the live profile, then links them. |
| GET | `/applications` | current user's applications with status |
| GET | `/applications/:id` | full record: snapshot, vacancy, match, documents, events |
| POST | `/applications/:id/review` | runs Z83 completeness/validation rules against the **snapshot** (not the live profile); returns pass/fail per rule; does not change status on failure |
| POST | `/applications/:id/sign` | `{ imageBase64 }`. Requires review to have passed. Stores `signatures` row, sets status `signed`, writes `application_events` |
| POST | `/applications/:id/email-package` | Requires status `signed`. Builds `{ recipient, subject, body, attachments[] }` from the vacancy's submission instructions and the snapshot's documents, in the vacancy's specified order. Sets status `email_prepared`. **Does not send anything.** |
| POST | `/applications/:id/send` | Requires status `signed` or `email_prepared`, and `{ "confirm": true }` in the body — no confirmation, no send. Rebuilds the package fresh (never reuses a stale preview) and dispatches it over real SMTP (`src/email.ts`). Records an `email_deliveries` row and an `email_sent`/`email_send_failed` event **on every attempt, success or failure**. Only a successful send moves status to `submitted` — a failed one leaves status untouched and returns the error in the response so the UI can show it, never silently. If `SMTP_HOST` isn't configured, responds with `{ success: false, error: "Email sending is not configured on this server." }` rather than pretending to send. |
| GET | `/applications/:id/email-deliveries` | Every dispatch attempt for this application — recipient, subject, attachments, timestamp, success/failure, error if any. |
| POST | `/applications/:id/print-package` | Requires status `signed`. Generates the Z83 PDF (template-filled if a template is loaded, else the structured fallback) and merges the applicant's own uploaded documents into it — ID, certificates, CV, in submission order — as one combined, print-ready PDF (`src/print-package.ts`). Stores it, adds it to `application_documents`. Sets status `print_prepared`. |
| PATCH | `/applications/:id/status` | `{ status }`. Applicant-facing transition to `submitted` (self-reported: "I hand-delivered this" — the counterpart to `/send`'s automatic transition for a real email dispatch) or `closed`. |
| GET | `/applications/:id/events` | audit trail for this application |

Status machine: `draft → reviewed → signed → (email_prepared | print_prepared) → submitted → closed`.
`review` can be re-run any number of times before `signed`; nothing before
`signed` is final. `submitted` is reached two ways: automatically, the
moment `/send` actually dispatches an email successfully, or manually via
`PATCH .../status` after a hand delivery — never merely from `/email-package`
or `/print-package` preparing something.

## Admin — circular ingestion (manual upload path: v1; automatic collection: designed)

See `docs/CIRCULAR-INGESTION.md` for the pipeline this drives.

| Method | Path | Notes | Status |
|---|---|---|---|
| POST | `/admin/circulars/upload` | multipart PDF + `circularNumber`, `publicationDate`. Runs extraction synchronously, creates `circulars` row and draft `vacancies` in `pending_verification`. | v1 |
| GET | `/admin/circulars` | list, with status | v1 |
| GET | `/admin/circulars/:id` | detail incl. extracted vacancies | v1 |
| GET | `/admin/vacancies/pending` | queue for review | v1 |
| PATCH | `/admin/vacancies/:id/verify` | `{ approve: boolean, edits?: {...} }`. Approve → `published`; reject → `rejected`. Requires `admin_users`. | v1 |
| POST | `/admin/circulars/collect` | trigger the scheduled automatic collector on demand | designed |

## Café assisted sessions — v1

All routes require `cafe_staff`. A session starts `pending` — opening one
grants staff nothing by itself. It only becomes `open` (staff can act on the
applicant's profile/documents) once the applicant authorizes it themselves.

| Method | Path | Notes |
|---|---|---|
| GET | `/cafe/applicants?email=` | `{ exists: boolean }` — whether an applicant account already exists for this email, so staff know whether to collect a new password or ask the applicant to authorize with their existing one. |
| POST | `/cafe/sessions` | `{ applicantEmail, newApplicantPassword?, applicantFullName?, openedReason? }`. If the email has no account yet, `newApplicantPassword` is required — the applicant chooses it themselves at the keyboard, which is what lets that session start already-`open` (there's no prior account to protect); `applicantFullName` names the new account (defaults to a placeholder if omitted). If the account already exists, the session starts `pending` and both `newApplicantPassword`/`applicantFullName` are ignored. |
| POST | `/cafe/sessions/:id/authorize` | `{ password }`. The applicant's own password, checked against their own account. The only way a `pending` session becomes `open`. |
| POST | `/cafe/sessions/:id/close` | Closes it (from `pending` or `open`); staff loses access to that applicant immediately after. |
| GET | `/cafe/sessions/:id` | Session state, staff-only, while `pending` or `open` (not after close). |

Once a session is `open`, staff calls to `/profile*` and `/documents*`
routes carry an `X-Assisted-Session-Id` header naming it. The API resolves
the *effective* user (the applicant, from the session) separately from the
*actor* (the staff member, from their own login) — every such write is
recorded in `audit_logs` against both. The same header, when present on
`GET /vacancies` or `GET /vacancies/:id`, also personalises the
`matchPercentage`/`match` block against the applicant's profile instead of
staff's own — this is read-only and exists so staff can help find a
matching vacancy; an invalid or missing session simply falls back to no
personalised match rather than failing the request. Applying, reviewing,
and signing are deliberately **not** assistable this way: those require the
applicant's own authenticated session, never staff acting on their behalf,
since a signature and a submission decision have to be the applicant's own
act.

## Account — designed

| Method | Path | Notes |
|---|---|---|
| DELETE | `/account` | soft-deletes the user, schedules document purge |
| GET | `/account/export` | JSON bundle of everything the platform holds on the user |

## Notifications — designed

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | unread + recent |
| POST | `/notifications/:id/read` | mark read |
