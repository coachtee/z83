import { PDFDocument } from "pdf-lib";
import type { DocumentTypeCode } from "@z83/types";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;

/**
 * Print submission order. Not derived from a specific vacancy's free-text
 * instructions (no vacancy in this dataset specifies one) — this is the
 * conventional order South African public-service applications are
 * assembled in: the Z83 itself, then ID, then qualifications, then CV,
 * then everything else. If a vacancy's `specialInstructions` ever states an
 * explicit order, that should override this default — not implemented yet,
 * tracked as follow-up rather than silently ignored.
 */
const DOCUMENT_TYPE_ORDER: Record<DocumentTypeCode, number> = {
  id_document: 1,
  matric_certificate: 2,
  qualification_certificate: 3,
  cv: 4,
  drivers_licence: 5,
  professional_registration: 6,
  other: 7,
  z83_form_template: 99,
};

export interface PrintableAttachment {
  documentTypeCode: DocumentTypeCode;
  originalFilename: string;
  mimeType: string;
  bytes: Buffer;
}

/**
 * Combines the generated Z83 summary with every one of the applicant's own
 * uploaded documents into a single print-ready PDF, in submission order.
 * PDFs are merged page-for-page; images become a full page each. A file
 * type we can't embed (rare — applicants upload PDF/JPEG/PNG almost
 * exclusively) gets a placeholder page saying so, rather than silently
 * vanishing from the package.
 */
export async function buildPrintReadyPackage(
  z83PdfBytes: Uint8Array,
  attachments: PrintableAttachment[],
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  const z83Doc = await PDFDocument.load(z83PdfBytes);
  const z83Pages = await merged.copyPages(z83Doc, z83Doc.getPageIndices());
  for (const page of z83Pages) merged.addPage(page);

  const ordered = [...attachments].sort(
    (a, b) => DOCUMENT_TYPE_ORDER[a.documentTypeCode] - DOCUMENT_TYPE_ORDER[b.documentTypeCode],
  );

  for (const attachment of ordered) {
    await appendAttachment(merged, attachment);
  }

  return merged.save();
}

async function appendAttachment(merged: PDFDocument, attachment: PrintableAttachment): Promise<void> {
  const mime = attachment.mimeType.toLowerCase();
  try {
    if (mime === "application/pdf") {
      const source = await PDFDocument.load(attachment.bytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
      return;
    }
    if (mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg") {
      const image = mime === "image/png" ? await merged.embedPng(attachment.bytes) : await merged.embedJpg(attachment.bytes);
      const page = merged.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const scaled = image.scaleToFit(PAGE_WIDTH - 80, PAGE_HEIGHT - 80);
      page.drawImage(image, {
        x: (PAGE_WIDTH - scaled.width) / 2,
        y: (PAGE_HEIGHT - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
      });
      return;
    }
  } catch {
    // fall through to the placeholder page below — a corrupt or
    // unreadable file should not silently disappear from the package
  }
  addPlaceholderPage(merged, attachment);
}

function addPlaceholderPage(merged: PDFDocument, attachment: PrintableAttachment): void {
  const page = merged.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawText(
    `${attachment.originalFilename} (${attachment.documentTypeCode}) could not be included in this ` +
      `print package automatically — attach the original document (${attachment.mimeType}) separately.`,
    { x: 50, y: PAGE_HEIGHT - 100, size: 11, maxWidth: PAGE_WIDTH - 100 },
  );
}
