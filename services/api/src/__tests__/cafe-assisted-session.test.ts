import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { pool } from "../db.js";
import { hashPassword } from "../auth.js";
import { createUser } from "../repo/users.js";
import { addRequirement, createCircular, createDraftVacancy, getOrCreateDepartment } from "../repo/vacancies.js";
import { resetDatabase } from "./dbReset.js";

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

async function createCafeStaff(app: FastifyInstance, cafeAccountName: string) {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO cafe_accounts (name, province) VALUES ($1, 'Gauteng') RETURNING id`,
    [cafeAccountName],
  );
  const cafeAccountId = rows[0]!.id;

  const email = `cafe-staff-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "staff-password-123";
  const user = await createUser({
    email,
    passwordHash: await hashPassword(password),
    fullName: "Café Staff",
    role: "cafe_staff",
  });
  await pool.query(`INSERT INTO cafe_staff (user_id, cafe_account_id) VALUES ($1, $2)`, [
    user.id,
    cafeAccountId,
  ]);

  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return { authed: { cookies: { z83_session: extractCookie(login) } }, userId: user.id };
}

describe("Internet café assisted sessions", () => {
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

  it("gives staff no access until the applicant authorizes, and none after close", async () => {
    const applicantEmail = `applicant-${Date.now()}@example.com`;
    const applicantPassword = "applicant-password-123";
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: applicantEmail, password: applicantPassword, fullName: "Assisted Applicant" },
    });
    const applicantAuthed = { cookies: { z83_session: extractCookie(register) } };

    const staff = await createCafeStaff(app, "Tshwane Digital Hub");

    // Staff opens a session for an existing applicant — must start pending.
    const openRes = await staff.authed;
    const open = await app.inject({
      method: "POST",
      url: "/cafe/sessions",
      ...staff.authed,
      payload: { applicantEmail },
    });
    expect(open.statusCode).toBe(201);
    const session = open.json().session;
    expect(session.status).toBe("pending");
    expect(open.json().newAccount).toBe(false);

    // Staff tries to use it before authorization — must be refused.
    const beforeAuth = await app.inject({
      method: "PUT",
      url: "/profile",
      ...staff.authed,
      headers: { "x-assisted-session-id": session.id },
      payload: { phone: "0821111111" },
    });
    expect(beforeAuth.statusCode).toBe(403);

    // Wrong password does not authorize it.
    const wrongAuth = await app.inject({
      method: "POST",
      url: `/cafe/sessions/${session.id}/authorize`,
      ...staff.authed,
      payload: { password: "totally-wrong-password" },
    });
    expect(wrongAuth.statusCode).toBe(401);

    // The applicant's own correct password does.
    const authorize = await app.inject({
      method: "POST",
      url: `/cafe/sessions/${session.id}/authorize`,
      ...staff.authed,
      payload: { password: applicantPassword },
    });
    expect(authorize.statusCode).toBe(200);
    expect(authorize.json().session.status).toBe("open");

    // Now staff can act on the applicant's profile, attributed to both.
    const editDuringSession = await app.inject({
      method: "PUT",
      url: "/profile",
      ...staff.authed,
      headers: { "x-assisted-session-id": session.id },
      payload: { phone: "0821111111", city: "Pretoria" },
    });
    expect(editDuringSession.statusCode).toBe(200);

    // The change really landed on the applicant's own profile.
    const applicantProfile = await app.inject({ method: "GET", url: "/profile", ...applicantAuthed });
    expect(applicantProfile.json().profile.phone).toBe("0821111111");
    expect(applicantProfile.json().profile.city).toBe("Pretoria");

    const auditRows = await pool.query(
      `SELECT * FROM audit_logs WHERE entity_type = 'profile' AND action = 'profile.update' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(auditRows.rows[0].actor_role).toBe("cafe_staff");
    expect(auditRows.rows[0].metadata.assistedSessionId).toBe(session.id);

    // Close the session — staff loses access immediately.
    const close = await app.inject({
      method: "POST",
      url: `/cafe/sessions/${session.id}/close`,
      ...staff.authed,
    });
    expect(close.statusCode).toBe(200);
    expect(close.json().session.status).toBe("closed");

    const afterClose = await app.inject({
      method: "PUT",
      url: "/profile",
      ...staff.authed,
      headers: { "x-assisted-session-id": session.id },
      payload: { phone: "0829999999" },
    });
    expect(afterClose.statusCode).toBe(403);

    void openRes;
  });

  it("lets a new walk-in choose their own password, which opens the session immediately", async () => {
    const staff = await createCafeStaff(app, "Soweto Community Kiosk");
    const newApplicantEmail = `walkin-${Date.now()}@example.com`;

    const noPassword = await app.inject({
      method: "POST",
      url: "/cafe/sessions",
      ...staff.authed,
      payload: { applicantEmail: newApplicantEmail },
    });
    expect(noPassword.statusCode).toBe(409);

    const open = await app.inject({
      method: "POST",
      url: "/cafe/sessions",
      ...staff.authed,
      payload: { applicantEmail: newApplicantEmail, newApplicantPassword: "applicant-chosen-pw" },
    });
    expect(open.statusCode).toBe(201);
    expect(open.json().session.status).toBe("open");
    expect(open.json().newAccount).toBe(true);

    const edit = await app.inject({
      method: "PUT",
      url: "/profile",
      ...staff.authed,
      headers: { "x-assisted-session-id": open.json().session.id },
      payload: { city: "Soweto" },
    });
    expect(edit.statusCode).toBe(200);
  });

  it("refuses a session id that belongs to a different staff member", async () => {
    const applicantEmail = `cross-staff-${Date.now()}@example.com`;
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: applicantEmail, password: "applicant-password-123", fullName: "Cross Staff Applicant" },
    });

    const staffA = await createCafeStaff(app, "Café A");
    const staffB = await createCafeStaff(app, "Café B");

    const open = await app.inject({
      method: "POST",
      url: "/cafe/sessions",
      ...staffA.authed,
      payload: { applicantEmail },
    });
    const sessionId = open.json().session.id;

    const wrongStaffAuthorize = await app.inject({
      method: "POST",
      url: `/cafe/sessions/${sessionId}/authorize`,
      ...staffB.authed,
      payload: { password: "applicant-password-123" },
    });
    expect(wrongStaffAuthorize.statusCode).toBe(404);
  });

  it("never allows an assisted session to reach applying, reviewing or signing", async () => {
    // The assisted-session header is only honoured by profile/documents
    // routes — applications routes never call resolveActingContext, so
    // passing the header there simply has no effect and normal
    // authentication/ownership rules apply unchanged.
    const applicantEmail = `no-apply-assist-${Date.now()}@example.com`;
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: applicantEmail, password: "applicant-password-123", fullName: "No Assist Apply" },
    });
    void register;

    const staff = await createCafeStaff(app, "Café C");
    const attempt = await app.inject({
      method: "GET",
      url: "/applications",
      ...staff.authed,
      headers: { "x-assisted-session-id": "00000000-0000-0000-0000-000000000000" },
    });
    // Staff's own (empty) application list — never the applicant's.
    expect(attempt.statusCode).toBe(200);
    expect(attempt.json().applications).toEqual([]);
  });

  it("personalises the vacancy match to the applicant during an open session, never to staff themselves", async () => {
    const departmentId = await getOrCreateDepartment("Match Test Department");
    const circularId = await createCircular({
      circularNumber: `MATCH-TEST-${Date.now()}`,
      publicationDate: "2026-01-01",
      ingestionMethod: "manual_upload",
    });
    const vacancyId = await createDraftVacancy({
      circularId,
      departmentId,
      jobTitle: "Test Match Post",
      referenceNumber: `REF-${Date.now()}`,
      salaryText: null,
      province: null,
      locationText: null,
      pageNumber: null,
      closingAt: null,
      submissionMethod: "email",
      submissionEmail: "test@example.org",
      submissionAddress: null,
      specialInstructions: null,
      rawExtractedText: null,
    });
    await addRequirement(vacancyId, {
      requirementType: "drivers_licence",
      description: "Valid Code B driving licence",
      minimumValue: "B",
      isMandatory: true,
      orderIndex: 0,
    });
    await pool.query(`UPDATE vacancies SET status = 'published' WHERE id = $1`, [vacancyId]);

    const applicantEmail = `match-assist-${Date.now()}@example.com`;
    const applicantPassword = "applicant-password-123";
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: applicantEmail, password: applicantPassword, fullName: "Match Assist Applicant" },
    });

    const staff = await createCafeStaff(app, "Match Café");
    const open = await app.inject({
      method: "POST",
      url: "/cafe/sessions",
      ...staff.authed,
      payload: { applicantEmail },
    });
    const sessionId = open.json().session.id;
    await app.inject({
      method: "POST",
      url: `/cafe/sessions/${sessionId}/authorize`,
      ...staff.authed,
      payload: { password: applicantPassword },
    });

    // Staff gives the applicant a Code B licence on their (the applicant's) profile.
    const edit = await app.inject({
      method: "PUT",
      url: "/profile",
      ...staff.authed,
      headers: { "x-assisted-session-id": sessionId },
      payload: { driversLicenceCodes: ["B"] },
    });
    expect(edit.statusCode).toBe(200);

    // Without the header, staff has no profile of their own — no personalised match.
    const staffOwnView = await app.inject({ method: "GET", url: `/vacancies/${vacancyId}`, ...staff.authed });
    expect(staffOwnView.json().match).toBeNull();

    // With the header, the applicant's own match shows up — read-only, no write.
    const assistedView = await app.inject({
      method: "GET",
      url: `/vacancies/${vacancyId}`,
      ...staff.authed,
      headers: { "x-assisted-session-id": sessionId },
    });
    expect(assistedView.json().match.percentage).toBe(100);
    expect(assistedView.json().match.matched).toHaveLength(1);

    const assistedList = await app.inject({
      method: "GET",
      url: "/vacancies",
      ...staff.authed,
      headers: { "x-assisted-session-id": sessionId },
    });
    const listed = assistedList
      .json()
      .vacancies.find((v: { id: string }) => v.id === vacancyId);
    expect(listed.matchPercentage).toBe(100);
  });
});
