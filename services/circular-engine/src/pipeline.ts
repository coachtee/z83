import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractVacancyBlocks } from "./extract.js";
import { normalizeVacancyBlock, type NormalizedVacancyDraft } from "./normalize.js";

export interface CircularProcessingResult {
  pageCount: number;
  vacancies: NormalizedVacancyDraft[];
}

/**
 * Runs the full extraction -> normalization pipeline against a circular
 * PDF's bytes. Used by both the manual-upload admin route and (once
 * enabled) the automatic collector — see docs/CIRCULAR-INGESTION.md.
 *
 * Uses pdfjs-dist directly (rather than a pdf-to-text wrapper) so text
 * extraction stays correct against whatever PDF producer generated a given
 * circular — government-published PDFs come from a wide mix of tools.
 */
export async function processCircularPdf(pdfBytes: Buffer): Promise<CircularProcessingResult> {
  const doc = await getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join("\n");
    pages.push(text);
  }

  const blocks = extractVacancyBlocks(pages);
  const vacancies = blocks.map(normalizeVacancyBlock);

  return { pageCount: pages.length, vacancies };
}
