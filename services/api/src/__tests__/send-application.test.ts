import { SMTPServer } from "smtp-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { pool } from "../db.js";
import { resetTransporterForTests } from "../email.js";
import {
  addRequirement,
  createCircular,
  createDraftVacancy,
  getOrCreateDepartment,
  verifyVacancy,
} from "../repo/vacancies.js";
import { createAdminUser } from "../repo/admin.js";
import { createUser } from "../repo/users.js";
import { hashPassword } from "../auth.js";
import { resetDatabase } from "./dbReset.js";
import { buildMultipartPayload } from "./multipart.js";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function seedDocumentTypes(): Promise<void> {
  const types = ["id_document", "cv", "qualification_certificate"];
  for (const code of types) {
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

/** Builds a signed, ready-to-send application without going through the
 * full circular-upload UI — this test is about /send, not ingestion. */
async function buildSignedApplication(
  app: FastifyInstance,
  overrides: { submissionEmail?: string | null } = {},
) {
  const email = `send-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const register = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "correct horse battery staple", fullName: "Send Test" },
  });
  const authed = { cookies: { z83_session: extractCookie(register) } };

  await app.inject({
    method: "PUT",
    url: "/profile",
    ...authed,
    payload: {
      idNumber: "9001015800083",
      dateOfBirth: "1990-01-01",
      gender: "male",
      nationality: "South African",
      addressLine1: "1 Church Street",
      city: "Pretoria",
      province: "Gauteng",
      postalCode: "0002",
      phone: "0821234567",
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
  for (const docType of ["id_document", "cv", "qualification_certificate"] as const) {
    const { body, contentType } = buildMultipartPayload(
      { documentTypeCode: docType },
      { fieldName: "file", filename: `${docType}.pdf`, contentType: "application/pdf", content: Buffer.from("x") },
    );
    await app.inject({
      method: "POST",
      url: "/documents",
      ...authed,
      headers: { "content-type": contentType },
      payload: body,
    });
  }
  await app.inject({
    method: "POST",
    url: "/profile/qualifications",
    ...authed,
    payload: {
      institution: "UNISA",
      qualificationName: "National Diploma",
      stillStudying: false,
      orderIndex: 0,
    },
  });

  const departmentId = await getOrCreateDepartment("Department of Send Testing");
  const circularId = await createCircular({
    circularNumber: `SEND-TEST-${Date.now()}-${Math.random()}`,
    publicationDate: "2026-01-01",
    ingestionMethod: "manual_upload",
  });
  const vacancyId = await createDraftVacancy({
    circularId,
    departmentId,
    jobTitle: "Test Post",
    referenceNumber: "TEST/01/2026",
    salaryText: null,
    province: "Gauteng",
    locationText: null,
    pageNumber: 1,
    closingAt: null,
    submissionMethod: "email",
    submissionEmail: overrides.submissionEmail === undefined ? "recruitment@example.org" : overrides.submissionEmail,
    submissionAddress: null,
    specialInstructions: null,
    rawExtractedText: null,
  });
  await addRequirement(vacancyId, {
    requirementType: "other",
    description: "N/A",
    minimumValue: null,
    isMandatory: false,
    orderIndex: 0,
  });

  const adminEmail = `send-admin-${Date.now()}@example.com`;
  const adminUser = await createUser({
    email: adminEmail,
    passwordHash: await hashPassword("admin-password"),
    fullName: "Send Test Admin",
    role: "admin",
  });
  const adminUserRow = await createAdminUser(adminUser.id, "superadmin");
  await verifyVacancy(vacancyId, adminUserRow.id, true);

  const apply = await app.inject({
    method: "POST",
    url: "/applications",
    ...authed,
    payload: { vacancyId },
  });
  const applicationId = apply.json().application.id as string;

  await app.inject({ method: "POST", url: `/applications/${applicationId}/review`, ...authed });
  await app.inject({
    method: "POST",
    url: `/applications/${applicationId}/sign`,
    ...authed,
    payload: { imageBase64: `data:image/png;base64,${TINY_PNG_BASE64}` },
  });

  return { app, authed, applicationId };
}

describe("POST /applications/:id/send", () => {
  let app: FastifyInstance;
  let server: SMTPServer;
  let port: number;

  beforeAll(async () => {
    await resetDatabase();
    await seedDocumentTypes();
    app = await buildApp();

    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS"],
      onData(stream, _session, callback) {
        stream.on("data", () => {});
        stream.on("end", callback);
      },
    });
    await new Promise<void>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    const address = server.server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test SMTP server.");
    port = address.port;
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  afterEach(() => {
    resetTransporterForTests();
  });

  it("rejects sending without explicit confirm:true", async () => {
    const { authed, applicationId } = await buildSignedApplication(app);
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);

    const res = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/send`,
      ...authed,
      payload: {},
    });
    expect(res.statusCode).toBe(400);

    const detail = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    expect(detail.json().application.status).toBe("signed");
  });

  it("sends for real, records the delivery and event, and marks the application submitted", async () => {
    delete process.env.SMTP_HOST;
    const { authed, applicationId } = await buildSignedApplication(app);
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_SECURE = "false";

    const res = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/send`,
      ...authed,
      payload: { confirm: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.recipient).toBe("recruitment@example.org");
    expect(body.error).toBeFalsy();

    const detail = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    expect(detail.json().application.status).toBe("submitted");

    const deliveries = await app.inject({
      method: "GET",
      url: `/applications/${applicationId}/email-deliveries`,
      ...authed,
    });
    expect(deliveries.json().deliveries).toHaveLength(1);
    expect(deliveries.json().deliveries[0].success).toBe(true);
    expect(deliveries.json().deliveries[0].recipient).toBe("recruitment@example.org");

    const events = await app.inject({ method: "GET", url: `/applications/${applicationId}/events`, ...authed });
    const eventTypes = events.json().events.map((e: { eventType: string }) => e.eventType);
    expect(eventTypes).toContain("email_sent");
  });

  it("reports failure clearly and never marks submitted when SMTP delivery fails", async () => {
    delete process.env.SMTP_HOST;
    const { authed, applicationId } = await buildSignedApplication(app);
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1"; // nothing listens here

    const res = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/send`,
      ...authed,
      payload: { confirm: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();

    const detail = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    expect(detail.json().application.status).not.toBe("submitted");
    expect(detail.json().application.status).toBe("signed");

    const deliveries = await app.inject({
      method: "GET",
      url: `/applications/${applicationId}/email-deliveries`,
      ...authed,
    });
    expect(deliveries.json().deliveries[0].success).toBe(false);

    const events = await app.inject({ method: "GET", url: `/applications/${applicationId}/events`, ...authed });
    const eventTypes = events.json().events.map((e: { eventType: string }) => e.eventType);
    expect(eventTypes).toContain("email_send_failed");
  });

  it("does not duplicate the generated Z83 document when preview then send both regenerate it", async () => {
    delete process.env.SMTP_HOST;
    const { authed, applicationId } = await buildSignedApplication(app);
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_SECURE = "false";

    await app.inject({ method: "POST", url: `/applications/${applicationId}/email-package`, ...authed });
    await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/send`,
      ...authed,
      payload: { confirm: true },
    });

    const detail = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    const generatedDocs = detail
      .json()
      .documents.filter((d: { documentRole: string }) => d.documentRole === "generated_z83");
    expect(generatedDocs).toHaveLength(1);
  });

  it("refuses to send when the vacancy has no email submission instructions", async () => {
    delete process.env.SMTP_HOST;
    const { authed, applicationId } = await buildSignedApplication(app, { submissionEmail: null });
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);

    const res = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/send`,
      ...authed,
      payload: { confirm: true },
    });
    expect(res.statusCode).toBe(409);
  });
});
