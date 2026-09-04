import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { pool } from "../db.js";
import { hashPassword } from "../auth.js";
import { createUser } from "../repo/users.js";
import { createAdminUser } from "../repo/admin.js";
import {
  addRequirement,
  createCircular,
  createDraftVacancy,
  getOrCreateDepartment,
  verifyVacancy,
} from "../repo/vacancies.js";
import { resetDatabase } from "./dbReset.js";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function extractCookie(response: { cookies: { name: string; value: string }[] }): string {
  const cookie = response.cookies.find((c) => c.name === "z83_session");
  if (!cookie) throw new Error("Session cookie was not set.");
  return cookie.value;
}

async function publishVacancy(): Promise<string> {
  const departmentId = await getOrCreateDepartment("Lifecycle Test Department");
  const circularId = await createCircular({
    circularNumber: `LIFECYCLE-${Date.now()}-${Math.random()}`,
    publicationDate: "2026-01-01",
    ingestionMethod: "manual_upload",
  });
  const vacancyId = await createDraftVacancy({
    circularId,
    departmentId,
    jobTitle: "Lifecycle Test Post",
    referenceNumber: `LC/${Date.now()}`,
    salaryText: null,
    province: null,
    locationText: null,
    pageNumber: null,
    closingAt: null,
    submissionMethod: "email",
    submissionEmail: "lifecycle@example.org",
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
  const adminUser = await createUser({
    email: `lifecycle-admin-${Date.now()}@example.com`,
    passwordHash: await hashPassword("admin-password"),
    fullName: "Lifecycle Admin",
    role: "admin",
  });
  const adminRow = await createAdminUser(adminUser.id, "superadmin");
  await verifyVacancy(vacancyId, adminRow.id, true);
  return vacancyId;
}

describe("Application snapshot integrity and signature gating", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await resetDatabase();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("freezes the snapshot at apply time — later profile edits never change it", async () => {
    const email = `snapshot-${Date.now()}@example.com`;
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "correct horse battery staple", fullName: "Snapshot Test" },
    });
    const authed = { cookies: { z83_session: extractCookie(register) } };

    await app.inject({
      method: "PUT",
      url: "/profile",
      ...authed,
      payload: { city: "Pretoria", phone: "0821111111" },
    });

    const vacancyId = await publishVacancy();
    const apply = await app.inject({
      method: "POST",
      url: "/applications",
      ...authed,
      payload: { vacancyId },
    });
    const applicationId = apply.json().application.id as string;

    const beforeEdit = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    expect(beforeEdit.json().snapshot.snapshotData.profile.city).toBe("Pretoria");

    // Edit the live profile after applying.
    await app.inject({
      method: "PUT",
      url: "/profile",
      ...authed,
      payload: { city: "Cape Town", phone: "0822222222" },
    });

    // The live profile changed...
    const liveProfile = await app.inject({ method: "GET", url: "/profile", ...authed });
    expect(liveProfile.json().profile.city).toBe("Cape Town");

    // ...but the application's own snapshot did not.
    const afterEdit = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    expect(afterEdit.json().snapshot.snapshotData.profile.city).toBe("Pretoria");
    expect(afterEdit.json().snapshot.snapshotData.profile.phone).toBe("0821111111");
  });

  it("keeps a profile_versions history entry for every edit", async () => {
    const email = `profile-version-${Date.now()}@example.com`;
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "correct horse battery staple", fullName: "Version Test" },
    });
    const authed = { cookies: { z83_session: extractCookie(register) } };
    const userId = register.json().user.id as string;

    await app.inject({ method: "PUT", url: "/profile", ...authed, payload: { city: "Durban" } });
    await app.inject({ method: "PUT", url: "/profile", ...authed, payload: { city: "Bloemfontein" } });

    const { rows } = await pool.query(
      `SELECT pv.data FROM profile_versions pv
       JOIN profiles p ON p.id = pv.profile_id
       WHERE p.user_id = $1 ORDER BY pv.created_at`,
      [userId],
    );
    expect(rows.length).toBe(2);
    expect(rows[0].data.profile.city).toBe("Durban");
    expect(rows[1].data.profile.city).toBe("Bloemfontein");
  });

  it("refuses to sign an application that hasn't passed review yet", async () => {
    const email = `sign-gate-${Date.now()}@example.com`;
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "correct horse battery staple", fullName: "Sign Gate Test" },
    });
    const authed = { cookies: { z83_session: extractCookie(register) } };

    const vacancyId = await publishVacancy();
    const apply = await app.inject({
      method: "POST",
      url: "/applications",
      ...authed,
      payload: { vacancyId },
    });
    const applicationId = apply.json().application.id as string;

    // Straight to /sign from draft — never reviewed.
    const signAttempt = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/sign`,
      ...authed,
      payload: { imageBase64: `data:image/png;base64,${TINY_PNG_BASE64}` },
    });
    expect(signAttempt.statusCode).toBe(409);
    expect(signAttempt.json().error.code).toBe("REVIEW_REQUIRED");

    // Even after running review, an incomplete profile (no references,
    // qualifications or documents here) must fail review and still block
    // signing.
    const review = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/review`,
      ...authed,
    });
    expect(review.json().complete).toBe(false);

    const signAfterFailedReview = await app.inject({
      method: "POST",
      url: `/applications/${applicationId}/sign`,
      ...authed,
      payload: { imageBase64: `data:image/png;base64,${TINY_PNG_BASE64}` },
    });
    expect(signAfterFailedReview.statusCode).toBe(409);

    const detail = await app.inject({ method: "GET", url: `/applications/${applicationId}`, ...authed });
    expect(detail.json().application.status).toBe("draft");
  });
});
