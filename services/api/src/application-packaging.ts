import type { Application, ApplicationSnapshot, EmailPackage, User, Vacancy } from "@z83/types";
import { addGeneratedApplicationDocument, getLatestSignature } from "./repo/applications.js";
import { getDocumentById } from "./repo/documents.js";
import { generateApplicationPdf } from "./pdf.js";
import { getStorageProvider } from "./storage.js";

/**
 * Builds (and persists) the generated Z83 PDF plus the full attachment
 * list for an application, in the vacancy's own document order. Shared by
 * POST /applications/:id/email-package (preview) and POST
 * /applications/:id/send (real dispatch) so the two never drift apart —
 * what gets shown to the applicant is exactly what gets sent.
 */
export async function buildEmailPackageForApplication(
  application: Application,
  snapshot: ApplicationSnapshot,
  vacancy: Vacancy,
  user: User,
): Promise<EmailPackage> {
  const signature = await getLatestSignature(application.id);
  const signatureBytes = signature ? await getStorageProvider().get(signature.imageStorageKey) : null;

  const generatedPdf = await generateApplicationPdf({
    applicantFullName: user.fullName,
    snapshot: snapshot.snapshotData,
    vacancy,
    signaturePngBytes: signatureBytes,
  });
  const generatedKey = `applications/${application.id}/z83-application.pdf`;
  await getStorageProvider().put(generatedKey, Buffer.from(generatedPdf), "application/pdf");
  await addGeneratedApplicationDocument({
    applicationId: application.id,
    documentRole: "generated_z83",
    storageKey: generatedKey,
    orderIndex: 0,
  });

  const attachments: EmailPackage["attachments"] = [{ label: "Z83 Application", storageKey: generatedKey }];
  for (const doc of snapshot.snapshotData.documents) {
    const fullDoc = await getDocumentById(doc.id);
    if (fullDoc) attachments.push({ label: fullDoc.originalFilename, storageKey: fullDoc.storageKey });
  }

  if (!vacancy.submissionEmail) {
    throw new Error("buildEmailPackageForApplication called for a vacancy with no submission email.");
  }

  return {
    recipient: vacancy.submissionEmail,
    subject: `Application: ${vacancy.jobTitle} (Ref: ${vacancy.referenceNumber})`,
    body:
      `Dear Sir/Madam,\n\nPlease find attached my application for the position of ` +
      `${vacancy.jobTitle} (Reference: ${vacancy.referenceNumber}).\n\n` +
      `Kind regards,\n${user.fullName}`,
    attachments,
  };
}
