import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  createApplicationSchema,
  signApplicationSchema,
  updateApplicationStatusSchema,
  checkApplicationReadiness,
  computeMatch,
} from "@z83/validation";
import type { Application, EmailPackage } from "@z83/types";
import { HttpError, authenticate } from "../auth.js";
import {
  addApplicationEvent,
  addGeneratedApplicationDocument,
  addSignature,
  createApplicationWithSnapshot,
  findOpenApplication,
  getApplicationById,
  getLatestSignature,
  getSnapshot,
  listApplicationDocuments,
  listApplicationEvents,
  listApplicationsForUser,
  updateApplicationStatus,
} from "../repo/applications.js";
import { getVacancyById, listRequirements } from "../repo/vacancies.js";
import { findUserById } from "../repo/users.js";
import { getDocumentById } from "../repo/documents.js";
import { generateApplicationPdf } from "../pdf.js";
import { getStorageProvider } from "../storage.js";

async function loadOwnedApplication(applicationId: string, userId: string): Promise<Application> {
  const application = await getApplicationById(applicationId);
  if (!application || application.userId !== userId) {
    throw new HttpError(404, "NOT_FOUND", "Application not found.");
  }
  return application;
}

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["closed"],
  reviewed: ["closed"],
  signed: ["closed"],
  email_prepared: ["submitted", "closed"],
  print_prepared: ["submitted", "closed"],
  submitted: ["closed"],
};

export function registerApplicationRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", authenticate);

  app.post("/applications", async (request, reply) => {
    const parsed = createApplicationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "vacancyId is required.", parsed.error.flatten());
    }
    const vacancy = await getVacancyById(parsed.data.vacancyId);
    if (!vacancy || vacancy.status !== "published") {
      throw new HttpError(404, "NOT_FOUND", "Vacancy not found.");
    }
    const existing = await findOpenApplication(request.authUser!.userId, vacancy.id);
    if (existing) {
      throw new HttpError(
        409,
        "APPLICATION_ALREADY_OPEN",
        "You already have an open application for this vacancy — one Z83 per position.",
      );
    }
    const application = await createApplicationWithSnapshot(request.authUser!.userId, vacancy.id);
    return reply.code(201).send({ application });
  });

  app.get("/applications", async (request, reply) => {
    const applications = await listApplicationsForUser(request.authUser!.userId);
    return reply.send({ applications });
  });

  app.get<{ Params: { id: string } }>("/applications/:id", async (request, reply) => {
    const application = await loadOwnedApplication(request.params.id, request.authUser!.userId);
    const [snapshot, vacancy, documents] = await Promise.all([
      getSnapshot(application.id),
      getVacancyById(application.vacancyId),
      listApplicationDocuments(application.id),
    ]);
    let match = null;
    if (snapshot && vacancy) {
      const requirements = await listRequirements(vacancy.id);
      match = computeMatch(snapshot.snapshotData, requirements);
    }
    return reply.send({ application, snapshot, vacancy, documents, match });
  });

  app.get<{ Params: { id: string } }>("/applications/:id/events", async (request, reply) => {
    await loadOwnedApplication(request.params.id, request.authUser!.userId);
    const events = await listApplicationEvents(request.params.id);
    return reply.send({ events });
  });

  app.post<{ Params: { id: string } }>("/applications/:id/review", async (request, reply) => {
    const application = await loadOwnedApplication(request.params.id, request.authUser!.userId);
    if (application.status === "closed") {
      throw new HttpError(409, "APPLICATION_CLOSED", "This application is closed.");
    }
    const [snapshot, vacancy] = await Promise.all([
      getSnapshot(application.id),
      getVacancyById(application.vacancyId),
    ]);
    if (!snapshot || !vacancy) throw new HttpError(500, "INTERNAL", "Application is missing its snapshot or vacancy.");

    const report = checkApplicationReadiness(snapshot.snapshotData, vacancy);

    if (report.complete && application.status === "draft") {
      await updateApplicationStatus(application.id, "reviewed");
      await addApplicationEvent({
        applicationId: application.id,
        eventType: "reviewed",
        actorUserId: request.authUser!.userId,
        actorRole: request.authUser!.role,
      });
    }

    return reply.send(report);
  });

  app.post<{ Params: { id: string } }>("/applications/:id/sign", async (request, reply) => {
    const parsed = signApplicationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "A signature image is required.", parsed.error.flatten());
    }
    const application = await loadOwnedApplication(request.params.id, request.authUser!.userId);
    if (!["reviewed", "signed"].includes(application.status)) {
      throw new HttpError(
        409,
        "REVIEW_REQUIRED",
        "Complete review successfully before signing.",
      );
    }
    const [snapshot, vacancy] = await Promise.all([
      getSnapshot(application.id),
      getVacancyById(application.vacancyId),
    ]);
    if (!snapshot || !vacancy) throw new HttpError(500, "INTERNAL", "Application is missing its snapshot or vacancy.");
    const report = checkApplicationReadiness(snapshot.snapshotData, vacancy);
    if (!report.complete) {
      throw new HttpError(409, "REVIEW_FAILED", "This application isn't ready to sign yet.", report);
    }

    const base64Data = parsed.data.imageBase64.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const key = `signatures/${application.id}/${randomUUID()}.png`;
    await getStorageProvider().put(key, buffer, "image/png");
    await addSignature({ applicationId: application.id, userId: request.authUser!.userId, imageStorageKey: key });

    await updateApplicationStatus(application.id, "signed");
    await addApplicationEvent({
      applicationId: application.id,
      eventType: "signed",
      actorUserId: request.authUser!.userId,
      actorRole: request.authUser!.role,
    });

    return reply.send({ status: "signed" });
  });

  app.post<{ Params: { id: string } }>("/applications/:id/email-package", async (request, reply) => {
    const application = await loadOwnedApplication(request.params.id, request.authUser!.userId);
    if (!["signed", "email_prepared", "print_prepared"].includes(application.status)) {
      throw new HttpError(409, "SIGN_REQUIRED", "Sign the application before preparing it for email.");
    }
    const [snapshot, vacancy, user] = await Promise.all([
      getSnapshot(application.id),
      getVacancyById(application.vacancyId),
      findUserById(request.authUser!.userId),
    ]);
    if (!snapshot || !vacancy || !user) throw new HttpError(500, "INTERNAL", "Missing application data.");
    if (!vacancy.submissionEmail) {
      throw new HttpError(
        409,
        "NO_EMAIL_INSTRUCTIONS",
        "This vacancy doesn't have an email submission address on file.",
      );
    }

    const signature = await getLatestSignature(application.id);
    const signatureBytes = signature
      ? await getStorageProvider().get(signature.imageStorageKey)
      : null;

    const generatedPdf = await generateApplicationPdf({
      applicantFullName: user.fullName,
      snapshot: snapshot.snapshotData,
      vacancy,
      signaturePngBytes: signatureBytes,
    });
    const generatedKey = `applications/${application.id}/z83-application.pdf`;
    await getStorageProvider().put(generatedKey, Buffer.from(generatedPdf), "application/pdf");

    const attachments: EmailPackage["attachments"] = [
      { label: "Z83 Application", storageKey: generatedKey },
    ];
    for (const doc of snapshot.snapshotData.documents) {
      const fullDoc = await getDocumentById(doc.id);
      if (fullDoc) attachments.push({ label: fullDoc.originalFilename, storageKey: fullDoc.storageKey });
    }

    const emailPackage: EmailPackage = {
      recipient: vacancy.submissionEmail,
      subject: `Application: ${vacancy.jobTitle} (Ref: ${vacancy.referenceNumber})`,
      body:
        `Dear Sir/Madam,\n\nPlease find attached my application for the position of ` +
        `${vacancy.jobTitle} (Reference: ${vacancy.referenceNumber}).\n\n` +
        `Kind regards,\n${user.fullName}`,
      attachments,
    };

    await addGeneratedApplicationDocument({
      applicationId: application.id,
      documentRole: "generated_z83",
      storageKey: generatedKey,
      orderIndex: 0,
    });
    await updateApplicationStatus(application.id, "email_prepared");
    await addApplicationEvent({
      applicationId: application.id,
      eventType: "email_prepared",
      actorUserId: request.authUser!.userId,
      actorRole: request.authUser!.role,
      metadata: { recipient: emailPackage.recipient, subject: emailPackage.subject },
    });

    // Prepared, not sent — see docs/ARCHITECTURE.md#email-preparation-not-sending.
    return reply.send({ emailPackage, sent: false });
  });

  app.post<{ Params: { id: string } }>("/applications/:id/print-package", async (request, reply) => {
    const application = await loadOwnedApplication(request.params.id, request.authUser!.userId);
    if (!["signed", "email_prepared", "print_prepared"].includes(application.status)) {
      throw new HttpError(409, "SIGN_REQUIRED", "Sign the application before preparing it for print.");
    }
    const [snapshot, vacancy, user] = await Promise.all([
      getSnapshot(application.id),
      getVacancyById(application.vacancyId),
      findUserById(request.authUser!.userId),
    ]);
    if (!snapshot || !vacancy || !user) throw new HttpError(500, "INTERNAL", "Missing application data.");

    const signature = await getLatestSignature(application.id);
    const signatureBytes = signature
      ? await getStorageProvider().get(signature.imageStorageKey)
      : null;

    const generatedPdf = await generateApplicationPdf({
      applicantFullName: user.fullName,
      snapshot: snapshot.snapshotData,
      vacancy,
      signaturePngBytes: signatureBytes,
    });
    const generatedKey = `applications/${application.id}/z83-print-package.pdf`;
    await getStorageProvider().put(generatedKey, Buffer.from(generatedPdf), "application/pdf");

    await addGeneratedApplicationDocument({
      applicationId: application.id,
      documentRole: "generated_z83",
      storageKey: generatedKey,
      orderIndex: 0,
    });
    await updateApplicationStatus(application.id, "print_prepared");
    await addApplicationEvent({
      applicationId: application.id,
      eventType: "print_prepared",
      actorUserId: request.authUser!.userId,
      actorRole: request.authUser!.role,
    });

    const url = await getStorageProvider().getSignedUrl(generatedKey, 300);
    return reply.send({ url, expiresInSeconds: 300 });
  });

  app.patch<{ Params: { id: string } }>("/applications/:id/status", async (request, reply) => {
    const parsed = updateApplicationStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid status.", parsed.error.flatten());
    }
    const application = await loadOwnedApplication(request.params.id, request.authUser!.userId);
    const allowed = ALLOWED_STATUS_TRANSITIONS[application.status] ?? [];
    if (!allowed.includes(parsed.data.status)) {
      throw new HttpError(
        409,
        "INVALID_TRANSITION",
        `Can't move from "${application.status}" to "${parsed.data.status}".`,
      );
    }
    const updated = await updateApplicationStatus(application.id, parsed.data.status);
    await addApplicationEvent({
      applicationId: application.id,
      eventType: "status_changed",
      actorUserId: request.authUser!.userId,
      actorRole: request.authUser!.role,
      metadata: { from: application.status, to: parsed.data.status },
    });
    return reply.send({ application: updated });
  });
}
