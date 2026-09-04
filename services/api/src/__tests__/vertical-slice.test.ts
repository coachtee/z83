import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { pool } from "../db.js";
import { hashPassword } from "../auth.js";
import { createUser } from "../repo/users.js";
import { createAdminUser } from "../repo/admin.js";
import { resetDatabase } from "./dbReset.js";
import { buildMultipartPayload } from "./multipart.js";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const DOCUMENT_TYPES: { code: string; label: string }[] = [
  { code: "id_document", label: "ID document" },
  { code: "matric_certificate", label: "Matric certificate" },
  { code: "qualification_certificate", label: "Qualification certificate" },
  { code: "cv", label: "Curriculum vitae" },
  { code: "drivers_licence", label: "Driver's licence" },
  { code: "professional_registration", label: "Professional registration" },
  { code: "other", label: "Other" },
  { code: "z83_form_template", label: "Official Z83 template" },
];

async function seedDocumentTypes(): Promise<void> {
  for (const dt of DOCUMENT_TYPES) {
    await pool.query(
      `INSERT INTO document_types (code, label) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
      [dt.code, dt.label],
    );
  }
}

async function buildSyntheticCircularPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  const lines = [
    "DEPARTMENT OF PUBLIC SERVICE AND ADMINISTRATION",
    "POST : Administration Clerk: Registry Services",
    "REF NO : TESTDEPT/01/2026",
    "SALARY : R202 233 per annum",
    "CENTRE : Pretoria, Gauteng",
    // Wrapped across multiple physical lines, same as a real circular PDF
    // would lay it out — pdf-lib silently truncates a single drawText call
    // that overflows the page width, so a long field has to be split by
    // hand into lines the way the source document actually would be.
    "REQUIREMENTS : Grade 12 certificate plus a National Diploma",
    "(NQF Level 6) in Public Administration. At least 3 years",
    "relevant experience. A valid Code B driving licence.",
    "COMPETENCIES : Knowledge of the Public Finance Management Act (PFMA).",
    "APPLICATIONS : Email applications to recruitment@example.org",
    "CLOSING DATE : 31 December 2026",
  ];
  let y = 800;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: 10, font });
    y -= 16;
  }
  return Buffer.from(await doc.save());
}

function extractCookie(response: { cookies: { name: string; value: string }[] }): string {
  const cookie = response.cookies.find((c) => c.name === "z83_session");
  if (!cookie) throw new Error("Session cookie was not set.");
  return cookie.value;
}

describe("Z83 first vertical slice", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await resetDatabase();
    await seedDocumentTypes();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("takes one applicant from registration through a signed, packaged application", async () => {
    // 1. Register
    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "thabo.applicant@example.com",
        password: "correct horse battery staple",
        fullName: "Thabo Nkosi",
      },
    });
    expect(registerResponse.statusCode).toBe(201);
    const applicantCookie = extractCookie(registerResponse);
    const authed = { cookies: { z83_session: applicantCookie } };

    // 2. Complete profile
    const profileUpdate = await app.inject({
      method: "PUT",
      url: "/profile",
      ...authed,
      payload: {
        idNumber: "9001015800083",
        dateOfBirth: "1990-01-01",
        gender: "male",
        nationality: "South African",
        race: "African",
        addressLine1: "1 Church Street",
        city: "Pretoria",
        province: "Gauteng",
        postalCode: "0002",
        phone: "0821234567",
        email: "thabo.applicant@example.com",
        driversLicenceCodes: ["B"],
      },
    });
    expect(profileUpdate.statusCode).toBe(200);

    // 3. Add qualification
    const qualification = await app.inject({
      method: "POST",
      url: "/profile/qualifications",
      ...authed,
      payload: {
        institution: "University of South Africa",
        qualificationName: "National Diploma in Public Administration",
        fieldOfStudy: "Public Administration",
        nqfLevel: 6,
        yearCompleted: 2015,
        stillStudying: false,
        orderIndex: 0,
      },
    });
    expect(qualification.statusCode).toBe(201);

    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
    const workExperience = await app.inject({
      method: "POST",
      url: "/profile/work-experience",
      ...authed,
      payload: {
        employer: "Department of Health",
        jobTitle: "Administration Clerk",
        startDate: fourYearsAgo.toISOString().slice(0, 10),
        isCurrent: true,
        orderIndex: 0,
      },
    });
    expect(workExperience.statusCode).toBe(201);

    for (let i = 0; i < 3; i++) {
      const reference = await app.inject({
        method: "POST",
        url: "/profile/references",
        ...authed,
        payload: { fullName: `Referee ${i + 1}`, phone: "0820000000", orderIndex: i },
      });
      expect(reference.statusCode).toBe(201);
    }

    // 3b. Upload a certificate (and the other documents review requires)
    for (const docType of ["id_document", "cv", "qualification_certificate"] as const) {
      const { body, contentType } = buildMultipartPayload(
        { documentTypeCode: docType },
        {
          fieldName: "file",
          filename: `${docType}.pdf`,
          contentType: "application/pdf",
          content: Buffer.from(`Fake ${docType} content for testing.`),
        },
      );
      const upload = await app.inject({
        method: "POST",
        url: "/documents",
        ...authed,
        headers: { "content-type": contentType },
        payload: body,
      });
      expect(upload.statusCode).toBe(201);
    }

    const documentsList = await app.inject({ method: "GET", url: "/documents", ...authed });
    expect(documentsList.json().documents).toHaveLength(3);

    // 4. Load a real (synthetic, admin-uploaded) vacancy through the real ingestion pipeline
    const adminPasswordHash = await hashPassword("admin-password-for-tests");
    const adminUser = await createUser({
      email: "admin@example.com",
      passwordHash: adminPasswordHash,
      fullName: "Z83 Test Admin",
      role: "admin",
    });
    await createAdminUser(adminUser.id, "superadmin");

    const adminLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@example.com", password: "admin-password-for-tests" },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminAuthed = { cookies: { z83_session: extractCookie(adminLogin) } };

    const circularPdf = await buildSyntheticCircularPdf();
    const { body: uploadBody, contentType: uploadContentType } = buildMultipartPayload(
      { circularNumber: "TEST-CIRC-01-2026", publicationDate: "2026-01-05" },
      { fieldName: "file", filename: "circular.pdf", contentType: "application/pdf", content: circularPdf },
    );
    const circularUpload = await app.inject({
      method: "POST",
      url: "/admin/circulars/upload",
      ...adminAuthed,
      headers: { "content-type": uploadContentType },
      payload: uploadBody,
    });
    expect(circularUpload.statusCode).toBe(201);
    expect(circularUpload.json().draftVacancyCount).toBe(1);

    const circularId = circularUpload.json().circularId as string;
    const circularDetail = await app.inject({
      method: "GET",
      url: `/admin/circulars/${circularId}`,
      ...adminAuthed,
    });
    const draftVacancy = circularDetail.json().vacancies[0];
    expect(draftVacancy.status).toBe("pending_verification");
    expect(draftVacancy.jobTitle).toBe("Administration Clerk: Registry Services");

    const verify = await app.inject({
      method: "PATCH",
      url: `/admin/vacancies/${draftVacancy.id}/verify`,
      ...adminAuthed,
      payload: { approve: true },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().vacancy.status).toBe("published");
    const vacancyId = draftVacancy.id as string;

    // 5 & 6. Calculate match and see why it matches
    const vacancyDetail = await app.inject({ method: "GET", url: `/vacancies/${vacancyId}`, ...authed });
    expect(vacancyDetail.statusCode).toBe(200);
    const { match } = vacancyDetail.json();
    expect(match.percentage).toBeGreaterThan(0);
    expect(match.percentage).toBeLessThan(100); // competency requirement is always "unknown"
    expect(match.matched.length).toBe(3); // qualification, experience, driver's licence
    expect(match.unknown.length).toBe(1); // competency
    expect(match.disclaimer).toMatch(/appears to match/i);
    expect(match.disclaimer).not.toMatch(/eligible/i);

    const vacancyList = await app.inject({ method: "GET", url: "/vacancies", ...authed });
    const listedVacancy = vacancyList.json().vacancies.find((v: { id: string }) => v.id === vacancyId);
    expect(listedVacancy.matchPercentage).toBe(match.percentage);

    // 7 & 8. Apply -> immutable snapshot
    const applyResponse = await app.inject({
      method: "POST",
      url: "/applications",
      ...authed,
      payload: { vacancyId },
    });
    expect(applyResponse.statusCode).toBe(201);
    const applicationId = applyResponse.json().application.id as string;

    const duplicateApply = await app.inject({
      method: "POST",
      url: "/applications",
      ...authed,
      payload: { vacancyId },
    });
    expect(duplicateApply.statusCode).toBe(409); // one Z83 per position

    // Change the live profile *after* applying — the snapshot must not move.
    await app.inject({
      method: "PUT",
      url: "/profile",
      ...authed,
      payload: { city: "Cape Town" },
    });

    const applicationAfterProfileChange = await app.inject({
      method: "GET",
      url: `/applications/${applicationId}`,
      ...authed,
    });
    expect(applicationAfterProfileChange.json().snapshot.snapshotData.profile.city).toBe("Pretoria");

    // 9 & 10. Generate application data + review
    const review = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/review`,
      ...authed,
    });
    expect(review.statusCode).toBe(200);
    const reviewReport = review.json();
    expect(reviewReport.complete).toBe(true);
    expect(reviewReport.checks.every((c: { passed: boolean }) => c.passed)).toBe(true);

    // Signing before review passes should be rejected — prove it with a
    // fresh application that has no documents attached.
    const barePersonResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "bare.applicant@example.com", password: "another long password", fullName: "Bare Applicant" },
    });
    const bareAuthed = { cookies: { z83_session: extractCookie(barePersonResponse) } };
    const bareApply = await app.inject({
      method: "POST",
      url: "/applications",
      ...bareAuthed,
      payload: { vacancyId },
    });
    const bareSignAttempt = await app.inject({
      method: "POST",
      url: `/applications/${bareApply.json().application.id}/sign`,
      ...bareAuthed,
      payload: { imageBase64: `data:image/png;base64,${TINY_PNG_BASE64}` },
    });
    expect(bareSignAttempt.statusCode).toBe(409);

    // 11. Sign
    const sign = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/sign`,
      ...authed,
      payload: { imageBase64: `data:image/png;base64,${TINY_PNG_BASE64}` },
    });
    expect(sign.statusCode).toBe(200);
    expect(sign.json().status).toBe("signed");

    // 12. Email-ready package — prepared, never claimed as sent
    const emailPackage = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/email-package`,
      ...authed,
    });
    expect(emailPackage.statusCode).toBe(200);
    const emailBody = emailPackage.json();
    expect(emailBody.sent).toBe(false);
    expect(emailBody.emailPackage.recipient).toBe("recruitment@example.org");
    expect(emailBody.emailPackage.subject).toMatch(/TESTDEPT\/01\/2026/);
    expect(emailBody.emailPackage.attachments.length).toBeGreaterThanOrEqual(4); // generated Z83 + 3 uploads

    // 13. Print-ready package
    const printPackage = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/print-package`,
      ...authed,
    });
    expect(printPackage.statusCode).toBe(200);
    expect(printPackage.json().url).toMatch(/^http/);

    // 14. Status persists on a fresh read
    const statusUpdate = await app.inject({
      method: "PATCH",
      url: `/applications/${applicationId}/status`,
      ...authed,
      payload: { status: "submitted" },
    });
    expect(statusUpdate.statusCode).toBe(200);

    const finalRead = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    expect(finalRead.json().application.status).toBe("submitted");

    const events = await app.inject({ method: "GET", url: `/applications/${applicationId}/events`, ...authed });
    const eventTypes = events.json().events.map((e: { eventType: string }) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining(["created", "reviewed", "signed", "email_prepared", "print_prepared", "status_changed"]),
    );
  });
});
