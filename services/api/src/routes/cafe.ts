import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError, authenticate, hashPassword, requireRole } from "../auth.js";
import { closeAssistedSession, getCafeStaffByUserId, getSessionById, openAssistedSession } from "../repo/cafe.js";
import { createEmptyProfile } from "../repo/profiles.js";
import { createUser, findUserByEmail } from "../repo/users.js";
import { randomBytes } from "node:crypto";

const openSessionSchema = z.object({
  applicantEmail: z.string().trim().toLowerCase().email(),
  openedReason: z.string().trim().optional(),
});

export function registerCafeRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("cafe_staff"));

  app.post("/cafe/sessions", async (request, reply) => {
    const parsed = openSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "A valid applicant email is required.", parsed.error.flatten());
    }
    const cafeStaff = await getCafeStaffByUserId(request.authUser!.userId);
    if (!cafeStaff) throw new HttpError(403, "FORBIDDEN", "This account isn't linked to a café.");

    let applicant = await findUserByEmail(parsed.data.applicantEmail);
    if (!applicant) {
      // A walk-in with no account yet — café staff can start one, but the
      // applicant owns it from creation: a random password is set that
      // only the applicant can reset later (out of scope for this slice),
      // never handed back to staff.
      const randomPassword = randomBytes(24).toString("hex");
      const passwordHash = await hashPassword(randomPassword);
      const created = await createUser({
        email: parsed.data.applicantEmail,
        passwordHash,
        fullName: "New applicant",
        role: "applicant",
      });
      await createEmptyProfile(created.id);
      applicant = { ...created, passwordHash: "" };
    }

    const session = await openAssistedSession({
      cafeStaffId: cafeStaff.id,
      applicantUserId: applicant.id,
      openedReason: parsed.data.openedReason,
    });
    return reply.code(201).send({ session });
  });

  app.post<{ Params: { id: string } }>("/cafe/sessions/:id/close", async (request, reply) => {
    const session = await getSessionById(request.params.id);
    const cafeStaff = await getCafeStaffByUserId(request.authUser!.userId);
    if (!session || !cafeStaff || session.cafeStaffId !== cafeStaff.id) {
      throw new HttpError(404, "NOT_FOUND", "Session not found.");
    }
    const closed = await closeAssistedSession(session.id);
    return reply.send({ session: closed });
  });

  app.get<{ Params: { id: string } }>("/cafe/sessions/:id", async (request, reply) => {
    const session = await getSessionById(request.params.id);
    const cafeStaff = await getCafeStaffByUserId(request.authUser!.userId);
    if (!session || !cafeStaff || session.cafeStaffId !== cafeStaff.id || session.status !== "open") {
      throw new HttpError(404, "NOT_FOUND", "Session not found or no longer open.");
    }
    return reply.send({ session });
  });
}
