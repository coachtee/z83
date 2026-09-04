import type { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@z83/validation";
import { HttpError, authenticate, hashPassword, setSessionCookie, signSession, verifyPassword, clearSessionCookie } from "../auth.js";
import { createUser, findUserByEmail, findUserById } from "../repo/users.js";
import { createEmptyProfile } from "../repo/profiles.js";

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid registration details.", parsed.error.flatten());
    }
    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists.");
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createUser({
      email: parsed.data.email,
      passwordHash,
      fullName: parsed.data.fullName,
      role: "applicant",
    });
    await createEmptyProfile(user.id);

    const token = signSession({ userId: user.id, role: user.role });
    setSessionCookie(reply, token);
    return reply.code(201).send({ user });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid login details.", parsed.error.flatten());
    }
    const user = await findUserByEmail(parsed.data.email);
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
    }
    const token = signSession({ userId: user.id, role: user.role });
    setSessionCookie(reply, token);
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return reply.send({ user: publicUser });
  });

  app.post("/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.authUser!.userId);
    if (!user) throw new HttpError(404, "NOT_FOUND", "User not found.");
    return reply.send({ user });
  });
}
