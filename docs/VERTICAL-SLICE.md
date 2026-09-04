# First vertical slice — acceptance criteria

Scope: prove the full flow end to end for one applicant against one real,
admin-verified vacancy. Nothing here is a mockup — every step below reads
from and writes to Postgres through `services/api`, and any generated
document is a real file.

## Flow under test

1. **Register** an applicant account (`POST /auth/register`).
2. **Complete profile**: personal particulars, address, at least one
   driver's licence code, at least one qualification, at least one work
   experience entry, at least three references.
3. **Upload a certificate**: a PDF/image tagged as
   `qualification_certificate`, stored through the `StorageProvider`, listed
   back via `GET /documents`.
4. **Load a real vacancy**: an admin uploads a genuine Public Service
   Vacancy Circular PDF (or the seeded sample vacancy for local dev),
   extraction produces a draft vacancy + requirements, admin verifies and
   publishes it.
5. **Calculate match**: `GET /vacancies/:id` returns a match percentage plus
   matched/missing/unknown requirement lists, computed from the profile
   against `vacancy_requirements` — no hardcoded percentage.
6. **Open vacancy, see why it matches**: the UI renders the match breakdown
   from step 5, not a restated summary.
7. **Apply**: `POST /applications` creates the application.
8. **Immutable snapshot**: `application_snapshots` is written from the
   profile at that instant. Verify: change the live profile afterwards and
   confirm `GET /applications/:id` still shows the old data.
9. **Generate application**: the Z83 field set is populated from the
   snapshot (name checked against `packages/validation` output, not by eye).
10. **Review**: `POST /applications/:id/review` runs the Z83 completeness
    rules against the snapshot and returns pass/fail per rule.
11. **Sign**: a drawn signature (PNG) is captured and stored; status moves
    to `signed`. Signing before review passes is rejected.
12. **Email-ready package**: `POST /applications/:id/email-package` returns
    a real recipient/subject/body/attachment list sourced from the
    vacancy's actual submission instructions — and the response/API never
    claims anything was sent.
13. **Print-ready package**: `POST /applications/:id/print-package`
    generates an actual PDF file (via `pdf-lib`), retrievable by URL,
    containing the Z83 data in the vacancy's specified document order.
14. **Status persists**: `GET /applications/:id` reflects the final status
    (`email_prepared` or `print_prepared`) after a fresh request — not just
    in the response of the action that set it.

## Pass/fail bar

- Every step above is backed by a passing automated test
  (`services/api` integration tests hitting a real local Postgres, plus
  `packages/validation` unit tests for the rules and matching logic).
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` are clean across the
  workspace.
- The web UI (`apps/web`) can drive steps 1–14 by hand in a browser — this
  is checked manually against a running dev server, not asserted by an
  end-to-end test in this first slice (that's a fast-follow, tracked, not
  silently skipped).
- No step in this list is represented by static/demo data standing in for a
  real database row.

## Explicitly out of scope for this slice

- Automatic circular collection (architecture only — see
  `docs/CIRCULAR-INGESTION.md`).
- Actually sending the prepared email (SMTP dispatch).
- Android app screens beyond a read-only profile/vacancy view.
- AdMob integration.
- Full café-assisted UI beyond session open/close.
