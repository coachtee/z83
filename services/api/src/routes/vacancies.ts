import type { FastifyInstance, FastifyRequest } from "fastify";
import { computeMatch } from "@z83/validation";
import { HttpError, tryAuthenticate } from "../auth.js";
import { resolveActingContext } from "../assisted-context.js";
import { getVacancyById, listPublishedVacancies, listRequirements } from "../repo/vacancies.js";
import { getFullProfileByUserId } from "../repo/profiles.js";

/**
 * Whose profile to match against for this vacancy view. Ordinary users
 * match against their own profile. Café staff only get a personalised
 * match while actively assisting — an open, authorized session named by
 * the same header the profile/document routes use — since this is
 * read-only and needed for the café flow's "find a matching vacancy"
 * step; an invalid or missing session just falls back to no personalised
 * match rather than failing the whole page.
 */
async function resolveMatchProfileUserId(request: FastifyRequest): Promise<string | null> {
  if (!request.authUser) return null;
  if (request.authUser.role !== "cafe_staff") return request.authUser.userId;
  if (!request.headers["x-assisted-session-id"]) return null;
  try {
    return (await resolveActingContext(request)).effectiveUserId;
  } catch {
    return null;
  }
}

export function registerVacancyRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { province?: string; departmentId?: string } }>(
    "/vacancies",
    { preHandler: tryAuthenticate },
    async (request, reply) => {
      const vacancies = await listPublishedVacancies({
        province: request.query.province,
        departmentId: request.query.departmentId,
      });

      const matchUserId = await resolveMatchProfileUserId(request);
      const profile = matchUserId ? await getFullProfileByUserId(matchUserId) : null;

      const withMatch = await Promise.all(
        vacancies.map(async (vacancy) => {
          if (!profile) return { ...vacancy, matchPercentage: null };
          const requirements = await listRequirements(vacancy.id);
          const match = computeMatch(profile, requirements);
          return { ...vacancy, matchPercentage: match.percentage };
        }),
      );

      return reply.send({ vacancies: withMatch });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/vacancies/:id",
    { preHandler: tryAuthenticate },
    async (request, reply) => {
      const vacancy = await getVacancyById(request.params.id);
      if (!vacancy || vacancy.status !== "published") {
        throw new HttpError(404, "NOT_FOUND", "Vacancy not found.");
      }
      const requirements = await listRequirements(vacancy.id);

      let match = null;
      const matchUserId = await resolveMatchProfileUserId(request);
      if (matchUserId) {
        const profile = await getFullProfileByUserId(matchUserId);
        if (profile) {
          match = computeMatch(profile, requirements);
        }
      }

      return reply.send({ vacancy, requirements, match });
    },
  );
}
