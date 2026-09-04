import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  createApplicationSchema,
  signApplicationSchema,
  updateApplicationStatusSchema,
  confirmSendSchema,
  checkApplicationReadiness,
  computeMatch,
} from "@z83/validation";
import type { Application } from "@z83/types";
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
import { listEmailDeliveries, recordEmailDelivery } from "../repo/emailDeliveries.js";
import { getVacancyById, listRequirements } from "../repo/vacancies.js";
import { findUserById } from "../repo/users.js";
import { buildEmailPackageForApplication } from "../application-packaging.js";
import { generateApplicationPdf } from "../pdf.js";
import { buildPrintReadyPackage, type PrintableAttachment } from "../print-package.js";
import { getStorageProvider } from "../storage.js";
import { sendEmail } from "../email.js";
import { getDocumentById } from "../repo/documents.js";

async function loadOwnedApplication(applicationId: string, userId: string): Promise<Application> {
  const application = await getApplicationById(applicationId);
  if (!application || application.userId !== userId) {
    throw new HttpError(404, "NOT_FOUND", "Application not found.");
  }
  return application;
}

// "submitted" is reachable manually only from print_prepared — that's the
// applicant self-reporting a real hand delivery. From email_prepared it
// must never be self-reported this way: only a genuinely dispatched
// /applications/:id/send can move an email-track application to
// submitted, so there's always a matching email_deliveries row and event
// behind that status. See docs/ARCHITECTURE.md#email-preparation-and-sending.
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["closed"],
  reviewed: ["closed"],
  signed: ["closed"],
  email_prepared: ["closed"],
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

  app.get<{ Params: { id: string } }>("/applications/:id/email-deliveries", async (request, reply) => {
    await loadOwnedApplication(request.params.id, request.authUser!.userId);
    const deliveries = await listEmailDeliveries(request.params.id);
    return reply.send({ deliveries });
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

    const emailPackage = await buildEmailPackageForApplication(application, snapshot, vacancy, user);

    await updateApplicationStatus(application.id, "email_prepared");
    await addApplicationEvent({
      applicationId: application.id,
      eventType: "email_prepared",
      actorUserId: request.authUser!.userId,
      actorRole: request.authUser!.role,
      metadata: { recipient: emailPackage.recipient, subject: emailPackage.subject },
    });

    // Prepared, not sent — see docs/ARCHITECTURE.md#email-preparation-and-sending.
    return reply.send({ emailPackage, sent: false });
  });

  app.post<{ Params: { id: string } }>("/applications/:id/send", async (request, reply) => {
    const parsed = confirmSendSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "CONFIRMATION_REQUIRED",
        'Sending requires explicit confirmation: { "confirm": true }.',
      );
    }
    const application = await loadOwnedApplication(request.params.id, request.authUser!.userId);
    if (!["signed", "email_prepared"].includes(application.status)) {
      throw new HttpError(409, "SIGN_REQUIRED", "Sign the application before sending it.");
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

    // Rebuilt fresh at send time rather than reusing a stale preview — the
    // attachment list and PDF must reflect this exact moment, not whatever
    // was true when /email-package last ran.
    const emailPackage = await buildEmailPackageForApplication(application, snapshot, vacancy, user);

    const attachmentBuffers = await Promise.all(
      emailPackage.attachments.map(async (attachment) => ({
        filename: attachment.label,
        content: await getStorageProvider().get(attachment.storageKey),
        contentType: "application/octet-stream",
      })),
    );

    const outcome = await sendEmail({
      recipient: emailPackage.recipient,
      subject: emailPackage.subject,
      body: emailPackage.body,
      attachments: attachmentBuffers,
    });

    const attemptedAt = new Date().toISOString();
    await recordEmailDelivery({
      applicationId: application.id,
      recipient: emailPackage.recipient,
      subject: emailPackage.subject,
      body: emailPackage.body,
      attachments: emailPackage.attachments,
      success: outcome.success,
      errorMessage: outcome.error ?? null,
    });
    await addApplicationEvent({
      applicationId: application.id,
      eventType: outcome.success ? "email_sent" : "email_send_failed",
      actorUserId: request.authUser!.userId,
      actorRole: request.authUser!.role,
      metadata: { recipient: emailPackage.recipient, subject: emailPackage.subject, error: outcome.error },
    });

    if (outcome.success) {
      // A genuinely dispatched email is a real submission — unlike
      // /email-package (preview only), this is the one place allowed to
      // move status to "submitted" on its own.
      await updateApplicationStatus(application.id, "submitted");
    }

    return reply.send({
      success: outcome.success,
      recipient: emailPackage.recipient,
      attemptedAt,
      error: outcome.error,
    });
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

    const z83Pdf = await generateApplicationPdf({
      applicantFullName: user.fullName,
      snapshot: snapshot.snapshotData,
      vacancy,
      signaturePngBytes: signatureBytes,
    });

    const attachments: PrintableAttachment[] = [];
    for (const doc of snapshot.snapshotData.documents) {
      const fullDoc = await getDocumentById(doc.id);
      if (!fullDoc) continue;
      const bytes = await getStorageProvider().get(fullDoc.storageKey);
      attachments.push({
        documentTypeCode: fullDoc.documentTypeCode,
        originalFilename: fullDoc.originalFilename,
        mimeType: fullDoc.mimeType,
        bytes,
      });
    }

    // One combined, print-ready PDF: the Z83 summary followed by every
    // uploaded document (ID, certificates, CV, ...) in submission order —
    // not just a summary that lists their names. See print-package.ts.
    const combinedPdf = await buildPrintReadyPackage(z83Pdf, attachments);
    const generatedKey = `applications/${application.id}/z83-print-package.pdf`;
    await getStorageProvider().put(generatedKey, Buffer.from(combinedPdf), "application/pdf");

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
