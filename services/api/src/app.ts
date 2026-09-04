import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { config } from "./config.js";
import { HttpError } from "./auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerVacancyRoutes } from "./routes/vacancies.js";
import { registerApplicationRoutes } from "./routes/applications.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerCafeRoutes } from "./routes/cafe.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(fastifyCors, { origin: config.webOrigin, credentials: true });
  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { attachFieldsToBody: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request.", details: error.flatten() },
      });
    }
    console.error(error);
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side." },
    });
  });

  app.get("/health", async () => ({ status: "ok" }));

  registerAuthRoutes(app);
  registerDocumentRoutes(app);
  registerVacancyRoutes(app);

  // These route groups add a blanket preHandler hook (e.g. authenticate,
  // requireRole) via addHook. Each needs its own encapsulation context
  // (app.register) so that hook only ever applies to routes declared
  // inside it — added straight to the root `app` instance, a hook applies
  // fleet-wide regardless of call order, which would leak auth
  // requirements onto unrelated routes like /auth/register.
  await app.register(async (scoped) => registerProfileRoutes(scoped));
  await app.register(async (scoped) => registerApplicationRoutes(scoped));
  await app.register(async (scoped) => registerAdminRoutes(scoped));
  await app.register(async (scoped) => registerCafeRoutes(scoped));

  return app;
}
