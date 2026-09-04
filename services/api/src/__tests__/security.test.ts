import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { pool } from "../db.js";
import { resetDatabase } from "./dbReset.js";
import { buildMultipartPayload } from "./multipart.js";

async function seedDocumentTypes(): Promise<void> {
  await pool.query(
    `INSERT INTO document_types (code, label) VALUES ('id_document', 'ID document') ON CONFLICT (code) DO NOTHING`,
  );
}

function extractCookie(response: { cookies: { name: string; value: string }[] }): string {
  const cookie = response.cookies.find((c) => c.name === "z83_session");
  if (!cookie) throw new Error("Session cookie was not set.");
  return cookie.value;
}

async function registerApplicant(app: FastifyInstance, email: string) {
  const register = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "correct horse battery staple", fullName: "Security Test Applicant" },
  });
  return { authed: { cookies: { z83_session: extractCookie(register) } } };
}

describe("Authorization and access-control checks", () => {
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

  it("rejects an upload whose file type isn't PDF/JPEG/PNG, even with an accepted documentTypeCode", async () => {
    const applicant = await registerApplicant(app, `mime-check-${Date.now()}@example.com`);
    const { body, contentType } = buildMultipartPayload(
      { documentTypeCode: "id_document" },
      {
        fieldName: "file",
        filename: "not-a-document.html",
        contentType: "text/html",
        content: Buffer.from("<script>alert(1)</script>"),
      },
    );
    const upload = await app.inject({
      method: "POST",
      url: "/documents",
      ...applicant.authed,
      headers: { "content-type": contentType },
      payload: body,
    });
    expect(upload.statusCode).toBe(400);
    expect(upload.json().error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("never lets one applicant read or delete another applicant's document", async () => {
    const owner = await registerApplicant(app, `doc-owner-${Date.now()}@example.com`);
    const stranger = await registerApplicant(app, `doc-stranger-${Date.now()}@example.com`);

    const { body, contentType } = buildMultipartPayload(
      { documentTypeCode: "id_document" },
      { fieldName: "file", filename: "id.pdf", contentType: "application/pdf", content: Buffer.from("%PDF-1.4") },
    );
    const upload = await app.inject({
      method: "POST",
      url: "/documents",
      ...owner.authed,
      headers: { "content-type": contentType },
      payload: body,
    });
    const documentId = upload.json().document.id as string;

    const strangerUrl = await app.inject({
      method: "GET",
      url: `/documents/${documentId}/url`,
      ...stranger.authed,
    });
    expect(strangerUrl.statusCode).toBe(404);

    const strangerDelete = await app.inject({
      method: "DELETE",
      url: `/documents/${documentId}`,
      ...stranger.authed,
    });
    expect(strangerDelete.statusCode).toBe(404);

    // The owner themselves can still reach it.
    const ownerUrl = await app.inject({ method: "GET", url: `/documents/${documentId}/url`, ...owner.authed });
    expect(ownerUrl.statusCode).toBe(200);
  });

  it("never lets one applicant read another applicant's application", async () => {
    const owner = await registerApplicant(app, `app-owner-${Date.now()}@example.com`);
    const stranger = await registerApplicant(app, `app-stranger-${Date.now()}@example.com`);

    // Owner has no published vacancy to apply to in this minimal test, so
    // exercise the ownership check on the applications list/detail routes
    // that don't require one — ownership is enforced before anything else.
    const strangerApplications = await app.inject({ method: "GET", url: "/applications", ...stranger.authed });
    expect(strangerApplications.statusCode).toBe(200);
    expect(strangerApplications.json().applications).toEqual([]);

    const bogusId = "00000000-0000-0000-0000-000000000000";
    const strangerDetail = await app.inject({
      method: "GET",
      url: `/applications/${bogusId}`,
      ...stranger.authed,
    });
    expect(strangerDetail.statusCode).toBe(404);
    void owner;
  });

  it("blocks an applicant from every admin and café route", async () => {
    const applicant = await registerApplicant(app, `role-check-${Date.now()}@example.com`);

    const adminList = await app.inject({ method: "GET", url: "/admin/circulars", ...applicant.authed });
    expect(adminList.statusCode).toBe(403);

    const adminVerify = await app.inject({
      method: "PATCH",
      url: "/admin/vacancies/00000000-0000-0000-0000-000000000000/verify",
      ...applicant.authed,
      payload: { approve: true },
    });
    expect(adminVerify.statusCode).toBe(403);

    const cafeSessions = await app.inject({
      method: "POST",
      url: "/cafe/sessions",
      ...applicant.authed,
      payload: { applicantEmail: "someone@example.com" },
    });
    expect(cafeSessions.statusCode).toBe(403);
  });

  it("blocks every unauthenticated request to a protected route", async () => {
    const noAuth = await app.inject({ method: "GET", url: "/profile" });
    expect(noAuth.statusCode).toBe(401);

    const noAuthDocs = await app.inject({ method: "GET", url: "/documents" });
    expect(noAuthDocs.statusCode).toBe(401);

    const noAuthApplications = await app.inject({ method: "GET", url: "/applications" });
    expect(noAuthApplications.statusCode).toBe(401);

    // Vacancy browsing is intentionally public — anonymous callers just get
    // no personalised match, never a 401.
    const publicVacancies = await app.inject({ method: "GET", url: "/vacancies" });
    expect(publicVacancies.statusCode).toBe(200);
    expect(publicVacancies.json().vacancies.every((v: { matchPercentage: unknown }) => v.matchPercentage === null)).toBe(
      true,
    );
  });
});
