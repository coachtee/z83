# Z83 — Product

## What it is

Z83 is a South African application platform for government jobs. A user fills in
their profile and Z83 information once, uploads their documents once, and
reuses all of it every time they apply for a public-service vacancy.

Tagline: **"Fill once. Apply many times."**

Owner: Naleli Innovations (jobs@naleli.co.za)
Planned domain: z83.naleli.co.za
Market: South Africa only.

Z83 is an independent product. It is not part of, endorsed by, or affiliated
with the Department of Public Service and Administration (DPSA) or any
government department. It uses publicly published Public Service Vacancy
Circular information to help people apply. It does not use the national coat
of arms, government letterhead styling, or any other mark that would suggest
it is an official government system.

## Who it's for

- **Applicants** — people applying for public-service jobs. Often on a phone,
  sometimes on a shared PC at an internet café, often applying to more than
  one vacancy over time with the same underlying information.
- **Internet café staff** — assist applicants who don't have a device,
  data, or the confidence to do this alone. They facilitate; they don't own
  the applicant's data or decisions.
- **Administrators** — Naleli staff who load and verify vacancy circulars and
  keep the vacancy data correct.

## What it is not

Z83 is not a job board, a CV marketplace, a social network, or an HR/ATS
system. There are no profiles-as-resumes to browse, no employer accounts, no
messaging between users, no feeds, no "connections." One user manages one
thing: their own application data and the applications built from it.

Every screen should answer one question: what does this person need to do
right now to move their application forward? Nothing else earns a place on
the screen.

## The core flow

1. Create a profile.
2. Fill in Z83 information (personal particulars, qualifications, experience,
   references, competencies) once.
3. Upload ID, qualification certificates, CV, professional registrations, and
   other supporting documents once, stored securely.
4. Z83 ingests government vacancy circulars weekly.
5. Each vacancy is matched against the user's profile.
6. The user opens a vacancy and sees *why* it matches (or doesn't).
7. They tap **Apply**.
8. Z83 assembles a vacancy-specific application from the saved profile.
9. The user reviews it.
10. The user signs it on their phone.
11. If the vacancy accepts email applications, Z83 prepares the email
    (recipient, subject, attachments) — the user still confirms before
    anything is sent.
12. If the vacancy requires hand delivery, Z83 generates a print-ready
    package.
13. The application and its status are stored for later reference.

## Design principles

- **Mobile-first.** Most applicants will use this on a phone. Desktop
  support (internet café PCs) must also work well, but phone is the primary
  target.
- **Progressive disclosure.** Show the minimum a person needs to complete the
  step they're on. Don't front-load every field the system will ever need.
- **No ads on the critical path.** Profile completion, document upload,
  application review, signing, and submission preparation are never
  interrupted by advertising, upsells, or unrelated prompts.
- **Plain language.** Government forms are already confusing. Z83's own UI
  copy should not add to that.
- **Advisory, not authoritative.** Z83 estimates whether a profile matches a
  vacancy. It never tells a user they are "eligible" — only DPSA and the
  hiring department can decide that.
- **One Z83 profile, versioned.** Editing a profile never rewrites history —
  applications already submitted are frozen snapshots of the profile as it
  stood at the time.

## Roles

- **Applicant** — owns their profile, documents, and applications.
- **Internet Café Staff** — can start and run an *assisted session* with an
  applicant present. All actions during the session are attributed to the
  applicant's account and staff involvement is recorded. Staff cannot see or
  act on an applicant's data outside an active, explicitly-opened session.
- **Administrator** — manages circular ingestion, verifies and publishes
  vacancies, manages departments and document types, and has audit visibility
  (not blanket access to applicant documents).

## Monetisation

The core product (profile, documents, matching, applying) is free. Google
AdMob will be added later, in placements that never interrupt the flows
listed as ad-free above (e.g. the vacancy list, not the review/sign screens).

## What "done" looks like for v1

A real applicant can, without help, build a complete profile, get matched
against real vacancy data, and walk away with either a correctly addressed
email application ready to send, or a print-ready package ready to hand
deliver — for a real Public Service Vacancy Circular. Everything short of
that is not v1.
