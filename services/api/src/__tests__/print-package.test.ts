import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { pool } from "../db.js";
import { hashPassword } from "../auth.js";
import { createAdminUser } from "../repo/admin.js";
import { createUser } from "../repo/users.js";
import {
  addRequirement,
  createCircular,
  createDraftVacancy,
  getOrCreateDepartment,
  verifyVacancy,
} from "../repo/vacancies.js";
import { resetDatabase } from "./dbReset.js";
import { buildMultipartPayload } from "./multipart.js";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function seedDocumentTypes(): Promise<void> {
  for (const code of ["id_document", "cv", "qualification_certificate"]) {
    await pool.query(
      `INSERT INTO document_types (code, label) VALUES ($1, $1) ON CONFLICT (code) DO NOTHING`,
      [code],
    );
  }
}

function extractCookie(response: { cookies: { name: string; value: string }[] }): string {
  const cookie = response.cookies.find((c) => c.name === "z83_session");
  if (!cookie) throw new Error("Session cookie was not set.");
  return cookie.value;
}

async function buildTestPdf(pageCount: number, label: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${label} — page ${i + 1}`, { x: 50, y: 780, size: 14, font });
  }
  return Buffer.from(await doc.save());
}

describe("hand-delivery print-ready package", () => {
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

  it("merges the Z83 summary with the applicant's real ID, certificate and CV, in submission order", async () => {
    const email = `hand-delivery-${Date.now()}@example.com`;
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "correct horse battery staple", fullName: "Hand Delivery Applicant" },
    });
    const authed = { cookies: { z83_session: extractCookie(register) } };

    await app.inject({
      method: "PUT",
      url: "/profile",
      ...authed,
      payload: {
        idNumber: "8501015800083",
        dateOfBirth: "1985-01-01",
        gender: "female",
        nationality: "South African",
        addressLine1: "22 Voortrekker Road",
        city: "Bloemfontein",
        province: "Free State",
        postalCode: "9301",
        phone: "0731234567",
        email,
      },
    });
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/profile/references",
        ...authed,
        payload: { fullName: `Referee ${i}`, phone: "0820000000", orderIndex: i },
      });
    }
    await app.inject({
      method: "POST",
      url: "/profile/qualifications",
      ...authed,
      payload: {
        institution: "Central University of Technology",
        qualificationName: "National Diploma in Human Resource Management",
        stillStudying: false,
        orderIndex: 0,
      },
    });

    // Upload real, multi-page PDFs — a certified ID copy (1 page), a
    // qualification certificate (1 page), and a CV (2 pages) — so the
    // merged package's page count and order can be checked precisely.
    const idPdf = await buildTestPdf(1, "Certified ID Copy");
    const certPdf = await buildTestPdf(1, "Qualification Certificate");
    const cvPdf = await buildTestPdf(2, "Curriculum Vitae");

    for (const [docType, bytes] of [
      ["id_document", idPdf],
      ["qualification_certificate", certPdf],
      ["cv", cvPdf],
    ] as const) {
      const { body, contentType } = buildMultipartPayload(
        { documentTypeCode: docType },
        { fieldName: "file", filename: `${docType}.pdf`, contentType: "application/pdf", content: bytes },
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

    // A real hand-delivery vacancy: no submission email, a physical address instead.
    const departmentId = await getOrCreateDepartment("Department of Social Development");
    const circularId = await createCircular({
      circularNumber: `HAND-DELIVERY-TEST-${Date.now()}`,
      publicationDate: "2026-02-01",
      ingestionMethod: "manual_upload",
    });
    const vacancyId = await createDraftVacancy({
      circularId,
      departmentId,
      jobTitle: "Social Work Policy Coordinator",
      referenceNumber: "DSD/HR/04/2026",
      salaryText: "R444 036 per annum (Level 09)",
      province: "Free State",
      locationText: "Bloemfontein",
      pageNumber: 3,
      closingAt: null,
      submissionMethod: "hand_delivery",
      submissionEmail: null,
      submissionAddress:
        "Hand deliver to: Department of Social Development, 51 Zastron Street, Bloemfontein, 9301. Applications must be placed in the box marked DSD/HR/04/2026.",
      specialInstructions: "No faxed or emailed applications will be considered for this post.",
      rawExtractedText: null,
    });
    await addRequirement(vacancyId, {
      requirementType: "qualification",
      description: "National Diploma in Human Resource Management or related field",
      minimumValue: null,
      isMandatory: true,
      orderIndex: 0,
    });

    const adminUser = await createUser({
      email: `hand-delivery-admin-${Date.now()}@example.com`,
      passwordHash: await hashPassword("admin-password"),
      fullName: "Hand Delivery Admin",
      role: "admin",
    });
    const adminUserRow = await createAdminUser(adminUser.id, "superadmin");
    const verified = await verifyVacancy(vacancyId, adminUserRow.id, true);
    expect(verified?.status).toBe("published");
    expect(verified?.submissionMethod).toBe("hand_delivery");
    expect(verified?.submissionAddress).toContain("51 Zastron Street");

    const apply = await app.inject({
      method: "POST",
      url: "/applications",
      ...authed,
      payload: { vacancyId },
    });
    expect(apply.statusCode).toBe(201);
    const applicationId = apply.json().application.id as string;

    const review = await app.inject({ method: "POST", url: `/applications/${applicationId}/review`, ...authed });
    expect(review.json().complete).toBe(true);

    const sign = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/sign`,
      ...authed,
      payload: { imageBase64: `data:image/png;base64,${TINY_PNG_BASE64}` },
    });
    expect(sign.statusCode).toBe(200);

    // A vacancy with no submission email must refuse email preparation —
    // hand delivery only, exactly as the vacancy states.
    const emailAttempt = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/email-package`,
      ...authed,
    });
    expect(emailAttempt.statusCode).toBe(409);

    const printPackage = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/print-package`,
      ...authed,
    });
    expect(printPackage.statusCode).toBe(200);
    const { url } = printPackage.json();

    const download = await app.inject({ method: "GET", url: new URL(url).pathname + new URL(url).search });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toBe("application/octet-stream");

    const merged = await PDFDocument.load(download.rawPayload);
    // Z83 summary is at least 1 page, then ID (1) + certificate (1) + CV (2) = 4 more.
    expect(merged.getPageCount()).toBeGreaterThanOrEqual(5);

    // Extract real text per page to confirm both content and order: the
    // Z83 summary first, then ID, then certificate, then CV — matching
    // DOCUMENT_TYPE_ORDER in print-package.ts, not just a page count.
    const pdfDoc = await getDocument({ data: new Uint8Array(download.rawPayload) }).promise;
    const pageTexts: string[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }

    const z83PageIndex = pageTexts.findIndex((t) => t.includes("Z83 Application Data"));
    const idPageIndex = pageTexts.findIndex((t) => t.includes("Certified ID Copy"));
    const certPageIndex = pageTexts.findIndex((t) => t.includes("Qualification Certificate"));
    const cvPage1Index = pageTexts.findIndex((t) => t.includes("Curriculum Vitae — page 1"));
    const cvPage2Index = pageTexts.findIndex((t) => t.includes("Curriculum Vitae — page 2"));

    expect(z83PageIndex).toBe(0);
    expect(idPageIndex).toBeGreaterThan(z83PageIndex);
    expect(certPageIndex).toBeGreaterThan(idPageIndex);
    expect(cvPage1Index).toBeGreaterThan(certPageIndex);
    expect(cvPage2Index).toBe(cvPage1Index + 1);

    const application = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    expect(application.json().application.status).toBe("print_prepared");
    const generatedDocs = application
      .json()
      .documents.filter((d: { documentRole: string }) => d.documentRole === "generated_z83");
    expect(generatedDocs).toHaveLength(1);
  });
});
