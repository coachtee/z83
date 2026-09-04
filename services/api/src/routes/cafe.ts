import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError, authenticate, hashPassword, requireRole, verifyPassword } from "../auth.js";
import {
  authorizeAssistedSession,
  closeAssistedSession,
  getCafeStaffByUserId,
  getSessionById,
  openAssistedSession,
} from "../repo/cafe.js";
import { recordAuditLog } from "../repo/auditLogs.js";
import { createEmptyProfile } from "../repo/profiles.js";
import { createUser, findUserByEmail, findUserByIdWithPasswordHash } from "../repo/users.js";

const findApplicantSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const openSessionSchema = z.object({
  applicantEmail: z.string().trim().toLowerCase().email(),
  /** Required only when this email has no account yet — the applicant
   * chooses it themselves, right there, which is what makes creating the
   * account itself the moment of consent (see the design note below). */
  newApplicantPassword: z.string().min(8).optional(),
  /** Applicant's own name, given when creating a brand-new account. */
  applicantFullName: z.string().trim().min(1).optional(),
  openedReason: z.string().trim().optional(),
});

const authorizeSessionSchema = z.object({
  password: z.string().min(1),
});

export function registerCafeRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("cafe_staff"));

  // Lets staff check whether someone already has a profile before deciding
  // whether to collect a new password (new account) or ask them to
  // authorize with their existing one.
  app.get<{ Querystring: { email: string } }>("/cafe/applicants", async (request, reply) => {
    const parsed = findApplicantSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "A valid email is required.", parsed.error.flatten());
    }
    const existing = await findUserByEmail(parsed.data.email);
    return reply.send({ exists: Boolean(existing && existing.role === "applicant") });
  });

  app.post("/cafe/sessions", async (request, reply) => {
    const parsed = openSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "A valid applicant email is required.", parsed.error.flatten());
    }
    const cafeStaff = await getCafeStaffByUserId(request.authUser!.userId);
    if (!cafeStaff) throw new HttpError(403, "FORBIDDEN", "This account isn't linked to a café.");

    const applicant = await findUserByEmail(parsed.data.applicantEmail);

    if (!applicant) {
      // A genuine walk-in with no account: the applicant sets their own
      // password right here, at the keyboard, in front of staff. That act
      // of choosing it *is* their consent, so this session can start
      // authorized — there's no pre-existing account to protect.
      if (!parsed.data.newApplicantPassword) {
        throw new HttpError(
          409,
          "NEW_APPLICANT_NEEDS_PASSWORD",
          "No account exists for this email yet. Have the applicant choose their own password to create one.",
        );
      }
      const passwordHash = await hashPassword(parsed.data.newApplicantPassword);
      const created = await createUser({
        email: parsed.data.applicantEmail,
        passwordHash,
        fullName: parsed.data.applicantFullName ?? "New applicant",
        role: "applicant",
      });
      await createEmptyProfile(created.id);

      const session = await openAssistedSession({
        cafeStaffId: cafeStaff.id,
        applicantUserId: created.id,
        openedReason: parsed.data.openedReason,
      });
      const authorized = await authorizeAssistedSession(session.id);
      await recordAuditLog({
        actorUserId: request.authUser!.userId,
        actorRole: "cafe_staff",
        action: "assisted_session.open_new_applicant",
        entityType: "assisted_session",
        entityId: session.id,
        metadata: { applicantUserId: created.id },
      });
      return reply.code(201).send({ session: authorized, newAccount: true });
    }

    if (applicant.role !== "applicant") {
      throw new HttpError(403, "FORBIDDEN", "This account can't be assisted.");
    }

    const session = await openAssistedSession({
      cafeStaffId: cafeStaff.id,
      applicantUserId: applicant.id,
      openedReason: parsed.data.openedReason,
    });
    await recordAuditLog({
      actorUserId: request.authUser!.userId,
      actorRole: "cafe_staff",
      action: "assisted_session.open",
      entityType: "assisted_session",
      entityId: session.id,
      metadata: { applicantUserId: applicant.id },
    });
    // Pending — staff has no access to this applicant's data yet. The
    // applicant must authorize it themselves next.
    return reply.code(201).send({ session, newAccount: false });
  });

  // The applicant's own action — their password, typed by them, on the
  // shared device — is what turns "staff requested a session" into "staff
  // may actually act on my profile." Nothing else does.
  app.post<{ Params: { id: string } }>("/cafe/sessions/:id/authorize", async (request, reply) => {
    const parsed = authorizeSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "A password is required.", parsed.error.flatten());
    }
    const session = await getSessionById(request.params.id);
    const cafeStaff = await getCafeStaffByUserId(request.authUser!.userId);
    if (!session || !cafeStaff || session.cafeStaffId !== cafeStaff.id || session.status !== "pending") {
      throw new HttpError(404, "NOT_FOUND", "Session not found or not awaiting authorization.");
    }
    const applicantWithHash = await findUserByIdWithPasswordHash(session.applicantUserId);
    if (!applicantWithHash || !(await verifyPassword(parsed.data.password, applicantWithHash.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "That password doesn't match this applicant's account.");
    }
    const authorized = await authorizeAssistedSession(session.id);
    await recordAuditLog({
      actorUserId: session.applicantUserId,
      actorRole: "applicant",
      action: "assisted_session.authorize",
      entityType: "assisted_session",
      entityId: session.id,
      metadata: { cafeStaffUserId: request.authUser!.userId },
    });
    return reply.send({ session: authorized });
  });

  app.post<{ Params: { id: string } }>("/cafe/sessions/:id/close", async (request, reply) => {
    const session = await getSessionById(request.params.id);
    const cafeStaff = await getCafeStaffByUserId(request.authUser!.userId);
    if (!session || !cafeStaff || session.cafeStaffId !== cafeStaff.id) {
      throw new HttpError(404, "NOT_FOUND", "Session not found.");
    }
    const closed = await closeAssistedSession(session.id);
    await recordAuditLog({
      actorUserId: request.authUser!.userId,
      actorRole: "cafe_staff",
      action: "assisted_session.close",
      entityType: "assisted_session",
      entityId: session.id,
    });
    return reply.send({ session: closed });
  });

  app.get<{ Params: { id: string } }>("/cafe/sessions/:id", async (request, reply) => {
    const session = await getSessionById(request.params.id);
    const cafeStaff = await getCafeStaffByUserId(request.authUser!.userId);
    if (!session || !cafeStaff || session.cafeStaffId !== cafeStaff.id || session.status === "closed") {
      throw new HttpError(404, "NOT_FOUND", "Session not found or already closed.");
    }
    return reply.send({ session });
  });
}
