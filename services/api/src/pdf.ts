import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ApplicationSnapshotData, Vacancy } from "@z83/types";

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;

/**
 * Fallback path described in docs/ARCHITECTURE.md: until an admin loads the
 * official Z83 AcroForm template for programmatic field-filling, this
 * generates a clearly labelled, structured summary of the same data — not
 * a facsimile of the government form.
 */
export async function generateApplicationPdf(input: {
  applicantFullName: string;
  snapshot: ApplicationSnapshotData;
  vacancy: Pick<Vacancy, "jobTitle" | "referenceNumber" | "departmentName">;
  signaturePngBytes?: Buffer | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < PAGE_MARGIN) newPage();
  };

  const drawHeading = (text: string, size = 13) => {
    ensureSpace(size + 14);
    page.drawText(text, { x: PAGE_MARGIN, y: cursorY, size, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    cursorY -= size + 10;
  };

  const drawLine = (label: string, value: string) => {
    ensureSpace(16);
    page.drawText(label, { x: PAGE_MARGIN, y: cursorY, size: 10, font: boldFont });
    page.drawText(value || "N/A", {
      x: PAGE_MARGIN + 170,
      y: cursorY,
      size: 10,
      font,
      maxWidth: PAGE_WIDTH - PAGE_MARGIN * 2 - 170,
    });
    cursorY -= 16;
  };

  const drawParagraph = (text: string, size = 9) => {
    ensureSpace(size + 6);
    page.drawText(text, { x: PAGE_MARGIN, y: cursorY, size, font, color: rgb(0.35, 0.35, 0.35) });
    cursorY -= size + 6;
  };

  drawHeading("Z83 Application Data", 16);
  drawParagraph(
    "Prepared by Z83 (Naleli Innovations) from the applicant's saved profile. This is a data " +
      "summary of the Z83 application, not a scan of the official government form.",
  );
  cursorY -= 6;

  drawHeading("Vacancy");
  drawLine("Position", input.vacancy.jobTitle);
  drawLine("Department", input.vacancy.departmentName);
  drawLine("Reference number", input.vacancy.referenceNumber);
  cursorY -= 6;

  const p = input.snapshot.profile;
  drawHeading("Part A: Personal particulars");
  drawLine("Full name", input.applicantFullName);
  drawLine("ID number", p.idNumber ?? "");
  drawLine("Passport number", p.passportNumber ?? "");
  drawLine("Date of birth", p.dateOfBirth ?? "");
  drawLine("Gender", p.gender ?? "");
  drawLine("Nationality", p.nationality ?? "");
  drawLine("Race", p.race ?? "");
  drawLine("Disability status", p.disabilityStatus ?? "N/A");
  drawLine(
    "Residential address",
    [p.addressLine1, p.addressLine2, p.city, p.province, p.postalCode].filter(Boolean).join(", "),
  );
  drawLine("Phone", p.phone ?? "");
  drawLine("Email", p.email ?? "");
  drawLine(
    "Driver's licence",
    p.driversLicenceCodes && p.driversLicenceCodes.length > 0
      ? p.driversLicenceCodes.join(", ")
      : "N/A",
  );
  cursorY -= 6;

  drawHeading("Part B: Qualifications");
  if (input.snapshot.qualifications.length === 0) {
    drawParagraph("N/A — no qualifications captured.");
  }
  for (const q of input.snapshot.qualifications) {
    drawLine(
      q.qualificationName,
      `${q.institution}${q.yearCompleted ? `, ${q.yearCompleted}` : ""}${q.stillStudying ? " (in progress)" : ""}`,
    );
  }
  cursorY -= 6;

  drawHeading("Work experience");
  if (input.snapshot.workExperience.length === 0) {
    drawParagraph("N/A — no work experience captured.");
  }
  for (const w of input.snapshot.workExperience) {
    drawLine(
      w.jobTitle,
      `${w.employer}, ${w.startDate} – ${w.isCurrent ? "present" : (w.endDate ?? "N/A")}`,
    );
  }
  cursorY -= 6;

  drawHeading("References");
  if (input.snapshot.references.length === 0) {
    drawParagraph("N/A — no references captured.");
  }
  for (const r of input.snapshot.references) {
    drawLine(r.fullName, [r.organisation, r.phone, r.email].filter(Boolean).join(", "));
  }
  cursorY -= 6;

  drawHeading("Supporting documents attached");
  if (input.snapshot.documents.length === 0) {
    drawParagraph("N/A — no documents attached.");
  }
  for (const d of input.snapshot.documents) {
    drawParagraph(`- ${d.originalFilename} (${d.documentTypeCode})`, 10);
  }
  cursorY -= 10;

  drawHeading("Declaration");
  drawParagraph(
    "I declare that the information provided in this application is true and correct to the " +
      "best of my knowledge.",
  );
  drawLine("Date completed", new Date().toISOString().slice(0, 10));

  if (input.signaturePngBytes) {
    ensureSpace(80);
    const signatureImage = await doc.embedPng(input.signaturePngBytes);
    const dims = signatureImage.scaleToFit(160, 60);
    page.drawText("Signature:", { x: PAGE_MARGIN, y: cursorY, size: 10, font: boldFont });
    page.drawImage(signatureImage, {
      x: PAGE_MARGIN + 90,
      y: cursorY - dims.height + 10,
      width: dims.width,
      height: dims.height,
    });
    cursorY -= 70;
  } else {
    drawLine("Signature", "Not yet signed");
  }

  return doc.save();
}
