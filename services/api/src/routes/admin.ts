import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { processCircularPdf } from "@z83/circular-engine";
import { HttpError, authenticate, requireRole } from "../auth.js";
import { getAdminUserByUserId } from "../repo/admin.js";
import {
  addRequirement,
  createCircular,
  createDraftVacancy,
  getCircularById,
  getOrCreateDepartment,
  listCirculars,
  listPendingVacancies,
  listVacanciesByCircular,
  verifyVacancy,
} from "../repo/vacancies.js";
import { getStorageProvider } from "../storage.js";

const uploadMetaSchema = z.object({
  circularNumber: z.string().trim().min(1),
  publicationDate: z.string().date(),
});

const verifySchema = z.object({
  approve: z.boolean(),
});

export function registerAdminRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("admin"));

  app.post("/admin/circulars/upload", async (request, reply) => {
    const adminUser = await getAdminUserByUserId(request.authUser!.userId);
    if (!adminUser) throw new HttpError(403, "FORBIDDEN", "This account isn't registered as an admin.");

    const file = await request.file();
    if (!file) throw new HttpError(400, "NO_FILE", "No circular PDF was uploaded.");

    const meta = uploadMetaSchema.safeParse({
      circularNumber: (file.fields.circularNumber as { value: string } | undefined)?.value,
      publicationDate: (file.fields.publicationDate as { value: string } | undefined)?.value,
    });
    if (!meta.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "circularNumber and publicationDate are required.", meta.error.flatten());
    }

    const pdfBytes = await file.toBuffer();
    const sourceKey = `circulars/${randomUUID()}-${file.filename}`;
    await getStorageProvider().put(sourceKey, pdfBytes, "application/pdf");

    const { vacancies } = await processCircularPdf(pdfBytes);

    const circularId = await createCircular({
      circularNumber: meta.data.circularNumber,
      publicationDate: meta.data.publicationDate,
      ingestionMethod: "manual_upload",
      sourceDocumentKey: sourceKey,
      uploadedByAdminId: adminUser.id,
    });

    let createdCount = 0;
    for (const draft of vacancies) {
      if (!draft.jobTitle || !draft.referenceNumber) {
        // Couldn't confidently extract the two fields every vacancy needs
        // to be reviewable — skip creating a row for it rather than
        // guessing; the raw text stays on the circular's source PDF for an
        // admin to handle by hand if needed.
        continue;
      }
      const departmentId = await getOrCreateDepartment(draft.departmentName);
      const vacancyId = await createDraftVacancy({
        circularId,
        departmentId,
        jobTitle: draft.jobTitle,
        referenceNumber: draft.referenceNumber,
        salaryText: draft.salaryText,
        province: draft.province,
        locationText: draft.locationText,
        pageNumber: draft.pageNumber,
        closingAt: draft.closingAt,
        submissionMethod: draft.submissionMethod,
        submissionEmail: draft.submissionEmail,
        submissionAddress: draft.submissionAddress,
        specialInstructions: draft.specialInstructions,
        rawExtractedText: draft.rawExtractedText,
      });
      for (let i = 0; i < draft.requirements.length; i++) {
        const req = draft.requirements[i]!;
        await addRequirement(vacancyId, {
          requirementType: req.requirementType,
          description: req.description,
          minimumValue: req.minimumValue,
          isMandatory: req.isMandatory,
          orderIndex: i,
        });
      }
      createdCount += 1;
    }

    return reply.code(201).send({
      circularId,
      extractedVacancyCount: vacancies.length,
      draftVacancyCount: createdCount,
    });
  });

  app.get("/admin/circulars", async (_request, reply) => {
    const circulars = await listCirculars();
    return reply.send({ circulars });
  });

  app.get<{ Params: { id: string } }>("/admin/circulars/:id", async (request, reply) => {
    const circular = await getCircularById(request.params.id);
    if (!circular) throw new HttpError(404, "NOT_FOUND", "Circular not found.");
    const vacancies = await listVacanciesByCircular(circular.id);
    return reply.send({ circular, vacancies });
  });

  app.get("/admin/vacancies/pending", async (_request, reply) => {
    const vacancies = await listPendingVacancies();
    return reply.send({ vacancies });
  });

  app.patch<{ Params: { id: string } }>("/admin/vacancies/:id/verify", async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "approve (boolean) is required.", parsed.error.flatten());
    }
    const adminUser = await getAdminUserByUserId(request.authUser!.userId);
    if (!adminUser) throw new HttpError(403, "FORBIDDEN", "This account isn't registered as an admin.");
    const vacancy = await verifyVacancy(request.params.id, adminUser.id, parsed.data.approve);
    if (!vacancy) throw new HttpError(404, "NOT_FOUND", "Vacancy not found.");
    return reply.send({ vacancy });
  });
}
