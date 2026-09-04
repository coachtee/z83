# Z83 — Architecture

## Repository layout

```
/apps/web                 Next.js app (applicant + café + admin UI)
/apps/android              Kotlin/Compose native Android app
/services/api              REST API — the only thing that talks to Postgres directly
/services/circular-engine  Vacancy circular ingestion pipeline
/packages/types            Shared TypeScript types/DTOs
/packages/validation       Shared Zod schemas, Z83 validation rules, matching logic
/database                  SQL migrations and seed data
/docs                      This folder
```

This is a pnpm workspace, not a build-system-heavy monorepo (no Turborepo /
Nx yet) — there are five packages, that doesn't need one. Add one when build
times or task orchestration actually justify it.

## Why a separate `services/api` instead of Next.js API routes

Two clients need the same backend: the web app and the native Android app.
Putting business logic in Next.js route handlers would tie it to one client
and make the Android app either duplicate the logic in Kotlin or go through
the Next.js server as a proxy. Instead:

- `services/api` is a standalone Fastify + TypeScript REST API. It owns the
  Postgres connection, session/auth, storage access, PDF generation, and
  matching logic. Nothing outside this service ever holds a database
  credential or connects to Postgres directly.
- `apps/web` is a Next.js app that calls `services/api` over HTTP. It holds
  no privileged credentials — its server components/route handlers proxy
  authenticated requests using the caller's session cookie, they don't embed
  a service-role key.
- `apps/android` calls the same REST API directly.

This also matches a later move to Supabase cleanly: `services/api` becomes
the thing that either talks to Supabase Postgres directly (self-hosted API)
or gets replaced field-by-field with Supabase's own REST/RPC layer, without
the web or Android client code changing shape.

## Backend/data

- **Database:** PostgreSQL 16. Schema is plain SQL (see `/database` and
  `docs/DATABASE.md`), applied with a minimal migration runner
  (`database/migrate.mjs`) rather than a heavyweight ORM migration tool. No
  Supabase-specific extensions are used in the schema itself, so it can be
  loaded into a Supabase project's Postgres instance unchanged when we move
  there.
- **Access layer:** `services/api` uses `pg` (node-postgres) directly with
  hand-written parameterised SQL. No ORM. At this schema size a query
  builder buys nothing and hides exactly what's being sent to Postgres,
  which matters for a system holding ID numbers and certified documents.
- **Auth:** Session-based. `POST /auth/register` and `POST /auth/login`
  issue a signed, httpOnly session cookie (JWT, short-lived, `SameSite=Lax`,
  `Secure` in production). Every route that touches applicant data checks
  the session's `userId` and `role` before doing anything. Role-based access
  is enforced in a single Fastify `preHandler` hook per route group, not
  scattered through handlers.
- **Secrets:** database URL, JWT signing secret, and storage credentials are
  read from environment variables only (`.env`, never committed —
  `.env.example` documents the shape). No credential is ever sent to a
  client.

## Storage abstraction

Applicant documents (ID, certificates, CV, registrations, signatures,
generated application PDFs) go through a single `StorageProvider` interface:

```ts
interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
```

- **Dev/local:** `LocalDiskStorageProvider` writes under a configured root
  directory outside any web-servable path, and "signs" a URL as a
  short-lived, HMAC-signed token verified by `services/api` (not a static
  file server) so document access always goes through the API's
  authorization check.
- **Later:** `SupabaseStorageProvider` or `R2StorageProvider` implement the
  same interface. No caller-facing code changes — only the provider bound in
  `services/api/src/storage/index.ts` changes, behind one environment
  variable (`STORAGE_DRIVER`).

Nothing in `apps/web` or `apps/android` ever gets a raw storage credential;
they get short-lived signed URLs issued by `services/api` after an
authorization check.

## Matching engine

Matching is deterministic and rule-based — there is no ML model and nothing
described as "AI matching." `packages/validation/src/matching.ts` compares a
profile snapshot against a vacancy's `vacancy_requirements` rows and
produces:

- a match percentage,
- the list of requirements the profile satisfies,
- the list of requirements it doesn't,
- the list of requirements it can't evaluate (data not captured, e.g. a
  professional registration field left blank).

This output is always advisory. Copy referencing it must say things like
"appears to match" — never "eligible" or "qualifies." See
`docs/API.md` for the exact response shape and `packages/validation` for the
scoring rules.

## Application generation

An application is an **immutable snapshot**. When a user taps Apply:

1. `services/api` reads the user's current profile, qualifications, work
   experience, languages, references, and linked documents.
2. It writes an `application_snapshots` row containing that data as JSON,
   plus a new `applications` row pointing at it and at the vacancy.
3. Every later step (review, sign, generate email/print package) reads from
   the snapshot, never from the live profile. Editing the profile afterwards
   does not change any submitted or in-progress application.

PDF generation (`services/api/src/pdf`) uses `pdf-lib`. Two paths exist:

- **Template fill:** if an admin has uploaded the official Z83 form as a
  fillable PDF (an AcroForm) and it's registered as a system document, the
  API fills that form's actual fields from the snapshot. This is the correct
  long-term path — it reproduces the real government form exactly because
  it *is* the real government form, just filled in.
- **Fallback summary:** until that template is loaded, the API generates a
  clearly labelled "Z83 application data" PDF from the snapshot, structured
  the same way the real form is (personal particulars, qualifications,
  experience, declaration) so a reviewer can read straight off it, but it is
  not presented as a facsimile of the official form.

`POST /applications/:id/print-package` (`src/print-package.ts`) produces one
combined, print-ready PDF — the Z83 summary followed by the applicant's own
uploaded documents actually merged in, not just listed by name. PDFs are
merged page-for-page; images (JPEG/PNG scans) become a full page each; a
file type that can't be embedded gets a placeholder page saying so instead
of silently vanishing from the package. Document order follows the
conventional South African public-service submission order — Z83, ID,
qualifications, CV, then everything else — since no vacancy in this dataset
has specified its own explicit ordering; a vacancy that does should override
this default (not implemented yet).

## Email preparation and sending

`POST /applications/:id/email-package` prepares recipient, subject, body,
and attachment list and stores that as a preview — it never sends anything,
and the UI never says an email "was sent" from this step, only "prepared."

Actually sending is a separate, explicit action:
`POST /applications/:id/send` requires `{ "confirm": true }` in the body —
the applicant must take a distinct, deliberate action, never a byproduct of
preparing the preview. It dispatches over real SMTP (`src/email.ts`,
`nodemailer`), configured via `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/
`SMTP_FROM`. If `SMTP_HOST` isn't set, the endpoint reports the attempt as
failed with "not configured" rather than pretending to succeed.

Every attempt — success or failure — is recorded twice: an `email_deliveries`
row (recipient, subject, body, attachments, timestamp, success, error) for
the detailed audit record, and an `email_sent` / `email_send_failed`
`application_events` row for the application's own timeline. Only a
successful send moves the application to `submitted`; a failure changes
nothing about its status and surfaces the error to the caller. Preparing a
package (`/email-package`) never sets `submitted` on its own — only a real,
confirmed, successful dispatch does, or a hand-delivery applicant marking it
submitted themselves via `PATCH .../status`.

## Assisted (internet café) sessions

`assisted_sessions` records a café staff member operating alongside an
applicant. Rules enforced in `services/api`:

- Opening a session (staff identifies the applicant, `POST /cafe/sessions`)
  grants nothing by itself — it starts `pending`. Staff having *asked* for
  access is not the same as the applicant *granting* it.
- The applicant grants it themselves: their own password, typed on the
  shared device (`POST /cafe/sessions/:id/authorize`), moves the session to
  `open`. For a first-time walk-in with no account yet, choosing their own
  password *while creating the account* is that same act of consent, so
  that session starts `open` immediately — there's nothing pre-existing to
  protect.
- Only while `open` can staff act on the applicant's profile and documents,
  via `src/assisted-context.ts`'s `resolveActingContext`: routes resolve an
  *effective* user (whoever the session says, i.e. the applicant) separately
  from the *actor* (the logged-in staff member), and both go into
  `audit_logs` for every write.
- Applying, reviewing, and signing are **not** assistable this way on
  purpose — those routes never consult an assisted session. A signature and
  the decision to submit have to be the applicant's own authenticated
  action; the café workflow ends at "profile and documents are ready,"
  after which the applicant reviews and signs themselves (on the shared
  device, logged in as themselves, or by taking it from there on their own
  phone).
- Closing the session (`POST /cafe/sessions/:id/close`, from either
  `pending` or `open`) ends staff access immediately. There is no standing
  staff-to-applicant link outside an open, authorized session.
- `cafe_accounts` / `cafe_staff` are separate from `admin_users` — café
  staff have no administrative capability.
- `apps/web`'s `/cafe` route is the staff-facing UI for all of this: look up
  or create an applicant, hand the keyboard to them to authorize (or, for a
  walk-in, to choose a password), then a session workspace
  (`/cafe/session/[id]`) for editing profile, uploading documents, and
  browsing matching vacancies — every action there carries the session's
  `X-Assisted-Session-Id` header. It reuses the same components and layout
  as the applicant-facing pages so the product feels the same; it stops
  short of application/review/sign, which stay applicant-only.

## Circular ingestion

Covered in full in `docs/CIRCULAR-INGESTION.md`. In short: `services/circular-engine`
is a separate service from the applicant-facing API so a slow or failing
ingestion run never affects applicant traffic. It writes into the same
Postgres database, into its own tables (`circulars` → normalized `vacancies`
→ `vacancy_requirements`), gated behind admin verification before anything
is visible to applicants.

## Security posture

- All traffic over TLS in any deployed environment.
- Passwords hashed with bcrypt; sessions are short-lived signed JWTs in
  httpOnly cookies.
- Every data-touching route checks authentication and role/ownership before
  reading or writing.
- `audit_logs` records who did what to which record, when — profile edits,
  document access, application state changes, café-assisted actions, admin
  circular actions.
- Account deletion and data export are first-class API operations
  (`docs/API.md`), not manual database work.
- No real applicant data in development or seed data — seed data is
  synthetic.

## Android

Native Kotlin + Jetpack Compose, not a WebView wrapper. It talks to the same
`services/api` REST endpoints as the web app and shares the same data model
(mirrored as Kotlin data classes generated from the same shapes as
`packages/types`, kept in sync by hand for now — codegen is a later
optimisation once the API contract has stabilised past the first vertical
slice).

## Deployment target (later, not built yet)

- `apps/web` → Vercel or similar Next.js host.
- `services/api` → any Node host (Fly.io, Render, Railway) with network
  access to Postgres.
- Database → Supabase Postgres.
- Storage → Supabase Storage or Cloudflare R2.
- `services/circular-engine` → scheduled job (weekly) on the same host as
  `services/api` or a separate worker, writing to the same database.

None of this changes application code — it changes environment variables and
which `StorageProvider`/DB connection string is configured.
