import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { processCircularPdf } from "../pipeline.js";

async function buildSyntheticCircularPdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  let y = 800;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: 10, font });
    y -= 16;
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

describe("processCircularPdf", () => {
  it("extracts a real, structured vacancy from an actual PDF file, not just plain text", async () => {
    const pdfBytes = await buildSyntheticCircularPdf([
      "DEPARTMENT OF PUBLIC SERVICE AND ADMINISTRATION",
      "POST : Administration Clerk: Registry Services",
      "REF NO : DPSA/01/2026",
      "SALARY : R202 233 - R238 269 per annum",
      "CENTRE : Pretoria, Gauteng",
      "REQUIREMENTS : Grade 12 certificate. At least 3 years relevant experience.",
      "CLOSING DATE : 30 September 2026",
    ]);

    const result = await processCircularPdf(pdfBytes);

    expect(result.pageCount).toBe(1);
    expect(result.vacancies).toHaveLength(1);
    const vacancy = result.vacancies[0]!;
    expect(vacancy.jobTitle).toBe("Administration Clerk: Registry Services");
    expect(vacancy.referenceNumber).toBe("DPSA/01/2026");
    expect(vacancy.province).toBe("Gauteng");
    expect(vacancy.closingAt).toBe("2026-09-30");
    expect(vacancy.requirements.some((r) => r.requirementType === "experience_years")).toBe(true);
  });
});
