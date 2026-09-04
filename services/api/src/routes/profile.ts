import type { FastifyInstance } from "fastify";
import {
  languageSchema,
  profileUpdateSchema,
  qualificationSchema,
  referenceSchema,
  workExperienceSchema,
} from "@z83/validation";
import { checkApplicationReadiness } from "@z83/validation";
import { HttpError, authenticate } from "../auth.js";
import {
  addLanguage,
  addQualification,
  addReference,
  addWorkExperience,
  deleteQualification,
  getFullProfileByUserId,
  updateProfile,
} from "../repo/profiles.js";
import { listDocumentsForUser } from "../repo/documents.js";

export function registerProfileRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", authenticate);

  app.get("/profile", async (request, reply) => {
    const full = await getFullProfileByUserId(request.authUser!.userId);
    if (!full) throw new HttpError(404, "NOT_FOUND", "Profile not found.");
    return reply.send(full);
  });

  app.put("/profile", async (request, reply) => {
    const parsed = profileUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid profile fields.", parsed.error.flatten());
    }
    const profile = await updateProfile(request.authUser!.userId, parsed.data);
    return reply.send({ profile });
  });

  app.get("/profile/completeness", async (request, reply) => {
    const full = await getFullProfileByUserId(request.authUser!.userId);
    if (!full) throw new HttpError(404, "NOT_FOUND", "Profile not found.");
    const documents = await listDocumentsForUser(request.authUser!.userId);
    // No specific vacancy in context here, so submission-instruction and
    // reference-number checks are evaluated against a permissive stand-in —
    // they're only meaningful once tied to a real vacancy at review time.
    const report = checkApplicationReadiness(
      {
        profile: full.profile,
        qualifications: full.qualifications,
        workExperience: full.workExperience,
        languages: full.languages,
        references: full.references,
        documents: documents.map((d) => ({
          id: d.id,
          documentTypeCode: d.documentTypeCode,
          originalFilename: d.originalFilename,
        })),
        capturedAt: new Date().toISOString(),
      },
      {
        referenceNumber: "N/A",
        jobTitle: "N/A",
        submissionMethod: "either",
        submissionEmail: "placeholder@example.org",
        submissionAddress: null,
      },
    );
    return reply.send(report);
  });

  app.post("/profile/qualifications", async (request, reply) => {
    const parsed = qualificationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid qualification.", parsed.error.flatten());
    }
    const full = await getFullProfileByUserId(request.authUser!.userId);
    if (!full) throw new HttpError(404, "NOT_FOUND", "Profile not found.");
    const qualification = await addQualification(full.profile.id, parsed.data);
    return reply.code(201).send({ qualification });
  });

  app.delete<{ Params: { id: string } }>("/profile/qualifications/:id", async (request, reply) => {
    const full = await getFullProfileByUserId(request.authUser!.userId);
    if (!full) throw new HttpError(404, "NOT_FOUND", "Profile not found.");
    await deleteQualification(full.profile.id, request.params.id);
    return reply.code(204).send();
  });

  app.post("/profile/work-experience", async (request, reply) => {
    const parsed = workExperienceSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid work experience.", parsed.error.flatten());
    }
    const full = await getFullProfileByUserId(request.authUser!.userId);
    if (!full) throw new HttpError(404, "NOT_FOUND", "Profile not found.");
    const experience = await addWorkExperience(full.profile.id, parsed.data);
    return reply.code(201).send({ experience });
  });

  app.post("/profile/languages", async (request, reply) => {
    const parsed = languageSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid language entry.", parsed.error.flatten());
    }
    const full = await getFullProfileByUserId(request.authUser!.userId);
    if (!full) throw new HttpError(404, "NOT_FOUND", "Profile not found.");
    const language = await addLanguage(full.profile.id, parsed.data);
    return reply.code(201).send({ language });
  });

  app.post("/profile/references", async (request, reply) => {
    const parsed = referenceSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid reference.", parsed.error.flatten());
    }
    const full = await getFullProfileByUserId(request.authUser!.userId);
    if (!full) throw new HttpError(404, "NOT_FOUND", "Profile not found.");
    const reference = await addReference(full.profile.id, parsed.data);
    return reply.code(201).send({ reference });
  });
}
