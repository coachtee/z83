import type { FastifyInstance } from "fastify";
import { computeMatch } from "@z83/validation";
import { HttpError, tryAuthenticate } from "../auth.js";
import { getVacancyById, listPublishedVacancies, listRequirements } from "../repo/vacancies.js";
import { getFullProfileByUserId } from "../repo/profiles.js";

export function registerVacancyRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { province?: string; departmentId?: string } }>(
    "/vacancies",
    { preHandler: tryAuthenticate },
    async (request, reply) => {
      const vacancies = await listPublishedVacancies({
        province: request.query.province,
        departmentId: request.query.departmentId,
      });

      const profile = request.authUser
        ? await getFullProfileByUserId(request.authUser.userId)
        : null;

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
      if (request.authUser) {
        const profile = await getFullProfileByUserId(request.authUser.userId);
        if (profile) {
          match = computeMatch(profile, requirements);
        }
      }

      return reply.send({ vacancy, requirements, match });
    },
  );
}
