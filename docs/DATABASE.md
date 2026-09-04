# Z83 — Database

PostgreSQL 16. Plain SQL migrations in `/database/migrations`, applied in
order by `database/migrate.mjs`. No ORM, no Supabase-specific extensions —
this schema loads unchanged into a Supabase project later.

All primary keys are `uuid default gen_random_uuid()` (built into Postgres
16 core, no extension needed). All tables have `created_at timestamptz not
null default now()`; tables that are edited in place also have `updated_at`
maintained by a trigger.

Two entities from the spec map to different table names for SQL reasons or
clarity, noted where relevant below.

## Identity and roles

### `users`
The single auth identity table for every human who logs in — applicants,
café staff, and admins alike. `cafe_staff` and `admin_users` are extension
tables that attach role-specific data to a `users` row, not separate login
systems.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| email | citext unique not null | |
| phone | text unique null | SA MSISDN, optional |
| password_hash | text not null | bcrypt |
| role | text not null | `applicant` \| `cafe_staff` \| `admin`, check constraint |
| full_name | text not null | |
| email_verified_at | timestamptz null | |
| deleted_at | timestamptz null | soft delete, supports account deletion |

### `admin_users`
Extends a `users` row with admin-specific state.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk → users, unique | |
| permission_level | text not null | `verifier` \| `superadmin` |

### `cafe_accounts`
The internet café business itself (one row per café location/franchise).

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text not null | |
| province | text not null | |
| address | text null | |
| contact_email | citext null | |
| contact_phone | text null | |

### `cafe_staff`
Extends a `users` row with which café they work for.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk → users, unique | |
| cafe_account_id | uuid fk → cafe_accounts | |

### `assisted_sessions`
An explicit, bounded window where café staff act alongside an applicant.
Staff opening a session grants nothing by itself — it starts `pending` and
only becomes `open` once the applicant authorizes it themselves (their own
password, entered on the shared device). Nothing outside an `open` session
gives staff access to applicant data.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| cafe_staff_id | uuid fk → cafe_staff | |
| applicant_user_id | uuid fk → users | |
| status | text not null | `pending` \| `open` \| `closed`, default `pending` |
| opened_at | timestamptz not null | when staff started the session |
| authorized_at | timestamptz null | when the applicant confirmed it — null until then |
| closed_at | timestamptz null | |
| opened_reason | text null | e.g. "walk-in, needs profile setup" |

## Profile (the "fill once" data)

### `profiles`
One row per applicant — the current, live state of their Z83 information.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk → users, unique | |
| id_number | text null | SA ID number |
| passport_number | text null | for non-SA-ID applicants where the vacancy allows |
| date_of_birth | date null | |
| gender | text null | |
| nationality | text null | |
| race | text null | required on the real Z83 form (EE reporting) |
| disability_status | text null | |
| address_line1/2, city, province, postal_code | text | residential address |
| postal_address_line1/2, city, province, postal_code | text | if different from residential |
| phone, alt_phone, email | text | contact details for the application itself, can differ from login email |
| drivers_licence_codes | text[] null | e.g. `{B,EB}`, null = not captured, `{}` = explicitly none |
| professional_registrations | text[] null | self-declared registration bodies, e.g. `{SAICA,ECSA}`; null = not captured, `{}` = explicitly none. Matched against `vacancy_requirements.minimum_value` for `professional_registration` requirements — it is not verified against the registering body, only what the applicant declares |
| current_version_id | uuid fk → profile_versions, null | points at the latest snapshot for convenience |

### `profile_versions`
Append-only history of the `profiles` row (plus its children, denormalised
as JSON) every time it's saved. This is general edit history, separate from
`application_snapshots`, which freezes a profile at the moment of a specific
application.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| profile_id | uuid fk → profiles | |
| data | jsonb not null | full profile + qualifications + experience + languages + references at save time |
| created_at | timestamptz not null | |

### `qualifications`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| profile_id | uuid fk → profiles | |
| institution | text not null | |
| qualification_name | text not null | |
| field_of_study | text null | |
| nqf_level | smallint null | |
| year_completed | smallint null | |
| still_studying | boolean not null default false | |
| order_index | smallint not null | display/submission order — the Z83 guidance expects qualifications ordered correctly |

### `work_experience`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| profile_id | uuid fk → profiles | |
| employer | text not null | |
| job_title | text not null | |
| start_date | date not null | |
| end_date | date null | |
| is_current | boolean not null default false | |
| responsibilities | text null | |
| order_index | smallint not null | |

### `languages`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| profile_id | uuid fk → profiles | |
| language | text not null | |
| speak_level, read_level, write_level | text | `poor` \| `fair` \| `good` |

### `applicant_references`
Spec entity name is "references"; `references` is a reserved word bound up
with foreign-key syntax in SQL, so the table is `applicant_references`.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| profile_id | uuid fk → profiles | |
| full_name | text not null | |
| relationship | text null | |
| organisation | text null | |
| phone | text null | |
| email | citext null | |
| order_index | smallint not null | |

The Z83 guidance expects a minimum of three references where the vacancy
requires them — enforced in `packages/validation`, not the database (a
profile with fewer than three is still allowed to exist; it just fails
"ready to apply" validation).

## Documents

### `document_types`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| code | text unique not null | `id_document`, `matric_certificate`, `qualification_certificate`, `cv`, `drivers_licence`, `professional_registration`, `other`, `z83_form_template` (system use) |
| label | text not null | |
| requires_certification | boolean not null default false | |

### `documents`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| owner_user_id | uuid fk → users | |
| document_type_id | uuid fk → document_types | |
| storage_key | text not null | opaque key into the configured `StorageProvider` |
| original_filename | text not null | |
| mime_type | text not null | |
| size_bytes | integer not null | |
| verified_at | timestamptz null | |
| deleted_at | timestamptz null | soft delete, supports document deletion capability |

## Vacancy circulars

### `departments`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text unique not null | |
| code | text null | |

### `circulars`
The source document for a batch of vacancies (a weekly Public Service
Vacancy Circular).

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| circular_number | text not null | |
| publication_date | date not null | |
| source_url | text null | |
| source_document_key | text null | storage key for the retained source PDF |
| ingestion_method | text not null | `automatic` \| `manual_upload` |
| status | text not null | `collected` \| `processing` \| `processed` \| `failed` |
| uploaded_by_admin_id | uuid fk → admin_users, null | set for manual uploads |

### `vacancies`
The normalized vacancy, one row per advertised post.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| circular_id | uuid fk → circulars | |
| department_id | uuid fk → departments | |
| job_title | text not null | |
| reference_number | text not null | |
| salary_text | text null | kept as published text — salary notches vary by scale/OSD and shouldn't be parsed into a false-precision number |
| province | text null | |
| location_text | text null | |
| page_number | integer null | page within the source circular PDF |
| closing_at | timestamptz null | |
| submission_method | text not null | `email` \| `hand_delivery` \| `online` \| `either` |
| submission_email | citext null | |
| submission_address | text null | |
| special_instructions | text null | free text from the circular, e.g. "quote reference in subject line" |
| raw_extracted_text | text null | the extractor's raw text block, kept for admin verification and re-parsing |
| status | text not null | `pending_verification` \| `published` \| `closed` \| `rejected` |
| verified_by_admin_id | uuid fk → admin_users, null | |
| verified_at | timestamptz null | |

### `vacancy_requirements`
Normalized, structured requirements pulled from the vacancy text — this is
what the matching engine reads.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| vacancy_id | uuid fk → vacancies | |
| requirement_type | text not null | `qualification` \| `experience_years` \| `drivers_licence` \| `professional_registration` \| `competency` \| `other` |
| description | text not null | human-readable, as published |
| minimum_value | text null | e.g. `"3"` for years, `"B"` for licence code — kept as text, interpreted per `requirement_type` |
| is_mandatory | boolean not null default true | |
| order_index | smallint not null | |

## Applications

### `applications`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk → users | |
| vacancy_id | uuid fk → vacancies | |
| snapshot_id | uuid fk → application_snapshots, null until snapshot is created | |
| status | text not null | `draft` \| `reviewed` \| `signed` \| `email_prepared` \| `print_prepared` \| `submitted` \| `closed` |

One user may only hold one non-`closed` application per vacancy (unique
partial index) — matches the Z83 guidance of one Z83 per position.

### `application_snapshots`
The immutable copy of the profile at the moment of applying. Nothing reads
the live `profiles` table once this exists.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| application_id | uuid fk → applications | |
| snapshot_data | jsonb not null | full profile + qualifications + work_experience + languages + applicant_references + document list, at apply time |

### `application_documents`
Which documents (uploaded or generated) belong to this application, and in
what order — driven by the vacancy's own submission instructions, not a
hardcoded order.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| application_id | uuid fk → applications | |
| document_id | uuid fk → documents, null | null for generated documents |
| document_role | text not null | `id` \| `certificate` \| `cv` \| `registration` \| `generated_z83` \| `other` |
| storage_key | text null | set directly for generated documents (e.g. the filled Z83 PDF) |
| order_index | smallint not null | |

### `application_events`
Audit trail specific to one application's lifecycle (separate from the
system-wide `audit_logs`, which is broader and includes non-application
actions).

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| application_id | uuid fk → applications | |
| event_type | text not null | `created` \| `reviewed` \| `signed` \| `email_prepared` \| `print_prepared` \| `status_changed` \| `email_sent` \| `email_send_failed` |
| actor_user_id | uuid fk → users, null | |
| actor_role | text null | |
| metadata | jsonb null | |

### `signatures`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| application_id | uuid fk → applications | |
| user_id | uuid fk → users | |
| image_storage_key | text not null | PNG of the drawn signature |
| signed_at | timestamptz not null | |
| ip_address | inet null | |
| user_agent | text null | |

### `email_deliveries`
Every real send attempt (`POST /applications/:id/send`), success or
failure — the detailed audit record the spec calls for, distinct from the
higher-level `application_events` row also written for the same attempt.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| application_id | uuid fk → applications | |
| recipient | citext not null | |
| subject | text not null | |
| body | text not null | |
| attachments | jsonb not null | `{ label, storageKey }[]`, same shape as `EmailPackage.attachments` |
| attempted_at | timestamptz not null | |
| success | boolean not null | |
| error_message | text null | set when `success` is false |

## Notifications and system-wide audit

### `notifications`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk → users | |
| type | text not null | `vacancy_match` \| `application_status` \| `system` |
| title | text not null | |
| body | text not null | |
| read_at | timestamptz null | |

### `audit_logs`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| actor_user_id | uuid fk → users, null | null for system actions |
| actor_role | text null | |
| action | text not null | e.g. `profile.update`, `document.delete`, `assisted_session.open` |
| entity_type | text null | |
| entity_id | uuid null | |
| metadata | jsonb null | |
| ip_address | inet null | |

## Entity relationship summary

```
users ─┬─< profiles ─┬─< profile_versions
       │             ├─< qualifications
       │             ├─< work_experience
       │             ├─< languages
       │             └─< applicant_references
       ├─< documents >─ document_types
       ├─< admin_users
       ├─< cafe_staff >─ cafe_accounts
       ├─< assisted_sessions (as applicant)
       ├─< notifications
       └─< applications ─┬─ vacancies ─┬─ departments
                          │             ├─< vacancy_requirements
                          │             └─ circulars
                          ├─ application_snapshots (1:1)
                          ├─< application_documents
                          ├─< application_events
                          ├─< email_deliveries
                          └─< signatures
```
